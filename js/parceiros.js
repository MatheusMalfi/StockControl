"use strict";

document.addEventListener("sc:ready", function () {
  const state = {
    page: 1, perPage: 24, total: 0,
    search: "", type: "", view: "grid",
    partners: [], activeId: null,
  };

  const gridEl   = document.getElementById("partners-grid");
  const tableEl  = document.getElementById("partners-table-wrap");
  const tbody    = document.getElementById("partners-tbody");
  const emptyEl  = document.getElementById("empty-state");
  const pagEl    = document.getElementById("pagination");

  const TYPE_LABEL = { donor: "Doador", recipient: "Recebedor", both: "Ambos" };
  const TYPE_CLASS = { donor: "partner-type-donor", recipient: "partner-type-recipient", both: "partner-type-both" };

  async function init() {
    wireFilters();
    wireModal();
    wireDrawer();
    document.getElementById("empty-add-btn")?.addEventListener("click", openNewModal);
    await Promise.all([loadKPIs(), loadPartners()]);
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  async function loadKPIs() {
    try {
      const d = await SC.api("/partners/stats");
      setEl("kpi-total",      d.total      ?? "—");
      setEl("kpi-donors",     d.donors     ?? "—");
      setEl("kpi-recipients", d.recipients ?? "—");
      setEl("kpi-donated",    d.donated    ?? "—");
    } catch (_) {}
  }

  // ── Load ──────────────────────────────────────────────────────────────────
  async function loadPartners() {
    showSkeleton();
    const qp = new URLSearchParams({ page: state.page, limit: state.perPage });
    if (state.search) qp.set("search", state.search);
    if (state.type)   qp.set("type",   state.type);
    try {
      const data = await SC.api(`/partners?${qp}`);
      state.partners = data.items || data.data || [];
      state.total    = data.total ?? state.partners.length;
      render();
      renderPagination();
    } catch (err) {
      if (gridEl) gridEl.innerHTML = `<p style="color:var(--color-danger)">${SC.escHtml(err.message)}</p>`;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    if (!state.partners.length) {
      gridEl  && (gridEl.innerHTML  = "");
      tableEl && (tableEl.style.display = "none");
      emptyEl && (emptyEl.style.display = "flex");
      return;
    }
    emptyEl && (emptyEl.style.display = "none");
    if (state.view === "grid") renderGrid();
    else renderTable();
  }

  function renderGrid() {
    if (!gridEl) return;
    tableEl && (tableEl.style.display = "none");
    gridEl.style.display = "grid";
    gridEl.innerHTML = state.partners.map(p => `
      <div class="partner-card" data-id="${p.id}">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <div class="partner-avatar">${SC.escHtml((p.name || "?")[0].toUpperCase())}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${SC.escHtml(p.name)}</div>
            <span class="partner-type-badge ${TYPE_CLASS[p.type] || ""}">${TYPE_LABEL[p.type] || p.type}</span>
          </div>
          <button class="btn btn-ghost btn-sm btn-edit" data-id="${p.id}" title="Editar" onclick="event.stopPropagation()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
        ${p.email ? `<div style="font-size:12px;color:var(--color-text-muted);margin-bottom:2px">✉ ${SC.escHtml(p.email)}</div>` : ""}
        ${p.phone ? `<div style="font-size:12px;color:var(--color-text-muted)">☎ ${SC.escHtml(p.phone)}</div>` : ""}
        <div class="partner-stats">
          <div>
            <div class="partner-stat-label">Itens doados</div>
            <div class="partner-stat-value">${p.totalDonated ?? p.total_donated ?? 0}</div>
          </div>
          <div>
            <div class="partner-stat-label">Última interação</div>
            <div class="partner-stat-value" style="font-size:12px">${p.lastInteraction ? SC.fmtDate(p.lastInteraction) : "—"}</div>
          </div>
        </div>
      </div>`).join("");

    gridEl.querySelectorAll(".partner-card").forEach(card => {
      card.addEventListener("click", () => openDrawer(card.dataset.id));
    });
    gridEl.querySelectorAll(".btn-edit").forEach(btn => {
      btn.addEventListener("click", (e) => { e.stopPropagation(); openEditModal(btn.dataset.id); });
    });
  }

  function renderTable() {
    if (!tbody || !tableEl) return;
    gridEl  && (gridEl.style.display = "none");
    tableEl.style.display = "block";
    tbody.innerHTML = state.partners.map(p => `
      <tr data-id="${p.id}" style="cursor:pointer">
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="partner-avatar" style="width:32px;height:32px;font-size:13px">${SC.escHtml((p.name||"?")[0].toUpperCase())}</div>
            <div><div style="font-weight:500;font-size:13px">${SC.escHtml(p.name)}</div>${p.address?`<div style="font-size:11px;color:var(--color-text-muted)">${SC.escHtml(p.address)}</div>`:""}
            </div>
          </div>
        </td>
        <td><span class="partner-type-badge ${TYPE_CLASS[p.type]||""}">${TYPE_LABEL[p.type]||p.type}</span></td>
        <td style="font-size:13px">${p.email?SC.escHtml(p.email):"—"}</td>
        <td style="font-size:13px;font-family:monospace">${p.cnpj?SC.escHtml(p.cnpj):"—"}</td>
        <td style="text-align:right;font-weight:600">${p.totalDonated??0}</td>
        <td style="font-size:12px;color:var(--color-text-muted)">${p.lastInteraction?SC.fmtDate(p.lastInteraction):"—"}</td>
        <td>
          <button class="btn btn-ghost btn-sm btn-edit" data-id="${p.id}" title="Editar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </td>
      </tr>`).join("");

    tbody.querySelectorAll("tr[data-id]").forEach(tr => tr.addEventListener("click", () => openDrawer(tr.dataset.id)));
    tbody.querySelectorAll(".btn-edit").forEach(btn => { btn.addEventListener("click", (e) => { e.stopPropagation(); openEditModal(btn.dataset.id); }); });
  }

  function showSkeleton() {
    emptyEl && (emptyEl.style.display = "none");
    if (state.view === "grid" && gridEl) {
      gridEl.style.display = "grid";
      gridEl.innerHTML = Array(6).fill(`<div class="partner-card"><div class="skeleton" style="height:120px;border-radius:8px"></div></div>`).join("");
    }
  }

  function renderPagination() {
    if (!pagEl) return;
    pagEl.innerHTML = SC.renderPagination({ page: state.page, perPage: state.perPage, total: state.total, onPage: (p) => { state.page = p; loadPartners(); } });
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  function wireFilters() {
    document.getElementById("search-input")?.addEventListener("input", SC.debounce(() => {
      state.search = document.getElementById("search-input").value.trim();
      state.page = 1; loadPartners();
    }, 350));
    document.getElementById("filter-type")?.addEventListener("change", (e) => { state.type = e.target.value; state.page = 1; loadPartners(); });
    document.getElementById("btn-view-grid")?.addEventListener("click",  () => { state.view = "grid";  render(); });
    document.getElementById("btn-view-table")?.addEventListener("click", () => { state.view = "table"; render(); });
  }

  // ── Modal ─────────────────────────────────────────────────────────────────
  function wireModal() {
    document.getElementById("btn-new-partner")?.addEventListener("click", openNewModal);
    document.getElementById("btn-save-partner")?.addEventListener("click", savePartner);
  }

  function openNewModal() {
    clearForm();
    document.getElementById("partner-id").value = "";
    setEl2("partner-modal-title", "Novo Parceiro");
    SC.openModal("modal-partner");
  }

  function openEditModal(id) {
    const p = state.partners.find(x => String(x.id) === String(id));
    if (!p) return;
    state.activeId = id;
    document.getElementById("partner-id").value   = p.id;
    setVal("partner-name",    p.name    || "");
    setVal("partner-type",    p.type    || "donor");
    setVal("partner-cnpj",    p.cnpj    || "");
    setVal("partner-email",   p.email   || "");
    setVal("partner-phone",   p.phone   || "");
    setVal("partner-address", p.address || "");
    setVal("partner-notes",   p.notes   || "");
    setEl2("partner-modal-title", "Editar Parceiro");
    SC.openModal("modal-partner");
  }

  async function savePartner() {
    const name = getVal("partner-name").trim();
    if (!name) { SC.toastError("Nome é obrigatório."); return; }
    const id  = document.getElementById("partner-id").value;
    const btn = document.getElementById("btn-save-partner");
    btn.disabled = true; btn.classList.add("loading");
    const payload = {
      name, type: getVal("partner-type"), cnpj: getVal("partner-cnpj").trim(),
      email: getVal("partner-email").trim(), phone: getVal("partner-phone").trim(),
      address: getVal("partner-address").trim(), notes: getVal("partner-notes").trim(),
    };
    try {
      if (id) {
        await SC.api(`/partners/${id}`, { method: "PUT", body: JSON.stringify(payload) });
        SC.toastSuccess("Parceiro atualizado!");
      } else {
        await SC.api("/partners", { method: "POST", body: JSON.stringify(payload) });
        SC.toastSuccess("Parceiro cadastrado!");
      }
      SC.closeModal("modal-partner");
      state.page = 1;
      await Promise.all([loadKPIs(), loadPartners()]);
    } catch (err) {
      SC.toastError(err.message || "Erro ao salvar.");
    } finally {
      btn.disabled = false; btn.classList.remove("loading");
    }
  }

  function clearForm() {
    ["partner-name","partner-cnpj","partner-email","partner-phone","partner-address","partner-notes"].forEach(id => setVal(id,""));
    setVal("partner-type","donor");
  }

  // ── Drawer ────────────────────────────────────────────────────────────────
  function wireDrawer() {
    document.getElementById("drawer-close")?.addEventListener("click", closeDrawer);
    document.getElementById("drawer-overlay")?.addEventListener("click", closeDrawer);
    document.getElementById("btn-edit-partner")?.addEventListener("click", () => {
      closeDrawer();
      openEditModal(state.activeId);
    });
  }

  async function openDrawer(id) {
    state.activeId = id;
    const drawer  = document.getElementById("partner-drawer");
    const overlay = document.getElementById("drawer-overlay");
    const body    = document.getElementById("drawer-body");
    drawer?.classList.add("is-open");
    overlay?.classList.add("is-visible");
    if (body) body.innerHTML = `<div class="skeleton" style="height:300px;border-radius:8px"></div>`;
    try {
      const p = await SC.api(`/partners/${id}`);
      const history = await SC.api(`/partners/${id}/history?limit=10`).catch(() => ({ items: [] }));
      if (body) body.innerHTML = buildDrawerContent(p, history.items || []);
    } catch (err) {
      if (body) body.innerHTML = `<p style="color:var(--color-danger)">${SC.escHtml(err.message)}</p>`;
    }
  }

  function buildDrawerContent(p, history) {
    return `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <div class="partner-avatar" style="width:56px;height:56px;font-size:22px;border-radius:12px">${SC.escHtml((p.name||"?")[0].toUpperCase())}</div>
        <div>
          <div style="font-size:17px;font-weight:700">${SC.escHtml(p.name)}</div>
          <span class="partner-type-badge ${TYPE_CLASS[p.type]||""}">${TYPE_LABEL[p.type]||p.type}</span>
        </div>
      </div>
      <dl style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;font-size:13px;margin-bottom:20px">
        ${p.cnpj    ? `<div><dt style="color:var(--color-text-muted);margin-bottom:2px">CNPJ/CPF</dt><dd style="font-family:monospace">${SC.escHtml(p.cnpj)}</dd></div>` : ""}
        ${p.email   ? `<div><dt style="color:var(--color-text-muted);margin-bottom:2px">E-mail</dt><dd>${SC.escHtml(p.email)}</dd></div>` : ""}
        ${p.phone   ? `<div><dt style="color:var(--color-text-muted);margin-bottom:2px">Telefone</dt><dd>${SC.escHtml(p.phone)}</dd></div>` : ""}
        ${p.address ? `<div style="grid-column:1/-1"><dt style="color:var(--color-text-muted);margin-bottom:2px">Endereço</dt><dd>${SC.escHtml(p.address)}</dd></div>` : ""}
        <div><dt style="color:var(--color-text-muted);margin-bottom:2px">Total doado</dt><dd style="font-weight:700;font-size:16px">${p.totalDonated??0} itens</dd></div>
        <div><dt style="color:var(--color-text-muted);margin-bottom:2px">Cadastrado em</dt><dd>${SC.fmtDate(p.createdAt||p.created_at)}</dd></div>
        ${p.notes ? `<div style="grid-column:1/-1"><dt style="color:var(--color-text-muted);margin-bottom:2px">Observações</dt><dd style="font-style:italic">${SC.escHtml(p.notes)}</dd></div>` : ""}
      </dl>
      ${history.length ? `
        <div style="border-top:1px solid var(--color-border);padding-top:16px">
          <div style="font-weight:600;font-size:13px;margin-bottom:10px">Histórico de Interações</div>
          <ul class="history-list">
            ${history.map(h => `
              <li class="history-item">
                ${SC.movTypeBadge ? SC.movTypeBadge(h.type) : `<span>${h.type}</span>`}
                <span style="flex:1">${SC.escHtml(h.itemName || "—")}</span>
                <span style="color:var(--color-text-muted)">${h.quantity ?? ""} un.</span>
                <span style="color:var(--color-text-muted)">${SC.fmtDate(h.date || h.created_at)}</span>
              </li>`).join("")}
          </ul>
        </div>` : ""}`;
  }

  function closeDrawer() {
    document.getElementById("partner-drawer")?.classList.remove("is-open");
    document.getElementById("drawer-overlay")?.classList.remove("is-visible");
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function setEl(id,v)   { const el = document.getElementById(id); if (el) el.textContent = v; }
  function setEl2(id,v)  { const el = document.getElementById(id); if (el) el.textContent = v; }
  function getVal(id)    { return document.getElementById(id)?.value || ""; }
  function setVal(id,v)  { const el = document.getElementById(id); if (el) el.value = v; }

  init();
});
