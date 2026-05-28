"use strict";

function initSolicitacoes() {
  // ── Storage ───────────────────────────────────────────────────────────────
  const KEYS = { ITEMS: "sc_items", REQUESTS: "sc_requests" };
  function dbGet(k) {
    try {
      return JSON.parse(localStorage.getItem(SC.storageKey(k)) || "[]") || [];
    } catch {
      return [];
    }
  }
  function dbSet(k, v) {
    localStorage.setItem(SC.storageKey(k), JSON.stringify(v));
  }

  // ── API helpers ───────────────────────────────────────────────────────────
  function _solToken() {
    return (
      localStorage.getItem("sc_token") || sessionStorage.getItem("sc_token")
    );
  }
  function _solApi(method, url, body) {
    const token = _solToken();
    return fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body != null ? { body: JSON.stringify(body) } : {}),
    }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  }

  function seedRequests() {
    const _sou =
      JSON.parse(
        localStorage.getItem("sc_user") ||
          sessionStorage.getItem("sc_user") ||
          "{}",
      ) || {};
    _solApi(
      "GET",
      `/api/solicitacoes${_sou.organization_id ? `?organization_id=${_sou.organization_id}` : ""}`,
    )
      .then((data) => {
        const reqs = Array.isArray(data) ? data : data.solicitacoes || [];
        const normalized = reqs.map(normalizeRequestRow);
        dbSet(KEYS.REQUESTS, normalized);
        render();
      })
      .catch(() => {
        dbSet(KEYS.REQUESTS, []);
        render();
      });
  }

  // ── State ─────────────────────────────────────────────────────────────────
  const state = {
    page: 1,
    perPage: 25,
    search: "",
    status: "",
    urgency: "",
    dateFrom: "",
    dateTo: "",
    sortBy: "created_at",
    sortDir: "desc",
    filtered: [],
    editId: null,
    detailId: null,
  };

  const $ = (id) => document.getElementById(id);
  const $$ = (s) => document.querySelectorAll(s);

  const reqEmptyAll = $("reqEmptyAll");
  const reqEmptyFiltered = $("reqEmptyFiltered");
  const reqSearch = $("reqSearch");
  const reqFilterStatus = $("reqFilterStatus");
  const reqFilterUrgency = $("reqFilterUrgency");
  const reqDateFrom = $("reqDateFrom");
  const reqDateTo = $("reqDateTo");
  const reqPerPage = $("reqPerPage");
  const reqBody = $("reqBody");

  const kpiTotal = $("kpiTotal");
  const kpiPending = $("kpiPending");
  const kpiApproved = $("kpiApproved");
  const kpiRejected = $("kpiRejected");
  const kpiCompleted = $("kpiCompleted");

  // modal: new/edit
  const reqItemSearch = $("reqItemSearch");
  const reqItemDrop = $("reqItemDrop");
  const reqItemSearchWrap = $("reqItemSearchWrap");
  const reqItemChip = $("reqItemChip");
  const reqChipName = $("reqChipName");
  const reqChipMeta = $("reqChipMeta");
  const btnChangeItem = $("btnChangeItem");
  const reqQty = $("reqQty");
  const reqQtyHint = $("reqQtyHint");
  const reqUrgency = $("reqUrgency");
  const reqJustification = $("reqJustification");
  const reqNeededBy = $("reqNeededBy");
  const btnAddReqItem = $("btnAddReqItem");
  const reqItemsList = $("reqItemsList");
  const btnSaveRequest = $("btnSaveRequest");
  const reqEditId = $("reqEditId");
  const reqFormErr = $("reqFormErr");
  const btnDetailEditRequest = $("btnDetailEditRequest");

  // modal: review
  const reviewSummary = $("reviewSummary");
  const reviewComment = $("reviewComment");
  const modalReviewTitle = $("modalReviewTitle");
  const reviewCommentReq = $("reviewCommentRequired");
  const errReviewComment = $("errReviewComment");
  const btnReviewReject = $("btnReviewReject");
  const btnReviewApprove = $("btnReviewApprove");

  // modal: detail
  const modalDetailBody = $("modalDetailBody");

  // ── Helpers ───────────────────────────────────────────────────────────────
  const esc = SC.escHtml;

  function avatarColor(name) {
    const palette = [
      "#3B82F6",
      "#10B981",
      "#F59E0B",
      "#EF4444",
      "#8B5CF6",
      "#EC4899",
      "#14B8A6",
      "#F97316",
    ];
    let h = 0;
    for (let i = 0; i < (name || "").length; i++)
      h = (h << 5) - h + name.charCodeAt(i);
    return palette[Math.abs(h) % palette.length];
  }

  function initials(name) {
    return (name || "?")
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }

  function animCount(el, target, ms) {
    if (!el) return;
    ms = ms || 650;
    const t0 = performance.now();
    (function tick(now) {
      const p = Math.min((now - t0) / ms, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  function highlight(text, q) {
    if (!q) return esc(text);
    const re = new RegExp(
      "(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")",
      "gi",
    );
    return esc(text).replace(re, "<mark>$1</mark>");
  }

  const URGENCIA_LABEL = {
    urgente: "Urgente",
    alta: "Alta",
    media: "Média",
    baixa: "Baixa",
  };
  const STATUS_LABEL = {
    pendente: "Pendente",
    aprovada: "Aprovada",
    recusada: "Recusada",
    concluida: "Concluída",
    cancelada: "Cancelada",
  };

  function urgBadge(u) {
    return `<span class="urg-badge urg-${u}">${URGENCIA_LABEL[u] || u}</span>`;
  }
  function staBadge(s) {
    return `<span class="sta-badge sta-${s}">${STATUS_LABEL[s] || s}</span>`;
  }

  // SVG icon helpers (15×15)
  const svgCheck = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const svgX = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const svgEye = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const svgEdit = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const svgBan = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`;
  const svgCircleCheck = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
  const svgRefresh = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.07"/></svg>`;
  const svgTrash = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;

  function actionBtns(r) {
    const id = r.id;
    const b = (action, title, color, icon) =>
      `<button class="btn btn-ghost btn-sm act-btn" data-action="${action}" data-id="${id}" title="${title}" style="color:${color};">${icon}</button>`;

    switch (r.status) {
      case "pendente":
        return (
          b("detail", "Ver detalhes", "inherit", svgEye) +
          b("approve", "Aprovar", "#16a34a", svgCheck) +
          b("reject", "Recusar", "#dc2626", svgX) +
          b("edit", "Editar", "inherit", svgEdit) +
          b("cancel", "Cancelar", "#dc2626", svgBan)
        );
      case "aprovada":
        return (
          b("detail", "Ver detalhes", "inherit", svgEye) +
          b("edit", "Editar", "inherit", svgEdit) +
          b("complete", "Concluir", "#2563eb", svgCircleCheck) +
          b("cancel", "Cancelar", "#dc2626", svgBan)
        );
      case "recusada":
        return (
          b("detail", "Ver detalhes", "inherit", svgEye) +
          b("edit", "Editar", "inherit", svgEdit) +
          b("reopen", "Reabrir", "#64748b", svgRefresh) +
          b("delete", "Excluir", "#dc2626", svgTrash)
        );
      case "cancelada":
        return (
          b("detail", "Ver detalhes", "inherit", svgEye) +
          b("edit", "Editar", "inherit", svgEdit) +
          b("reopen", "Reabrir", "#64748b", svgRefresh) +
          b("delete", "Excluir", "#dc2626", svgTrash)
        );
      case "concluida":
        return b("detail", "Ver detalhes", "inherit", svgEye);
      default:
        return b("detail", "Ver detalhes", "inherit", svgEye);
    }
  }

  function currentUserName() {
    try {
      const raw =
        localStorage.getItem("sc_user") || sessionStorage.getItem("sc_user");
      const u = raw ? JSON.parse(raw) : null;
      return (u && u.name) || "Admin";
    } catch {
      return "Admin";
    }
  }

  function currentUser() {
    try {
      const raw =
        localStorage.getItem("sc_user") || sessionStorage.getItem("sc_user");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function requestPayloadFromLocal(req) {
    const user = currentUser();
    return {
      id: req.id,
      organization_id: user.organization_id,
      tipo: req.tipo || null,
      item: req.nome_item || req.patrimonio || req.tipo || "",
      quantidade: req.quantidade || 1,
      solicitante: req.solicitante || currentUserName(),
      email: user.email || null,
      status: req.status || "pendente",
      prioridade: req.urgencia || "media",
      data_solicitacao: req.necessario_ate || null,
      obs: req.justificativa || "",
    };
  }

  // ── Date filtering ────────────────────────────────────────────────────────
  function inDateRange(r) {
    const d = new Date(r.created_at);
    if (state.dateFrom) {
      if (d < new Date(state.dateFrom)) return false;
    }
    if (state.dateTo) {
      const dt = new Date(state.dateTo);
      dt.setHours(23, 59, 59, 999);
      if (d > dt) return false;
    }
    return true;
  }

  // ── Apply filters + sort ──────────────────────────────────────────────────
  function applyFilters() {
    let reqs = dbGet(KEYS.REQUESTS);

    if (state.status) reqs = reqs.filter((r) => r.status === state.status);
    if (state.urgency) reqs = reqs.filter((r) => r.urgencia === state.urgency);
    if (state.dateFrom || state.dateTo) reqs = reqs.filter(inDateRange);

    if (state.search) {
      const q = normalise(state.search);
      reqs = reqs.filter(
        (r) =>
          normalise(r.nome_item || "").includes(q) ||
          normalise(r.patrimonio || "").includes(q) ||
          normalise(r.solicitante || "").includes(q) ||
          normalise(r.setor || "").includes(q),
      );
    }

    reqs.sort((a, b) => {
      let va, vb;
      if (state.sortBy === "created_at") {
        va = new Date(a.created_at).getTime();
        vb = new Date(b.created_at).getTime();
      } else {
        va = normalise(a.nome_item || "");
        vb = normalise(b.nome_item || "");
      }
      if (va < vb) return state.sortDir === "asc" ? -1 : 1;
      if (va > vb) return state.sortDir === "asc" ? 1 : -1;
      return 0;
    });

    state.filtered = reqs;
  }

  function normalise(s) {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  function renderKPIs() {
    const all = dbGet(KEYS.REQUESTS);
    const total = all.length;
    const pending = all.filter((r) => r.status === "pendente").length;
    const approv = all.filter((r) => r.status === "aprovada").length;
    const reject = all.filter((r) => r.status === "recusada").length;
    const done = all.filter((r) => r.status === "concluida").length;

    kpiTotal && animCount(kpiTotal, total, 600);
    kpiPending && animCount(kpiPending, pending, 650);
    kpiApproved && animCount(kpiApproved, approv, 700);
    kpiRejected && animCount(kpiRejected, reject, 720);
    kpiCompleted && animCount(kpiCompleted, done, 750);

    // pulse if there are pending items
    const pendRow = $("reqKpiPending");
    if (pendRow) pendRow.classList.toggle("is-pulsing", pending > 0);
  }

  // ── Table ─────────────────────────────────────────────────────────────────
  function renderTable() {
    const total = state.filtered.length;
    const allReqs = dbGet(KEYS.REQUESTS);
    const perPage =
      parseInt(reqPerPage ? reqPerPage.value : state.perPage) || state.perPage;
    const pages = Math.max(1, Math.ceil(total / perPage));
    if (state.page > pages) state.page = pages;

    // empty states
    const hasAny = allReqs.length > 0;
    const hasFilters = !!(
      state.status ||
      state.urgency ||
      state.search ||
      state.dateFrom ||
      state.dateTo
    );

    if (!reqBody) return;

    if (total === 0) {
      reqBody.innerHTML = "";
      reqPagination && (reqPagination.style.display = "none");
      if (!hasAny) {
        reqEmptyAll && (reqEmptyAll.style.display = "flex");
        reqEmptyFiltered && (reqEmptyFiltered.style.display = "none");
      } else {
        reqEmptyAll && (reqEmptyAll.style.display = "none");
        reqEmptyFiltered && (reqEmptyFiltered.style.display = "flex");
      }
      return;
    }

    reqEmptyAll && (reqEmptyAll.style.display = "none");
    reqEmptyFiltered && (reqEmptyFiltered.style.display = "none");
    reqPagination && (reqPagination.style.display = "flex");

    const q = state.search ? normalise(state.search) : "";
    const slice = state.filtered.slice(
      (state.page - 1) * perPage,
      state.page * perPage,
    );

    reqBody.innerHTML = slice
      .map((r) => {
        const ini = initials(r.solicitante);
        const color = avatarColor(r.solicitante);
        const rowCls = r.urgencia === "urgente" ? "row-urg" : "";
        const dateStr = SC.fmtDateTime(r.created_at);
        const itemLabel =
          r.items && r.items.length > 1
            ? `${esc(r.items[0].nome_item)} +${r.items.length - 1} itens`
            : esc(r.nome_item);
        const totalQty = r.items
          ? r.items.reduce(
              (sum, it) => sum + (parseInt(it.quantidade, 10) || 0),
              0,
            )
          : r.quantidade;

        return `
        <tr class="${rowCls}" data-id="${r.id}" style="cursor:pointer; animation:fadeIn .2s ease-out;">
          <td style="white-space:nowrap; font-size:.8125rem; color:var(--color-text-secondary);">${esc(dateStr)}</td>
          <td>
            <div style="font-weight:500; font-size:.875rem; color:var(--color-text-primary);">${highlight(itemLabel, q)}</div>
            <div style="font-size:.8125rem; color:var(--color-text-muted);">${esc(r.patrimonio || "")}</div>
          </td>
          <td style="text-align:center; font-weight:600; font-size:.875rem;">${totalQty} <span style="font-weight:400; color:var(--color-text-muted); font-size:.75rem;">un.</span></td>
          <td>
            <div style="display:flex; align-items:center; gap:var(--space-2);">
              <div class="req-av" style="background:${color};">${esc(ini)}</div>
              <div>
                <div style="font-size:.875rem; font-weight:500;">${highlight(r.solicitante, q)}</div>
                <div style="font-size:.8125rem; color:var(--color-text-muted);">${esc(r.setor || "")}</div>
              </div>
            </div>
          </td>
          <td>${urgBadge(r.urgencia)}</td>
          <td>${staBadge(r.status)}</td>
          <td class="col-actions" style="white-space:nowrap;">${actionBtns(r)}</td>
        </tr>`;
      })
      .join("");

    // wire row click (open detail) and action buttons
    reqBody.querySelectorAll("tr[data-id]").forEach((tr) => {
      tr.addEventListener("click", (e) => {
        if (e.target.closest("[data-action]")) return;
        openDetail(tr.dataset.id);
      });
    });
    reqBody.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        dispatch(btn.dataset.action, btn.dataset.id);
      });
    });

    // pagination
    SC.renderPagination({
      containerId: "reqPagControls",
      infoId: "reqPagInfo",
      page: state.page,
      perPage,
      total,
      onPageChange: (p) => {
        state.page = p;
        renderTable();
      },
    });
  }

  // ── Main render cycle ─────────────────────────────────────────────────────
  function render() {
    applyFilters();
    renderKPIs();
    renderTable();
  }

  // ── Action dispatcher ─────────────────────────────────────────────────────
  function dispatch(action, id) {
    switch (action) {
      case "approve":
        openReview(id, "approve");
        break;
      case "reject":
        openReview(id, "reject");
        break;
      case "detail":
        openDetail(id);
        break;
      case "edit":
        openEdit(id);
        break;
      case "complete":
        doComplete(id);
        break;
      case "cancel":
        doCancel(id);
        break;
      case "reopen":
        doReopen(id);
        break;
      case "delete":
        doDelete(id);
        break;
    }
  }

  // ── Sort headers ──────────────────────────────────────────────────────────
  function wireSortHeaders() {
    $$("th[data-sort]").forEach((th) => {
      th.style.cursor = "pointer";
      th.addEventListener("click", () => {
        const col = th.dataset.sort;
        state.sortDir =
          state.sortBy === col && state.sortDir === "desc" ? "asc" : "desc";
        state.sortBy = col;
        state.page = 1;
        render();
      });
    });
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  function wireFilters() {
    reqSearch &&
      reqSearch.addEventListener(
        "input",
        SC.debounce(() => {
          state.search = reqSearch.value.trim();
          state.page = 1;
          render();
        }, 300),
      );

    reqFilterStatus &&
      reqFilterStatus.addEventListener("change", () => {
        state.status = reqFilterStatus.value;
        syncKpiActive(state.status);
        state.page = 1;
        render();
      });

    reqFilterUrgency &&
      reqFilterUrgency.addEventListener("change", () => {
        state.urgency = reqFilterUrgency.value;
        state.page = 1;
        render();
      });

    reqDateFrom &&
      reqDateFrom.addEventListener("change", () => {
        state.dateFrom = reqDateFrom.value;
        state.page = 1;
        render();
      });

    reqDateTo &&
      reqDateTo.addEventListener("change", () => {
        state.dateTo = reqDateTo.value;
        state.page = 1;
        render();
      });

    reqPerPage &&
      reqPerPage.addEventListener("change", () => {
        state.perPage = parseInt(reqPerPage.value) || 25;
        state.page = 1;
        render();
      });

    // Clear filters button (empty-filtered state)
    $("btnClearFilters") &&
      $("btnClearFilters").addEventListener("click", clearFilters);
  }

  function clearFilters() {
    state.search =
      state.status =
      state.urgency =
      state.dateFrom =
      state.dateTo =
        "";
    if (reqSearch) reqSearch.value = "";
    if (reqFilterStatus) reqFilterStatus.value = "";
    if (reqFilterUrgency) reqFilterUrgency.value = "";
    if (reqDateFrom) reqDateFrom.value = "";
    if (reqDateTo) reqDateTo.value = "";
    syncKpiActive("");
    state.page = 1;
    render();
  }

  // ── KPI card clicks ───────────────────────────────────────────────────────
  function wireKpiCards() {
    $$(".req-kpi-row[data-kpi]").forEach((row) => {
      row.addEventListener("click", () => {
        const s = row.dataset.kpi;
        state.status = s;
        if (reqFilterStatus) reqFilterStatus.value = s;
        syncKpiActive(s);
        state.page = 1;
        render();
      });
    });
  }

  function syncKpiActive(statusVal) {
    $$(".req-kpi-row[data-kpi]").forEach((row) => {
      row.classList.toggle("is-active", row.dataset.kpi === statusVal);
    });
  }

  // ── New / Edit modal ──────────────────────────────────────────────────────
  function wireNewModal() {
    $("btnNewRequest") &&
      $("btnNewRequest").addEventListener("click", () => openNew());
    $("btnEmptyNew") &&
      $("btnEmptyNew").addEventListener("click", () => openNew());

    reqItemSearch &&
      reqItemSearch.addEventListener(
        "input",
        SC.debounce(() => {
          const q = (reqItemSearch.value || "").trim().toLowerCase();
          if (!q) {
            reqItemDrop && reqItemDrop.classList.remove("is-open");
            return;
          }
          const items = dbGet(KEYS.ITEMS)
            .filter(
              (it) =>
                (it.nome || "").toLowerCase().includes(q) ||
                (it.patrimonio || "").toLowerCase().includes(q),
            )
            .slice(0, 8);
          renderItemDrop(items);
        }, 250),
      );

    btnChangeItem &&
      btnChangeItem.addEventListener("click", () => {
        state.selectedItem = null;
        if (reqItemChip) reqItemChip.style.display = "none";
        if (reqItemSearchWrap) reqItemSearchWrap.style.display = "";
        if (reqItemSearch) {
          reqItemSearch.value = "";
          reqItemSearch.focus();
        }
        if (reqQtyHint) reqQtyHint.textContent = "Disponível: —";
        if (btnAddReqItem) btnAddReqItem.style.display = "none";
      });

    btnAddReqItem &&
      btnAddReqItem.addEventListener("click", addCurrentItemToList);

    reqQty &&
      reqQty.addEventListener("input", () => {
        if ($("errReqQty")) $("errReqQty").style.display = "none";
      });

    btnDetailEditRequest &&
      btnDetailEditRequest.addEventListener("click", () => {
        if (state.detailId) {
          SC.closeModal("modalDetail");
          openEdit(state.detailId);
        }
      });

    btnSaveRequest && btnSaveRequest.addEventListener("click", saveRequest);
  }

  function openNew() {
    state.editId = null;
    state.selectedItem = null;
    state.selectedItems = [];
    resetReqForm();
    if ($("modalReqTitle")) $("modalReqTitle").textContent = "Nova Solicitação";
    if (btnSaveRequest) btnSaveRequest.textContent = "Enviar Solicitação";
    SC.openModal("modalNewRequest");
  }

  function openEdit(id) {
    const reqs = dbGet(KEYS.REQUESTS);
    const r = reqs.find((x) => x.id === id);
    if (!r) return;

    state.editId = id;
    resetReqForm();

    if ($("modalReqTitle"))
      $("modalReqTitle").textContent = "Editar Solicitação";
    if (btnSaveRequest) btnSaveRequest.textContent = "Salvar Alterações";
    if (reqEditId) reqEditId.value = id;

    state.selectedItem = null;
    state.selectedItems =
      r.items && Array.isArray(r.items)
        ? r.items.slice()
        : parseRequestItems(r);
    renderSelectedItems();
    if (reqItemChip) reqItemChip.style.display = "none";
    if (reqItemSearchWrap) reqItemSearchWrap.style.display = "";
    if (btnAddReqItem) btnAddReqItem.style.display = "none";

    if (reqQty) reqQty.value = "1";
    if (reqUrgency) reqUrgency.value = r.urgencia;
    if (reqJustification) reqJustification.value = r.justificativa;
    if (reqNeededBy) reqNeededBy.value = r.necessario_ate || "";

    SC.openModal("modalNewRequest");
  }

  function resetReqForm() {
    state.selectedItem = null;
    state.selectedItems = [];
    if (reqEditId) reqEditId.value = "";
    if (reqItemSearch) reqItemSearch.value = "";
    if (reqItemDrop) {
      reqItemDrop.innerHTML = "";
      reqItemDrop.classList.remove("is-open");
    }
    if (reqItemChip) reqItemChip.style.display = "none";
    if (reqItemSearchWrap) reqItemSearchWrap.style.display = "";
    if (btnAddReqItem) btnAddReqItem.style.display = "none";
    if (reqItemsList) {
      reqItemsList.innerHTML = "";
      reqItemsList.style.display = "none";
    }
    if (reqQty) reqQty.value = "1";
    if (reqQtyHint) reqQtyHint.textContent = "Disponível: —";
    if (reqUrgency) reqUrgency.value = "media";
    if (reqJustification) reqJustification.value = "";
    if (reqNeededBy) reqNeededBy.value = "";
    if (reqFormErr) reqFormErr.style.display = "none";
    ["errReqItem", "errReqQty", "errReqJustification"].forEach((id) => {
      const el = $(id);
      if (el) el.style.display = "none";
    });
  }

  function renderItemDrop(items) {
    if (!reqItemDrop) return;
    reqItemDrop.classList.add("is-open");
    if (!items.length) {
      reqItemDrop.innerHTML = `<div class="req-drop-row"><span style="color:var(--color-text-muted);">Nenhum item encontrado</span></div>`;
      return;
    }
    reqItemDrop.innerHTML = items
      .map(
        (it) => `
      <div class="req-drop-row" data-id="${esc(it.id)}">
        <span style="font-weight:500; color:var(--color-text-primary);">${esc(it.nome)}</span>
        <span style="font-size:.8125rem; color:var(--color-text-muted);">${esc(it.patrimonio || "")} · Disp: ${it.disponivel ?? "?"}</span>
      </div>`,
      )
      .join("");

    reqItemDrop.querySelectorAll(".req-drop-row[data-id]").forEach((row) => {
      row.addEventListener("click", () => {
        const found = items.find(
          (i) => String(i.id) === String(row.dataset.id),
        );
        if (found) selectItem(found);
      });
    });
  }

  function selectItem(item) {
    state.selectedItem = item;
    if (reqChipName) reqChipName.textContent = item.nome;
    if (reqChipMeta)
      reqChipMeta.textContent = `${item.patrimonio || ""} · Disponível: ${item.disponivel ?? "?"}`;
    if (reqQtyHint)
      reqQtyHint.textContent = `Disponível: ${item.disponivel ?? "?"}`;
    if (reqItemChip) reqItemChip.style.display = "flex";
    if (reqItemSearchWrap) reqItemSearchWrap.style.display = "none";
    if (btnAddReqItem) btnAddReqItem.style.display = "inline-flex";
    if (reqItemDrop) {
      reqItemDrop.innerHTML = "";
      reqItemDrop.classList.remove("is-open");
    }
    if ($("errReqItem")) $("errReqItem").style.display = "none";
    renderSelectedItems();
  }

  function parseRequestItems(row) {
    if (Array.isArray(row.items)) return row.items;
    if (typeof row.items === "string") {
      try {
        const parsed = JSON.parse(row.items);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore
      }
    }

    return [
      {
        item_id: row.item_id || null,
        nome_item: row.nome_item || row.item || row.tipo || "–",
        patrimonio: row.patrimonio || "",
        quantidade: row.quantidade != null ? row.quantidade : 1,
        disponivel:
          row.disponivel ??
          row.quantity_available ??
          row.quantity ??
          row.total ??
          0,
      },
    ];
  }

  function summarizeRequestItems(items) {
    const allQty = items.reduce(
      (sum, it) => sum + (parseInt(it.quantidade, 10) || 0),
      0,
    );
    if (items.length === 1) {
      return {
        nome_item: items[0].nome_item,
        patrimonio: items[0].patrimonio || "",
        quantidade: allQty,
      };
    }
    return {
      nome_item: `${items[0].nome_item} +${items.length - 1} itens`,
      patrimonio: items[0].patrimonio
        ? `${items[0].patrimonio} +${items.length - 1}`
        : `+${items.length - 1} itens`,
      quantidade: allQty,
    };
  }

  function normalizeRequestRow(row) {
    const items = parseRequestItems(row);
    const summary = summarizeRequestItems(items);

    return {
      id: row.id,
      item_id: row.item_id || null,
      nome_item: summary.nome_item,
      patrimonio: summary.patrimonio,
      quantidade: summary.quantidade,
      items,
      urgencia: row.urgencia || row.prioridade || "media",
      status: row.status || "pendente",
      solicitante: row.solicitante || row.email || "Usuário",
      setor: row.setor || "",
      justificativa: row.justificativa || row.obs || "",
      necessario_ate: row.necessario_ate || row.data_solicitacao || null,
      created_at: row.created_at || new Date().toISOString(),
      revisao: row.revisao || row.data_revisao || null,
      revisor: row.revisor || null,
    };
  }

  function renderSelectedItems() {
    if (!reqItemsList) return;
    if (!state.selectedItems || !state.selectedItems.length) {
      reqItemsList.innerHTML = "";
      reqItemsList.style.display = "none";
      return;
    }
    reqItemsList.style.display = "flex";
    reqItemsList.innerHTML = state.selectedItems
      .map(
        (item, idx) => `
          <div class="req-selected-item" style="display:flex; align-items:center; justify-content:space-between; gap:var(--space-3); padding:var(--space-2) var(--space-3); background:var(--color-surface-alt); border:1px solid var(--color-border); border-radius:var(--radius-sm);">
            <div style="flex:1; min-width:0;">
              <div style="font-weight:600; color:var(--color-text-primary);">${esc(item.nome_item)}</div>
              <div style="font-size:.8125rem; color:var(--color-text-muted);">${esc(item.patrimonio || "")} · ${item.quantidade} unidade(s) · Disponível: ${item.disponivel ?? "?"}</div>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" data-req-item-remove="${idx}">Remover</button>
          </div>
        `,
      )
      .join("");
    reqItemsList.querySelectorAll("[data-req-item-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.reqItemRemove);
        if (!Number.isNaN(idx) && state.selectedItems[idx]) {
          state.selectedItems.splice(idx, 1);
          renderSelectedItems();
        }
      });
    });
  }

  function addCurrentItemToList() {
    if (!state.selectedItem) {
      if ($("errReqItem")) {
        $("errReqItem").textContent = "Selecione um item.";
        $("errReqItem").style.display = "";
      }
      return;
    }
    const qty = parseInt(reqQty ? reqQty.value : "0", 10) || 0;
    const available =
      state.selectedItem.disponivel ??
      state.selectedItem.quantity_available ??
      state.selectedItem.quantity ??
      state.selectedItem.total ??
      0;
    if (qty < 1 || qty > available) {
      if ($("errReqQty")) {
        $("errReqQty").textContent =
          `Quantidade inválida. Disponível: ${available}`;
        $("errReqQty").style.display = "";
      }
      return;
    }
    const existing = state.selectedItems.find(
      (it) => it.item_id === state.selectedItem.id,
    );
    if (existing) {
      existing.quantidade = Math.min(existing.quantidade + qty, available);
    } else {
      state.selectedItems.push({
        item_id: state.selectedItem.id,
        nome_item: state.selectedItem.nome,
        patrimonio: state.selectedItem.patrimonio || "",
        quantidade: qty,
        disponivel: available,
      });
    }
    if (reqQty) reqQty.value = "1";
    state.selectedItem = null;
    if (reqItemChip) reqItemChip.style.display = "none";
    if (reqItemSearchWrap) reqItemSearchWrap.style.display = "";
    if (reqItemSearch) reqItemSearch.value = "";
    if (btnAddReqItem) btnAddReqItem.style.display = "none";
    renderSelectedItems();
  }

  function saveRequest() {
    let ok = true;
    const showErr = (id, msg) => {
      const el = $(id);
      if (el) {
        el.textContent = msg;
        el.style.display = "";
      }
      ok = false;
    };

    const qty = parseInt(reqQty ? reqQty.value : "0", 10) || 0;
    const just = reqJustification ? reqJustification.value.trim() : "";
    const selectedItems = Array.isArray(state.selectedItems)
      ? state.selectedItems.slice()
      : [];
    const currentItem = state.selectedItem;
    const hasCurrent = !!currentItem;
    const currentAvailable = hasCurrent
      ? (currentItem.disponivel ??
        currentItem.quantity_available ??
        currentItem.quantity ??
        currentItem.total ??
        0)
      : 0;

    if (!hasCurrent && !selectedItems.length) {
      showErr("errReqItem", "Selecione ao menos um item.");
    }
    if (hasCurrent && (!qty || qty < 1 || qty > currentAvailable)) {
      showErr(
        "errReqQty",
        `Quantidade inválida. Disponível: ${currentAvailable}`,
      );
    }
    if (!just) showErr("errReqJustification", "Justificativa é obrigatória.");
    if (!ok) return;

    if (hasCurrent) {
      const existing = selectedItems.find(
        (it) => it.item_id === currentItem.id,
      );
      if (existing) {
        existing.quantidade = Math.min(
          existing.quantidade + qty,
          currentAvailable,
        );
      } else {
        selectedItems.push({
          item_id: currentItem.id,
          nome_item: currentItem.nome,
          patrimonio: currentItem.patrimonio || "",
          quantidade: qty,
          disponivel: currentAvailable,
        });
      }
    }

    if (!selectedItems.length) {
      showErr("errReqItem", "Selecione ao menos um item.");
      return;
    }

    const requestSummary = summarizeRequestItems(selectedItems);
    const reqs = dbGet(KEYS.REQUESTS);
    const user = currentUser();
    const userName = currentUserName();

    if (state.editId) {
      const idx = reqs.findIndex((r) => r.id === state.editId);
      if (idx !== -1) {
        const existing = reqs[idx];
        const updated = {
          ...existing,
          items: selectedItems,
          item_id: selectedItems[0]?.item_id || existing.item_id,
          nome_item: requestSummary.nome_item,
          patrimonio: requestSummary.patrimonio,
          quantidade: requestSummary.quantidade,
          urgencia: reqUrgency
            ? reqUrgency.value
            : existing.urgencia || "media",
          justificativa: just,
          necessario_ate: reqNeededBy
            ? reqNeededBy.value || null
            : existing.necessario_ate || null,
        };

        const requiresReapproval =
          existing.status === "aprovada" || existing.status === "recusada";
        if (requiresReapproval) {
          updated.status = "pendente";
          updated.revisor = null;
          updated.revisao = null;
        }

        reqs[idx] = updated;
        dbSet(KEYS.REQUESTS, reqs);
        if (user.organization_id) {
          _solApi(
            "PUT",
            `/api/solicitacoes/${state.editId}`,
            requestPayloadFromLocal(updated),
          ).catch(() => {});
        }
        SC.closeModal("modalNewRequest");
        SC.toastSuccess(
          requiresReapproval
            ? "Solicitação modificada e retornou para pendente, aguardando nova revisão."
            : "Solicitação atualizada.",
        );
        render();
      }
      return;
    }

    const newReq = {
      id: `req_${Date.now()}`,
      items: selectedItems,
      item_id: selectedItems[0]?.item_id || null,
      nome_item: requestSummary.nome_item,
      patrimonio: requestSummary.patrimonio,
      quantidade: requestSummary.quantidade,
      urgencia: reqUrgency ? reqUrgency.value : "media",
      status: "pendente",
      solicitante: userName,
      setor: "—",
      justificativa: just,
      necessario_ate: reqNeededBy ? reqNeededBy.value || null : null,
      created_at: new Date().toISOString(),
      revisao: null,
      revisor: null,
    };

    reqs.unshift(newReq);
    dbSet(KEYS.REQUESTS, reqs);
    if (user.organization_id) {
      _solApi(
        "POST",
        "/api/solicitacoes",
        requestPayloadFromLocal(newReq),
      ).catch(() => {});
    }
    SC.closeModal("modalNewRequest");
    SC.toastSuccess("Solicitação enviada com sucesso!");
    render();
  }

  // ── Review modal (Approve / Reject) ───────────────────────────────────────
  function wireReviewModal() {
    btnReviewApprove &&
      btnReviewApprove.addEventListener("click", () => submitReview("approve"));
    btnReviewReject &&
      btnReviewReject.addEventListener("click", () => submitReview("reject"));
  }

  function openReview(id, action) {
    state.reviewId = id;
    state.reviewAction = action;

    const reqs = dbGet(KEYS.REQUESTS);
    const r = reqs.find((x) => x.id === id);
    if (!r) return;

    const isApprove = action === "approve";
    if (modalReviewTitle)
      modalReviewTitle.textContent = isApprove
        ? "Aprovar Solicitação"
        : "Recusar Solicitação";
    if (reviewCommentReq)
      reviewCommentReq.style.display = isApprove ? "none" : "";
    if (reviewComment)
      reviewComment.placeholder = isApprove
        ? "Opcional: adicione uma observação…"
        : "Informe o motivo da recusa…";
    if (errReviewComment) errReviewComment.style.display = "none";
    if (reviewComment) reviewComment.value = "";

    if (reviewSummary) {
      reviewSummary.innerHTML = `
        <strong>${esc(r.nome_item)}</strong> &mdash; ${r.quantidade} unidade(s)<br>
        <span style="color:var(--color-text-muted);">Solicitante: ${esc(r.solicitante)} · ${esc(r.setor)}</span><br>
        <span style="color:var(--color-text-muted); font-style:italic;">"${esc(r.justificativa)}"</span>`;
    }

    if (btnReviewApprove)
      btnReviewApprove.style.display = isApprove ? "" : "none";
    if (btnReviewReject)
      btnReviewReject.style.display = isApprove ? "none" : "";

    SC.openModal("modalReview");
  }

  function submitReview(action) {
    const comment = reviewComment ? reviewComment.value.trim() : "";

    if (action === "reject" && !comment) {
      if (errReviewComment) {
        errReviewComment.textContent = "Motivo é obrigatório ao recusar.";
        errReviewComment.style.display = "";
      }
      return;
    }

    const reqs = dbGet(KEYS.REQUESTS);
    const idx = reqs.findIndex((r) => r.id === state.reviewId);
    if (idx === -1) return;

    reqs[idx].status = action === "approve" ? "aprovada" : "recusada";
    reqs[idx].revisao = comment || null;
    reqs[idx].revisor = currentUserName();
    dbSet(KEYS.REQUESTS, reqs);
    _solApi("PATCH", `/api/solicitacoes/${state.reviewId}/revisar`, {
      status: reqs[idx].status,
      revisor: reqs[idx].revisor,
      obs: comment,
    }).catch(() => {});

    SC.closeModal("modalReview");
    SC.toastSuccess(
      action === "approve" ? "Solicitação aprovada!" : "Solicitação recusada.",
    );
    render();
  }

  // ── Confirm dialog (usa modal em vez de confirm() nativo) ────────────────
  const CONFIRM_ICONS = {
    success: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    danger: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
    warning: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  };

  function showConfirm(
    message,
    onConfirm,
    { title = "Confirmar", variant = "warning" } = {},
  ) {
    const el = document.getElementById("modalConfirmarSolMensagem");
    const elTitle = document.getElementById("modalConfirmarSolTitulo");
    const icon = document.getElementById("modalConfirmarSolIcon");
    const btn = document.getElementById("btnConfirmarSolSim");
    if (!el || !btn) {
      if (onConfirm) onConfirm();
      return;
    }
    if (elTitle) elTitle.textContent = title;
    el.textContent = message;
    if (icon) {
      icon.className = `modal-confirm-icon ${variant}`;
      icon.innerHTML = CONFIRM_ICONS[variant] || CONFIRM_ICONS.warning;
    }
    btn.className = `btn ${variant === "success" ? "btn-success" : variant === "danger" ? "btn-danger" : "btn-primary"}`;
    const handler = () => {
      btn.removeEventListener("click", handler);
      SC.closeModal("modalConfirmarSol");
      onConfirm();
    };
    btn.removeEventListener("click", handler);
    btn.addEventListener("click", handler);
    SC.openModal("modalConfirmarSol");
  }

  // ── Quick status changes ──────────────────────────────────────────────────
  function changeStatus(id, newStatus, msg) {
    const reqs = dbGet(KEYS.REQUESTS);
    const idx = reqs.findIndex((r) => r.id === id);
    if (idx === -1) return;
    reqs[idx].status = newStatus;
    if (newStatus === "pendente") {
      reqs[idx].revisao = null;
      reqs[idx].revisor = null;
    }
    dbSet(KEYS.REQUESTS, reqs);
    _solApi("PATCH", `/api/solicitacoes/${id}/status`, {
      status: newStatus,
    }).catch(() => {});
    SC.toastSuccess(msg);
    render();
  }

  function doComplete(id) {
    showConfirm(
      "Marcar esta solicitação como concluída?",
      () => changeStatus(id, "concluida", "Solicitação concluída!"),
      { variant: "success" },
    );
  }
  function doCancel(id) {
    showConfirm(
      "Cancelar esta solicitação?",
      () => changeStatus(id, "cancelada", "Solicitação cancelada."),
      { variant: "warning" },
    );
  }
  function doReopen(id) {
    showConfirm(
      "Reabrir esta solicitação (voltará para Pendente)?",
      () => changeStatus(id, "pendente", "Solicitação reaberta."),
      { variant: "warning" },
    );
  }
  function doDelete(id) {
    showConfirm(
      "Excluir esta solicitação permanentemente? Esta ação não pode ser desfeita.",
      () => {
        _solApi("DELETE", `/api/solicitacoes/${id}`).catch(() => {});
        const reqs = dbGet(KEYS.REQUESTS).filter((r) => r.id !== id);
        dbSet(KEYS.REQUESTS, reqs);
        SC.toastSuccess("Solicitação excluída.");
        render();
      },
      { variant: "danger" },
    );
  }

  // ── Detail modal ──────────────────────────────────────────────────────────
  function openDetail(id) {
    const reqs = dbGet(KEYS.REQUESTS);
    const r = reqs.find((x) => x.id === id);
    if (!r || !modalDetailBody) return;

    const dt = (label, value) => `
      <div>
        <dt style="font-size:.75rem; font-weight:600; text-transform:uppercase; letter-spacing:.04em; color:var(--color-text-muted); margin-bottom:3px;">${label}</dt>
        <dd style="margin:0; font-size:.875rem;">${value}</dd>
      </div>`;

    const color = avatarColor(r.solicitante);
    const ini = initials(r.solicitante);
    const itemDetails =
      r.items && Array.isArray(r.items) && r.items.length > 0
        ? `
        <div style="grid-column:1/-1;">
          <dt style="font-size:.75rem; font-weight:600; text-transform:uppercase; letter-spacing:.04em; color:var(--color-text-muted); margin-bottom:3px;">Itens</dt>
          <dd style="margin:0; font-size:.875rem;">
            <ul style="margin:0; padding-left:1rem; color:var(--color-text-secondary);">
              ${r.items
                .map(
                  (it) => `
                    <li style="margin-bottom:.35rem;">
                      <strong>${esc(it.nome_item)}</strong> ${esc(it.patrimonio || "")} — ${parseInt(it.quantidade, 10) || 0} un.
                    </li>
                  `,
                )
                .join("")}
            </ul>
          </dd>
        </div>
      `
        : "";

    state.detailId = id;
    modalDetailBody.innerHTML = `
      <div style="display:flex; align-items:center; gap:var(--space-3); margin-bottom:var(--space-5);">
        ${staBadge(r.status)}
        ${urgBadge(r.urgencia)}
        <span style="font-size:.8125rem; color:var(--color-text-muted); margin-left:auto;">#${esc(r.id)}</span>
      </div>

      <dl style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-4) var(--space-6); margin-bottom:var(--space-5);">
        ${dt("Item", `<strong>${esc(r.nome_item)}</strong>`)}
        ${dt("Patrimônio", esc(r.patrimonio || "—"))}
        ${dt("Quantidade", `<strong>${r.quantidade} un.</strong>`)}
        ${dt("Data", SC.fmtDateTime(r.created_at))}
        ${dt(
          "Solicitante",
          `<div style="display:flex;align-items:center;gap:var(--space-2);">
            <div class="req-av" style="background:${color};">${esc(ini)}</div>
            <div>
              <div style="font-weight:500;">${esc(r.solicitante)}</div>
              <div style="font-size:.8125rem; color:var(--color-text-muted);">${esc(r.setor || "")}</div>
            </div>
          </div>`,
        )}
        ${r.necessario_ate ? dt("Necessário até", SC.fmtDate(r.necessario_ate)) : ""}
        <div style="grid-column:1/-1;">${dt("Justificativa", `<em style="color:var(--color-text-secondary);">"${esc(r.justificativa)}"</em>`)}</div>
        ${itemDetails}
        ${r.revisor ? dt("Revisado por", esc(r.revisor)) : ""}
        ${r.revisao ? `<div style="grid-column:1/-1;">${dt("Comentário da revisão", `<em style="color:var(--color-text-secondary);">"${esc(r.revisao)}"</em>`)}</div>` : ""}
      </dl>`;

    if (btnDetailEditRequest) {
      btnDetailEditRequest.style.display =
        r.status !== "concluida" ? "inline-flex" : "none";
    }
    SC.openModal("modalDetail");
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  seedRequests();
  wireSortHeaders();
  wireFilters();
  wireKpiCards();
  wireNewModal();
  wireReviewModal();
  render();
}

if (window.SC && window.SC.ready) {
  initSolicitacoes();
} else {
  document.addEventListener("sc:ready", initSolicitacoes);
}
