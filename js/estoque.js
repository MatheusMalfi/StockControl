/**
 * estoque.js — StockControl
 * Handles all data fetching and interaction for estoque.html.
 *
 * Features:
 *  - Table and grid views with pagination
 *  - Live search + condition + category filters
 *  - Row selection + bulk actions (move, discard)
 *  - Detail drawer (view item)
 *  - Discard confirmation modal
 *  - Deep-link: ?item=ID opens drawer, ?q=text pre-fills search, ?condition=X pre-selects filter
 */

(() => {
  "use strict";

  function onReady(fn) {
    if (window.SC && SC.ready) fn();
    else document.addEventListener("sc:ready", fn, { once: true });
  }

  /* ============================================================
     STATE
     ============================================================ */
  const state = {
    view: "table", // "table" | "grid"
    page: 1,
    perPage: 20,
    total: 0,
    search: "",
    condition: "ALL",
    categoryId: "",
    sortBy: "product_name",
    sortDir: "asc",
    items: [],
    selected: new Set(),
    activeItemId: null,
    discardItemId: null,
  };

  /* Current session user — populated in init() */
  let _sessionUser = {};
  let _orgId = "";

  onReady(init);

  /* ============================================================
     INIT
     ============================================================ */
  async function init() {
    /* Resolve org context from session */
    try {
      // Prefer in-memory `SC.currentUser`. If not present, try fetching /users/me
      if (SC.currentUser) {
        _sessionUser = SC.currentUser;
      } else {
        try {
          const data = await SC.api("/users/me");
          _sessionUser = (data && (data.user || data)) ||
            JSON.parse(
              localStorage.getItem("sc_user") ||
                sessionStorage.getItem("sc_user") ||
                "null",
            ) || {};
          if (_sessionUser) {
            // cache in SC.currentUser for consistency
            SC.currentUser = _sessionUser;
          }
        } catch {
          // fallback to stored value if API fails
          _sessionUser = JSON.parse(
            localStorage.getItem("sc_user") ||
              sessionStorage.getItem("sc_user") ||
              "null",
          ) || {};
        }
      }
    } catch {
      _sessionUser = {};
    }
    _orgId = _sessionUser.organization_id || "";

    readURLParams();
    await loadCategories();
    wireFilters();
    wireViewToggle();
    wireSelectAll();
    wireBulkActions();
    wireDrawer();
    wireDiscardModal();
    await loadItems();

    /* Deep-link: open drawer for specific item */
    if (state.activeItemId) openDrawer(state.activeItemId);
  }

  /* ============================================================
     READ URL PARAMS
     ============================================================ */
  function readURLParams() {
    const p = SC.urlParams();
    if (p.q) state.search = p.q;
    if (p.condition) state.condition = p.condition;
    if (p.item) state.activeItemId = p.item;

    /* Pre-fill search input */
    const si = document.getElementById("searchInput");
    if (si && state.search) si.value = state.search;

    /* Pre-select condition chip */
    if (state.condition) {
      document.querySelectorAll(".filter-chip[data-condition]").forEach((c) => {
        c.classList.toggle("active", c.dataset.condition === state.condition);
      });
    }
  }

  /* ============================================================
     LOAD CATEGORIES (populate select)
     ============================================================ */
  async function loadCategories() {
    const sel = document.getElementById("categoryFilter");
    if (!sel) return;
    try {
      const data = await SC.api("/categories");
      const cats = Array.isArray(data) ? data : data.categories || [];
      cats.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        sel.appendChild(opt);
      });
    } catch {
      /* non-critical */
    }
  }

  /* ============================================================
     LOAD ITEMS
     ============================================================ */
  async function loadItems() {
    showSkeleton();

    const paramsObj = {
      organization_id: _orgId,
      page: state.page,
      limit: state.perPage,
      sort: `${state.sortBy}:${state.sortDir}`,
    };
    if (state.search) paramsObj.search = state.search;
    // Só envia o parâmetro condition se não for 'ALL'
    if (state.condition && state.condition !== "ALL")
      paramsObj.condition = state.condition;
    if (state.categoryId) paramsObj.category = state.categoryId;
    const params = new URLSearchParams(paramsObj);

    try {
      const data = await SC.api(`/items?${params}`);
      state.items = Array.isArray(data) ? data : data.items || data.data || [];
      state.total = data.total || data.count || state.items.length;

      updateSubtitle();
      renderItems();
      renderPagination();
    } catch (err) {
      showError(err.message || "Erro ao carregar itens.");
    }
  }

  /* ============================================================
     RENDER — TABLE VIEW
     ============================================================ */
  function renderTableView() {
    const tbody = document.getElementById("stockBody");
    if (!tbody) return;

    if (!state.items.length) {
      showEmpty();
      return;
    }

    hideEmpty();
    tbody.innerHTML = state.items
      .map((item) => {
        // Só mostra o botão Descartar se a condição for OTIMO ou REPARO
        const showDiscard =
          item.condition_code === "OTIMO" || item.condition_code === "REPARO";
        return `
      <tr data-id="${item.id}" class="${state.selected.has(item.id) ? "selected" : ""}">
        <td class="col-check">
          <input type="checkbox" class="row-check" data-id="${item.id}"
            ${state.selected.has(item.id) ? "checked" : ""}
            aria-label="Selecionar ${SC.escHtml(item.product_name)}" />
        </td>
        <td>
          <div class="table-item-info">
            ${
              item.photo_url
                ? `<img class="table-item-thumb" src="${SC.escHtml(item.photo_url)}" alt="" loading="lazy" />`
                : `<div class="table-item-thumb-placeholder">
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                     <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                     <polyline points="21 15 16 10 5 21"/>
                   </svg>
                 </div>`
            }
            <div>
              <div class="table-item-name">${SC.escHtml(item.product_name)}</div>
              ${
                item.description
                  ? `<div class="table-item-meta" style="max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${SC.escHtml(item.description)}</div>`
                  : ""
              }
            </div>
          </div>
        </td>
        <td style="text-align:center; font-weight:600;">${SC.escHtml(item.category_name || "—")}</td>
        <td style="text-align:center; font-weight:600;">${SC.conditionBadge(item.condition_code)}</td>
        <td style="text-align:center; font-weight:600;">${item.quantity_available ?? item.quantity ?? "—"}</td>
        <td style="text-align:center; font-weight:600; color:var(--color-text-primary);">${item.quantity ?? "—"}</td>
        <td style="text-align:center; font-weight:600; color:var(--color-text-primary);">${SC.escHtml(item.asset_tag || item.serial_number || "—")}</td>
        
        <td class="col-actions">
          <div class="table-actions" style="display: flex; gap: 2px; align-items: center; justify-content: flex-end;">
            <button class="btn btn-ghost btn-icon btn-sm btn-view" data-id="${item.id}" data-tooltip="Ver detalhes" aria-label="Ver detalhes">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <a href="form-item.html?id=${item.id}" class="btn btn-ghost btn-icon btn-sm" data-tooltip="Editar" aria-label="Editar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </a>
            ${
              showDiscard
                ? `
            <button class="btn btn-ghost btn-icon btn-sm btn-discard-row" data-id="${item.id}" data-name="${SC.escHtml(item.product_name)}" data-tooltip="Descartar" aria-label="Descartar" style="color:var(--color-danger);">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
              </svg>
            </button>
            `
                : ""
            }
          </div>
        </td>
      </tr>`;
      })
      .join("");

    /* Wire row events */
    tbody
      .querySelectorAll(".btn-view")
      .forEach((btn) =>
        btn.addEventListener("click", () => openDrawer(btn.dataset.id)),
      );

    tbody
      .querySelectorAll(".row-check")
      .forEach((chk) =>
        chk.addEventListener("change", () =>
          toggleSelect(chk.dataset.id, chk.checked),
        ),
      );

    tbody
      .querySelectorAll(".btn-discard-row")
      .forEach((btn) =>
        btn.addEventListener("click", () =>
          openDiscardModal(btn.dataset.id, btn.dataset.name),
        ),
      );

    updateSelectAll();
  }

  /* ============================================================
     RENDER — GRID VIEW
     ============================================================ */
  function renderGridView() {
    const grid = document.getElementById("stockGrid");
    if (!grid) return;

    if (!state.items.length) {
      showEmpty();
      return;
    }
    hideEmpty();

    grid.innerHTML = state.items
      .map(
        (item) => `
      <div class="item-card" data-id="${item.id}" tabindex="0" role="button" aria-label="${SC.escHtml(item.product_name)}">
        <div class="item-card-img">
          ${
            item.photo_url
              ? `<img src="${SC.escHtml(item.photo_url)}" alt="" style="width:100%;height:100%;object-fit:cover;" loading="lazy"/>`
              : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                 <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                 <polyline points="21 15 16 10 5 21"/>
               </svg>`
          }
        </div>
        <div class="item-card-body">
          <div class="item-card-name" title="${SC.escHtml(item.product_name)}">${SC.escHtml(item.product_name)}</div>
          <div class="item-card-meta">${SC.escHtml(item.category_name || "—")}</div>
          <div class="item-card-footer">
            ${SC.conditionBadge(item.condition_code)}
            <span class="item-card-qty">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline;margin-right:2px;">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
              </svg>
              ${item.quantity_available ?? item.quantity ?? "—"}
            </span>
          </div>
        </div>
      </div>`,
      )
      .join("");

    grid.querySelectorAll(".item-card").forEach((card) => {
      const open = () => openDrawer(card.dataset.id);
      card.addEventListener("click", open);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });
  }

  /* ============================================================
     RENDER DISPATCHER
     ============================================================ */
  function renderItems() {
    const tableView = document.getElementById("tableView");
    const gridView = document.getElementById("gridView");

    if (state.view === "grid") {
      if (tableView) tableView.style.display = "none";
      if (gridView) gridView.style.display = "block";
      renderGridView();
    } else {
      if (tableView) tableView.style.display = "block";
      if (gridView) gridView.style.display = "none";
      renderTableView();
    }
  }

  /* ============================================================
     PAGINATION
     ============================================================ */
  function renderPagination() {
    const isGrid = state.view === "grid";
    const pagEl = document.getElementById(
      isGrid ? "gridPagination" : "tablePagination",
    );
    const infoId = isGrid ? "gridPaginationInfo" : "paginationInfo";
    const controlsId = isGrid ? "gridPaginationControls" : "paginationControls";

    if (!pagEl) return;
    pagEl.style.display = state.total > state.perPage ? "flex" : "none";

    SC.renderPagination({
      containerId: controlsId,
      infoId,
      page: state.page,
      perPage: state.perPage,
      total: state.total,
      onPageChange: (p) => {
        state.page = p;
        loadItems();
      },
    });
  }

  /* ============================================================
     FILTERS
     ============================================================ */
  function wireFilters() {
    /* Search */
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener(
        "input",
        SC.debounce(() => {
          state.search = searchInput.value.trim();
          state.page = 1;
          loadItems();
        }, 350),
      );
    }

    /* Condition chips */
    document
      .querySelectorAll(".filter-chip[data-condition]")
      .forEach((chip) => {
        chip.addEventListener("click", () => {
          document
            .querySelectorAll(".filter-chip[data-condition]")
            .forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");
          state.condition = chip.dataset.condition;
          state.page = 1;
          loadItems();
        });
      });

    /* Category select */
    const catSel = document.getElementById("categoryFilter");
    if (catSel) {
      catSel.addEventListener("change", () => {
        state.categoryId = catSel.value;
        state.page = 1;
        loadItems();
      });
    }

    /* Per-page select */
    const perPage = document.getElementById("perPageSelect");
    if (perPage) {
      perPage.addEventListener("change", () => {
        state.perPage = Number(perPage.value);
        state.page = 1;
        loadItems();
      });
    }

    /* Sort (click on th[data-sort]) */
    document.addEventListener("click", (e) => {
      const th = e.target.closest("th[data-sort]");
      if (!th) return;
      const col = th.dataset.sort;
      if (state.sortBy === col) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortBy = col;
        state.sortDir = "asc";
      }
      state.page = 1;
      loadItems();
    });
  }

  /* ============================================================
     VIEW TOGGLE
     ============================================================ */
  function wireViewToggle() {
    const btnTable = document.getElementById("viewTable");
    const btnGrid = document.getElementById("viewGrid");

    btnTable &&
      btnTable.addEventListener("click", () => {
        if (state.view === "table") return;
        state.view = "table";
        btnTable.classList.add("active");
        btnGrid && btnGrid.classList.remove("active");
        renderItems();
        renderPagination();
      });

    btnGrid &&
      btnGrid.addEventListener("click", () => {
        if (state.view === "grid") return;
        state.view = "grid";
        btnGrid.classList.add("active");
        btnTable && btnTable.classList.remove("active");
        renderItems();
        renderPagination();
      });
  }

  /* ============================================================
     SELECTION
     ============================================================ */
  function toggleSelect(id, checked) {
    if (checked) state.selected.add(id);
    else state.selected.delete(id);
    updateSelectAll();
    updateBulkBar();

    /* Highlight row */
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (row) row.classList.toggle("selected", checked);
  }

  function wireSelectAll() {
    const chk = document.getElementById("selectAll");
    if (!chk) return;
    chk.addEventListener("change", () => {
      state.items.forEach((item) => toggleSelect(String(item.id), chk.checked));
      document
        .querySelectorAll(".row-check")
        .forEach((c) => (c.checked = chk.checked));
    });
  }

  function updateSelectAll() {
    const chk = document.getElementById("selectAll");
    if (!chk || !state.items.length) return;
    const allSelected = state.items.every((i) =>
      state.selected.has(String(i.id)),
    );
    const someSelected = state.items.some((i) =>
      state.selected.has(String(i.id)),
    );
    chk.checked = allSelected;
    chk.indeterminate = !allSelected && someSelected;
  }

  function updateBulkBar() {
    const bar = document.getElementById("bulkBar");
    const count = document.getElementById("bulkCount");
    if (!bar) return;
    const n = state.selected.size;
    bar.classList.toggle("is-visible", n > 0);
    if (count) count.textContent = `${n} selecionado${n !== 1 ? "s" : ""}`;
  }

  /* ============================================================
     BULK ACTIONS
     ============================================================ */
  function wireBulkActions() {
    const bulkDiscard = document.getElementById("bulkDiscard");
    if (bulkDiscard) {
      bulkDiscard.addEventListener("click", () => {
        if (!state.selected.size) return;
        /* For simplicity, open discard modal for first selected; full bulk could iterate */
        const id = [...state.selected][0];
        const item = state.items.find((i) => String(i.id) === String(id));
        openDiscardModal(id, item ? item.product_name : "Itens selecionados");
      });
    }

    const bulkMove = document.getElementById("bulkMove");
    if (bulkMove) {
      bulkMove.addEventListener("click", () => {
        if (!state.selected.size) return;
        const ids = [...state.selected].join(",");
        window.location.href = `movimentacoes.html?items=${ids}`;
      });
    }
  }

  /* ============================================================
     DETAIL DRAWER
     ============================================================ */
  function wireDrawer() {
    const drawer = document.getElementById("detailDrawer");
    const closeBtn = document.getElementById("drawerClose");
    const overlay = document.getElementById("drawerOverlay");

    closeBtn && closeBtn.addEventListener("click", closeDrawer);
    overlay && overlay.addEventListener("click", closeDrawer);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawer && drawer.classList.contains("is-open"))
        closeDrawer();
    });
  }

  async function openDrawer(id) {
    const drawer = document.getElementById("detailDrawer");
    const body = document.getElementById("drawerBody");
    const title = document.getElementById("drawerTitle");
    const editBtn = document.getElementById("drawerEditBtn");
    const overlay = document.getElementById("drawerOverlay");

    if (!drawer || !body) return;

    /* Show skeleton while loading */
    title && (title.textContent = "Carregando…");
    body.innerHTML = `
      <div class="skeleton" style="height:180px; border-radius:var(--radius-lg); margin-bottom:var(--space-4);"></div>
      ${Array(4).fill('<div class="skeleton" style="height:14px; margin-bottom:var(--space-3);"></div>').join("")}`;

    drawer.classList.add("is-open");
    overlay && overlay.classList.add("active");
    document.body.style.overflow = "hidden";

    /* Wire discard + move buttons */
    const discardBtn = document.getElementById("drawerDiscardBtn");
    const moveBtn = document.getElementById("drawerMoveBtn");

    try {
      const data = await SC.api(`/items/${id}`);
      const item = data.item || data;

      state.activeItemId = item.id;
      if (title) title.textContent = item.product_name || "Item";
      if (editBtn) {
        editBtn.onclick = () => {
          window.location.href = `form-item.html?id=${item.id}`;
        };
      }

      if (discardBtn) {
        discardBtn.onclick = () => openDiscardModal(item.id, item.product_name);
      }
      if (moveBtn) {
        moveBtn.onclick = () =>
          (window.location.href = `movimentacoes.html?item=${item.id}`);
      }

      body.innerHTML = buildDrawerContent(item);

      /* Wire QR copy */
      const qrCopy = body.querySelector("#drawerQrCopy");
      if (qrCopy && item.qr_code_token) {
        qrCopy.addEventListener("click", () =>
          SC.copyText(item.qr_code_token, "Token copiado!"),
        );
      }
    } catch (err) {
      body.innerHTML = `<div class="alert alert-danger">
        <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>Não foi possível carregar os dados do item.</span>
      </div>`;
      if (title) title.textContent = "Erro";
    }
  }

  function closeDrawer() {
    const drawer = document.getElementById("detailDrawer");
    const overlay = document.getElementById("drawerOverlay");
    drawer && drawer.classList.remove("is-open");
    overlay && overlay.classList.remove("active");
    document.body.style.overflow = "";
    state.activeItemId = null;
  }

  function buildDrawerContent(item) {
    const photo = item.photo_url
      ? `<img src="${SC.escHtml(item.photo_url)}" alt="Foto do item" class="detail-photo" style="display:block;" />`
      : `<div class="detail-photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
           <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
           <polyline points="21 15 16 10 5 21"/>
         </svg></div>`;

    const brand = item.brand || item.product_brand || item.brand_name || "";
    const model = item.model || item.product_model || item.model_name || "";
    const brandModelText = [brand, model].filter(Boolean).join(" / ") || "—";

    return `
      ${photo}

      <div class="detail-fields-grid">
        <div class="detail-field">
          <span class="detail-field-label">Condição</span>
          <div class="detail-field-value">${SC.conditionBadge(item.condition_code)}</div>
        </div>
        <div class="detail-field">
          <span class="detail-field-label">Disponível / Total</span>
          <div class="detail-field-value" style="font-weight:700; font-size:1.0625rem;">
            ${item.quantity_available ?? "—"} / ${item.quantity ?? "—"}
          </div>
        </div>
        <div class="detail-field">
          <span class="detail-field-label">Categoria</span>
          <div class="detail-field-value">${SC.escHtml(item.category_name || "—")}</div>
        </div>
        <div class="detail-field">
          <span class="detail-field-label">Marca / Modelo</span>
          <div class="detail-field-value">${SC.escHtml(brandModelText)}</div>
        </div>
        <div class="detail-field">
          <span class="detail-field-label">Nº Patrimônio</span>
          <div class="detail-field-value">${SC.escHtml(item.serial_number || item.asset_tag || "—")}</div>
        </div>
        <div class="detail-field">
          <span class="detail-field-label">Localização</span>
          <div class="detail-field-value">${SC.escHtml(item.location_name || item.localizacao || "—")}</div>
        </div>
        <div class="detail-field">
          <span class="detail-field-label">Valor Estimado</span>
          <div class="detail-field-value">${SC.fmtCurrency(item.estimated_value)}</div>
        </div>
        <div class="detail-field">
          <span class="detail-field-label">Cadastrado em</span>
          <div class="detail-field-value">${SC.fmtDate(item.created_at)}</div>
        </div>
      </div>

      ${
        item.description
          ? `
        <div class="detail-field" style="margin-bottom:var(--space-4);">
          <span class="detail-field-label">Descrição</span>
          <div class="detail-field-value" style="font-size:0.875rem; color:var(--color-text-secondary); line-height:1.6;">
            ${SC.escHtml(item.description)}
          </div>
        </div>`
          : ""
      }

      ${
        item.tags && item.tags.length
          ? `
        <div class="detail-field" style="margin-bottom:var(--space-4);">
          <span class="detail-field-label">Tags</span>
          <div style="display:flex; flex-wrap:wrap; gap:var(--space-1-5); margin-top:var(--space-1);">
            ${item.tags.map((t) => `<span class="badge badge-neutral">${SC.escHtml(t.name || t)}</span>`).join("")}
          </div>
        </div>`
          : ""
      }

      ${
        item.qr_code_token
          ? `
        <div class="detail-field">
          <span class="detail-field-label">QR Code Token</span>
          <div class="qr-token-box" style="margin-top:var(--space-1);">
            <span style="font-family:monospace; font-size:0.8125rem; word-break:break-all; flex:1;">
              ${SC.escHtml(item.qr_code_token)}
            </span>
            <button type="button" class="qr-copy-btn" id="drawerQrCopy" aria-label="Copiar token">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          </div>
        </div>`
          : ""
      }`;
  }

  /* ============================================================
     DISCARD MODAL
     ============================================================ */
  function openDiscardModal(id, name) {
    state.discardItemId = id;
    const desc = document.getElementById("discardDesc");
    const reasonSelect = document.getElementById("discardReason");
    const reasonGroup = document.getElementById("discardReasonGroup");
    if (desc)
      desc.textContent = `Descartar "${name}"? Esta ação registrará o descarte e não pode ser desfeita.`;
    if (reasonSelect) reasonSelect.value = "";
    if (reasonGroup) reasonGroup.classList.remove("has-error");
    SC.openModal("discardModal");
  }

  function wireDiscardModal() {
    const confirmBtn = document.getElementById("discardConfirmBtn");
    const reasonSelect = document.getElementById("discardReason");
    const reasonGroup = document.getElementById("discardReasonGroup");
    if (!confirmBtn) return;

    reasonSelect?.addEventListener("change", () => {
      if (reasonSelect.value) {
        reasonGroup?.classList.remove("has-error");
      }
    });

    confirmBtn.addEventListener("click", async () => {
      const reason = reasonSelect?.value || "";
      const notes = document.getElementById("discardNotes")?.value || "";

      if (!reason) {
        reasonGroup?.classList.add("has-error");
        return;
      }

      reasonGroup?.classList.remove("has-error");

      confirmBtn.classList.add("is-loading");
      confirmBtn.disabled = true;

      try {
        await SC.api("/items/discard", {
          method: "POST",
          body: JSON.stringify({
            item_id: state.discardItemId,
            organization_id: _orgId,
            created_by: _sessionUser.id || null,
            reason,
            notes,
          }),
        });

        SC.closeModal("discardModal");
        closeDrawer();
        SC.toastSuccess("Item descartado com sucesso.");
        state.selected.delete(String(state.discardItemId));
        updateBulkBar();
        await loadItems();
        try {
          localStorage.setItem('estoque_items_updated', JSON.stringify({ ts: Date.now() }));
          setTimeout(() => localStorage.removeItem('estoque_items_updated'), 1000);
        } catch (err) {
          console.warn('Não foi possível notificar etiquetas do descarte.', err);
        }
      } catch (err) {
        SC.toastError(err.message || "Erro ao descartar item.");
      } finally {
        confirmBtn.classList.remove("is-loading");
        confirmBtn.disabled = false;
      }
    });
  }

  /* ============================================================
     HELPERS
     ============================================================ */
  function updateSubtitle() {
    const el = document.getElementById("stockSubtitle");
    if (el)
      el.textContent = `${state.total.toLocaleString("pt-BR")} ite${state.total !== 1 ? "ns" : "m"} encontrado${state.total !== 1 ? "s" : ""}`;
  }

  function showSkeleton() {
    const tbody = document.getElementById("stockBody");
    const grid = document.getElementById("stockGrid");
    hideEmpty();
    if (tbody && state.view === "table") {
      tbody.innerHTML = Array(6)
        .fill(
          `
        <tr>
          <td class="col-check"><div class="skeleton" style="width:15px;height:15px;border-radius:3px;"></div></td>
          <td><div style="display:flex;gap:var(--space-3);align-items:center;">
            <div class="skeleton" style="width:36px;height:36px;border-radius:var(--radius-sm);flex-shrink:0;"></div>
            <div><div class="skeleton" style="width:160px;height:13px;margin-bottom:5px;"></div>
            <div class="skeleton" style="width:90px;height:11px;"></div></div>
          </div></td>
          <td style="text-align:center;"><div class="skeleton" style="width:80px;height:13px;"></div></td>
          <td style="text-align:center;"><div class="skeleton" style="width:60px;height:20px;border-radius:20px;"></div></td>
          <td style="text-align:center;"><div class="skeleton" style="width:30px;height:13px;margin-left:auto;"></div></td>
          <td style="text-align:center;"><div class="skeleton" style="width:30px;height:13px;margin-left:auto;"></div></td>
          <td style="text-align:center;"><div class="skeleton" style="width:70px;height:13px;"></div></td>
          <td></td>
        </tr>`,
        )
        .join("");
    }
    if (grid && state.view === "grid") {
      grid.innerHTML = Array(8)
        .fill(
          `
        <div class="skeleton" style="height:220px;border-radius:var(--radius-xl);"></div>`,
        )
        .join("");
    }
  }

  function showEmpty() {
    const empty = document.getElementById("emptyState");
    const tableView = document.getElementById("tableView");
    const gridView = document.getElementById("gridView");
    if (tableView) tableView.style.display = "none";
    if (gridView) gridView.style.display = "none";
    if (empty) empty.style.display = "flex";
  }

  function hideEmpty() {
    const empty = document.getElementById("emptyState");
    if (empty) empty.style.display = "none";
  }

  function showError(msg) {
    const tbody = document.getElementById("stockBody");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:var(--space-8);">
        <div class="alert alert-danger" style="display:inline-flex; max-width:400px;">
          <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>${SC.escHtml(msg)}</span>
        </div>
      </td></tr>`;
    }
  }
})();
