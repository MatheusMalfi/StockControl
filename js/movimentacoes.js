"use strict";
let movInitFired = false;
function bootMovimentacoes() {
  if (movInitFired) return;
  movInitFired = true;

  // ── Storage ───────────────────────────────────────────────────────────────
  const KEYS = {
    ITEMS: "sc_items",
    MOVEMENTS: "sc_movements",
    DELETED: "sc_movements_deleted",
  };

  function dbGet(key) {
    try {
      return JSON.parse(localStorage.getItem(SC.storageKey(key)) || "[]") || [];
    } catch {
      return [];
    }
  }
  function dbSet(key, val) {
    localStorage.setItem(SC.storageKey(key), JSON.stringify(val));
  }

  // ── API helpers ───────────────────────────────────────────────────────────
  function _movToken() {
    return (
      localStorage.getItem("sc_token") || sessionStorage.getItem("sc_token")
    );
  }
  function _movApi(method, url, body) {
    const token = _movToken();
    return fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body != null ? { body: JSON.stringify(body) } : {}),
    }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  }

  function getStoredUser() {
    try {
      return (
        JSON.parse(
          localStorage.getItem("sc_user") ||
            sessionStorage.getItem("sc_user") ||
            "{}",
        ) || {}
      );
    } catch {
      return {};
    }
  }

  function loadItems() {
    const user = getStoredUser();
    const qs = user.organization_id
      ? `?organization_id=${user.organization_id}&limit=1000`
      : "?limit=1000";
    return _movApi("GET", `/api/items${qs}`)
      .then((data) => {
        const items = Array.isArray(data)
          ? data
          : data.items || data.itens || [];
        const mapped = (Array.isArray(items) ? items : []).map((it) => ({
          id: it.id,
          nome: it.product_name || it.nome || "—",
          patrimonio: it.serial_number || it.patrimonio || "",
          categoria: it.category_name || it.categoria || "",
          disponivel:
            it.quantity_available ?? it.disponivel ?? it.quantity ?? 0,
          total: it.quantity ?? it.total ?? 0,
          quantity_available:
            it.quantity_available ?? it.disponivel ?? it.quantity ?? 0,
        }));
        dbSet(KEYS.ITEMS, mapped);
        return mapped;
      })
      .catch(() => []);
  }

  function normalizeServerMovement(m) {
    // Garantir quantidade válida (rejeitar valores negativos ou zero)
    const qty = m.quantidade ?? m.quantity ?? 0;
    const validQty = typeof qty === "number" && qty > 0 ? qty : 1;

    return {
      id: m.id,
      item_id: m.item_id || m.product_id || null,
      nome: m.nome || m.produto || m.product_name || "—",
      patrimonio: m.patrimonio || m.origem || "",
      tipo: (m.tipo || "").toUpperCase(),
      quantidade: validQty,
      responsavel: m.responsavel || m.responsible || "—",
      created_at: m.created_at || m.data || new Date().toISOString(),
      destino: m.destino || null,
      notas: m.notas || m.obs || m.notes || null,
    };
  }

  function dbGetDeleted() {
    try {
      return (
        JSON.parse(localStorage.getItem(SC.storageKey(KEYS.DELETED)) || "[]") ||
        []
      );
    } catch {
      return [];
    }
  }
  function dbSetDeleted(arr) {
    try {
      localStorage.setItem(SC.storageKey(KEYS.DELETED), JSON.stringify(arr));
    } catch {}
  }
  function addDeletedId(id) {
    const arr = dbGetDeleted().map(String);
    if (!arr.includes(String(id))) {
      arr.push(String(id));
      dbSetDeleted(arr);
    }
  }
  function removeDeletedId(id) {
    const arr = dbGetDeleted().filter((x) => String(x) !== String(id));
    dbSetDeleted(arr);
  }

  function isValidMovement(m) {
    // Validar quantidade: não permitir valores negativos, zero ou inválidos
    const qty = m.quantidade ?? m.quantity ?? 0;
    if (typeof qty !== "number" || qty <= 0) return false;

    // Validar tipo
    const validTypes = [
      "ENTRADA",
      "SAIDA",
      "DOACAO",
      "DESCARTE",
      "TRANSFERENCIA",
    ];
    if (!validTypes.includes((m.tipo || "").toUpperCase())) return false;

    // Validar que tem um ID válido
    if (!m.id) return false;

    return true;
  }

  function mergeMovements(serverMovs) {
    const localMovs = dbGet(KEYS.MOVEMENTS);
    const deleted = new Set(dbGetDeleted().map(String));
    const map = new Map();
    const serverList = Array.isArray(serverMovs) ? serverMovs : [];

    // If there are no server movements, preserve only unsynced local movements.
    if (!serverList.length) {
      (Array.isArray(localMovs) ? localMovs : []).forEach((m) => {
        if (isValidMovement(m) && m._local) {
          map.set(String(m.id), m);
        }
      });
      return Array.from(map.values());
    }

    (Array.isArray(localMovs) ? localMovs : []).forEach((m) => {
      if (isValidMovement(m)) {
        map.set(String(m.id), m);
      }
    });
    serverList.forEach((m) => {
      const id = String(m.id);
      if (deleted.has(id)) return; // skip server entries that were deleted locally
      if (!isValidMovement(m)) return; // skip invalid server entries
      map.set(id, normalizeServerMovement(m));
    });
    return Array.from(map.values());
  }

  // ── State ─────────────────────────────────────────────────────────────────
  const state = {
    page: 1,
    perPage: 25,
    period: "30",
    dateFrom: "",
    dateTo: "",
    type: "",
    search: "",
    sortBy: "created_at",
    sortDir: "desc",
    filtered: [],
    selectedItem: null,
  };

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  const movBody = $("movBody");
  const movEmpty = $("movEmpty");
  const movPagination = $("movPagination");
  const movSearch = $("movSearch");
  const typeFilter = $("typeFilter");
  const dateFrom = $("dateFrom");
  const dateTo = $("dateTo");
  const exportBtn = $("exportBtn");
  const newMovBtn = $("newMovBtn");
  const emptyNewMovBtn = $("emptyNewMovBtn");
  const movPerPage = $("movPerPage");

  const kpiTotal = $("kpiTotal");
  const kpiTotalSub = $("kpiTotalSub");
  const kpiEntrada = $("kpiEntrada");
  const kpiSaida = $("kpiSaida");
  const kpiDoacao = $("kpiDoacao");
  const kpiDescarte = $("kpiDescarte");

  const movItemSearch = $("movItemSearch");
  const itemSearchResult = $("itemSearchResult");
  const selectedItemChip = $("selectedItemChip");
  const selectedItemName = $("selectedItemName");
  const selectedItemMeta = $("selectedItemMeta");
  const changeItemBtn = $("changeItemBtn");
  const itemSearchWrap = $("itemSearchWrap");
  const movItemId = $("movItemId");
  const movQuantity = $("movQuantity");
  const movQtyHint = $("movQtyHint");
  const movDate = $("movDate");
  const movNotes = $("movNotes");
  const movDestination = $("movDestination");
  const destinationRow = $("destinationRow");
  const saveMovBtn = $("saveMovBtn");
  const errorMovItem = $("errorMovItem");
  const errorMovType = $("errorMovType");
  const errorMovQty = $("errorMovQty");
  const movDetailBody = $("movDetailBody");

  const movTypeInputs = $$('input[name="movement_type"]');

  // ── Helpers ───────────────────────────────────────────────────────────────
  function animCount(el, target, duration) {
    if (!el) return;
    duration = duration || 600;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function typeLabel(tipo) {
    const map = {
      ENTRADA: "Entrada",
      SAIDA: "Saída",
      DOACAO: "Doação",
      DESCARTE: "Descarte",
      TRANSFERENCIA: "Transferência",
    };
    return map[(tipo || "").toUpperCase()] || tipo;
  }

  function typeBadgeHtml(tipo) {
    const t = (tipo || "").toUpperCase();
    const cls =
      {
        ENTRADA: "mov-entrada",
        SAIDA: "mov-saida",
        DOACAO: "mov-doacao",
        DESCARTE: "mov-descarte",
        TRANSFERENCIA: "mov-transferencia",
      }[t] || "";
    return `<span class="mov-type ${cls}"><span class="mov-type-dot"></span>${SC.escHtml(typeLabel(t))}</span>`;
  }

  function qtyHtml(tipo, qty) {
    const t = (tipo || "").toUpperCase();
    const pos = t === "ENTRADA";
    const neg = ["SAIDA", "DOACAO", "DESCARTE"].includes(t);
    const cls = pos
      ? "qty-delta positive"
      : neg
        ? "qty-delta negative"
        : "qty-delta";
    const sign = pos ? "+" : neg ? "−" : "";
    return `<span class="${cls}">${sign}${qty}</span>`;
  }

  function initials(name) {
    return (name || "?")
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
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

  // ── Period / date filtering ───────────────────────────────────────────────
  function parseDateInput(value) {
    if (!value) return null;
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function inPeriod(mov) {
    const d = new Date(mov.created_at);
    if (Number.isNaN(d.getTime())) return false;

    if (state.dateFrom) {
      const from = parseDateInput(state.dateFrom);
      if (from && d < from) return false;
    }

    if (state.dateTo) {
      const to = parseDateInput(state.dateTo);
      if (to) {
        to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }
    }

    if (
      !state.dateFrom &&
      !state.dateTo &&
      state.period &&
      state.period !== "0"
    ) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(state.period));
      if (d < cutoff) return false;
    }
    return true;
  }

  // ── Apply filters + sort ──────────────────────────────────────────────────
  function applyFilters() {
    let movs = dbGet(KEYS.MOVEMENTS);

    // Se não houver usuário logado, mostrar apenas movimentações criadas localmente
    const _user = getStoredUser();
    if (!_user || !_user.organization_id) {
      movs = (Array.isArray(movs) ? movs : []).filter((m) => m && m._local);
    }

    // Filtrar movimentações inválidas
    movs = movs.filter((m) => isValidMovement(m));

    movs = movs.filter(inPeriod);

    if (state.type) movs = movs.filter((m) => m.tipo === state.type);

    if (state.search) {
      const q = state.search.toLowerCase();
      movs = movs.filter(
        (m) =>
          (m.nome || "").toLowerCase().includes(q) ||
          (m.patrimonio || "").toLowerCase().includes(q) ||
          (m.responsavel || "").toLowerCase().includes(q),
      );
    }

    movs.sort((a, b) => {
      let va, vb;
      if (state.sortBy === "created_at") {
        va = new Date(a.created_at).getTime();
        vb = new Date(b.created_at).getTime();
      } else {
        va = (a.nome || "").toLowerCase();
        vb = (b.nome || "").toLowerCase();
      }
      if (va < vb) return state.sortDir === "asc" ? -1 : 1;
      if (va > vb) return state.sortDir === "asc" ? 1 : -1;
      return 0;
    });

    state.filtered = movs;
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  function renderKPIs() {
    const movs = state.filtered;
    const total = movs.length;
    const entrada = movs.filter((m) => m.tipo === "ENTRADA").length;
    const saida = movs.filter((m) => m.tipo === "SAIDA").length;
    const doacao = movs.filter((m) => m.tipo === "DOACAO").length;
    const descarte = movs.filter((m) => m.tipo === "DESCARTE").length;

    if (kpiTotal) {
      kpiTotal.classList.remove("skeleton");
      kpiTotal.style.width = "";
      kpiTotal.style.height = "";
    }

    const periodLabel =
      state.period === "0"
        ? "todos os períodos"
        : state.period
          ? `últimos ${state.period} dias`
          : "período selecionado";
    if (kpiTotalSub) kpiTotalSub.textContent = periodLabel;

    animCount(kpiTotal, total);
    animCount(kpiEntrada, entrada);
    animCount(kpiSaida, saida);
    animCount(kpiDoacao, doacao);
    animCount(kpiDescarte, descarte);
  }

  // ── Table rendering ───────────────────────────────────────────────────────
  function renderTable() {
    if (!movBody) return;

    const total = state.filtered.length;
    const perPage =
      parseInt(movPerPage ? movPerPage.value : state.perPage) || state.perPage;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (state.page > totalPages) state.page = totalPages;

    if (!total) {
      movBody.innerHTML = "";
      movEmpty && (movEmpty.style.display = "");
      movPagination && (movPagination.style.display = "none");
      return;
    }

    movEmpty && (movEmpty.style.display = "none");
    movPagination && (movPagination.style.display = "flex");

    const slice = state.filtered.slice(
      (state.page - 1) * perPage,
      state.page * perPage,
    );

    movBody.innerHTML = slice
      .map((m) => {
        const ini = initials(m.responsavel);
        const obs = m.notas
          ? m.notas.length > 45
            ? m.notas.slice(0, 45) + "…"
            : m.notas
          : "";
        // const oriDest = m.destino
        //   ? `<span>${SC.escHtml(m.destino)}</span>`
        //   : `<span style="color:var(--color-text-muted);">—</span>`;
        return `
        <tr data-id="${m.id}">
          <td style="white-space:nowrap; color:var(--color-text-secondary); font-size:0.8125rem;">${SC.fmtDateTime(m.created_at)}</td>
          <td>${typeBadgeHtml(m.tipo)}</td>
          <td style="white-space:nowrap;">
            <div style="font-weight:500; color:var(--color-text-primary); font-size:0.875rem;">${SC.escHtml(m.nome)}</div>
            <div style="font-size:0.8125rem; color:var(--color-text-muted);">${SC.escHtml(m.patrimonio)}</div>
          </td>
          <td style="text-align: center;">${qtyHtml(m.tipo, m.quantidade)}</td>
          <td style="text-align: center;">
            <div style="display:flex; align-items:center; gap:var(--space-2); min-width:0;">
              <div class="avatar" style="width:26px; height:26px; font-size:0.65rem; flex-shrink:0;">${SC.escHtml(ini)}</div>
              <span style="font-size:0.875rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${SC.escHtml(m.responsavel || "—")}</span>
            </div>
          </td>
          <td style="font-size:0.8125rem; color:var(--color-text-muted); max-width:180px;" title="${SC.escHtml(m.notas || "")}">${SC.escHtml(obs) || "—"}</td>
          <td class="col-actions" style="white-space:nowrap;">
            <button class="btn btn-ghost btn-sm btn-row-detail" data-id="${m.id}" title="Ver detalhes">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button class="btn btn-ghost btn-sm btn-row-delete" data-id="${m.id}" title="Excluir" style="color:var(--color-danger);">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              </svg>
            </button>
          </td>
        </tr>`;
      })
      .join("");

    movBody
      .querySelectorAll(".btn-row-detail")
      .forEach((btn) =>
        btn.addEventListener("click", () => openDetail(btn.dataset.id)),
      );
    movBody
      .querySelectorAll(".btn-row-delete")
      .forEach((btn) =>
        btn.addEventListener("click", () => deleteMovement(btn.dataset.id)),
      );

    SC.renderPagination({
      containerId: "movPagControls",
      infoId: "movPagInfo",
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

  // ── Filters wiring ────────────────────────────────────────────────────────
  function wireFilters() {
    movSearch &&
      movSearch.addEventListener(
        "input",
        SC.debounce(() => {
          state.search = movSearch.value.trim();
          state.page = 1;
          render();
        }, 300),
      );

    typeFilter &&
      typeFilter.addEventListener("change", () => {
        state.type = typeFilter.value;
        state.page = 1;
        render();
      });

    dateFrom &&
      dateFrom.addEventListener("change", () => {
        state.dateFrom = dateFrom.value;
        state.period = "";
        $$(".period-tab").forEach((t) => t.classList.remove("active"));
        state.page = 1;
        render();
      });

    dateTo &&
      dateTo.addEventListener("change", () => {
        state.dateTo = dateTo.value;
        state.period = "";
        $$(".period-tab").forEach((t) => t.classList.remove("active"));
        state.page = 1;
        render();
      });

    $$(".period-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        state.period = tab.dataset.period;
        state.dateFrom = "";
        state.dateTo = "";
        if (dateFrom) dateFrom.value = "";
        if (dateTo) dateTo.value = "";
        $$(".period-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        state.page = 1;
        render();
      });
    });

    movPerPage &&
      movPerPage.addEventListener("change", () => {
        state.perPage = parseInt(movPerPage.value) || 25;
        state.page = 1;
        render();
      });
  }

  // ── Export CSV ────────────────────────────────────────────────────────────
  function exportCSV() {
    const cols = [
      "Data",
      "Tipo",
      "Item",
      "Patrimônio",
      "Quantidade",
      "Responsável",
      "Destino/Beneficiário",
      "Observações",
    ];
    const rows = state.filtered.map((m) => [
      SC.fmtDateTime(m.created_at),
      typeLabel(m.tipo),
      m.nome || "",
      m.patrimonio || "",
      m.quantidade ?? "",
      m.responsavel || "",
      m.destino || "",
      m.notas || "",
    ]);
    const csv = [cols, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimentacoes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── New movement modal ────────────────────────────────────────────────────
  function openNewMovModal() {
    resetMovForm();
    if (!dbGet(KEYS.ITEMS).length) {
      loadItems();
    }
    SC.openModal("newMovModal");
  }

  function resetMovForm() {
    state.selectedItem = null;
    if (movItemId) movItemId.value = "";
    if (movItemSearch) movItemSearch.value = "";
    if (itemSearchResult) {
      itemSearchResult.innerHTML = "";
      itemSearchResult.classList.remove("is-open");
    }
    if (selectedItemChip) selectedItemChip.style.display = "none";
    if (itemSearchWrap) itemSearchWrap.style.display = "";
    movTypeInputs.forEach((r) => {
      r.checked = false;
    });
    if (movQuantity) movQuantity.value = "1";
    if (movQtyHint) movQtyHint.textContent = "Disponível: —";
    const now = new Date();
    now.setSeconds(0, 0);
    if (movDate) movDate.value = now.toISOString().slice(0, 16);
    if (movNotes) movNotes.value = "";
    if (movDestination) movDestination.value = "";
    if (destinationRow) destinationRow.style.display = "none";
    if (errorMovItem) errorMovItem.style.display = "none";
    if (errorMovType) errorMovType.style.display = "none";
    if (errorMovQty) errorMovQty.style.display = "none";
  }

  function wireNewMovModal() {
    if (newMovBtn) {
      newMovBtn.addEventListener("click", openNewMovModal);
    }
    if (emptyNewMovBtn) {
      emptyNewMovBtn.addEventListener("click", openNewMovModal);
    }

    movItemSearch &&
      movItemSearch.addEventListener(
        "input",
        SC.debounce(() => {
          const q = (movItemSearch.value || "").trim().toLowerCase();
          if (!q) {
            if (itemSearchResult) itemSearchResult.classList.remove("is-open");
            return;
          }
          const items = dbGet(KEYS.ITEMS)
            .filter(
              (it) =>
                (it.nome || "").toLowerCase().includes(q) ||
                (it.patrimonio || "").toLowerCase().includes(q),
            )
            .slice(0, 8);
          renderItemResults(items);
        }, 250),
      );

    changeItemBtn &&
      changeItemBtn.addEventListener("click", () => {
        state.selectedItem = null;
        if (movItemId) movItemId.value = "";
        if (selectedItemChip) selectedItemChip.style.display = "none";
        if (itemSearchWrap) itemSearchWrap.style.display = "";
        if (movItemSearch) {
          movItemSearch.value = "";
          movItemSearch.focus();
        }
        if (movQtyHint) movQtyHint.textContent = "Disponível: —";
      });

    movTypeInputs.forEach((r) => {
      r.addEventListener("change", () => {
        const show = ["DOACAO", "TRANSFERENCIA"].includes(r.value);
        if (destinationRow) destinationRow.style.display = show ? "" : "none";
        if (movDestination) {
          movDestination.placeholder =
            r.value === "DOACAO"
              ? "Nome do donatário ou organização"
              : "Destino da transferência";
        }
        if (errorMovType) errorMovType.style.display = "none";

        // Validar quantidade ao mudar tipo
        if (errorMovQty) errorMovQty.style.display = "none";
        if (state.selectedItem && movQuantity) {
          const qty = parseInt(movQuantity.value || 0);
          const disponivel =
            state.selectedItem.disponivel ??
            state.selectedItem.quantity_available ??
            state.selectedItem.quantity ??
            state.selectedItem.total ??
            0;

          if (
            ["SAIDA", "DOACAO", "DESCARTE"].includes(r.value) &&
            qty > disponivel
          ) {
            if (errorMovQty) {
              errorMovQty.style.display = "";
              errorMovQty.textContent = `Quantidade indisponível. Disponível: ${disponivel}`;
            }
          }
        }
      });
    });

    movQuantity &&
      movQuantity.addEventListener("input", () => {
        if (errorMovQty) errorMovQty.style.display = "none";

        // Validação em tempo real: verificar se quantidade excede disponível
        if (state.selectedItem && movTypeInputs) {
          const typeChecked = [...movTypeInputs].find((r) => r.checked);
          if (
            typeChecked &&
            ["SAIDA", "DOACAO", "DESCARTE"].includes(typeChecked.value)
          ) {
            const qty = parseInt(movQuantity.value || 0);
            const disponivel =
              state.selectedItem.disponivel ??
              state.selectedItem.quantity_available ??
              state.selectedItem.quantity ??
              state.selectedItem.total ??
              0;

            if (qty > disponivel) {
              if (errorMovQty) {
                errorMovQty.style.display = "";
                errorMovQty.textContent = `Quantidade indisponível. Disponível: ${disponivel}`;
              }
            }
          }
        }
      });

    saveMovBtn && saveMovBtn.addEventListener("click", saveMovement);
  }

  function renderItemResults(items) {
    if (!itemSearchResult) return;
    itemSearchResult.classList.add("is-open");
    if (!items.length) {
      itemSearchResult.innerHTML = `
        <div class="item-result-row">
          <span class="item-result-name" style="color:var(--color-text-muted);">Nenhum item encontrado</span>
        </div>`;
      return;
    }
    itemSearchResult.innerHTML = items
      .map(
        (it) => `
      <div class="item-result-row" data-id="${SC.escHtml(it.id)}">
        <div>
          <div class="item-result-name">${SC.escHtml(it.nome)}</div>
          <div class="item-result-meta">${SC.escHtml(it.patrimonio)} · ${SC.escHtml(it.categoria || "")} · Disp: ${it.disponivel ?? "?"}</div>
        </div>
      </div>`,
      )
      .join("");

    itemSearchResult
      .querySelectorAll(".item-result-row[data-id]")
      .forEach((row) => {
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
    if (movItemId) movItemId.value = item.id;
    if (selectedItemName) selectedItemName.textContent = item.nome;

    // Tentar várias variantes de propriedade para disponível
    const disponivel =
      item.disponivel ??
      item.quantity_available ??
      item.quantity ??
      item.total ??
      0;
    const dispText =
      disponivel > 0
        ? `${disponivel} disponível${disponivel === 1 ? "" : "s"}`
        : "Sem estoque";

    if (selectedItemMeta)
      selectedItemMeta.textContent = `${item.patrimonio} · ${dispText}`;
    if (movQtyHint)
      movQtyHint.innerHTML = `Disponível: <strong>${disponivel}</strong>`;
    if (selectedItemChip) selectedItemChip.style.display = "";
    if (itemSearchWrap) itemSearchWrap.style.display = "none";
    if (itemSearchResult) {
      itemSearchResult.innerHTML = "";
      itemSearchResult.classList.remove("is-open");
    }
    if (errorMovItem) errorMovItem.style.display = "none";
    if (errorMovQty) errorMovQty.style.display = "none";
  }

  function saveMovement() {
    let valid = true;

    if (!state.selectedItem) {
      if (errorMovItem) {
        errorMovItem.style.display = "";
        errorMovItem.textContent = "Selecione um item.";
      }
      valid = false;
    }

    const typeChecked = [...movTypeInputs].find((r) => r.checked);
    if (!typeChecked) {
      if (errorMovType) {
        errorMovType.style.display = "";
        errorMovType.textContent = "Selecione o tipo de movimentação.";
      }
      valid = false;
    }

    const qty = parseInt(movQuantity ? movQuantity.value : 0);
    if (!qty || qty < 1) {
      if (errorMovQty) {
        errorMovQty.style.display = "";
        errorMovQty.textContent = "Quantidade deve ser maior que zero.";
      }
      valid = false;
    }

    // Validar quantidade contra estoque disponível (exceto para ENTRADA)
    if (valid && state.selectedItem && typeChecked) {
      const tipo = typeChecked.value;
      const disponivel =
        state.selectedItem.disponivel ??
        state.selectedItem.quantity_available ??
        state.selectedItem.quantity ??
        state.selectedItem.total ??
        0;

      // Para SAIDA, DOACAO e DESCARTE, a quantidade não pode exceder o disponível
      if (["SAIDA", "DOACAO", "DESCARTE"].includes(tipo) && qty > disponivel) {
        if (errorMovQty) {
          errorMovQty.style.display = "";
          errorMovQty.textContent = `Quantidade indisponível. Disponível: ${disponivel}`;
        }
        valid = false;
      }
    }

    if (!valid) return;

    const tipo = typeChecked.value;
    const item = state.selectedItem;
    const dateVal = movDate ? movDate.value : "";
    const created_at = dateVal
      ? new Date(dateVal).toISOString()
      : new Date().toISOString();

    const newMov = {
      id: Date.now(),
      item_id: item.id,
      nome: item.nome,
      patrimonio: item.patrimonio,
      tipo,
      quantidade: qty,
      _local: true,
      responsavel: currentUserName(),
      created_at,
      destino: (movDestination && movDestination.value.trim()) || null,
      notas: (movNotes && movNotes.value.trim()) || null,
    };

    const movs = dbGet(KEYS.MOVEMENTS);
    movs.unshift(newMov);
    dbSet(KEYS.MOVEMENTS, movs);

    const user = getStoredUser();
    const payload = {
      id: newMov.id,
      item_id: newMov.item_id,
      patrimonio: newMov.patrimonio,
      organization_id: user.organization_id,
      tipo: newMov.tipo,
      produto: newMov.nome,
      quantidade: newMov.quantidade,
      responsavel: newMov.responsavel,
      destino: newMov.destino,
      origem: newMov.patrimonio,
      data: newMov.created_at,
      obs: newMov.notas,
    };

    _movApi("POST", "/api/movimentacoes", payload)
      .then((res) => {
        // If server created/returned a different id, update local cache
        try {
          if (res && res.id && String(res.id) !== String(newMov.id)) {
            const movs2 = dbGet(KEYS.MOVEMENTS).map((m) => {
              if (String(m.id) === String(newMov.id))
                return { ...m, id: String(res.id) };
              return m;
            });
            dbSet(KEYS.MOVEMENTS, movs2);
            // Also update deleted index if present
            const dels = dbGetDeleted();
            const changed = dels.map((x) =>
              String(x) === String(newMov.id) ? String(res.id) : x,
            );
            dbSetDeleted(changed);
          }
        } catch (_) {}
      })
      .catch(() => {
        /* Falha de backend não impede persistência local */
      });

    // Update item stock
    const items = dbGet(KEYS.ITEMS);
    const idx = items.findIndex((it) => String(it.id) === String(item.id));
    if (idx !== -1) {
      if (tipo === "ENTRADA") {
        items[idx].disponivel = (items[idx].disponivel || 0) + qty;
        items[idx].total = (items[idx].total || 0) + qty;
      } else if (["SAIDA", "DOACAO", "DESCARTE"].includes(tipo)) {
        items[idx].disponivel = Math.max(0, (items[idx].disponivel || 0) - qty);
      }
      dbSet(KEYS.ITEMS, items);
    }

    SC.closeModal("newMovModal");
    SC.toastSuccess("Movimentação registrada com sucesso!", 5000);
    state.page = 1;
    render();
  }

  // ── Detail modal ──────────────────────────────────────────────────────────
  function openDetail(id) {
    const m = dbGet(KEYS.MOVEMENTS).find((x) => String(x.id) === String(id));
    if (!m) return;

    const dt = (row) => `
      <div>
        <dt style="font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:var(--color-text-muted); margin-bottom:3px;">${row[0]}</dt>
        <dd style="margin:0;">${row[1]}</dd>
      </div>`;

    if (movDetailBody) {
      movDetailBody.innerHTML = `
        <dl style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-4) var(--space-6); font-size:0.875rem;">
          ${dt(["Item", `<strong>${SC.escHtml(m.nome)}</strong>`])}
          ${dt(["Patrimônio", SC.escHtml(m.patrimonio || "—")])}
          ${dt(["Tipo", typeBadgeHtml(m.tipo)])}
          ${dt(["Quantidade", qtyHtml(m.tipo, m.quantidade)])}
          ${dt(["Responsável", SC.escHtml(m.responsavel || "—")])}
          ${dt(["Data / Hora", SC.fmtDateTime(m.created_at)])}
          ${
            m.destino
              ? `<div style="grid-column:1/-1">${dt([
                  "Destino / Beneficiário",
                  SC.escHtml(m.destino),
                ])
                  .replace("<div>", "")
                  .replace("</div>", "")}</div>`
              : ""
          }
          ${
            m.notas
              ? `<div style="grid-column:1/-1">${dt([
                  "Observações",
                  `<span style="color:var(--color-text-secondary);">${SC.escHtml(m.notas)}</span>`,
                ])
                  .replace("<div>", "")
                  .replace("</div>", "")}</div>`
              : ""
          }
        </dl>`;
    }
    SC.openModal("movDetailModal");
  }

  // ── Delete movement ───────────────────────────────────────────────────────
  function deleteMovement(id) {
    // Abre o modal customizado de exclusão
    openDeleteMovModal(id);
  }

  // Modal customizado de exclusão de movimentação
  function openDeleteMovModal(id) {
    const modal = document.getElementById("deleteMovModal");
    const desc = document.getElementById("deleteMovDesc");
    const notes = document.getElementById("deleteMovNotes");
    const confirmBtn = document.getElementById("deleteMovConfirmBtn");
    if (!modal || !confirmBtn) return;
    desc.textContent =
      "Esta ação removerá a movimentação e não pode ser desfeita.";
    notes.value = "";
    confirmBtn.onclick = function () {
      // Executa a exclusão
      addDeletedId(id);
      const user = getStoredUser();
      const orgQuery = user.organization_id
        ? `?organization_id=${user.organization_id}`
        : "";
      _movApi("DELETE", `/api/movimentacoes/${id}${orgQuery}`).catch(() => {
        // Failure: keep id in deleted list so merges won't re-add it
      });
      const movs = dbGet(KEYS.MOVEMENTS).filter(
        (m) => String(m.id) !== String(id),
      );
      dbSet(KEYS.MOVEMENTS, movs);
      SC.closeModal("deleteMovModal");
      SC.toastSuccess("Movimentação removida.", 5000);
      render();
    };
    SC.openModal("deleteMovModal");
  }

  // ── General buttons ───────────────────────────────────────────────────────
  function wireButtons() {
    exportBtn && exportBtn.addEventListener("click", exportCSV);
  }

  // Modal de exclusão: ESC fecha, limpar handler ao fechar
  const deleteMovModal = document.getElementById("deleteMovModal");
  if (deleteMovModal) {
    deleteMovModal.addEventListener("keydown", function (e) {
      if (e.key === "Escape") SC.closeModal("deleteMovModal");
    });
    deleteMovModal.addEventListener("click", function (e) {
      if (e.target === deleteMovModal) SC.closeModal("deleteMovModal");
    });
    // Limpa o onclick ao fechar
    deleteMovModal.addEventListener("modal:close", function () {
      const btn = document.getElementById("deleteMovConfirmBtn");
      if (btn) btn.onclick = null;
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    wireSortHeaders();
    wireFilters();
    wireNewMovModal();
    wireButtons();

    // Limpar dados inválidos do localStorage
    const localMovs = dbGet(KEYS.MOVEMENTS);
    if (Array.isArray(localMovs) && localMovs.length > 0) {
      const validMovs = localMovs.filter((m) => isValidMovement(m));
      if (validMovs.length !== localMovs.length) {
        dbSet(KEYS.MOVEMENTS, validMovs);
      }
    }

    const _mou =
      JSON.parse(
        localStorage.getItem("sc_user") ||
          sessionStorage.getItem("sc_user") ||
          "{}",
      ) || {};
    loadItems();
    // Só buscar movimentações do servidor se houver usuário/organization_id
    if (_mou && _mou.organization_id) {
      _movApi(
        "GET",
        `/api/movimentacoes?organization_id=${_mou.organization_id}`,
      )
        .then((data) => {
          const serverMovs = Array.isArray(data)
            ? data
            : data.movimentacoes || [];
          const merged = mergeMovements(serverMovs);
          dbSet(KEYS.MOVEMENTS, merged);
          render();
        })
        .catch(() => {});
    }
    render();
  }

  init();
}

document.addEventListener("sc:ready", function () {
  bootMovimentacoes();
});

if (
  document.readyState === "interactive" ||
  document.readyState === "complete"
) {
  bootMovimentacoes();
} else {
  document.addEventListener("DOMContentLoaded", function () {
    bootMovimentacoes();
  });
}

setTimeout(() => {
  if (!movInitFired) {
    bootMovimentacoes();
  }
}, 1000);
