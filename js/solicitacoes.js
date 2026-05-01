"use strict";

document.addEventListener("sc:ready", function () {
  const state = {
    page: 1, perPage: 20, total: 0,
    search: "", status: "", urgency: "", dateFrom: "", dateTo: "",
    sortBy: "created_at", sortDir: "desc",
    requests: [],
    selectedItem: null,
    activeId: null,
    pendingAction: null,
  };

  const tbody      = document.getElementById("requests-tbody");
  const emptyState = document.getElementById("empty-state");
  const pagination = document.getElementById("pagination");

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    wireFilters();
    wireNewRequestModal();
    wireReviewModal();
    wireDrawer();
    await Promise.all([loadKPIs(), loadRequests()]);
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  async function loadKPIs() {
    try {
      const d = await SC.api("/requests/stats");
      setEl("kpi-total",     d.total     ?? "—");
      setEl("kpi-pending",   d.pending   ?? "—");
      setEl("kpi-approved",  d.approved  ?? "—");
      setEl("kpi-rejected",  d.rejected  ?? "—");
      setEl("kpi-completed", d.completed ?? "—");
    } catch (_) {}
  }

  // ── Load ──────────────────────────────────────────────────────────────────
  async function loadRequests() {
    showSkeleton();
    const qp = new URLSearchParams({ page: state.page, limit: state.perPage, sort: `${state.sortBy}:${state.sortDir}` });
    if (state.search)   qp.set("search",   state.search);
    if (state.status)   qp.set("status",   state.status);
    if (state.urgency)  qp.set("urgency",  state.urgency);
    if (state.dateFrom) qp.set("dateFrom", state.dateFrom);
    if (state.dateTo)   qp.set("dateTo",   state.dateTo);
    try {
      const data = await SC.api(`/requests?${qp}`);
      state.requests = data.items || data.data || [];
      state.total    = data.total ?? state.requests.length;
      renderTable();
      renderPagination();
    } catch (err) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--color-danger);padding:2rem">${SC.escHtml(err.message)}</td></tr>`;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function renderTable() {
    if (!tbody) return;
    if (!state.requests.length) {
      tbody.innerHTML = "";
      emptyState && (emptyState.style.display = "flex");
      return;
    }
    emptyState && (emptyState.style.display = "none");

    tbody.innerHTML = state.requests.map(r => {
      const item      = r.item || {};
      const requester = r.requester || r.user || {};
      const urgClass  = { low: "urgency-low", medium: "urgency-medium", high: "urgency-high" }[r.urgency] || "urgency-low";
      const urgLabel  = { low: "Baixa", medium: "Média", high: "Alta" }[r.urgency] || r.urgency;
      const isPending = r.status === "PENDING";

      return `<tr data-id="${r.id}" style="cursor:pointer">
        <td style="font-size:13px;color:var(--color-text-muted)">${SC.fmtDateTime(r.createdAt || r.created_at)}</td>
        <td>
          <div style="font-weight:500;font-size:13px">${SC.escHtml(item.name || r.itemName || "—")}</div>
          ${r.justification ? `<div style="font-size:12px;color:var(--color-text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${SC.escHtml(r.justification)}">${SC.escHtml(r.justification)}</div>` : ""}
        </td>
        <td style="text-align:right;font-weight:500">${r.quantity ?? r.qty}</td>
        <td style="font-size:13px">${SC.escHtml(requester.name || requester.email || "—")}</td>
        <td><span class="${urgClass}">${urgLabel}</span></td>
        <td><span class="badge request-status-${(r.status || "").toLowerCase()}">${statusLabel(r.status)}</span></td>
        <td>
          <div class="approval-actions">
            ${isPending ? `
              <button class="btn btn-sm" style="background:#DCFCE7;color:#166534;border:none" data-action="approve" data-id="${r.id}" title="Aprovar">✓</button>
              <button class="btn btn-sm" style="background:#FEE2E2;color:#991B1B;border:none" data-action="reject" data-id="${r.id}" title="Recusar">✗</button>
            ` : ""}
            <button class="btn btn-ghost btn-sm" data-action="detail" data-id="${r.id}" title="Ver detalhes">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
    }).join("");

    tbody.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id     = btn.dataset.id;
        const action = btn.dataset.action;
        if (action === "approve") openReview(id, "approve");
        else if (action === "reject") openReview(id, "reject");
        else openDrawer(id);
      });
    });

    tbody.querySelectorAll("tr[data-id]").forEach(tr => {
      tr.addEventListener("click", () => openDrawer(tr.dataset.id));
    });
  }

  function statusLabel(s) {
    return { PENDING: "Pendente", APPROVED: "Aprovada", REJECTED: "Recusada", COMPLETED: "Concluída", CANCELLED: "Cancelada" }[s] || s;
  }

  function renderPagination() {
    if (!pagination) return;
    pagination.innerHTML = SC.renderPagination({ page: state.page, perPage: state.perPage, total: state.total, onPage: (p) => { state.page = p; loadRequests(); } });
  }

  function showSkeleton() {
    if (!tbody) return;
    tbody.innerHTML = Array(5).fill(`<tr>${Array(7).fill('<td><div class="skeleton" style="height:14px;border-radius:4px"></div></td>').join("")}</tr>`).join("");
    emptyState && (emptyState.style.display = "none");
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  function wireFilters() {
    document.getElementById("search-input")?.addEventListener("input", SC.debounce(() => {
      state.search = document.getElementById("search-input").value.trim();
      state.page = 1; loadRequests();
    }, 350));

    document.getElementById("filter-status")?.addEventListener("change", (e) => { state.status  = e.target.value; state.page = 1; loadRequests(); });
    document.getElementById("filter-urgency")?.addEventListener("change",(e) => { state.urgency = e.target.value; state.page = 1; loadRequests(); });
    document.getElementById("filter-date-from")?.addEventListener("change",(e) => { state.dateFrom = e.target.value; state.page = 1; loadRequests(); });
    document.getElementById("filter-date-to")?.addEventListener("change",  (e) => { state.dateTo   = e.target.value; state.page = 1; loadRequests(); });

    document.querySelectorAll("th[data-sort]").forEach(th => {
      th.style.cursor = "pointer";
      th.addEventListener("click", () => {
        state.sortBy  = state.sortBy === th.dataset.sort ? state.sortBy : th.dataset.sort;
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        state.page = 1; loadRequests();
      });
    });
  }

  // ── New request modal ──────────────────────────────────────────────────────
  function wireNewRequestModal() {
    document.getElementById("btn-new-request")?.addEventListener("click", () => {
      resetNewForm();
      SC.openModal("modal-new-request");
    });

    const searchEl  = document.getElementById("req-item-search");
    const resultsEl = document.getElementById("req-item-results");

    searchEl?.addEventListener("input", SC.debounce(async () => {
      const q = searchEl.value.trim();
      if (!q) { resultsEl.style.display = "none"; return; }
      try {
        const data  = await SC.api(`/items?search=${encodeURIComponent(q)}&limit=8`);
        const items = data.items || data.data || [];
        if (!items.length) { resultsEl.innerHTML = `<div style="padding:10px 12px;font-size:13px;color:var(--color-text-muted)">Nenhum item</div>`; resultsEl.style.display = "block"; return; }
        resultsEl.innerHTML = items.map(it =>
          `<div class="req-item-opt" data-id="${it.id}" data-name="${SC.escHtml(it.name)}" data-stock="${it.quantity ?? it.qty ?? 0}" style="padding:8px 12px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:space-between">
            <span style="font-weight:500">${SC.escHtml(it.name)}</span>
            <span style="color:var(--color-text-muted)">Estoque: ${it.quantity ?? it.qty ?? 0}</span>
          </div>`
        ).join("");
        resultsEl.style.display = "block";
        resultsEl.querySelectorAll(".req-item-opt").forEach(opt => {
          opt.addEventListener("mouseenter", () => opt.style.background = "var(--color-surface-alt)");
          opt.addEventListener("mouseleave", () => opt.style.background = "");
          opt.addEventListener("click", () => {
            state.selectedItem = { id: opt.dataset.id, name: opt.dataset.name, stock: parseInt(opt.dataset.stock) };
            document.getElementById("req-selected-name").textContent  = opt.dataset.name;
            document.getElementById("req-selected-stock").textContent = `Disponível: ${opt.dataset.stock}`;
            const sel = document.getElementById("req-selected-item");
            sel.style.display = "flex";
            searchEl.style.display = "none";
            resultsEl.style.display = "none";
          });
        });
      } catch (_) {}
    }, 300));

    document.getElementById("btn-clear-req-item")?.addEventListener("click", () => {
      state.selectedItem = null;
      document.getElementById("req-selected-item").style.display = "none";
      searchEl.style.display = "block"; searchEl.value = "";
    });

    document.getElementById("btn-save-request")?.addEventListener("click", saveRequest);
  }

  function resetNewForm() {
    state.selectedItem = null;
    const sel = document.getElementById("req-selected-item");
    if (sel) sel.style.display = "none";
    const si = document.getElementById("req-item-search");
    if (si) { si.value = ""; si.style.display = "block"; }
    const ri = document.getElementById("req-item-results");
    if (ri) ri.style.display = "none";
    setVal("req-qty", "1");
    setVal("req-urgency", "medium");
    setVal("req-justification", "");
    setVal("req-needed-by", "");
    const err = document.getElementById("new-req-error");
    if (err) err.style.display = "none";
  }

  async function saveRequest() {
    const err = document.getElementById("new-req-error");
    if (err) err.style.display = "none";

    if (!state.selectedItem) { showFormError(err, "Selecione um item."); return; }
    const qty = parseInt(getVal("req-qty"));
    if (!qty || qty < 1)     { showFormError(err, "Quantidade inválida."); return; }
    const justification = getVal("req-justification").trim();
    if (!justification)      { showFormError(err, "Justificativa é obrigatória."); return; }

    const btn = document.getElementById("btn-save-request");
    btn.disabled = true; btn.classList.add("loading");
    try {
      await SC.api("/requests", { method: "POST", body: JSON.stringify({
        itemId: state.selectedItem.id,
        quantity: qty,
        urgency: getVal("req-urgency"),
        justification,
        neededBy: getVal("req-needed-by") || null,
      }) });
      SC.closeModal("modal-new-request");
      SC.toastSuccess("Solicitação enviada!");
      state.page = 1;
      await Promise.all([loadKPIs(), loadRequests()]);
    } catch (e) {
      showFormError(err, e.message || "Erro ao enviar.");
    } finally {
      btn.disabled = false; btn.classList.remove("loading");
    }
  }

  // ── Review modal ──────────────────────────────────────────────────────────
  function wireReviewModal() {
    document.getElementById("btn-approve")?.addEventListener("click", () => submitReview("approve"));
    document.getElementById("btn-reject")?.addEventListener("click",  () => submitReview("reject"));
  }

  function openReview(id, action) {
    state.activeId     = id;
    state.pendingAction = action;
    const req = state.requests.find(r => String(r.id) === String(id));
    const summary = document.getElementById("review-summary");
    const title   = document.getElementById("review-modal-title");
    if (title) title.textContent = action === "approve" ? "Aprovar Solicitação" : "Recusar Solicitação";
    if (summary && req) {
      const item = req.item || {};
      const user = req.requester || req.user || {};
      summary.innerHTML = `
        <strong>${SC.escHtml(item.name || req.itemName || "—")}</strong> — ${req.quantity ?? req.qty} unidade(s)<br>
        <span style="color:var(--color-text-muted)">Solicitado por: ${SC.escHtml(user.name || user.email || "—")}</span><br>
        ${req.justification ? `<span style="color:var(--color-text-muted);font-style:italic">${SC.escHtml(req.justification)}</span>` : ""}`;
    }
    setVal("review-comment", "");
    SC.openModal("modal-review");
  }

  async function submitReview(action) {
    const comment = getVal("review-comment").trim();
    const btnApprove = document.getElementById("btn-approve");
    const btnReject  = document.getElementById("btn-reject");
    [btnApprove, btnReject].forEach(b => b && (b.disabled = true));
    try {
      await SC.api(`/requests/${state.activeId}/${action}`, { method: "POST", body: JSON.stringify({ comment }) });
      SC.closeModal("modal-review");
      SC.toastSuccess(action === "approve" ? "Solicitação aprovada!" : "Solicitação recusada.");
      await Promise.all([loadKPIs(), loadRequests()]);
    } catch (e) {
      SC.toastError(e.message || "Erro ao processar.");
    } finally {
      [btnApprove, btnReject].forEach(b => b && (b.disabled = false));
    }
  }

  // ── Drawer ────────────────────────────────────────────────────────────────
  function wireDrawer() {
    document.getElementById("drawer-close")?.addEventListener("click", closeDrawer);
    document.getElementById("drawer-overlay")?.addEventListener("click", closeDrawer);
  }

  async function openDrawer(id) {
    state.activeId = id;
    const drawer  = document.getElementById("request-drawer");
    const overlay = document.getElementById("drawer-overlay");
    const body    = document.getElementById("drawer-body");
    drawer?.classList.add("is-open");
    overlay?.classList.add("is-visible");
    if (body) body.innerHTML = `<div class="skeleton" style="height:300px;border-radius:8px"></div>`;
    try {
      const req = await SC.api(`/requests/${id}`);
      if (body) body.innerHTML = buildDrawerContent(req);
      body?.querySelectorAll("[data-action='approve']").forEach(b => b.addEventListener("click", () => { closeDrawer(); openReview(id, "approve"); }));
      body?.querySelectorAll("[data-action='reject']").forEach(b =>  b.addEventListener("click", () => { closeDrawer(); openReview(id, "reject"); }));
    } catch (e) {
      if (body) body.innerHTML = `<p style="color:var(--color-danger)">${SC.escHtml(e.message)}</p>`;
    }
  }

  function buildDrawerContent(r) {
    const item      = r.item || {};
    const requester = r.requester || r.user || {};
    const reviewer  = r.reviewer || {};
    const urgLabel  = { low: "Baixa", medium: "Média", high: "Alta" }[r.urgency] || r.urgency;
    const isPending = r.status === "PENDING";

    return `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px">
        ${SC.conditionBadge ? "" : ""}
        <span class="badge request-status-${(r.status||"").toLowerCase()}" style="font-size:13px">${statusLabel(r.status)}</span>
        <span style="font-size:12px;color:var(--color-text-muted)">#${r.id}</span>
      </div>
      <dl style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;font-size:13px;margin-bottom:20px">
        <div><dt style="color:var(--color-text-muted);margin-bottom:2px">Item</dt><dd style="font-weight:500">${SC.escHtml(item.name || r.itemName || "—")}</dd></div>
        <div><dt style="color:var(--color-text-muted);margin-bottom:2px">Quantidade</dt><dd style="font-weight:600">${r.quantity ?? r.qty}</dd></div>
        <div><dt style="color:var(--color-text-muted);margin-bottom:2px">Urgência</dt><dd class="${{ low:"urgency-low",medium:"urgency-medium",high:"urgency-high" }[r.urgency]}">${urgLabel}</dd></div>
        <div><dt style="color:var(--color-text-muted);margin-bottom:2px">Solicitado em</dt><dd>${SC.fmtDateTime(r.createdAt || r.created_at)}</dd></div>
        <div><dt style="color:var(--color-text-muted);margin-bottom:2px">Solicitante</dt><dd>${SC.escHtml(requester.name || requester.email || "—")}</dd></div>
        ${r.neededBy ? `<div><dt style="color:var(--color-text-muted);margin-bottom:2px">Necessário até</dt><dd>${SC.fmtDate(r.neededBy)}</dd></div>` : ""}
        ${r.justification ? `<div style="grid-column:1/-1"><dt style="color:var(--color-text-muted);margin-bottom:2px">Justificativa</dt><dd style="font-style:italic">${SC.escHtml(r.justification)}</dd></div>` : ""}
        ${reviewer.name ? `<div><dt style="color:var(--color-text-muted);margin-bottom:2px">Revisado por</dt><dd>${SC.escHtml(reviewer.name || reviewer.email)}</dd></div>` : ""}
        ${r.reviewComment ? `<div style="grid-column:1/-1"><dt style="color:var(--color-text-muted);margin-bottom:2px">Comentário da revisão</dt><dd>${SC.escHtml(r.reviewComment)}</dd></div>` : ""}
      </dl>
      ${isPending ? `
        <div style="display:flex;gap:8px;padding-top:16px;border-top:1px solid var(--color-border)">
          <button class="btn btn-danger" style="flex:1" data-action="reject">Recusar</button>
          <button class="btn btn-primary" style="flex:1" data-action="approve">Aprovar</button>
        </div>` : ""}`;
  }

  function closeDrawer() {
    document.getElementById("request-drawer")?.classList.remove("is-open");
    document.getElementById("drawer-overlay")?.classList.remove("is-visible");
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function setEl(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
  function getVal(id)   { return document.getElementById(id)?.value || ""; }
  function setVal(id,v) { const el = document.getElementById(id); if (el) el.value = v; }
  function showFormError(el, msg) { if (el) { el.textContent = msg; el.style.display = "block"; } }

  init();
});
