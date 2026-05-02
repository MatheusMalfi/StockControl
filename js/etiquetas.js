"use strict";

document.addEventListener("sc:ready", function () {
  const ITEMS_KEY = "sc_items";

  const BADGE_MAP = {
    otimo:   { cls: "badge-otimo",    label: "Ótimo" },
    bom:     { cls: "badge-bom",      label: "Bom" },
    reparo:  { cls: "badge-reparo",   label: "Reparo" },
    ruim:    { cls: "badge-regular",  label: "Regular" },
    inativo: { cls: "badge-descarte", label: "Descarte" },
  };

  const EMOJI_MAP = {
    "Informática": "💻", "Audiovisual": "📽️", "Mobiliário": "🪑",
    "Rede": "🌐", "Climatização": "❄️", "Telecomunicações": "📞",
    "Energia": "⚡", "Periféricos": "🖱️", "Ferramentas": "🔧",
  };

  // QR canvas size in pixels (preview / print)
  const QR_PX = {
    pequena: { preview: 32, print: 56 },
    media:   { preview: 40, print: 72 },
    grande:  { preview: 50, print: 88 },
  };

  const MOCK_ITEMS = [
    { id: "101", nome: "Notebook Dell XPS 15",           patrimonio: "PAT-2024-001", condicao: "otimo",   total: 5,  disponivel: 3,  categoria: "Informática",       localizacao: "Sala 201",     responsavel: "TI",             valor: 4500, tags: ["notebook","dell"],     created_at: "2024-01-10T10:00:00Z" },
    { id: "102", nome: "Projetor Epson 3200",            patrimonio: "PAT-2024-002", condicao: "reparo",  total: 2,  disponivel: 0,  categoria: "Audiovisual",        localizacao: "Auditório",    responsavel: "TI",             valor: 2800, tags: ["projetor"],            created_at: "2024-02-15T10:00:00Z" },
    { id: "103", nome: "Cadeira Herman Miller",          patrimonio: "PAT-2024-003", condicao: "otimo",   total: 20, disponivel: 15, categoria: "Mobiliário",         localizacao: "Escritório",   responsavel: "Administrativo", valor: 1200, tags: ["cadeira"],             created_at: "2024-03-01T10:00:00Z" },
    { id: "104", nome: "Switch TP-Link 24 portas",       patrimonio: "PAT-2024-004", condicao: "bom",     total: 3,  disponivel: 2,  categoria: "Rede",               localizacao: "Servidor",     responsavel: "TI",             valor: 650,  tags: ["rede","switch"],       created_at: "2024-03-15T10:00:00Z" },
    { id: "105", nome: "Mesa de Escritório 160cm",       patrimonio: "PAT-2024-005", condicao: "otimo",   total: 10, disponivel: 8,  categoria: "Mobiliário",         localizacao: "Coworking",    responsavel: "Administrativo", valor: 850,  tags: ["mesa"],               created_at: "2024-04-01T10:00:00Z" },
    { id: "106", nome: "Monitor LG 27\" 4K",             patrimonio: "PAT-2024-006", condicao: "otimo",   total: 8,  disponivel: 6,  categoria: "Informática",        localizacao: "Sala 102",     responsavel: "TI",             valor: 1800, tags: ["monitor"],             created_at: "2024-04-10T10:00:00Z" },
    { id: "107", nome: "Impressora HP LaserJet Pro",     patrimonio: "PAT-2024-007", condicao: "reparo",  total: 2,  disponivel: 1,  categoria: "Informática",        localizacao: "Recepção",     responsavel: "TI",             valor: 1200, tags: ["impressora"],          created_at: "2024-04-20T10:00:00Z" },
    { id: "108", nome: "Ar-Condicionado Springer 12000", patrimonio: "PAT-2024-008", condicao: "otimo",   total: 5,  disponivel: 5,  categoria: "Climatização",       localizacao: "Sala 301",     responsavel: "Manutenção",     valor: 2200, tags: ["ar-condicionado"],     created_at: "2024-05-01T10:00:00Z" },
    { id: "109", nome: "Tablet Samsung Galaxy Tab S8",   patrimonio: "PAT-2024-009", condicao: "inativo", total: 3,  disponivel: 0,  categoria: "Informática",        localizacao: "Almoxarifado", responsavel: "TI",             valor: 900,  tags: ["tablet","samsung"],    created_at: "2024-05-10T10:00:00Z" },
    { id: "110", nome: "Telefone IP Cisco 7961",         patrimonio: "PAT-2024-010", condicao: "bom",     total: 15, disponivel: 12, categoria: "Telecomunicações",   localizacao: "Geral",        responsavel: "TI",             valor: 350,  tags: ["telefone","voip"],     created_at: "2024-05-20T10:00:00Z" },
    { id: "111", nome: "Estabilizador NHS 1400VA",       patrimonio: "PAT-2024-011", condicao: "otimo",   total: 6,  disponivel: 4,  categoria: "Energia",            localizacao: "Servidor",     responsavel: "TI",             valor: 280,  tags: ["estabilizador","nhs"], created_at: "2024-06-01T10:00:00Z" },
    { id: "112", nome: "Webcam Logitech C920",           patrimonio: "PAT-2024-012", condicao: "otimo",   total: 10, disponivel: 7,  categoria: "Periféricos",        localizacao: "Home Office",  responsavel: "TI",             valor: 420,  tags: ["webcam","logitech"],   created_at: "2024-06-10T10:00:00Z" },
  ];

  const state = {
    search: "", category: "",
    allItems: [],
    selected: new Set(),
    tamanho: "pequena",
    showPatrimonio: true, showCondicao: true, showQtd: true,
    showCategoria: false, showOrg: false, showSerie: false,
    orgName: "StockControl / USCS",
  };

  // ── DOM refs ────────────────────────────────────────────────────────────────
  const listaItens    = document.getElementById("listaItens");
  const areaPreview   = document.getElementById("areaPreview");
  const gridImpressao = document.getElementById("gridImpressao");
  const areaImpressao = document.getElementById("areaImpressao");
  const btnImprimir   = document.getElementById("btnImprimir");
  const btnPdf        = document.getElementById("btnPdf");

  // ── Storage ─────────────────────────────────────────────────────────────────
  function getStoredItems() {
    try { return JSON.parse(localStorage.getItem(ITEMS_KEY) || "[]"); } catch { return []; }
  }

  function seedIfEmpty() {
    if (!getStoredItems().length) localStorage.setItem(ITEMS_KEY, JSON.stringify(MOCK_ITEMS));
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
    if (state.category) items = items.filter(i => (i.categoria || "") === state.category);
    return items;
  }

  function getSelectedItems() {
    return getStoredItems().filter(i => state.selected.has(String(i.id)));
  }

  // ── QR Code ─────────────────────────────────────────────────────────────────
  async function createQRCanvas(text, size) {
    if (typeof QRCode === "undefined" || !text) return null;
    const canvas = document.createElement("canvas");
    try {
      await QRCode.toCanvas(canvas, String(text), { width: size, margin: 0,
        color: { dark: "#000000", light: "#ffffff" } });
      return canvas;
    } catch { return null; }
  }

  // ── Init ────────────────────────────────────────────────────────────────────
  function init() {
    seedIfEmpty();
    state.orgName =
      SC.currentUser?.organizationName ||
      SC.currentUser?.organization?.name ||
      "StockControl / USCS";
    populateCategoryFilter();
    wireSearch();
    wireCategoryFilter();
    wireSelectAll();
    wireClearButtons();
    wireSizeCards();
    wireFieldToggles();
    wirePrintButtons();
    loadAndRender();
  }

  // ── Category filter ─────────────────────────────────────────────────────────
  function populateCategoryFilter() {
    const sel = document.getElementById("filtroCategoria");
    if (!sel) return;
    const cats = [...new Set(getStoredItems().map(i => i.categoria).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">Todas as categorias</option>' +
      cats.map(c => `<option value="${SC.escHtml(c)}">${SC.escHtml(c)}</option>`).join("");
  }

  // ── Load & render ────────────────────────────────────────────────────────────
  function loadAndRender() {
    state.allItems = getFilteredItems();
    renderList();
  }

  function renderList() {
    if (!listaItens) return;

    if (!state.allItems.length) {
      listaItens.innerHTML = `
        <div class="estado-vazio">
          <div class="icone">📦</div>
          <h3>Nenhum item encontrado</h3>
          <p>${state.search || state.category ? "Tente ajustar os filtros" : "Cadastre itens no estoque primeiro"}</p>
          ${!state.search && !state.category ? `<a href="form-item.html"><button class="btn-acao-vazio">Cadastrar item</button></a>` : ""}
        </div>`;
      updateCounters();
      return;
    }

    listaItens.innerHTML = "";
    state.allItems.forEach(item => {
      listaItens.appendChild(createItemRow(item));
    });

    updateCounters();
    syncSelectAll();
  }

  function createItemRow(item) {
    const isSelected = state.selected.has(String(item.id));
    const cond = BADGE_MAP[item.condicao] || BADGE_MAP.otimo;
    const emoji = EMOJI_MAP[item.categoria] || "📦";

    const div = document.createElement("div");
    div.className = `item-linha${isSelected ? " selecionado" : ""}`;
    div.dataset.id = String(item.id);

    div.innerHTML = `
      <input type="checkbox" class="item-check"${isSelected ? " checked" : ""} aria-label="Selecionar ${SC.escHtml(item.nome || "")}">
      <div class="item-icone">${emoji}</div>
      <div class="item-info">
        <div class="item-nome">${SC.escHtml(item.nome || "")}</div>
        <div class="item-meta">
          ${item.categoria ? `<span class="item-categoria">${SC.escHtml(item.categoria)}</span>` : ""}
          <span class="badge-condicao ${cond.cls}">${cond.label}</span>
        </div>
      </div>
      <div class="item-direita">
        <div class="item-patrimonio">${item.patrimonio ? SC.escHtml(item.patrimonio) : "—"}</div>
        <div class="item-qtd">Qtd: ${item.total ?? 0}</div>
      </div>`;

    const cb = div.querySelector(".item-check");

    cb.addEventListener("change", () => {
      const id = String(item.id);
      if (cb.checked) state.selected.add(id);
      else state.selected.delete(id);
      div.classList.toggle("selecionado", cb.checked);
      syncSelectAll();
      updateCounters();
      schedulePreview();
    });

    div.addEventListener("click", e => {
      if (e.target.type === "checkbox") return;
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event("change"));
    });

    return div;
  }

  // ── Select all ──────────────────────────────────────────────────────────────
  function syncSelectAll() {
    const cb = document.getElementById("selecionarTodos");
    if (!cb || !state.allItems.length) {
      if (cb) { cb.checked = false; cb.indeterminate = false; }
      return;
    }
    const ids = state.allItems.map(i => String(i.id));
    const allOn  = ids.every(id => state.selected.has(id));
    const someOn = ids.some(id  => state.selected.has(id));
    cb.checked       = allOn;
    cb.indeterminate = someOn && !allOn;
  }

  function updateCounters() {
    const n = state.selected.size;
    const total = state.allItems.length;

    const elCount = document.getElementById("contadorSelecionados");
    if (elCount) {
      elCount.textContent = `${n} selecionado${n !== 1 ? "s" : ""}`;
      elCount.classList.toggle("ativo", n > 0);
    }
    const elInfo = document.getElementById("infoItens");
    if (elInfo) elInfo.textContent = `${total} item${total !== 1 ? "s" : ""}`;
    const elCi = document.getElementById("contadorImpressao");
    if (elCi) elCi.textContent = n;
    if (btnImprimir) btnImprimir.disabled = n === 0;
    if (btnPdf)      btnPdf.disabled      = n === 0;
  }

  // ── Wiring ───────────────────────────────────────────────────────────────────
  function wireSearch() {
    const input = document.getElementById("buscaInput");
    if (!input) return;
    input.addEventListener("input", SC.debounce(() => {
      state.search = input.value.trim();
      loadAndRender();
    }, 300));
  }

  function wireCategoryFilter() {
    document.getElementById("filtroCategoria")?.addEventListener("change", e => {
      state.category = e.target.value;
      loadAndRender();
    });
  }

  function wireSelectAll() {
    document.getElementById("selecionarTodos")?.addEventListener("change", e => {
      state.allItems.forEach(item => {
        if (e.target.checked) state.selected.add(String(item.id));
        else state.selected.delete(String(item.id));
      });
      renderList();
      schedulePreview();
    });
  }

  function wireClearButtons() {
    document.getElementById("btnLimparBusca")?.addEventListener("click", () => {
      const input = document.getElementById("buscaInput");
      if (input) input.value = "";
      state.search = "";
      loadAndRender();
    });

    document.getElementById("btnLimparSel")?.addEventListener("click", () => {
      state.selected.clear();
      renderList();
      schedulePreview();
    });
  }

  function wireSizeCards() {
    document.querySelectorAll(".card-tamanho").forEach(card => {
      card.addEventListener("click", () => {
        document.querySelectorAll(".card-tamanho").forEach(c => c.classList.remove("ativo"));
        card.classList.add("ativo");
        state.tamanho = card.dataset.tamanho;
        schedulePreview();
      });
    });
  }

  function wireFieldToggles() {
    const map = {
      showPatrimonio: "showPatrimonio", showCondicao: "showCondicao",
      showQtd: "showQtd", showCategoria: "showCategoria",
      showOrg: "showOrg", showSerie: "showSerie",
    };
    Object.entries(map).forEach(([id, key]) => {
      document.getElementById(id)?.addEventListener("change", e => {
        state[key] = e.target.checked;
        schedulePreview();
      });
    });
  }

  // ── Preview ─────────────────────────────────────────────────────────────────
  let previewTimer = null;
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 200);
  }

  async function renderPreview() {
    if (!areaPreview) return;
    const items = getSelectedItems();

    if (!items.length) {
      areaPreview.innerHTML = `
        <div class="preview-vazio">
          <div class="icone-preview">🏷️</div>
          <p>Selecione itens para visualizar</p>
        </div>`;
      return;
    }

    areaPreview.innerHTML = `<div class="preview-gerando">Gerando pré-visualização…</div>`;

    const wrapper = document.createElement("div");
    wrapper.className = "preview-etiquetas";

    const preview = items.slice(0, 3);
    const qrPx = QR_PX[state.tamanho].preview;

    for (const item of preview) {
      const el = buildPreviewEl(item);
      wrapper.appendChild(el);
      const qrDiv = el.querySelector(".preview-qr");
      if (qrDiv) {
        const qrText = item.patrimonio || item.nome || String(item.id);
        const canvas = await createQRCanvas(qrText, qrPx);
        if (canvas) qrDiv.appendChild(canvas);
      }
    }

    if (items.length > 3) {
      const more = document.createElement("p");
      more.className = "preview-mais";
      more.textContent = `+${items.length - 3} etiqueta(s) adicional(is)`;
      wrapper.appendChild(more);
    }

    areaPreview.innerHTML = "";
    areaPreview.appendChild(wrapper);
  }

  function buildPreviewEl(item) {
    const cond = BADGE_MAP[item.condicao] || BADGE_MAP.otimo;
    const sizeClass = state.tamanho !== "pequena" ? ` ${state.tamanho}` : "";

    const div = document.createElement("div");
    div.className = `etiqueta-preview${sizeClass}`;

    const infoParts = [];
    if (state.showCategoria && item.categoria) infoParts.push(SC.escHtml(item.categoria));
    if (state.showQtd) infoParts.push(`Qtd: ${item.total ?? 0}`);
    if (state.showOrg) infoParts.push(SC.escHtml(state.orgName));
    if (state.showSerie && item.serie) infoParts.push(`S/N: ${SC.escHtml(item.serie)}`);

    div.innerHTML = `
      <div class="preview-qr"></div>
      <div class="preview-campos">
        <div class="preview-nome">${SC.escHtml(item.nome || "")}</div>
        ${state.showPatrimonio && item.patrimonio ? `<div class="preview-pat">${SC.escHtml(item.patrimonio)}</div>` : ""}
        ${infoParts.length ? `<div class="preview-info">${infoParts.join(" · ")}</div>` : ""}
        ${state.showCondicao ? `<span class="preview-badge ${cond.cls}">${cond.label}</span>` : ""}
      </div>`;

    return div;
  }

  // ── Print / PDF ─────────────────────────────────────────────────────────────
  function wirePrintButtons() {
    btnImprimir?.addEventListener("click", () => doPrint(false));
    btnPdf?.addEventListener("click",      () => doPrint(true));
  }

  async function doPrint(isPdf) {
    const items = getSelectedItems();
    if (!items.length || !gridImpressao || !areaImpressao) return;

    const savedInnerHTML = btnImprimir.innerHTML;
    btnImprimir.disabled = true;
    btnImprimir.textContent = "Preparando…";

    if (isPdf) showToast("Selecione 'Salvar como PDF' no diálogo de impressão.", "info");

    // Build print grid
    gridImpressao.innerHTML = "";
    const qrPx = QR_PX[state.tamanho].print;

    for (const item of items) {
      const el = buildPrintEl(item);
      gridImpressao.appendChild(el);
      const qrDiv = el.querySelector(".print-qr");
      if (qrDiv) {
        const canvas = await createQRCanvas(item.patrimonio || item.nome || String(item.id), qrPx);
        if (canvas) qrDiv.appendChild(canvas);
      }
    }

    // @media print shows .area-impressao via display:block !important
    await new Promise(r => requestAnimationFrame(r));
    window.print();

    setTimeout(() => {
      const n = state.selected.size;
      btnImprimir.innerHTML = savedInnerHTML;
      btnImprimir.disabled = n === 0;
      const ci = document.getElementById("contadorImpressao");
      if (ci) ci.textContent = n;
    }, 600);
  }

  function buildPrintEl(item) {
    const cond = BADGE_MAP[item.condicao] || BADGE_MAP.otimo;

    const infoParts = [];
    if (state.showCondicao) infoParts.push(cond.label);
    if (state.showCategoria && item.categoria) infoParts.push(SC.escHtml(item.categoria));
    if (state.showQtd) infoParts.push(`Qtd: ${item.total ?? 0}`);
    if (state.showOrg) infoParts.push(SC.escHtml(state.orgName));
    if (state.showSerie && item.serie) infoParts.push(`S/N: ${SC.escHtml(item.serie)}`);

    const div = document.createElement("div");
    div.className = `etiqueta-print ${state.tamanho}`;
    div.innerHTML = `
      <div class="print-qr"></div>
      <div class="print-campos">
        <span class="print-nome">${SC.escHtml(item.nome || "")}</span>
        ${state.showPatrimonio && item.patrimonio ? `<span class="print-pat">${SC.escHtml(item.patrimonio)}</span>` : ""}
        ${infoParts.length ? `<span class="print-info">${infoParts.join(" · ")}</span>` : ""}
      </div>`;

    return div;
  }

  // ── Toast ────────────────────────────────────────────────────────────────────
  function showToast(msg, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add("saindo");
      setTimeout(() => el.remove(), 280);
    }, 4000);
  }

  init();
});
