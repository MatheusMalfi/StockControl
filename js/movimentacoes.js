"use strict";

document.addEventListener("sc:ready", function () {
  // ── State ────────────────────────────────────────────────────────────────
  const state = {
    page: 1,
    perPage: 20,
    total: 0,
    period: "30",
    dateFrom: "",
    dateTo: "",
    type: "",
    search: "",
    sortBy: "created_at",
    sortDir: "desc",
    movements: [],
    // new movement modal
    selectedItem: null,
    movType: "ENTRADA",
    // detail modal
    activeMovId: null,
  };

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const tableBody    = document.getElementById("movements-tbody");
  const emptyState   = document.getElementById("empty-state");
  const paginationEl = document.getElementById("pagination");
  const searchInput  = document.getElementById("search-input");
  const typeSelect   = document.getElementById("filter-type");
  const dateFromInput = document.getElementById("date-from");
  const dateToInput   = document.getElementById("date-to");
  const periodTabs    = document.querySelectorAll(".period-tab");

  const kpiTotal     = document.getElementById("kpi-total");
  const kpiEntradas  = document.getElementById("kpi-entradas");
  const kpiSaidas    = document.getElementById("kpi-saidas");
  const kpiDoacoes   = document.getElementById("kpi-doacoes");
  const kpiDescartes = document.getElementById("kpi-descartes");

  // New movement modal refs
  const btnNewMov      = document.getElementById("btn-new-movement");
  const newMovModal    = document.getElementById("modal-new-movement");
  const itemSearchInput = document.getElementById("mov-item-search");
  const itemResults    = document.getElementById("item-search-results");
  const selectedItemEl  = document.getElementById("selected-item");
  const selectedItemName = document.getElementById("selected-item-name");
  const btnClearItem   = document.getElementById("btn-clear-item");
  const movTypeInputs  = document.querySelectorAll('input[name="mov-type"]');
  const qtyInput       = document.getElementById("mov-qty");
  const datetimeInput  = document.getElementById("mov-datetime");
  const notesInput     = document.getElementById("mov-notes");
  const destinationRow = document.getElementById("destination-row");
  const destinationInput = document.getElementById("mov-destination");
  const btnSaveMov     = document.getElementById("btn-save-movement");
  const btnCancelMov   = document.getElementById("btn-cancel-movement");
  const movFormError   = document.getElementById("mov-form-error");

  // Detail modal refs
  const detailModal    = document.getElementById("modal-detail");
  const detailContent  = document.getElementById("detail-content");
  const btnCloseDetail = document.getElementById("btn-close-detail");

  // ── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    setDefaultDatetime();
    wireFilters();
    wireNewMovModal();
    wireDetailModal();
    await Promise.all([loadKPIs(), loadMovements()]);
  }

  function setDefaultDatetime() {
    if (datetimeInput) {
      const now = new Date();
      now.setSeconds(0, 0);
      datetimeInput.value = now.toISOString().slice(0, 16);
    }
  }

  // ── KPIs ─────────────────────────────────────────────────────────────────
  async function loadKPIs() {
    try {
      const data = await SC.api(`/stock-movements/stats?period=${state.period}`);
      if (kpiTotal)     kpiTotal.textContent     = data.total    ?? "—";
      if (kpiEntradas)  kpiEntradas.textContent  = data.entradas ?? "—";
      if (kpiSaidas)    kpiSaidas.textContent     = data.saidas   ?? "—";
      if (kpiDoacoes)   kpiDoacoes.textContent    = data.doacoes  ?? "—";
      if (kpiDescartes) kpiDescartes.textContent  = data.descartes ?? "—";
    } catch (_) { /* non-fatal */ }
  }

  // ── Load movements ────────────────────────────────────────────────────────
  async function loadMovements() {
    showSkeleton();

    const qp = new URLSearchParams({
      page:    state.page,
      limit:   state.perPage,
      sort:    `${state.sortBy}:${state.sortDir}`,
    });
    if (state.search)   qp.set("search", state.search);
    if (state.type)     qp.set("type", state.type);
    if (state.dateFrom) qp.set("dateFrom", state.dateFrom);
    if (state.dateTo)   qp.set("dateTo", state.dateTo);
    if (state.period && !state.dateFrom && !state.dateTo) qp.set("period", state.period);

    try {
      const data = await SC.api(`/stock-movements?${qp}`);
      state.movements = data.items || data.data || [];
      state.total = data.total ?? state.movements.length;
      renderTable();
      renderPagination();
    } catch (err) {
      showError(err.message);
    }
  }

  // ── Render table ─────────────────────────────────────────────────────────
  function renderTable() {
    if (!tableBody) return;
    if (!state.movements.length) {
      tableBody.innerHTML = "";
      emptyState && (emptyState.style.display = "flex");
      return;
    }
    emptyState && (emptyState.style.display = "none");

    tableBody.innerHTML = state.movements.map(m => {
      const item = m.item || {};
      const user = m.user || m.createdBy || {};
      return `
        <tr data-id="${m.id}">
          <td>${SC.fmtDateTime(m.createdAt || m.created_at)}</td>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              ${item.photoUrl ? `<img src="${SC.escHtml(item.photoUrl)}" width="32" height="32" style="border-radius:6px;object-fit:cover" alt="">` : `<div style="width:32px;height:32px;border-radius:6px;background:var(--color-surface-alt)"></div>`}
              <div>
                <div style="font-weight:500">${SC.escHtml(item.name || m.itemName || "—")}</div>
                ${item.assetTag ? `<div class="text-sm text-muted">${SC.escHtml(item.assetTag)}</div>` : ""}
              </div>
            </div>
          </td>
          <td>${SC.movTypeBadge(m.type)}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${m.quantity ?? m.qty ?? "—"}</td>
          <td>${SC.escHtml(m.destination || m.donor || "—")}</td>
          <td>
            <div style="font-size:13px">${SC.escHtml(user.name || user.email || "Sistema")}</div>
          </td>
          <td>
            <button class="btn btn-ghost btn-sm btn-view-detail" data-id="${m.id}" title="Ver detalhes">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </td>
        </tr>`;
    }).join("");

    tableBody.querySelectorAll(".btn-view-detail").forEach(btn => {
      btn.addEventListener("click", () => openDetail(btn.dataset.id));
    });

    tableBody.querySelectorAll("th[data-sort]").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.sort;
        if (state.sortBy === col) {
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
          state.sortBy = col;
          state.sortDir = "asc";
        }
        state.page = 1;
        loadMovements();
      });
    });
  }

  function renderPagination() {
    if (!paginationEl) return;
    paginationEl.innerHTML = SC.renderPagination({
      page: state.page,
      perPage: state.perPage,
      total: state.total,
      onPage: (p) => { state.page = p; loadMovements(); },
    });
  }

  function showSkeleton() {
    if (!tableBody) return;
    tableBody.innerHTML = Array(6).fill(`
      <tr>
        ${Array(7).fill('<td><div class="skeleton" style="height:16px;border-radius:4px"></div></td>').join("")}
      </tr>`).join("");
    emptyState && (emptyState.style.display = "none");
  }

  function showError(msg) {
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--color-danger);padding:2rem">${SC.escHtml(msg || "Erro ao carregar dados.")}</td></tr>`;
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  function wireFilters() {
    searchInput?.addEventListener("input", SC.debounce(() => {
      state.search = searchInput.value.trim();
      state.page = 1;
      loadMovements();
    }, 350));

    typeSelect?.addEventListener("change", () => {
      state.type = typeSelect.value;
      state.page = 1;
      loadMovements();
    });

    dateFromInput?.addEventListener("change", () => {
      state.dateFrom = dateFromInput.value;
      state.period = "";
      deactivatePeriodTabs();
      state.page = 1;
      loadMovements();
    });

    dateToInput?.addEventListener("change", () => {
      state.dateTo = dateToInput.value;
      state.period = "";
      deactivatePeriodTabs();
      state.page = 1;
      loadMovements();
    });

    periodTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        state.period = tab.dataset.period;
        state.dateFrom = "";
        state.dateTo = "";
        if (dateFromInput) dateFromInput.value = "";
        if (dateToInput)   dateToInput.value   = "";
        periodTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        state.page = 1;
        loadMovements();
        loadKPIs();
      });
    });

    document.querySelectorAll("th[data-sort]").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.sort;
        if (state.sortBy === col) {
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
          state.sortBy = col;
          state.sortDir = "asc";
        }
        state.page = 1;
        loadMovements();
      });
    });
  }

  function deactivatePeriodTabs() {
    periodTabs.forEach(t => t.classList.remove("active"));
  }

  // ── New movement modal ────────────────────────────────────────────────────
  function wireNewMovModal() {
    btnNewMov?.addEventListener("click", () => {
      resetMovForm();
      SC.openModal("modal-new-movement");
    });

    btnCancelMov?.addEventListener("click", () => SC.closeModal("modal-new-movement"));

    // Item search
    itemSearchInput && itemSearchInput.addEventListener("input", SC.debounce(async () => {
      const q = itemSearchInput.value.trim();
      if (!q) { itemResults && (itemResults.innerHTML = ""); return; }
      try {
        const data = await SC.api(`/items?search=${encodeURIComponent(q)}&limit=8`);
        const items = data.items || data.data || [];
        renderItemResults(items);
      } catch (_) {}
    }, 300));

    // Movement type
    movTypeInputs.forEach(r => {
      r.addEventListener("change", () => {
        state.movType = r.value;
        updateDestinationRow();
      });
    });

    // Clear selected item
    btnClearItem?.addEventListener("click", () => {
      state.selectedItem = null;
      if (selectedItemEl) selectedItemEl.style.display = "none";
      if (itemSearchInput) { itemSearchInput.value = ""; itemSearchInput.style.display = "block"; }
    });

    // Save
    btnSaveMov?.addEventListener("click", saveMovement);
  }

  function renderItemResults(items) {
    if (!itemResults) return;
    if (!items.length) {
      itemResults.innerHTML = `<div style="padding:10px 12px;color:var(--color-text-muted);font-size:13px">Nenhum item encontrado</div>`;
      return;
    }
    itemResults.innerHTML = items.map(item => `
      <div class="item-result" data-id="${item.id}" style="display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;hover:background:var(--color-surface-alt)">
        ${item.photoUrl ? `<img src="${SC.escHtml(item.photoUrl)}" width="28" height="28" style="border-radius:4px;object-fit:cover" alt="">` : `<div style="width:28px;height:28px;border-radius:4px;background:var(--color-surface-alt)"></div>`}
        <div>
          <div style="font-size:13px;font-weight:500">${SC.escHtml(item.name)}</div>
          ${item.assetTag ? `<div style="font-size:11px;color:var(--color-text-muted)">${SC.escHtml(item.assetTag)}</div>` : ""}
        </div>
        <span style="margin-left:auto;font-size:12px;color:var(--color-text-muted)">Qtd: ${item.quantity ?? item.qty ?? "—"}</span>
      </div>`).join("");

    itemResults.querySelectorAll(".item-result").forEach(el => {
      el.addEventListener("mouseenter", () => el.style.background = "var(--color-surface-alt)");
      el.addEventListener("mouseleave", () => el.style.background = "");
      el.addEventListener("click", () => {
        const id = el.dataset.id;
        const found = items.find(i => String(i.id) === id);
        if (found) selectItem(found);
      });
    });
  }

  function selectItem(item) {
    state.selectedItem = item;
    if (selectedItemName) selectedItemName.textContent = item.name;
    if (selectedItemEl) selectedItemEl.style.display = "flex";
    if (itemSearchInput) { itemSearchInput.value = ""; itemSearchInput.style.display = "none"; }
    if (itemResults) itemResults.innerHTML = "";
  }

  function updateDestinationRow() {
    if (!destinationRow) return;
    const show = ["DOACAO", "TRANSFERENCIA"].includes(state.movType);
    destinationRow.style.display = show ? "block" : "none";
    if (destinationInput) {
      destinationInput.placeholder = state.movType === "DOACAO" ? "Nome do donatário ou organização" : "Destino da transferência";
    }
  }

  function resetMovForm() {
    state.selectedItem = null;
    state.movType = "ENTRADA";
    if (itemSearchInput) { itemSearchInput.value = ""; itemSearchInput.style.display = "block"; }
    if (itemResults) itemResults.innerHTML = "";
    if (selectedItemEl) selectedItemEl.style.display = "none";
    movTypeInputs.forEach(r => { r.checked = r.value === "ENTRADA"; });
    if (qtyInput) qtyInput.value = "1";
    setDefaultDatetime();
    if (notesInput) notesInput.value = "";
    if (destinationInput) destinationInput.value = "";
    updateDestinationRow();
    if (movFormError) movFormError.style.display = "none";
  }

  async function saveMovement() {
    if (movFormError) movFormError.style.display = "none";

    if (!state.selectedItem) {
      showMovError("Selecione um item.");
      return;
    }
    const qty = parseInt(qtyInput?.value);
    if (!qty || qty < 1) {
      showMovError("Quantidade deve ser maior que zero.");
      return;
    }

    const movType = [...movTypeInputs].find(r => r.checked)?.value || "ENTRADA";

    btnSaveMov && (btnSaveMov.disabled = true);
    try {
      await SC.api("/stock-movements", {
        method: "POST",
        body: JSON.stringify({
          itemId:      state.selectedItem.id,
          type:        movType,
          quantity:    qty,
          movedAt:     datetimeInput?.value || new Date().toISOString(),
          destination: destinationInput?.value.trim() || null,
          notes:       notesInput?.value.trim() || null,
        }),
      });
      SC.closeModal("modal-new-movement");
      SC.toastSuccess("Movimentação registrada!");
      state.page = 1;
      await Promise.all([loadKPIs(), loadMovements()]);
    } catch (err) {
      showMovError(err.message || "Erro ao salvar movimentação.");
    } finally {
      btnSaveMov && (btnSaveMov.disabled = false);
    }
  }

  function showMovError(msg) {
    if (movFormError) {
      movFormError.textContent = msg;
      movFormError.style.display = "block";
    }
  }

  // ── Detail modal ──────────────────────────────────────────────────────────
  function wireDetailModal() {
    btnCloseDetail?.addEventListener("click", () => SC.closeModal("modal-detail"));
  }

  async function openDetail(id) {
    state.activeMovId = id;
    SC.openModal("modal-detail");
    if (detailContent) detailContent.innerHTML = `<div class="skeleton" style="height:200px;border-radius:8px"></div>`;

    try {
      const m = await SC.api(`/stock-movements/${id}`);
      renderDetail(m);
    } catch (err) {
      if (detailContent) detailContent.innerHTML = `<p style="color:var(--color-danger)">${SC.escHtml(err.message)}</p>`;
    }
  }

  function renderDetail(m) {
    if (!detailContent) return;
    const item = m.item || {};
    const user = m.user || m.createdBy || {};
    detailContent.innerHTML = `
      <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:16px">
        ${item.photoUrl ? `<img src="${SC.escHtml(item.photoUrl)}" width="60" height="60" style="border-radius:8px;object-fit:cover" alt="">` : ""}
        <div>
          <div style="font-weight:600;font-size:15px">${SC.escHtml(item.name || m.itemName || "—")}</div>
          ${item.assetTag ? `<div style="color:var(--color-text-muted);font-size:13px">${SC.escHtml(item.assetTag)}</div>` : ""}
        </div>
        <div style="margin-left:auto">${SC.movTypeBadge(m.type)}</div>
      </div>
      <dl style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:13px">
        <div><dt style="color:var(--color-text-muted);margin-bottom:2px">Quantidade</dt><dd style="font-weight:500">${m.quantity ?? m.qty}</dd></div>
        <div><dt style="color:var(--color-text-muted);margin-bottom:2px">Data/Hora</dt><dd>${SC.fmtDateTime(m.movedAt || m.created_at || m.createdAt)}</dd></div>
        ${m.destination ? `<div><dt style="color:var(--color-text-muted);margin-bottom:2px">Destino / Donatário</dt><dd>${SC.escHtml(m.destination)}</dd></div>` : ""}
        <div><dt style="color:var(--color-text-muted);margin-bottom:2px">Registrado por</dt><dd>${SC.escHtml(user.name || user.email || "Sistema")}</dd></div>
        ${m.notes ? `<div style="grid-column:1/-1"><dt style="color:var(--color-text-muted);margin-bottom:2px">Observações</dt><dd>${SC.escHtml(m.notes)}</dd></div>` : ""}
      </dl>`;
  }

  init();
});
