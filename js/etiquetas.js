"use strict";

document.addEventListener("sc:ready", function () {
  const ITEMS_KEY = "sc_items";

  const COND_LABELS = {
    otimo:   { label: "Ótimo",     cls: "label-cond-otimo" },
    bom:     { label: "Bom",       cls: "label-cond-otimo" },
    reparo:  { label: "Reparo",    cls: "label-cond-reparo" },
    ruim:    { label: "Reparo",    cls: "label-cond-reparo" },
    inativo: { label: "Descartar", cls: "label-cond-descartar" },
  };

  const MOCK_ITEMS = [
    { id: "101", nome: "Notebook Dell XPS 15", patrimonio: "PAT-2024-001", condicao: "otimo",   total: 5,  disponivel: 3,  categoria: "Informática",       localizacao: "Sala 201",    responsavel: "TI",             valor: 4500, tags: ["notebook","dell"],    created_at: "2024-01-10T10:00:00Z" },
    { id: "102", nome: "Projetor Epson 3200",  patrimonio: "PAT-2024-002", condicao: "reparo",  total: 2,  disponivel: 0,  categoria: "Audiovisual",        localizacao: "Auditório",   responsavel: "TI",             valor: 2800, tags: ["projetor"],           created_at: "2024-02-15T10:00:00Z" },
    { id: "103", nome: "Cadeira Herman Miller", patrimonio: "PAT-2024-003", condicao: "otimo",  total: 20, disponivel: 15, categoria: "Mobiliário",          localizacao: "Escritório",  responsavel: "Administrativo", valor: 1200, tags: ["cadeira"],            created_at: "2024-03-01T10:00:00Z" },
    { id: "104", nome: "Switch TP-Link 24p",   patrimonio: "PAT-2024-004", condicao: "bom",     total: 3,  disponivel: 2,  categoria: "Rede",               localizacao: "Servidor",    responsavel: "TI",             valor: 650,  tags: ["rede","switch"],      created_at: "2024-03-15T10:00:00Z" },
    { id: "105", nome: "Mesa de Escritório 160cm", patrimonio: "PAT-2024-005", condicao: "otimo", total: 10, disponivel: 8, categoria: "Mobiliário",        localizacao: "Coworking",   responsavel: "Administrativo", valor: 850,  tags: ["mesa"],              created_at: "2024-04-01T10:00:00Z" },
    { id: "106", nome: "Monitor LG 27\" 4K",   patrimonio: "PAT-2024-006", condicao: "otimo",   total: 8,  disponivel: 6,  categoria: "Informática",       localizacao: "Sala 102",    responsavel: "TI",             valor: 1800, tags: ["monitor"],            created_at: "2024-04-10T10:00:00Z" },
    { id: "107", nome: "Impressora HP LaserJet", patrimonio: "PAT-2024-007", condicao: "reparo", total: 2, disponivel: 1,  categoria: "Informática",        localizacao: "Recepção",    responsavel: "TI",             valor: 1200, tags: ["impressora"],         created_at: "2024-04-20T10:00:00Z" },
    { id: "108", nome: "Ar-Condicionado Springer 12000", patrimonio: "PAT-2024-008", condicao: "otimo", total: 5, disponivel: 5, categoria: "Climatização", localizacao: "Sala 301",    responsavel: "Manutenção",     valor: 2200, tags: ["ar-condicionado"],    created_at: "2024-05-01T10:00:00Z" },
    { id: "109", nome: "Tablet Samsung Galaxy Tab S8", patrimonio: "PAT-2024-009", condicao: "inativo", total: 3, disponivel: 0, categoria: "Informática", localizacao: "Almoxarifado", responsavel: "TI",            valor: 900,  tags: ["tablet","samsung"],   created_at: "2024-05-10T10:00:00Z" },
    { id: "110", nome: "Telefone IP Cisco",    patrimonio: "PAT-2024-010", condicao: "bom",     total: 15, disponivel: 12, categoria: "Telecomunicações",   localizacao: "Geral",       responsavel: "TI",             valor: 350,  tags: ["telefone","voip"],    created_at: "2024-05-20T10:00:00Z" },
    { id: "111", nome: "Estabilizador NHS 1400VA", patrimonio: "PAT-2024-011", condicao: "otimo", total: 6, disponivel: 4, categoria: "Energia",           localizacao: "Servidor",    responsavel: "TI",             valor: 280,  tags: ["estabilizador","nhs"], created_at: "2024-06-01T10:00:00Z" },
    { id: "112", nome: "Webcam Logitech C920", patrimonio: "PAT-2024-012", condicao: "otimo",   total: 10, disponivel: 7,  categoria: "Periféricos",       localizacao: "Home Office",  responsavel: "TI",            valor: 420,  tags: ["webcam","logitech"],  created_at: "2024-06-10T10:00:00Z" },
  ];

  const state = {
    page: 1, perPage: 15, total: 0,
    search: "", category: "",
    pageItems: [],
    selected: new Set(),
    size: "sm",
    showAsset: true, showCondition: true, showQty: true, showOrg: true,
    showCategory: false, showSerie: false,
    orgName: "StockControl / USCS",
  };

  const itemsList  = document.getElementById("items-list");
  const previewArea = document.getElementById("label-preview-area");
  const printArea  = document.getElementById("print-area");
  const printBtn   = document.getElementById("btn-print");
  const pdfBtn     = document.getElementById("btn-export-pdf");
  const printCount = document.getElementById("print-count");
  const selCount   = document.getElementById("selected-count");

  // ── Storage ────────────────────────────────────────────────────────────────
  function getStoredItems() {
    try { return JSON.parse(localStorage.getItem(ITEMS_KEY) || "[]"); } catch { return []; }
  }

  function seedIfEmpty() {
    if (!getStoredItems().length) {
      localStorage.setItem(ITEMS_KEY, JSON.stringify(MOCK_ITEMS));
    }
  }

  function getFilteredItems() {
    let items = getStoredItems();
    if (state.search) {
      const q = state.search.toLowerCase();
      items = items.filter(i =>
        (i.nome       || "").toLowerCase().includes(q) ||
        (i.patrimonio || "").toLowerCase().includes(q) ||
        (i.categoria  || "").toLowerCase().includes(q) ||
        (i.responsavel|| "").toLowerCase().includes(q)
      );
    }
    if (state.category) {
      items = items.filter(i => (i.categoria || "") === state.category);
    }
    return items;
  }

  function getSelectedItems() {
    return getStoredItems().filter(i => state.selected.has(String(i.id)));
  }

  // ── QR Code ────────────────────────────────────────────────────────────────
  async function getQRDataUrl(text) {
    if (typeof QRCode === "undefined" || !text) return null;
    try {
      return await QRCode.toDataURL(String(text), {
        width: 72, margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
    } catch { return null; }
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    seedIfEmpty();
    state.orgName =
      SC.currentUser?.organizationName ||
      SC.currentUser?.organization?.name ||
      "StockControl / USCS";
    populateCategoryFilter();
    wireFilters();
    wireTemplates();
    wireFieldToggles();
    wirePrintButtons();
    loadAndRender();
  }

  // ── Category filter ────────────────────────────────────────────────────────
  function populateCategoryFilter() {
    const sel = document.getElementById("filter-category");
    if (!sel) return;
    const cats = [...new Set(getStoredItems().map(i => i.categoria).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">Todas as categorias</option>' +
      cats.map(c => `<option value="${SC.escHtml(c)}">${SC.escHtml(c)}</option>`).join("");
  }

  // ── Load & render ──────────────────────────────────────────────────────────
  function loadAndRender() {
    const all = getFilteredItems();
    state.total = all.length;
    const start = (state.page - 1) * state.perPage;
    state.pageItems = all.slice(start, start + state.perPage);
    renderList();
    renderPagination();
    syncSelectAll();
  }

  function renderList() {
    if (!itemsList) return;
    if (!state.pageItems.length) {
      itemsList.innerHTML = `<div style="padding:32px;text-align:center;color:var(--color-text-muted);font-size:13px">Nenhum item encontrado</div>`;
      return;
    }

    itemsList.innerHTML = state.pageItems.map(item => {
      const cond = COND_LABELS[item.condicao] || COND_LABELS.otimo;
      const isSelected = state.selected.has(String(item.id));
      const foto = item.foto || "";
      return `
        <div class="item-row${isSelected ? " selected" : ""}" data-id="${item.id}">
          <input type="checkbox" class="form-checkbox item-check" data-id="${item.id}"${isSelected ? " checked" : ""} />
          ${foto
            ? `<img src="${foto}" width="32" height="32" style="border-radius:4px;object-fit:cover;flex-shrink:0" alt="">`
            : `<div style="width:32px;height:32px;border-radius:4px;background:var(--color-surface-alt);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:16px">📦</div>`}
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${SC.escHtml(item.nome || "")}</div>
            <div style="font-size:11px;color:var(--color-text-muted)">${item.patrimonio ? SC.escHtml(item.patrimonio) : "Sem patrimônio"} · ${SC.escHtml(item.categoria || "")} · Qtd: ${item.total ?? 0}</div>
          </div>
          <span class="${cond.cls}" style="font-size:10px;padding:2px 6px;border-radius:99px;font-weight:600;flex-shrink:0">${cond.label}</span>
        </div>`;
    }).join("");

    itemsList.querySelectorAll(".item-check").forEach(cb => {
      cb.addEventListener("change", () => {
        const id = cb.dataset.id;
        if (cb.checked) state.selected.add(id);
        else state.selected.delete(id);
        cb.closest(".item-row").classList.toggle("selected", cb.checked);
        syncSelectAll();
        updateCounters();
        schedulePreview();
      });
    });

    itemsList.querySelectorAll(".item-row").forEach(row => {
      row.addEventListener("click", e => {
        if (e.target.classList.contains("item-check") || e.target.type === "checkbox") return;
        const cb = row.querySelector(".item-check");
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event("change"));
      });
    });
  }

  function renderPagination() {
    SC.renderPagination({
      containerId: "labelPagControls",
      infoId:      "labelPagInfo",
      page:        state.page,
      perPage:     state.perPage,
      total:       state.total,
      onPageChange: p => { state.page = p; loadAndRender(); },
    });
  }

  // ── Select all ─────────────────────────────────────────────────────────────
  function syncSelectAll() {
    const cb = document.getElementById("select-all");
    if (!cb) return;
    const pageIds = state.pageItems.map(i => String(i.id));
    if (!pageIds.length) { cb.checked = false; cb.indeterminate = false; return; }
    const allChecked  = pageIds.every(id => state.selected.has(id));
    const someChecked = pageIds.some(id  => state.selected.has(id));
    cb.checked       = allChecked;
    cb.indeterminate = someChecked && !allChecked;
    updateCounters();
  }

  function updateCounters() {
    const n = state.selected.size;
    if (selCount) selCount.textContent = `${n} selecionado${n !== 1 ? "s" : ""}`;
    const pc = document.getElementById("print-count");
    if (pc) pc.textContent = n;
    if (printBtn) printBtn.disabled = n === 0;
    if (pdfBtn)   pdfBtn.disabled   = n === 0;
  }

  // ── Filters ────────────────────────────────────────────────────────────────
  function wireFilters() {
    document.getElementById("search-input")?.addEventListener("input", SC.debounce(() => {
      state.search = document.getElementById("search-input").value.trim();
      state.page = 1;
      loadAndRender();
    }, 300));

    document.getElementById("filter-category")?.addEventListener("change", e => {
      state.category = e.target.value;
      state.page = 1;
      loadAndRender();
    });

    document.getElementById("select-all")?.addEventListener("change", e => {
      state.pageItems.forEach(item => {
        if (e.target.checked) state.selected.add(String(item.id));
        else state.selected.delete(String(item.id));
      });
      renderList();
      updateCounters();
      schedulePreview();
    });
  }

  // ── Size templates ─────────────────────────────────────────────────────────
  function wireTemplates() {
    document.querySelectorAll(".label-tpl").forEach(tpl => {
      tpl.addEventListener("click", () => {
        document.querySelectorAll(".label-tpl").forEach(t => t.classList.remove("active"));
        tpl.classList.add("active");
        state.size = tpl.dataset.size;
        schedulePreview();
      });
    });
  }

  // ── Field toggles ──────────────────────────────────────────────────────────
  function wireFieldToggles() {
    const map = {
      "show-asset":     "showAsset",
      "show-condition": "showCondition",
      "show-qty":       "showQty",
      "show-org":       "showOrg",
      "show-category":  "showCategory",
      "show-serie":     "showSerie",
    };
    Object.entries(map).forEach(([id, key]) => {
      document.getElementById(id)?.addEventListener("change", e => {
        state[key] = e.target.checked;
        schedulePreview();
      });
    });
  }

  // ── Preview ────────────────────────────────────────────────────────────────
  let previewTimer = null;
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 200);
  }

  async function renderPreview() {
    if (!previewArea) return;
    const items = getSelectedItems();
    if (!items.length) {
      previewArea.innerHTML = `<div style="color:var(--color-text-muted);font-size:13px;text-align:center;padding:20px 0">Selecione itens para visualizar</div>`;
      return;
    }

    previewArea.innerHTML = `<div style="color:var(--color-text-muted);font-size:12px">Gerando pré-visualização…</div>`;

    const preview = items.slice(0, 3);
    const qrUrls = await Promise.all(
      preview.map(item => getQRDataUrl(item.patrimonio || item.nome || item.id))
    );

    previewArea.innerHTML =
      preview.map((item, i) => buildLabelHTML(item, qrUrls[i])).join("") +
      (items.length > 3
        ? `<div style="font-size:12px;color:var(--color-text-muted);margin-top:4px">+${items.length - 3} etiqueta(s) adicional(is)</div>`
        : "");
  }

  function buildLabelHTML(item, qrDataUrl) {
    const cond = COND_LABELS[item.condicao] || COND_LABELS.otimo;
    const sizeClass = `label-${state.size}`;
    const qrSize = state.size === "lg" ? 52 : state.size === "md" ? 44 : 36;

    const qrEl = qrDataUrl
      ? `<img src="${qrDataUrl}" width="${qrSize}" height="${qrSize}" style="border-radius:2px;flex-shrink:0" alt="QR">`
      : `<div class="label-qr-placeholder" style="width:${qrSize}px;height:${qrSize}px" title="QR"></div>`;

    return `
      <div class="label-item ${sizeClass}">
        ${state.showOrg ? `<div class="label-org">${SC.escHtml(state.orgName)}</div>` : ""}
        <div class="label-name">${SC.escHtml(item.nome || "")}</div>
        ${state.showCategory && item.categoria ? `<div class="label-cat">${SC.escHtml(item.categoria)}</div>` : ""}
        <div class="label-meta">
          ${state.showAsset && item.patrimonio    ? `<span class="label-asset">${SC.escHtml(item.patrimonio)}</span>` : ""}
          ${state.showCondition                   ? `<span class="label-cond ${cond.cls}">${cond.label}</span>` : ""}
          ${state.showQty                         ? `<span class="label-qty">Qtd: ${item.total ?? 0}</span>` : ""}
          ${state.showSerie && item.serie         ? `<span class="label-qty">S/N: ${SC.escHtml(item.serie)}</span>` : ""}
        </div>
        <div class="label-qr">
          <span class="label-date">${new Date().toLocaleDateString("pt-BR")}</span>
          ${qrEl}
        </div>
      </div>`;
  }

  // ── Print / PDF ────────────────────────────────────────────────────────────
  function wirePrintButtons() {
    printBtn?.addEventListener("click", () => doPrint(false));
    pdfBtn?.addEventListener("click",   () => doPrint(true));
  }

  async function doPrint(isPdf) {
    const items = getSelectedItems();
    if (!items.length || !printArea) return;

    printBtn.disabled = true;
    printBtn.textContent = "Preparando…";

    if (isPdf) {
      showToast("No diálogo de impressão, selecione 'Salvar como PDF'.", "info");
    }

    const qrUrls = await Promise.all(
      items.map(item => getQRDataUrl(item.patrimonio || item.nome || item.id))
    );

    printArea.innerHTML = items.map((item, i) => buildLabelHTML(item, qrUrls[i])).join("");
    printArea.style.display = "flex";
    printArea.style.flexWrap = "wrap";
    printArea.style.gap = "6mm";
    printArea.style.padding = "8mm";

    await new Promise(r => requestAnimationFrame(r));
    window.print();

    setTimeout(() => {
      printArea.style.display = "none";
      const n = state.selected.size;
      printBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Imprimir Etiquetas (<span id="print-count">${n}</span>)`;
      printBtn.disabled = n === 0;
    }, 500);
  }

  // ── Toast ──────────────────────────────────────────────────────────────────
  function showToast(msg, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 300);
    }, 4000);
  }

  init();
});
