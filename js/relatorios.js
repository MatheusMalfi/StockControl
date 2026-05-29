"use strict";

document.addEventListener("sc:ready", function () {
  // ── Constants ─────────────────────────────────────────────────────────────
  const KEYS = {
    ITEMS: "sc_items",
    MOVEMENTS: "sc_movements",
    REQUESTS: "sc_requests",
  };
  KEYS.DELETED = "sc_movements_deleted";

  // ── State ─────────────────────────────────────────────────────────────────
  const state = {
    reportType: "estoque",
    page: 1,
    perPage: 25,
    filtered: [],
  };

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const cards = document.querySelectorAll(".report-card[data-report]");
  const builderTitle = document.getElementById("builderTitle");
  const generateBtn = document.getElementById("generateBtn");
  const exportCsvBtn = document.getElementById("exportCsv");
  const exportPdfBtn = document.getElementById("exportPdf");
  const printBtn = document.getElementById("printBtn");

  const rptFrom = document.getElementById("rptFrom");
  const rptTo = document.getElementById("rptTo");
  const rptCond = document.getElementById("rptCondition");
  const rptCat = document.getElementById("rptCategory");
  const rptMovType = document.getElementById("rptMovType");

  const condGroup = document.getElementById("rptCondGroup");
  const catGroup = document.getElementById("rptCatGroup");
  const typeGroup = document.getElementById("rptTypeGroup");

  const mainChart = document.getElementById("mainChart");
  const chartTitle = document.getElementById("chartTitle");
  const chartLegend = document.getElementById("chartLegend");

  const condBarSec = document.getElementById("condBarSection");
  const condBarOtimo = document.getElementById("condBarOtimo");
  const condBarReparo = document.getElementById("condBarReparo");
  const condBarDescartar = document.getElementById("condBarDescartar");
  const condPctOtimo = document.getElementById("condPctOtimo");
  const condPctReparo = document.getElementById("condPctReparo");
  const condPctDescartar = document.getElementById("condPctDescartar");

  const tHead = document.getElementById("reportThead");
  const tBody = document.getElementById("reportBody");
  const pagSection = document.getElementById("reportPagination");
  const perPageSel = document.getElementById("rptPerPage");

  // ── Data helpers ──────────────────────────────────────────────────────────
  function dbGet(key) {
    try {
      return JSON.parse(localStorage.getItem(SC.storageKey(key)) || "[]") || [];
    } catch {
      return [];
    }
  }
  function dbSet(key, val) {
    try {
      localStorage.setItem(SC.storageKey(key), JSON.stringify(val));
    } catch {}
  }

  function normalizeMovement(m) {
    // Busca nome do item de todas as variantes possíveis
    let nome_item = m.nome_item || m.nome || m.product_name || m.produto || "";
    // Se ainda estiver vazio, tenta buscar pelo item_id nos itens cadastrados
    if (!nome_item && m.item_id) {
      try {
        const items =
          JSON.parse(localStorage.getItem(SC.storageKey("sc_items")) || "[]") ||
          [];
        const found = items.find((it) => String(it.id) === String(m.item_id));
        if (found && found.nome) nome_item = found.nome;
      } catch {}
    }
    if (!nome_item) nome_item = "—";
    return {
      id: String(m.id),
      item_id: m.item_id || m.id || null,
      nome_item,
      patrimonio: m.patrimonio || "",
      tipo: m.tipo || "ENTRADA",
      quantidade: m.quantidade ?? m.quantity ?? 0,
      destino: m.destino || "",
      observacao: m.observacao || m.obs || "",
      created_at: m.created_at || m.data || new Date().toISOString(),
      usuario: m.usuario || m.responsavel || "—",
    };
  }

  function mergeMovements(localMovs, serverMovs) {
    const map = new Map();
    const deleted = new Set(
      (
        JSON.parse(localStorage.getItem(SC.storageKey(KEYS.DELETED)) || "[]") ||
        []
      ).map(String),
    );
    (Array.isArray(localMovs) ? localMovs : []).forEach((m) => {
      map.set(String(m.id), m);
    });
    (Array.isArray(serverMovs) ? serverMovs : []).forEach((m) => {
      const normalized = normalizeMovement(m);
      if (deleted.has(String(normalized.id))) return;
      map.set(String(normalized.id), normalized);
    });
    return Array.from(map.values());
  }

  // ── API helpers ───────────────────────────────────────────────────────────
  function _relToken() {
    return (
      localStorage.getItem("sc_token") || sessionStorage.getItem("sc_token")
    );
  }
  function _relOrgId() {
    try {
      const raw =
        localStorage.getItem("sc_user") || sessionStorage.getItem("sc_user");
      const user = raw ? JSON.parse(raw) : {};
      return (
        user.organization_id || user.organizationId || user.org || user.orgId || ""
      );
    } catch {
      return "";
    }
  }
  function _relApi(params) {
    const token = _relToken();
    const orgId = _relOrgId();
    const qs = new URLSearchParams({ ...params, organization_id: orgId }).toString();
    return fetch(`/api/relatorios?${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  }

  function normalizeItemFromServer(it) {
    return {
      id: String(it.id),
      nome: it.product_name || it.nome || "",
      patrimonio: it.serial_number || it.patrimonio || "",
      categoria: it.category_name || it.categoria || "",
      condicao: (it.condition_code || it.condicao || "").toLowerCase(),
      total: it.quantity ?? it.total ?? 0,
      disponivel: it.quantity_available ?? it.disponivel ?? 0,
      localizacao: it.localizacao || "",
      responsavel: it.responsavel || "",
      valor: it.estimated_value ?? it.valor ?? 0,
      dataAquisicao:
        it.dataAquisicao ||
        (it.created_at ? it.created_at.slice(0, 10) : ""),
      created_at: it.created_at || new Date().toISOString(),
    };
  }

  // ── Seed data if missing ──────────────────────────────────────────────────
  function seedIfNeeded() {
    const existing = dbGet(KEYS.ITEMS);
    if (existing.length && existing[0].nome) return;

    const categories = [
      "Informática",
      "Mobiliário",
      "Audiovisual",
      "Esportivo",
      "Saúde",
    ];
    const conditions = [
      "otimo",
      "otimo",
      "bom",
      "bom",
      "reparo",
      "ruim",
      "descartar",
    ];
    const locations = [
      "Sala A01",
      "Sala B12",
      "Almoxarifado",
      "Lab TI",
      "Ginásio",
      "Enfermaria",
    ];
    const responsaveis = [
      "João Silva",
      "Maria Santos",
      "Pedro Oliveira",
      "Ana Costa",
      "Carlos Lima",
    ];
    const itemNames = {
      Informática: [
        "Notebook Dell",
        'Monitor 24"',
        "Teclado USB",
        "Mouse Óptico",
        "Impressora HP",
        "Projetor HDMI",
      ],
      Mobiliário: [
        "Mesa Reunião",
        "Cadeira Escritório",
        "Armário Aço",
        "Estante Madeira",
        "Quadro Branco",
      ],
      Audiovisual: [
        "Câmera Sony",
        "Tripé Profissional",
        "Microfone s/Fio",
        "Caixa de Som JBL",
        "Mixer Digital",
      ],
      Esportivo: [
        "Bola Futebol",
        "Rede Tênis",
        "Colchonete Yoga",
        "Bicicleta Ergométrica",
        "Kit Halteres",
      ],
      Saúde: [
        "Cadeira de Rodas",
        "Maca Hospitalar",
        "Oxímetro",
        "Termômetro Digital",
        "Kit Primeiros Socorros",
      ],
    };

    const now = new Date();
    const items = [];
    let idx = 1;

    categories.forEach((cat) => {
      itemNames[cat].forEach((nome, i) => {
        const cond = conditions[(idx + i) % conditions.length];
        const total = Math.floor(Math.random() * 10) + 1;
        const daysAgo = Math.floor(Math.random() * 730) + 30;
        const acq = new Date(now);
        acq.setDate(acq.getDate() - daysAgo);
        const created = new Date(now);
        created.setDate(created.getDate() - Math.floor(daysAgo * 0.8));
        items.push({
          id: `item_${String(idx).padStart(3, "0")}`,
          nome,
          patrimonio: `PAT-${String(2000 + idx).padStart(5, "0")}`,
          condicao: cond,
          categoria: cat,
          total,
          disponivel:
            cond === "descartar" ? 0 : Math.max(0, Math.floor(total * 0.7)),
          localizacao: locations[idx % locations.length],
          responsavel: responsaveis[idx % responsaveis.length],
          valor: (Math.random() * 4900 + 100).toFixed(2),
          dataAquisicao: acq.toISOString().slice(0, 10),
          created_at: created.toISOString(),
        });
        idx++;
      });
    });
    dbSet(KEYS.ITEMS, items);

    const movExisting = dbGet(KEYS.MOVEMENTS);
    if (movExisting.length) return;

    const tipos = [
      "ENTRADA",
      "ENTRADA",
      "SAIDA",
      "SAIDA",
      "DOACAO",
      "DESCARTE",
      "TRANSFERENCIA",
    ];
    const destinos = [
      "ONG Esperança",
      "Parceiro ABC",
      "Reciclagem Local",
      "Setor TI",
      "Sala A01",
    ];
    const usuarios = ["admin", "joao.silva", "maria.santos", "pedro.oliveira"];
    const movs = [];

    items.forEach((item, i) => {
      const count = Math.floor(Math.random() * 3) + 1;
      for (let m = 0; m < count; m++) {
        const tipo = tipos[(i + m) % tipos.length];
        const daysAgo = Math.floor(Math.random() * 180);
        const created = new Date(now);
        created.setDate(created.getDate() - daysAgo);
        movs.push({
          id: `mov_${String(movs.length + 1).padStart(3, "0")}`,
          item_id: item.id,
          nome_item: item.nome,
          patrimonio: item.patrimonio,
          tipo,
          quantidade: Math.floor(Math.random() * 3) + 1,
          destino: tipo !== "ENTRADA" ? destinos[m % destinos.length] : "",
          observacao: "",
          created_at: created.toISOString(),
          usuario: usuarios[(i + m) % usuarios.length],
        });
      }
    });
    dbSet(KEYS.MOVEMENTS, movs);
  }

  // ── Report config ──────────────────────────────────────────────────────────
  const REPORT_CFG = {
    estoque: {
      label: "Inventário Geral",
      showCond: true,
      showCat: true,
      showType: false,
      showCondBar: true,
      chartTitle: "Itens por Categoria",
    },
    movimentacoes: {
      label: "Movimentações",
      showCond: false,
      showCat: false,
      showType: true,
      showCondBar: false,
      chartTitle: "Movimentações por Tipo",
    },
    condicao: {
      label: "Estado dos Itens",
      showCond: false,
      showCat: true,
      showType: false,
      showCondBar: true,
      chartTitle: "Distribuição por Condição",
    },
    doacoes: {
      label: "Doações e Impacto",
      showCond: false,
      showCat: false,
      showType: false,
      showCondBar: false,
      chartTitle: "Doações por Destinatário",
    },
    descarte: {
      label: "Descartes e Reciclagem",
      showCond: false,
      showCat: false,
      showType: false,
      showCondBar: false,
      chartTitle: "Descartes por Mês",
    },
    auditoria: {
      label: "Log de Auditoria",
      showCond: false,
      showCat: false,
      showType: false,
      showCondBar: false,
      chartTitle: "Eventos por Tipo",
    },
  };

  const TITLE_ICONS = {
    estoque:
      '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    movimentacoes:
      '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    condicao: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    doacoes:
      '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    descarte:
      '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    auditoria:
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  };

  // ── Condition helpers ─────────────────────────────────────────────────────
  const COND_LABEL = {
    otimo: "Ótimo",
    bom: "Bom",
    reparo: "Reparo",
    ruim: "Ruim",
    descartar: "Descartar",
  };
  const COND_COLOR = {
    otimo: "var(--color-success)",
    bom: "#16a34a",
    reparo: "var(--color-warning)",
    ruim: "#ca8a04",
    descartar: "var(--color-danger)",
  };

  function isGood(c) {
    return c === "otimo" || c === "bom";
  }
  function isRepair(c) {
    return c === "reparo" || c === "ruim";
  }
  function isDiscard(c) {
    return c === "descartar";
  }

  function matchCondFilter(cond, f) {
    if (!f) return true;
    if (f === "OTIMO") return isGood(cond);
    if (f === "REPARO") return isRepair(cond);
    if (f === "DESCARTAR") return isDiscard(cond);
    return true;
  }

  function dateInRange(iso, from, to) {
    if (!from && !to) return true;
    const d = iso ? iso.slice(0, 10) : "";
    if (!d) return true;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }

  function condBadge(cond) {
    const label = COND_LABEL[cond] || cond;
    const color = COND_COLOR[cond] || "var(--color-text-muted)";
    return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:0.8125rem;font-weight:500;color:${color};">
      <span style="width:6px;height:6px;border-radius:50%;background:${color};flex-shrink:0;"></span>
      ${SC.escHtml(label)}
    </span>`;
  }

  function movTypeBadge(tipo) {
    const labels = {
      ENTRADA: "Entrada",
      SAIDA: "Saída",
      DOACAO: "Doação",
      DESCARTE: "Descarte",
      TRANSFERENCIA: "Transf.",
    };
    const colors = {
      ENTRADA: "#16a34a",
      SAIDA: "#dc2626",
      DOACAO: "#7c3aed",
      DESCARTE: "#ea580c",
      TRANSFERENCIA: "#0284c7",
    };
    const label = labels[tipo] || tipo;
    const color = colors[tipo] || "var(--color-text-muted)";
    return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:0.8125rem;font-weight:500;color:${color};">
      <span style="width:6px;height:6px;border-radius:50%;background:${color};flex-shrink:0;"></span>
      ${SC.escHtml(label)}
    </span>`;
  }

  // ── KPI animation ─────────────────────────────────────────────────────────
  function animCount(el, target, duration) {
    if (!el) return;
    const start = performance.now();
    (function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }

  function animCurrency(el, target, duration) {
    if (!el) return;
    const start = performance.now();
    (function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = target * eased;
      el.textContent = "R$ " + Math.round(val).toLocaleString("pt-BR");
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }

  // ── Populate category dropdown ────────────────────────────────────────────
  function populateCategories() {
    if (!rptCat) return;
    const items = dbGet(KEYS.ITEMS);
    const cats = [
      ...new Set(items.map((it) => it.categoria).filter(Boolean)),
    ].sort();
    rptCat.innerHTML =
      '<option value="">Todas</option>' +
      cats
        .map(
          (c) => `<option value="${SC.escHtml(c)}">${SC.escHtml(c)}</option>`,
        )
        .join("");
  }

  // ── Card wiring ───────────────────────────────────────────────────────────
  function wireCards() {
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        cards.forEach((c) => c.classList.remove("active"));
        card.classList.add("active");
        selectReport(card.dataset.report);
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          card.click();
        }
      });
    });
  }

  function selectReport(type) {
    const cfg = REPORT_CFG[type];
    if (!cfg) return;
    state.reportType = type;
    state.page = 1;
    state.filtered = [];

    if (builderTitle) {
      builderTitle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:var(--color-primary);">${TITLE_ICONS[type] || ""}</svg>
        ${SC.escHtml(cfg.label)}`;
    }

    if (condGroup) condGroup.style.display = cfg.showCond ? "" : "none";
    if (catGroup) catGroup.style.display = cfg.showCat ? "" : "none";
    if (typeGroup) typeGroup.style.display = cfg.showType ? "" : "none";
    if (condBarSec) condBarSec.style.display = cfg.showCondBar ? "" : "none";
    if (chartTitle) chartTitle.textContent = cfg.chartTitle;

    resetTable();
    generateReport();
  }

  // ── Generate dispatcher ───────────────────────────────────────────────────
  function generateReport() {
    const from = rptFrom?.value || "";
    const to = rptTo?.value || "";
    const cond = rptCond?.value || "";
    const cat = rptCat?.value || "";
    const movType = rptMovType?.value || "";

    _relApi({ tipo: state.reportType, from, to, cond, cat, movType })
      .then((data) => {
        if (!Array.isArray(data.dados) || !data.dados.length) return;
        if (data.tipo === "estoque" || data.tipo === "condicao") {
          dbSet(KEYS.ITEMS, data.dados.map(normalizeItemFromServer));
        } else if (data.tipo === "movimentacoes") {
          dbSet(
            KEYS.MOVEMENTS,
            mergeMovements(dbGet(KEYS.MOVEMENTS), data.dados),
          );
        } else if (data.tipo === "descarte") {
          const existing = dbGet(KEYS.MOVEMENTS);
          const descartes = data.dados.map((d) => normalizeMovement({
            id: d.id,
            item_id: d.item_id,
            nome_item: d.product_name,
            tipo: "DESCARTE",
            quantidade: d.quantity,
            created_at: d.created_at,
          }));
          dbSet(KEYS.MOVEMENTS, mergeMovements(existing, descartes));
        }
      })
      .catch(() => {})
      .finally(() => {
        switch (state.reportType) {
          case "estoque":
            genEstoque(from, to, cond, cat);
            break;
          case "movimentacoes":
            genMovimentacoes(from, to, movType);
            break;
          case "condicao":
            genCondicao(cat);
            break;
          case "doacoes":
            genDoacoes(from, to);
            break;
          case "descarte":
            genDescarte(from, to);
            break;
          case "auditoria":
            genAuditoria(from, to);
            break;
        }
      });
  }

  // ── Report: Inventário Geral ──────────────────────────────────────────────
  function genEstoque(from, to, condFilter, catFilter) {
    const items = dbGet(KEYS.ITEMS).filter(
      (it) =>
        dateInRange(it.dataAquisicao, from, to) &&
        matchCondFilter(it.condicao, condFilter) &&
        (!catFilter || it.categoria === catFilter),
    );

    const good = items.filter((it) => isGood(it.condicao)).length;
    const repair = items.filter((it) => isRepair(it.condicao)).length;
    const discard = items.filter((it) => isDiscard(it.condicao)).length;

    setKpi(1, items.length, "Total de Itens", "itens cadastrados");
    setKpi(
      2,
      good,
      "Em bom estado",
      "condição ótima/boa",
      "var(--color-success-dark)",
    );
    setKpi(
      3,
      repair,
      "Para reparo",
      "precisam de atenção",
      "var(--color-warning-dark)",
    );
    setKpi(
      4,
      discard,
      "Para descarte",
      "aguardando descarte",
      "var(--color-danger-dark)",
    );

    const catCounts = {};
    items.forEach((it) => {
      const k = it.categoria || "Sem categoria";
      catCounts[k] = (catCounts[k] || 0) + 1;
    });
    renderBarChart(
      Object.entries(catCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({ label, value })),
      "var(--color-primary)",
    );
    renderCondBar(good, repair, discard);

    const cols = [
      { key: "nome", label: "Item" },
      { key: "patrimonio", label: "Patrimônio" },
      { key: "categoria", label: "Categoria" },
      { key: "condicao", label: "Condição", badge: "cond" },
      { key: "total", label: "Total", align: "right" },
      { key: "disponivel", label: "Disponível", align: "right" },
      { key: "localizacao", label: "Localização" },
      { key: "dataAquisicao", label: "Aquisição" },
    ];
    setTableHead(cols);
    state.filtered = items;
    renderTablePage(cols, (row, col) => {
      if (col.badge === "cond") return condBadge(row.condicao);
      if (col.key === "dataAquisicao")
        return SC.escHtml(SC.fmtDate(row.dataAquisicao));
      return SC.escHtml(String(row[col.key] ?? "—"));
    });
  }

  // ── Report: Movimentações ─────────────────────────────────────────────────
  function genMovimentacoes(from, to, typeFilter) {
    const movs = dbGet(KEYS.MOVEMENTS)
      .filter(
        (m) =>
          dateInRange(m.created_at, from, to) &&
          (!typeFilter || m.tipo === typeFilter),
      )
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

    const entradas = movs.filter((m) => m.tipo === "ENTRADA").length;
    const saidas = movs.filter((m) => m.tipo === "SAIDA").length;
    const outros = movs.filter((m) =>
      ["DOACAO", "DESCARTE", "TRANSFERENCIA"].includes(m.tipo),
    ).length;

    setKpi(1, movs.length, "Total", "movimentações no período");
    setKpi(
      2,
      entradas,
      "Entradas",
      "itens recebidos",
      "var(--color-success-dark)",
    );
    setKpi(3, saidas, "Saídas", "itens retirados", "var(--color-danger-dark)");
    setKpi(
      4,
      outros,
      "Outros",
      "doações/descartes/transf.",
      "var(--color-warning-dark)",
    );

    const typeColors = {
      ENTRADA: "var(--color-success)",
      SAIDA: "var(--color-danger)",
      DOACAO: "#7c3aed",
      DESCARTE: "var(--color-warning)",
      TRANSFERENCIA: "var(--color-primary)",
    };
    const typeLabels2 = {
      ENTRADA: "Entrada",
      SAIDA: "Saída",
      DOACAO: "Doação",
      DESCARTE: "Descarte",
      TRANSFERENCIA: "Transf.",
    };
    const typeCounts = {};
    movs.forEach((m) => {
      typeCounts[m.tipo] = (typeCounts[m.tipo] || 0) + 1;
    });
    renderBarChart(
      Object.entries(typeCounts).map(([tipo, value]) => ({
        label: typeLabels2[tipo] || tipo,
        value,
        color: typeColors[tipo],
      })),
    );

    const cols = [
      { key: "created_at", label: "Data/Hora" },
      { key: "nome_item", label: "Item" },
      { key: "patrimonio", label: "Patrimônio" },
      { key: "tipo", label: "Tipo", badge: "movType" },
      { key: "quantidade", label: "Qtd", align: "right" },
      { key: "destino", label: "Destino" },
      { key: "usuario", label: "Usuário" },
    ];
    setTableHead(cols);
    state.filtered = movs;
    renderTablePage(cols, (row, col) => {
      if (col.badge === "movType") return movTypeBadge(row.tipo);
      if (col.key === "created_at")
        return SC.escHtml(SC.fmtDateTime(row.created_at));
      return SC.escHtml(String(row[col.key] ?? "—"));
    });
  }

  // ── Report: Estado dos Itens ──────────────────────────────────────────────
  function genCondicao(catFilter) {
    const items = dbGet(KEYS.ITEMS).filter(
      (it) => !catFilter || it.categoria === catFilter,
    );

    const good = items.filter((it) => isGood(it.condicao)).length;
    const repair = items.filter((it) => isRepair(it.condicao)).length;
    const discard = items.filter((it) => isDiscard(it.condicao)).length;

    setKpi(1, items.length, "Total de Itens", "itens catalogados");
    setKpi(
      2,
      good,
      "Bom estado",
      "em bom funcionamento",
      "var(--color-success-dark)",
    );
    setKpi(
      3,
      repair,
      "Para reparo",
      "requerem manutenção",
      "var(--color-warning-dark)",
    );
    setKpi(
      4,
      discard,
      "Para descarte",
      "devem ser descartados",
      "var(--color-danger-dark)",
    );

    const condColors2 = {
      otimo: "var(--color-success)",
      bom: "#4ade80",
      reparo: "var(--color-warning)",
      ruim: "#fbbf24",
      descartar: "var(--color-danger)",
    };
    const condCounts = {};
    items.forEach((it) => {
      const k = it.condicao || "desconhecido";
      condCounts[k] = (condCounts[k] || 0) + 1;
    });
    const ORDER = ["otimo", "bom", "reparo", "ruim", "descartar"];
    renderBarChart(
      ORDER.filter((k) => condCounts[k]).map((k) => ({
        label: COND_LABEL[k] || k,
        value: condCounts[k],
        color: condColors2[k],
      })),
    );
    renderCondBar(good, repair, discard);

    const cols = [
      { key: "nome", label: "Item" },
      { key: "patrimonio", label: "Patrimônio" },
      { key: "categoria", label: "Categoria" },
      { key: "condicao", label: "Condição", badge: "cond" },
      { key: "localizacao", label: "Localização" },
      { key: "responsavel", label: "Responsável" },
    ];
    setTableHead(cols);
    const condOrder = { descartar: 0, ruim: 1, reparo: 2, bom: 3, otimo: 4 };
    state.filtered = [...items].sort(
      (a, b) => (condOrder[a.condicao] ?? 5) - (condOrder[b.condicao] ?? 5),
    );
    renderTablePage(cols, (row, col) => {
      if (col.badge === "cond") return condBadge(row.condicao);
      return SC.escHtml(String(row[col.key] ?? "—"));
    });
  }

  // ── Report: Doações e Impacto ─────────────────────────────────────────────
  function genDoacoes(from, to) {
    const movs = dbGet(KEYS.MOVEMENTS)
      .filter((m) => m.tipo === "DOACAO" && dateInRange(m.created_at, from, to))
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

    const qtdTotal = movs.reduce((s, m) => s + (m.quantidade || 0), 0);
    const itemMap = {};
    dbGet(KEYS.ITEMS).forEach((it) => {
      itemMap[it.id] = it;
    });
    const valorEst = movs.reduce((s, m) => {
      const it = itemMap[m.item_id];
      return s + (it ? parseFloat(it.valor || 0) * (m.quantidade || 1) : 0);
    }, 0);

    setKpi(1, movs.length, "Total de Doações", "doações realizadas");
    setKpi(
      2,
      new Set(movs.map((m) => m.item_id)).size,
      "Itens Únicos",
      "tipos diferentes",
      "var(--color-primary)",
    );
    setKpi(
      3,
      qtdTotal,
      "Qtd Total",
      "unidades doadas",
      "var(--color-warning-dark)",
    );

    const kpi4El = document.getElementById("rptKpi4");
    const kpi4LabelEl = document.getElementById("rptKpi4Label");
    const kpi4SubEl = document.getElementById("rptKpi4Sub");
    if (kpi4LabelEl) kpi4LabelEl.textContent = "Valor Estimado";
    if (kpi4SubEl) kpi4SubEl.textContent = "valor dos itens doados";
    if (kpi4El) {
      animCurrency(kpi4El, valorEst, 800);
      kpi4El.style.color = "var(--color-success-dark)";
    }

    const destCounts = {};
    movs.forEach((m) => {
      const d = m.destino || "Não informado";
      destCounts[d] = (destCounts[d] || 0) + (m.quantidade || 0);
    });
    renderBarChart(
      Object.entries(destCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([label, value]) => ({ label, value, color: "#7c3aed" })),
    );

    const cols = [
      { key: "created_at", label: "Data" },
      { key: "nome_item", label: "Item" },
      { key: "patrimonio", label: "Patrimônio" },
      { key: "quantidade", label: "Qtd", align: "right" },
      { key: "destino", label: "Destinatário" },
      { key: "usuario", label: "Registrado por" },
    ];
    setTableHead(cols);
    state.filtered = movs;
    renderTablePage(cols, (row, col) => {
      if (col.key === "created_at")
        return SC.escHtml(SC.fmtDate(row.created_at));
      return SC.escHtml(String(row[col.key] ?? "—"));
    });
  }

  // ── Report: Descartes e Reciclagem ────────────────────────────────────────
  function genDescarte(from, to) {
    const movs = dbGet(KEYS.MOVEMENTS)
      .filter(
        (m) => m.tipo === "DESCARTE" && dateInRange(m.created_at, from, to),
      )
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

    const qtdTotal = movs.reduce((s, m) => s + (m.quantidade || 0), 0);
    const itemsDiscard = dbGet(KEYS.ITEMS).filter((it) =>
      isDiscard(it.condicao),
    ).length;

    setKpi(1, movs.length, "Total de Descartes", "descartes realizados");
    setKpi(
      2,
      new Set(movs.map((m) => m.item_id)).size,
      "Itens Únicos",
      "tipos descartados",
      "var(--color-warning-dark)",
    );
    setKpi(3, qtdTotal, "Qtd Total", "unidades descartadas");
    setKpi(
      4,
      itemsDiscard,
      "Pendentes",
      "aguardando descarte",
      "var(--color-danger-dark)",
    );

    const monthCounts = {};
    movs.forEach((m) => {
      const mo = m.created_at ? m.created_at.slice(0, 7) : "?";
      monthCounts[mo] = (monthCounts[mo] || 0) + 1;
    });
    renderBarChart(
      Object.entries(monthCounts)
        .sort()
        .slice(-8)
        .map(([label, value]) => ({
          label,
          value,
          color: "var(--color-danger)",
        })),
    );

    const cols = [
      { key: "created_at", label: "Data" },
      { key: "nome_item", label: "Item" },
      { key: "patrimonio", label: "Patrimônio" },
      { key: "quantidade", label: "Qtd", align: "right" },
      { key: "destino", label: "Destino/Motivo" },
      { key: "usuario", label: "Registrado por" },
    ];
    setTableHead(cols);
    state.filtered = movs;
    renderTablePage(cols, (row, col) => {
      if (col.key === "created_at")
        return SC.escHtml(SC.fmtDate(row.created_at));
      return SC.escHtml(String(row[col.key] ?? "—"));
    });
  }

  // ── Report: Log de Auditoria ──────────────────────────────────────────────
  function genAuditoria(from, to) {
    const movs = dbGet(KEYS.MOVEMENTS).filter((m) =>
      dateInRange(m.created_at, from, to),
    );
    const reqs = dbGet(KEYS.REQUESTS).filter((r) =>
      dateInRange(r.created_at, from, to),
    );

    const movLabels = {
      ENTRADA: "Entrada de estoque",
      SAIDA: "Saída de estoque",
      DOACAO: "Doação registrada",
      DESCARTE: "Descarte registrado",
      TRANSFERENCIA: "Transferência",
    };
    const reqLabels = {
      pendente: "Solicitação criada",
      aprovada: "Solicitação aprovada",
      recusada: "Solicitação recusada",
      concluida: "Solicitação concluída",
      cancelada: "Solicitação cancelada",
    };

    const rows = [];
    movs.forEach((m) => {
      // Concatena nome e patrimônio/ID com separador correto
      let objNome = m.nome_item || "Item";
      let objPat = m.patrimonio || m.item_id || "—";
      rows.push({
        created_at: m.created_at,
        usuario: m.usuario || "sistema",
        acao: movLabels[m.tipo] || m.tipo,
        objeto: `${objNome} - (${objPat})`,
        tipo: "MOVIMENTACAO",
        detalhes: `Qtd: ${m.quantidade}${m.destino ? " → " + m.destino : ""}`,
      });
    });
    reqs.forEach((r) => {
      // Suporte a múltiplos itens: pode ser array ou string
      let nomes = r.nome_item;
      let patrimonios = r.patrimonio;
      let ids = r.item_id;
      // Se for array, junta tudo
      if (Array.isArray(nomes)) nomes = nomes.join(", ");
      if (Array.isArray(patrimonios)) patrimonios = patrimonios.join(", ");
      if (Array.isArray(ids)) ids = ids.join(", ");
      // OBJETO: só mostra se houver valor real
      let objNome = nomes && nomes !== "—" && nomes !== "-" ? nomes : "";
      let objInfo =
        patrimonios && patrimonios !== "—" && patrimonios !== "-"
          ? patrimonios
          : ids && ids !== "—" && ids !== "-"
            ? ids
            : "";
      let objeto = objNome;
      if (objNome && objInfo) {
        objeto += ` - (${objInfo})`;
      } else if (objInfo) {
        objeto = `(${objInfo})`;
      } else if (!objNome) {
        objeto = "";
      }
      objeto = objeto.trim();
      // DETALHES: só mostra se houver valor real
      let detalhesArr = [];
      if (r.quantidade && r.quantidade !== "—" && r.quantidade !== "-")
        detalhesArr.push(`Qtd: ${r.quantidade}`);
      if (r.urgencia && r.urgencia !== "—" && r.urgencia !== "-")
        detalhesArr.push(r.urgencia);
      let detalhes = detalhesArr.join(" — ");
      rows.push({
        created_at: r.created_at,
        usuario: r.solicitante || "usuario",
        acao: reqLabels[r.status] || "Solicitação",
        objeto,
        tipo: "SOLICITACAO",
        detalhes,
      });
    });
    rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

    const movCount = rows.filter((r) => r.tipo === "MOVIMENTACAO").length;
    const reqCount = rows.filter((r) => r.tipo === "SOLICITACAO").length;
    const uniqueUsers = new Set(rows.map((r) => r.usuario)).size;

    setKpi(1, rows.length, "Total de Eventos", "eventos registrados");
    setKpi(
      2,
      movCount,
      "Movimentações",
      "registros de estoque",
      "var(--color-primary)",
    );
    setKpi(
      3,
      reqCount,
      "Solicitações",
      "pedidos processados",
      "var(--color-warning-dark)",
    );
    setKpi(
      4,
      uniqueUsers,
      "Usuários",
      "usuários ativos",
      "var(--color-success-dark)",
    );

    renderBarChart([
      {
        label: "Movimentações",
        value: movCount,
        color: "var(--color-primary)",
      },
      { label: "Solicitações", value: reqCount, color: "var(--color-warning)" },
    ]);

    const cols = [
      { key: "created_at", label: "Data/Hora" },
      { key: "usuario", label: "Usuário" },
      { key: "acao", label: "Ação" },
      { key: "objeto", label: "Objeto" },
      { key: "detalhes", label: "Detalhes" },
    ];
    setTableHead(cols);
    state.filtered = rows;
    renderTablePage(cols, (row, col) => {
      if (col.key === "created_at")
        return SC.escHtml(SC.fmtDateTime(row.created_at));
      return SC.escHtml(String(row[col.key] ?? "—"));
    });
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  function setKpi(n, value, labelText, subText, color) {
    const elVal = document.getElementById(`rptKpi${n}`);
    const elLabel = document.getElementById(`rptKpi${n}Label`);
    const elSub = document.getElementById(`rptKpi${n}Sub`);
    if (elLabel) elLabel.textContent = labelText;
    if (elSub) elSub.textContent = subText;
    if (elVal) {
      animCount(elVal, value, 600);
      elVal.style.color = color || "var(--color-text-primary)";
    }
  }

  function renderBarChart(data, defaultColor) {
    if (!mainChart) return;
    if (!data.length) {
      mainChart.innerHTML = `<div style="text-align:center;padding:var(--space-4);color:var(--color-text-muted);font-size:0.875rem;width:100%;">Sem dados para exibir.</div>`;
      if (chartLegend) chartLegend.innerHTML = "";
      return;
    }
    const max = Math.max(...data.map((d) => d.value), 1);
    mainChart.innerHTML = data
      .map((d) => {
        const pct = Math.max(Math.round((d.value / max) * 100), 2);
        const color = d.color || defaultColor || "var(--color-primary)";
        return `<div class="css-bar-item">
        <div class="css-bar-fill" style="height:${pct}%;background:${color};">
          <span class="bar-tooltip">${SC.escHtml(d.label)}: ${d.value}</span>
        </div>
        <span class="css-bar-label">${SC.escHtml(d.label)}</span>
      </div>`;
      })
      .join("");

    if (chartLegend) {
      chartLegend.innerHTML = data
        .map(
          (d) => `
        <div class="chart-legend-item">
          <div class="chart-legend-dot" style="background:${d.color || defaultColor || "var(--color-primary)"};"></div>
          ${SC.escHtml(d.label)} (${d.value})
        </div>`,
        )
        .join("");
    }
  }

  function renderCondBar(good, repair, discard) {
    const total = good + repair + discard || 1;
    const pGood = ((good / total) * 100).toFixed(1);
    const pRepair = ((repair / total) * 100).toFixed(1);
    const pDiscard = ((discard / total) * 100).toFixed(1);
    if (condBarOtimo) condBarOtimo.style.width = pGood + "%";
    if (condBarReparo) condBarReparo.style.width = pRepair + "%";
    if (condBarDescartar) condBarDescartar.style.width = pDiscard + "%";
    if (condPctOtimo) condPctOtimo.textContent = pGood + "%";
    if (condPctReparo) condPctReparo.textContent = pRepair + "%";
    if (condPctDescartar) condPctDescartar.textContent = pDiscard + "%";
  }

  function setTableHead(cols) {
    if (!tHead) return;
    tHead.innerHTML = `<tr>${cols
      .map(
        (c) =>
          `<th${c.align ? ` style="text-align:${c.align}"` : ""}>${SC.escHtml(c.label)}</th>`,
      )
      .join("")}</tr>`;
  }

  function renderTablePage(cols, cellFn) {
    if (!tBody) return;
    const total = state.filtered.length;
    const start = (state.page - 1) * state.perPage;
    const pageRows = state.filtered.slice(start, start + state.perPage);

    if (!total) {
      tBody.innerHTML = `<tr><td colspan="${cols.length}" style="text-align:center;padding:var(--space-8);">
        <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-2);color:var(--color-text-muted);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span class="empty-state-title">Nenhum registro encontrado</span>
          <span class="empty-state-text">Ajuste os filtros ou selecione outro período.</span>
        </div>
      </td></tr>`;
      if (pagSection) pagSection.style.display = "none";
      return;
    }

    tBody.innerHTML = pageRows
      .map(
        (row) =>
          `<tr>${cols
            .map((col) => {
              const val = cellFn(row, col);
              return `<td${col.align ? ` style="text-align:${col.align}"` : ""}>${val}</td>`;
            })
            .join("")}</tr>`,
      )
      .join("");

    if (pagSection)
      pagSection.style.display = total > state.perPage ? "" : "none";
    SC.renderPagination({
      containerId: "rptPagControls",
      infoId: "rptPagInfo",
      page: state.page,
      perPage: state.perPage,
      total,
      onPageChange: (p) => {
        state.page = p;
        generateReport();
      },
    });
  }

  function resetTable() {
    if (tHead) tHead.innerHTML = "";
    if (tBody)
      tBody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:var(--space-8);color:var(--color-text-muted);">
      Clique em <strong>Gerar</strong> para carregar o relatório.
    </td></tr>`;
    if (pagSection) pagSection.style.display = "none";
    if (mainChart) mainChart.innerHTML = "";
    if (chartLegend) chartLegend.innerHTML = "";
  }

  // ── Export CSV ────────────────────────────────────────────────────────────
  function exportCsv() {
    if (!state.filtered.length) {
      SC.toastWarning("Gere o relatório antes de exportar.");
      return;
    }

    const colMaps = {
      estoque: [
        "nome",
        "patrimonio",
        "categoria",
        "condicao",
        "total",
        "disponivel",
        "localizacao",
        "dataAquisicao",
      ],
      movimentacoes: [
        "created_at",
        "nome_item",
        "patrimonio",
        "tipo",
        "quantidade",
        "destino",
        "usuario",
      ],
      condicao: [
        "nome",
        "patrimonio",
        "categoria",
        "condicao",
        "localizacao",
        "responsavel",
      ],
      doacoes: [
        "created_at",
        "nome_item",
        "patrimonio",
        "quantidade",
        "destino",
        "usuario",
      ],
      descarte: [
        "created_at",
        "nome_item",
        "patrimonio",
        "quantidade",
        "destino",
        "usuario",
      ],
      auditoria: ["created_at", "usuario", "acao", "objeto", "detalhes"],
    };
    const headerMaps = {
      estoque: [
        "Item",
        "Patrimônio",
        "Categoria",
        "Condição",
        "Total",
        "Disponível",
        "Localização",
        "Aquisição",
      ],
      movimentacoes: [
        "Data/Hora",
        "Item",
        "Patrimônio",
        "Tipo",
        "Qtd",
        "Destino",
        "Usuário",
      ],
      condicao: [
        "Item",
        "Patrimônio",
        "Categoria",
        "Condição",
        "Localização",
        "Responsável",
      ],
      doacoes: [
        "Data",
        "Item",
        "Patrimônio",
        "Qtd",
        "Destinatário",
        "Registrado por",
      ],
      descarte: [
        "Data",
        "Item",
        "Patrimônio",
        "Qtd",
        "Destino/Motivo",
        "Registrado por",
      ],
      auditoria: ["Data/Hora", "Usuário", "Ação", "Objeto", "Detalhes"],
    };

    const type = state.reportType;
    const keys = colMaps[type] || [];
    const headers = headerMaps[type] || keys;

    const rows = state.filtered.map((row) =>
      keys
        .map((k) => {
          let v = row[k] ?? "";
          if (k === "created_at" && v) v = v.slice(0, 19).replace("T", " ");
          if (k === "dataAquisicao" && v) v = v.slice(0, 10);
          return `"${String(v).replace(/"/g, '""')}"`;
        })
        .join(","),
    );

    const csv = [headers.map((h) => `"${h}"`).join(","), ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    SC.toastSuccess("CSV exportado com sucesso.");
  }

  // ── Wire buttons ──────────────────────────────────────────────────────────
  function wireButtons() {
    generateBtn?.addEventListener("click", () => {
      state.page = 1;
      generateReport();
    });
    exportCsvBtn?.addEventListener("click", exportCsv);
    exportPdfBtn?.addEventListener("click", () =>
      SC.toastInfo("Exportação PDF em breve."),
    );
    printBtn?.addEventListener("click", () => window.print());
    perPageSel?.addEventListener("change", () => {
      state.perPage = parseInt(perPageSel.value, 10) || 25;
      state.page = 1;
      generateReport();
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    seedIfNeeded();
    populateCategories();
    wireCards();
    wireButtons();
    selectReport("estoque");
  }

  init();
});
