"use strict";

// ════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ════════════════════════════════════════════════════════
const Estado = {
  itens: [],
  itensFiltrados: [],
  itensSelecionados: [],
  tamanho: "pequena",
  orgName: "StockControl / USCS",
  campos: {
    patrimonio: true,
    condicao: true,
    quantidade: true,
    organizacao: true,
    categoria: false,
    serie: false,
  },
};

// ════════════════════════════════════════════════════════
// 1. INICIALIZAÇÃO
// ════════════════════════════════════════════════════════
function initEtiquetas() {
  carregarPreferencias();
  carregarItens(true);
  carregarCategorias();
  bindEventos();
  renderListaItens(Estado.itens);
  atualizarBotaoImprimir();
  agendarPreview();

  requestAnimationFrame(() => carregarItens());
}

function _etiqToken() {
  return localStorage.getItem("sc_token") || sessionStorage.getItem("sc_token");
}

function carregarItens(useCacheOnly = false) {
  const salvo = localStorage.getItem("estoque_itens");
  Estado.itens = salvo ? JSON.parse(salvo) : [];
  if (!salvo) localStorage.setItem("estoque_itens", JSON.stringify([]));
  Estado.itensFiltrados = [...Estado.itens];

  const user = window.SC?.currentUser;
  if (user) {
    Estado.orgName =
      user.organizationName || user.organization?.name || Estado.orgName;
  }

  if (useCacheOnly) {
    return;
  }

  const token = _etiqToken();
  fetch("/api/items", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((data) => {
      const itens = (Array.isArray(data) ? data : data.items || []).map(
        (it) => ({
          id: String(it.id),
          nome: it.nome,
          patrimonio: it.patrimonio || "",
          condicao: it.condicao || "otimo",
          qtdTotal: it.total || 0,
          qtdDisponivel: it.disponivel || 0,
          categoria: it.categoria || "",
          numeroSerie: it.numero_serie || it.numeroSerie || "",
        }),
      );

      const atualHash = JSON.stringify(Estado.itens);
      const novoHash = JSON.stringify(itens);
      if (itens.length && novoHash !== atualHash) {
        localStorage.setItem("estoque_itens", novoHash);
        Estado.itens = itens;
        Estado.itensFiltrados = [...itens];
        renderListaItens(Estado.itens);
        atualizarBotaoImprimir();
      }
    })
    .catch(() => {});
}

function carregarPreferencias() {
  const pref = JSON.parse(localStorage.getItem("etiquetas_prefs") || "{}");
  if (pref.tamanho) Estado.tamanho = pref.tamanho;
  if (pref.campos) Estado.campos = { ...Estado.campos, ...pref.campos };
  aplicarPreferenciasUI();
}

function salvarPreferencias() {
  localStorage.setItem(
    "etiquetas_prefs",
    JSON.stringify({
      tamanho: Estado.tamanho,
      campos: Estado.campos,
    }),
  );
}

function aplicarPreferenciasUI() {
  document.querySelectorAll(".card-tamanho").forEach((c) => {
    c.classList.toggle("ativo", c.dataset.tamanho === Estado.tamanho);
  });
  Object.keys(Estado.campos).forEach((campo) => {
    const cb = document.querySelector(`[data-campo="${campo}"]`);
    if (cb) cb.checked = Estado.campos[campo];
  });
}

function carregarCategorias() {
  const cats = [
    ...new Set(Estado.itens.map((i) => i.categoria).filter(Boolean)),
  ].sort();
  const sel = document.getElementById("filtroCategoria");
  if (!sel) return;
  cats.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    sel.appendChild(opt);
  });
}

function bindEventos() {
  const inputBusca = document.getElementById("buscaItens");
  if (inputBusca) {
    inputBusca.addEventListener(
      "input",
      debounce((e) => {
        const btnX = document.getElementById("btnLimparBusca");
        if (btnX) btnX.style.display = e.target.value ? "block" : "none";
        aplicarFiltros();
      }, 300),
    );
  }

  document.getElementById("btnLimparBusca")?.addEventListener("click", () => {
    const inp = document.getElementById("buscaItens");
    if (inp) inp.value = "";
    const btnX = document.getElementById("btnLimparBusca");
    if (btnX) btnX.style.display = "none";
    aplicarFiltros();
  });

  document
    .getElementById("filtroCategoria")
    ?.addEventListener("change", aplicarFiltros);
  document
    .getElementById("checkboxTodos")
    ?.addEventListener("change", toggleSelecionarTodos);
}

// ════════════════════════════════════════════════════════
// 2. SKELETON LOADING
// ════════════════════════════════════════════════════════
function mostrarSkeleton() {
  const lista = document.getElementById("listaItens");
  if (!lista) return;
  lista.innerHTML = Array(5)
    .fill("")
    .map(
      () => `
    <div class="skeleton-linha">
      <div class="skeleton-box sk-check"></div>
      <div class="skeleton-box sk-icone"></div>
      <div class="sk-info">
        <div class="skeleton-box sk-nome"></div>
        <div class="skeleton-box sk-meta"></div>
      </div>
      <div class="skeleton-box sk-pat"></div>
    </div>`,
    )
    .join("");
}

// ════════════════════════════════════════════════════════
// 3. FILTROS
// ════════════════════════════════════════════════════════
function aplicarFiltros() {
  const termo = normalizar(document.getElementById("buscaItens")?.value || "");
  const cat = document.getElementById("filtroCategoria")?.value || "";

  Estado.itensFiltrados = Estado.itens.filter((item) => {
    const matchBusca =
      !termo ||
      [item.nome, item.patrimonio, item.numeroSerie, item.categoria].some(
        (v) => v && normalizar(v).includes(termo),
      );
    const matchCat = !cat || item.categoria === cat;
    return matchBusca && matchCat;
  });

  // Preservar apenas seleções que ainda aparecem
  const idsVisiveis = Estado.itensFiltrados.map((i) => i.id);
  Estado.itensSelecionados = Estado.itensSelecionados.filter((id) =>
    idsVisiveis.includes(id),
  );

  renderListaItens(Estado.itensFiltrados);
  atualizarUI();
}

function limparFiltros() {
  const inp = document.getElementById("buscaItens");
  if (inp) inp.value = "";
  const btnX = document.getElementById("btnLimparBusca");
  if (btnX) btnX.style.display = "none";
  const sel = document.getElementById("filtroCategoria");
  if (sel) sel.value = "";
  Estado.itensFiltrados = [...Estado.itens];
  Estado.itensSelecionados = [];
  renderListaItens(Estado.itens);
  atualizarUI();
}

// ════════════════════════════════════════════════════════
// 4. RENDER LISTA
// ════════════════════════════════════════════════════════
function renderListaItens(itens) {
  const lista = document.getElementById("listaItens");
  const infoEl = document.getElementById("infoTotal");
  if (!lista) return;

  if (!itens.length) {
    const temFiltro =
      document.getElementById("buscaItens")?.value ||
      document.getElementById("filtroCategoria")?.value;

    lista.innerHTML = temFiltro
      ? `<div class="estado-vazio">
           <div class="icone">🔍</div>
           <h3>Nenhum item encontrado</h3>
           <p>Tente outro termo ou categoria</p>
           <button class="btn-acao-vazio" onclick="limparFiltros()">Limpar filtros</button>
         </div>`
      : `<div class="estado-vazio">
           <div class="icone">📦</div>
           <h3>Nenhum item no estoque</h3>
           <p>Cadastre itens para gerar etiquetas</p>
           <button class="btn-acao-vazio" onclick="location.href='form-item.html'">Cadastrar item</button>
         </div>`;

    if (infoEl) infoEl.textContent = "0 itens";
    return;
  }

  lista.innerHTML = itens.map((item) => renderItemLinha(item)).join("");
  if (infoEl)
    infoEl.textContent = `${itens.length} ite${itens.length !== 1 ? "ns" : "m"}`;
}

function renderItemLinha(item) {
  const sel = Estado.itensSelecionados.includes(item.id);
  const icone = getIconeCategoria(item.categoria);
  const cond = item.condicao || "otimo";
  const condLabel =
    {
      otimo: "Ótimo",
      bom: "Bom",
      regular: "Regular",
      reparo: "Reparo",
      descarte: "Descarte",
    }[cond] || cond;

  return `
    <div class="item-linha${sel ? " selecionado" : ""}" onclick="toggleSelecionarItem('${item.id}')">
      <input type="checkbox"${sel ? " checked" : ""} onclick="event.stopPropagation(); toggleSelecionarItem('${item.id}')">
      <div class="item-icone">${icone}</div>
      <div class="item-info">
        <div class="item-nome">${escHtml(item.nome)}</div>
        <div class="item-meta">
          <span class="item-categoria">${escHtml(item.categoria || "—")}</span>
          <span class="badge-condicao badge-${cond}">${condLabel}</span>
        </div>
      </div>
      <div class="item-direita">
        <div class="item-patrimonio">${escHtml(item.patrimonio || "—")}</div>
        <div class="item-qtd">Qtd: ${item.qtdDisponivel ?? item.qtdTotal ?? 0}</div>
      </div>
    </div>`;
}

function getIconeCategoria(cat) {
  return (
    {
      Informática: "💻",
      Mobiliário: "🪑",
      Eletrônicos: "📱",
      Ferramentas: "🔧",
      Eletrodomésticos: "🏠",
      Veículos: "🚗",
      "Material de Escritório": "📎",
      Audiovisual: "📽️",
    }[cat] || "📦"
  );
}

// ════════════════════════════════════════════════════════
// 5. SELEÇÃO
// ════════════════════════════════════════════════════════
function toggleSelecionarItem(id) {
  const idx = Estado.itensSelecionados.indexOf(id);
  if (idx === -1) Estado.itensSelecionados.push(id);
  else Estado.itensSelecionados.splice(idx, 1);

  // Atualizar apenas a linha afetada (sem re-renderizar tudo)
  document.querySelectorAll(".item-linha").forEach((linha) => {
    if (!linha.getAttribute("onclick")?.includes(`'${id}'`)) return;
    const sel = Estado.itensSelecionados.includes(id);
    linha.classList.toggle("selecionado", sel);
    const cb = linha.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = sel;
  });

  atualizarUI();
}

function toggleSelecionarTodos() {
  const cb = document.getElementById("checkboxTodos");
  const idsVisiveis = Estado.itensFiltrados.map((i) => i.id);

  if (cb.checked) {
    idsVisiveis.forEach((id) => {
      if (!Estado.itensSelecionados.includes(id))
        Estado.itensSelecionados.push(id);
    });
  } else {
    Estado.itensSelecionados = Estado.itensSelecionados.filter(
      (id) => !idsVisiveis.includes(id),
    );
  }

  renderListaItens(Estado.itensFiltrados);
  atualizarUI();
}

function limparSelecao() {
  Estado.itensSelecionados = [];
  renderListaItens(Estado.itensFiltrados);
  atualizarUI();
  showToast("Seleção limpa", "info");
}

function obterItensSelecionados() {
  return Estado.itensSelecionados
    .map((id) => Estado.itens.find((i) => i.id === id))
    .filter(Boolean);
}

// ════════════════════════════════════════════════════════
// 6. ATUALIZAR UI
// ════════════════════════════════════════════════════════
function atualizarUI() {
  const n = Estado.itensSelecionados.length;
  const idsVisiveis = Estado.itensFiltrados.map((i) => i.id);

  // Contador
  const elCount = document.getElementById("contadorSelecionados");
  if (elCount) {
    elCount.textContent = `${n} selecionado${n !== 1 ? "s" : ""}`;
    elCount.classList.toggle("ativo", n > 0);
  }

  // Checkbox "todos"
  const cbAll = document.getElementById("checkboxTodos");
  if (cbAll && idsVisiveis.length) {
    const todosOn = idsVisiveis.every((id) =>
      Estado.itensSelecionados.includes(id),
    );
    const algunsOn = idsVisiveis.some((id) =>
      Estado.itensSelecionados.includes(id),
    );
    cbAll.checked = todosOn;
    cbAll.indeterminate = algunsOn && !todosOn;
  } else if (cbAll) {
    cbAll.checked = false;
    cbAll.indeterminate = false;
  }

  atualizarBotaoImprimir();
  agendarPreview();
}

function atualizarBotaoImprimir() {
  const n = Estado.itensSelecionados.length;
  const btn = document.getElementById("btnImprimir");
  const btnPdf = document.getElementById("btnPdf");
  const ci = document.getElementById("contadorImpressao");
  if (ci) ci.textContent = n;
  if (btn) btn.disabled = n === 0;
  if (btnPdf) btnPdf.disabled = n === 0;
}

// ════════════════════════════════════════════════════════
// 7. TAMANHO E CAMPOS
// ════════════════════════════════════════════════════════
function setTamanho(tamanho) {
  Estado.tamanho = tamanho;
  document.querySelectorAll(".card-tamanho").forEach((c) => {
    c.classList.toggle("ativo", c.dataset.tamanho === tamanho);
  });
  salvarPreferencias();
  agendarPreview();
}

function setCampo(campo, ativo) {
  Estado.campos[campo] = ativo;
  salvarPreferencias();
  agendarPreview();
}

// ════════════════════════════════════════════════════════
// 8. PREVIEW COM QR CODE
// ════════════════════════════════════════════════════════
const QR_PX = {
  pequena: { preview: 32, print: 56 },
  media: { preview: 40, print: 72 },
  grande: { preview: 50, print: 88 },
};

const COND_LABEL = {
  otimo: "Ótimo",
  bom: "Bom",
  regular: "Regular",
  reparo: "Reparo",
  descarte: "Descarte",
};

let _previewTimer = null;
function agendarPreview() {
  clearTimeout(_previewTimer);
  _previewTimer = setTimeout(renderPreview, 200);
}

async function renderPreview() {
  const area = document.getElementById("areaPreview");
  if (!area) return;
  const itensSel = obterItensSelecionados();

  if (!itensSel.length) {
    area.innerHTML = `
      <div class="preview-vazio">
        <div class="icone-preview">🏷️</div>
        <p>Selecione itens para visualizar</p>
      </div>`;
    return;
  }

  area.innerHTML =
    '<div class="preview-gerando">Gerando pré-visualização…</div>';

  const wrapper = document.createElement("div");
  wrapper.className = "preview-etiquetas";

  const preview = itensSel.slice(0, 3);
  const qrPx = QR_PX[Estado.tamanho].preview;

  for (const item of preview) {
    const el = buildPreviewEl(item);
    wrapper.appendChild(el);
    const qrDiv = el.querySelector(".preview-qr");
    if (qrDiv && typeof QRCode !== "undefined") {
      const canvas = document.createElement("canvas");
      try {
        await QRCode.toCanvas(canvas, item.patrimonio || item.nome || item.id, {
          width: qrPx,
          margin: 0,
          color: { dark: "#000", light: "#fff" },
        });
        qrDiv.appendChild(canvas);
      } catch {}
    }
  }

  if (itensSel.length > 3) {
    const mais = document.createElement("p");
    mais.className = "preview-mais";
    mais.textContent = `+${itensSel.length - 3} etiqueta(s) adicional(is)`;
    wrapper.appendChild(mais);
  }

  area.innerHTML = "";
  area.appendChild(wrapper);
}

function buildPreviewEl(item) {
  const cond = item.condicao || "otimo";
  const condLabel = COND_LABEL[cond] || cond;
  const sizeClass = Estado.tamanho !== "pequena" ? ` ${Estado.tamanho}` : "";

  const infoParts = [];
  if (Estado.campos.categoria && item.categoria)
    infoParts.push(escHtml(item.categoria));
  if (Estado.campos.quantidade)
    infoParts.push(`Qtd: ${item.qtdDisponivel ?? item.qtdTotal ?? 0}`);
  if (Estado.campos.organizacao) infoParts.push(escHtml(Estado.orgName));
  if (Estado.campos.serie && item.numeroSerie)
    infoParts.push(`S/N: ${escHtml(item.numeroSerie)}`);

  const div = document.createElement("div");
  div.className = `etiqueta-preview${sizeClass}`;
  div.innerHTML = `
    <div class="preview-qr"></div>
    <div class="preview-campos">
      <div class="preview-nome">${escHtml(item.nome || "")}</div>
      ${Estado.campos.patrimonio && item.patrimonio ? `<div class="preview-pat">${escHtml(item.patrimonio)}</div>` : ""}
      ${infoParts.length ? `<div class="preview-info">${infoParts.join(" · ")}</div>` : ""}
      ${Estado.campos.condicao ? `<span class="preview-badge badge-${cond}">${condLabel}</span>` : ""}
    </div>`;
  return div;
}

// ════════════════════════════════════════════════════════
// 9. IMPRESSÃO
// ════════════════════════════════════════════════════════
async function imprimir() {
  const itensSel = obterItensSelecionados();
  if (!itensSel.length) return;

  const btn = document.getElementById("btnImprimir");
  const savedHTML = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = "Preparando…";

  const grid = document.getElementById("gridImpressao");
  if (!grid) return;
  grid.innerHTML = "";

  const qrPx = QR_PX[Estado.tamanho].print;

  for (const item of itensSel) {
    const el = buildPrintEl(item);
    grid.appendChild(el);
    const qrDiv = el.querySelector(".print-qr");
    if (qrDiv && typeof QRCode !== "undefined") {
      const canvas = document.createElement("canvas");
      try {
        await QRCode.toCanvas(canvas, item.patrimonio || item.nome || item.id, {
          width: qrPx,
          margin: 0,
          color: { dark: "#000", light: "#fff" },
        });
        qrDiv.appendChild(canvas);
      } catch {}
    }
  }

  // @media print reveals .area-impressao via display:block !important
  await new Promise((r) => requestAnimationFrame(r));
  window.print();

  setTimeout(() => {
    const n = Estado.itensSelecionados.length;
    btn.innerHTML = savedHTML;
    btn.disabled = n === 0;
    const ci = document.getElementById("contadorImpressao");
    if (ci) ci.textContent = n;
  }, 600);
}

function buildPrintEl(item) {
  const cond = item.condicao || "otimo";
  const condLabel = COND_LABEL[cond] || cond;

  const infoParts = [];
  if (Estado.campos.condicao) infoParts.push(condLabel);
  if (Estado.campos.categoria && item.categoria)
    infoParts.push(escHtml(item.categoria));
  if (Estado.campos.quantidade)
    infoParts.push(`Qtd: ${item.qtdDisponivel ?? item.qtdTotal ?? 0}`);
  if (Estado.campos.organizacao) infoParts.push(escHtml(Estado.orgName));
  if (Estado.campos.serie && item.numeroSerie)
    infoParts.push(`S/N: ${escHtml(item.numeroSerie)}`);

  const div = document.createElement("div");
  div.className = `etiqueta-print ${Estado.tamanho}`;
  div.innerHTML = `
    <div class="print-qr"></div>
    <div class="print-campos">
      <span class="print-nome">${escHtml(item.nome || "")}</span>
      ${Estado.campos.patrimonio && item.patrimonio ? `<span class="print-pat">${escHtml(item.patrimonio)}</span>` : ""}
      ${infoParts.length ? `<span class="print-info">${infoParts.join(" · ")}</span>` : ""}
    </div>`;
  return div;
}

async function exportarPDF() {
  showToast("Selecione 'Salvar como PDF' no diálogo de impressão.", "info");
  await imprimir();
}

// ════════════════════════════════════════════════════════
// 10. UTILITÁRIOS
// ════════════════════════════════════════════════════════
function normalizar(str) {
  return (str || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast(msg, tipo = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const el = document.createElement("div");
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add("saindo");
    setTimeout(() => el.remove(), 280);
  }, 5000);
}

// ════════════════════════════════════════════════════════
// ENTRY POINT
// ════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", initEtiquetas);
