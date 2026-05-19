/**
 * dashboard.js — StockControl
 * Fonte de dados: localStorage (sem dependência de backend).
 * Schema v2: campos em português (nome, patrimonio, condicao, total, disponivel…)
 */

(() => {
  "use strict";

  function onReady(fn) {
    if (window.SC && SC.ready) fn();
    else document.addEventListener("sc:ready", fn, { once: true });
  }

  /* ================================================================
     CHAVES DO LOCALSTORAGE
     ================================================================ */
  const KEYS = {
    ITEMS: "sc_items",
    MOVEMENTS: "sc_movements",
    ALERTS: "sc_alerts",
    GOAL: "sc_goal",
  };

  function dbGet(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  }
  function dbSet(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  // ── API helpers ───────────────────────────────────────────────────────────
  function _dashToken() {
    return (
      localStorage.getItem("sc_token") || sessionStorage.getItem("sc_token")
    );
  }
  function _dashApi(url) {
    const token = _dashToken();
    return fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  }

  /* ================================================================
     DADOS MOCK
     Schema: { id, nome, patrimonio, categoria, condicao, total,
               disponivel, localizacao, responsavel, valor,
               dataAquisicao, numeroSerie?, descricao? }
     Condições: "otimo" | "bom" | "reparo" | "ruim" | "inativo"
     ================================================================ */
  const MOCK_ITEMS = [
    {
      id: "item_001",
      nome: "Notebook Dell Inspiron",
      patrimonio: "PAT-2024-001",
      categoria: "Informática",
      condicao: "otimo",
      total: 10,
      disponivel: 7,
      localizacao: "TI - Sala 201",
      responsavel: "Carlos",
      valor: 3500.0,
      dataAquisicao: "2024-01-15",
      numeroSerie: "DLL-INS-001",
      descricao: "Notebook para uso administrativo",
    },
    {
      id: "item_002",
      nome: "Cadeira Ergonômica",
      patrimonio: "PAT-2024-002",
      categoria: "Mobiliário",
      condicao: "bom",
      total: 25,
      disponivel: 20,
      localizacao: "Almoxarifado",
      responsavel: "Carlos",
      valor: 890.0,
      dataAquisicao: "2024-02-10",
      descricao: "Cadeira para escritório com apoio lombar",
    },
    {
      id: "item_003",
      nome: "Impressora HP LaserJet",
      patrimonio: "PAT-2024-003",
      categoria: "Informática",
      condicao: "reparo",
      total: 3,
      disponivel: 1,
      localizacao: "Manutenção",
      responsavel: "Carlos",
      valor: 1200.0,
      dataAquisicao: "2023-08-20",
      numeroSerie: "HP-LJ-003",
      descricao: "2 unidades aguardando peças",
    },
    {
      id: "item_004",
      nome: "Projetor Epson EB-X41",
      patrimonio: "PAT-2024-004",
      categoria: "Audiovisual",
      condicao: "otimo",
      total: 5,
      disponivel: 4,
      localizacao: "Sala 201",
      responsavel: "Ana Pereira",
      valor: 2400.0,
      dataAquisicao: "2024-01-20",
      numeroSerie: "EPS-EB-004",
      descricao: "Projetor para apresentações em sala de aula",
    },
    {
      id: "item_005",
      nome: "Servidor Dell PowerEdge",
      patrimonio: "PAT-2024-005",
      categoria: "Informática",
      condicao: "otimo",
      total: 2,
      disponivel: 2,
      localizacao: "Datacenter",
      responsavel: "Carlos",
      valor: 12000.0,
      dataAquisicao: "2024-03-01",
      numeroSerie: "DLL-PE-005",
      descricao: "Servidor principal de dados e aplicações",
    },
    {
      id: "item_006",
      nome: 'Monitor Samsung 27"',
      patrimonio: "PAT-2024-006",
      categoria: "Informática",
      condicao: "bom",
      total: 15,
      disponivel: 12,
      localizacao: "Lab. Informática",
      responsavel: "Carlos",
      valor: 1200.0,
      dataAquisicao: "2024-02-05",
      descricao: "Monitor Full HD para laboratório",
    },
    {
      id: "item_007",
      nome: "Mesa de Reunião 10 lugares",
      patrimonio: "PAT-2024-007",
      categoria: "Mobiliário",
      condicao: "otimo",
      total: 4,
      disponivel: 4,
      localizacao: "Sala Diretoria",
      responsavel: "Fernanda Lima",
      valor: 1800.0,
      dataAquisicao: "2024-01-10",
      descricao: "Mesa modular para sala de reuniões",
    },
    {
      id: "item_008",
      nome: "Microscópio Óptico Binocular",
      patrimonio: "PAT-2024-008",
      categoria: "Laboratório",
      condicao: "otimo",
      total: 8,
      disponivel: 6,
      localizacao: "Lab. Biologia",
      responsavel: "Prof. Maria",
      valor: 5200.0,
      dataAquisicao: "2024-01-05",
      numeroSerie: "MIC-OPT-008",
      descricao: "Microscópio para aulas práticas de biologia",
    },
    {
      id: "item_009",
      nome: "Câmera IP Intelbras VIP",
      patrimonio: "PAT-2023-009",
      categoria: "Segurança",
      condicao: "ruim",
      total: 12,
      disponivel: 8,
      localizacao: "Almoxarifado",
      responsavel: "Carlos",
      valor: 480.0,
      dataAquisicao: "2023-06-15",
      descricao: "4 unidades com defeito aguardando manutenção",
    },
    {
      id: "item_010",
      nome: "Aspirador Industrial 30L",
      patrimonio: "PAT-2024-010",
      categoria: "Limpeza",
      condicao: "bom",
      total: 3,
      disponivel: 3,
      localizacao: "Almoxarifado",
      responsavel: "João Santos",
      valor: 750.0,
      dataAquisicao: "2024-01-25",
      descricao: "Aspirador para limpeza pesada",
    },
    {
      id: "item_011",
      nome: "Controle de Acesso HID",
      patrimonio: "PAT-2022-011",
      categoria: "Segurança",
      condicao: "inativo",
      total: 5,
      disponivel: 0,
      localizacao: "Almoxarifado",
      responsavel: "Carlos",
      valor: 890.0,
      dataAquisicao: "2022-03-10",
      descricao: "Equipamentos obsoletos — aguardando descarte formal",
    },
    {
      id: "item_012",
      nome: "Estufa Bacteriológica",
      patrimonio: "PAT-2024-012",
      categoria: "Laboratório",
      condicao: "reparo",
      total: 2,
      disponivel: 0,
      localizacao: "Manutenção",
      responsavel: "Prof. Roberto",
      valor: 4100.0,
      dataAquisicao: "2024-02-20",
      numeroSerie: "EST-BAC-012",
      descricao: "Em manutenção na assistência técnica",
    },
    {
      id: "item_013",
      nome: "Switch Cisco Catalyst 2960",
      patrimonio: "PAT-2024-013",
      categoria: "Informática",
      condicao: "otimo",
      total: 4,
      disponivel: 4,
      localizacao: "Datacenter",
      responsavel: "Carlos",
      valor: 3200.0,
      dataAquisicao: "2024-03-05",
      numeroSerie: "CSC-CAT-013",
      descricao: "Switch de rede para infraestrutura",
    },
    {
      id: "item_014",
      nome: "Balança Analítica 0,1 mg",
      patrimonio: "PAT-2024-014",
      categoria: "Laboratório",
      condicao: "bom",
      total: 3,
      disponivel: 2,
      localizacao: "Lab. Química",
      responsavel: "Prof. Maria",
      valor: 2900.0,
      dataAquisicao: "2024-03-10",
      numeroSerie: "BAL-ANA-014",
      descricao: "Balança de precisão para análises químicas",
    },
    {
      id: "item_015",
      nome: "Sistema de Som JBL",
      patrimonio: "PAT-2023-015",
      categoria: "Audiovisual",
      condicao: "ruim",
      total: 1,
      disponivel: 0,
      localizacao: "Manutenção",
      responsavel: "Ana Pereira",
      valor: 3800.0,
      dataAquisicao: "2023-05-12",
      descricao: "Amplificador com defeito no canal direito",
    },
  ];

  /* ================================================================
     MOVIMENTAÇÕES MOCK
     Schema: { id, item_id, nome, patrimonio, tipo, quantidade,
               responsavel, created_at, observacao? }
     Tipos: ENTRADA | SAIDA | TRANSFERENCIA | DESCARTE | DOACAO
     ================================================================ */
  function ago(days) {
    return new Date(Date.now() - days * 86_400_000).toISOString();
  }

  const MOCK_MOVEMENTS = [
    {
      id: 1,
      item_id: "item_001",
      nome: "Notebook Dell Inspiron",
      patrimonio: "PAT-2024-001",
      tipo: "ENTRADA",
      quantidade: 3,
      responsavel: "Carlos",
      created_at: ago(1),
    },
    {
      id: 2,
      item_id: "item_004",
      nome: "Projetor Epson EB-X41",
      patrimonio: "PAT-2024-004",
      tipo: "SAIDA",
      quantidade: 1,
      responsavel: "Ana Pereira",
      created_at: ago(1),
    },
    {
      id: 3,
      item_id: "item_003",
      nome: "Impressora HP LaserJet",
      patrimonio: "PAT-2024-003",
      tipo: "SAIDA",
      quantidade: 2,
      responsavel: "Carlos",
      created_at: ago(2),
    },
    {
      id: 4,
      item_id: "item_008",
      nome: "Microscópio Óptico",
      patrimonio: "PAT-2024-008",
      tipo: "ENTRADA",
      quantidade: 2,
      responsavel: "Prof. Maria",
      created_at: ago(3),
    },
    {
      id: 5,
      item_id: "item_007",
      nome: "Mesa de Reunião",
      patrimonio: "PAT-2024-007",
      tipo: "TRANSFERENCIA",
      quantidade: 1,
      responsavel: "Fernanda Lima",
      created_at: ago(3),
    },
    {
      id: 6,
      item_id: "item_006",
      nome: 'Monitor Samsung 27"',
      patrimonio: "PAT-2024-006",
      tipo: "ENTRADA",
      quantidade: 5,
      responsavel: "Carlos",
      created_at: ago(4),
    },
    {
      id: 7,
      item_id: "item_010",
      nome: "Aspirador Industrial 30L",
      patrimonio: "PAT-2024-010",
      tipo: "ENTRADA",
      quantidade: 1,
      responsavel: "João Santos",
      created_at: ago(5),
    },
    {
      id: 8,
      item_id: "item_011",
      nome: "Controle de Acesso HID",
      patrimonio: "PAT-2022-011",
      tipo: "DESCARTE",
      quantidade: 2,
      responsavel: "Carlos",
      created_at: ago(6),
    },
    {
      id: 9,
      item_id: "item_005",
      nome: "Servidor Dell PowerEdge",
      patrimonio: "PAT-2024-005",
      tipo: "ENTRADA",
      quantidade: 1,
      responsavel: "Carlos",
      created_at: ago(7),
    },
    {
      id: 10,
      item_id: "item_012",
      nome: "Estufa Bacteriológica",
      patrimonio: "PAT-2024-012",
      tipo: "SAIDA",
      quantidade: 1,
      responsavel: "Prof. Roberto",
      created_at: ago(8),
    },
  ];

  const MOCK_ALERTS = [
    {
      id: 1,
      type: "LOW_STOCK",
      title: "Estoque baixo: Impressora HP LaserJet (1 disponível)",
      created_at: ago(0),
      unread: true,
    },
    {
      id: 2,
      type: "DISCARD",
      title: "Controle de Acesso HID aguardando descarte formal",
      created_at: ago(1),
      unread: true,
    },
    {
      id: 3,
      type: "REPARO",
      title: "Estufa Bacteriológica em manutenção externa",
      created_at: ago(2),
      unread: true,
    },
    {
      id: 4,
      type: "REPARO",
      title: "Sistema de Som JBL com defeito no canal direito",
      created_at: ago(3),
      unread: true,
    },
    {
      id: 5,
      type: "INFO",
      title: "Inventário semestral agendado para 30/06/2025",
      created_at: ago(4),
      unread: false,
    },
  ];

  const MOCK_GOAL = {
    description: "Meta de Patrimônio USCS — Semestre 1/2025",
    current_quantity: 11,
    target_quantity: 15,
    start_date: "2025-01-01",
    end_date: "2025-06-30",
  };

  /* ================================================================
     SEED — reaplica se localStorage vazio ou schema antigo
     ================================================================ */
  function seedIfEmpty() {
    const _u =
      JSON.parse(
        localStorage.getItem("sc_user") ||
          sessionStorage.getItem("sc_user") ||
          "{}",
      ) || {};
    const orgId = _u.organization_id || "";
    const qs = orgId ? `?organization_id=${orgId}` : "";

    _dashApi(`/api/home${qs}`)
      .then((data) => {
        const COND = { OTIMO: "otimo", REPARO: "reparo", DESCARTAR: "inativo" };
        if (Array.isArray(data.itens) && data.itens.length) {
          const mapped = data.itens.map((i) => ({
            id: i.id,
            nome: i.product_name || "—",
            patrimonio: i.serial_number || "",
            categoria: i.category_name || "Outros",
            condicao: COND[i.condition_code] || "otimo",
            total: i.quantity ?? 1,
            disponivel: i.quantity_available ?? 1,
            localizacao: "",
            responsavel: "",
            valor: i.estimated_value || 0,
            dataAquisicao: i.created_at ? i.created_at.slice(0, 10) : "",
          }));
          dbSet(KEYS.ITEMS, mapped);
        }
        if (Array.isArray(data.historico) && data.historico.length) {
          const movs = data.historico.map((h) => ({
            id: h.id,
            nome: h.product_name || "—",
            patrimonio: "",
            tipo: "DESCARTE",
            quantidade: 1,
            responsavel: "—",
            created_at: h.created_at,
          }));
          dbSet(KEYS.MOVEMENTS, movs);
        }
        loadKPIs();
        loadConditionChart();
        loadCategoryChart();
        loadRecentMovements();
        loadSystemAlerts();
        loadGoal();
      })
      .catch(() => {});

    const stored = dbGet(KEYS.ITEMS);
    const isOldSchema = stored && stored[0] && !stored[0].nome;
    if (!stored || isOldSchema) dbSet(KEYS.ITEMS, MOCK_ITEMS);

    if (!dbGet(KEYS.MOVEMENTS)) dbSet(KEYS.MOVEMENTS, MOCK_MOVEMENTS);
    if (!dbGet(KEYS.ALERTS)) dbSet(KEYS.ALERTS, MOCK_ALERTS);
    if (!dbGet(KEYS.GOAL)) dbSet(KEYS.GOAL, MOCK_GOAL);
  }

  /* ================================================================
     INIT
     ================================================================ */
  function init() {
    seedIfEmpty();
    loadKPIs();
    loadConditionChart();
    loadCategoryChart();
    loadRecentMovements();
    loadSystemAlerts();
    loadGoal();
    wireQRModal();
  }

  /* ================================================================
     KPI CARDS
     ================================================================ */
  function loadKPIs() {
    const grid = document.getElementById("kpiGrid");
    if (!grid) return;

    const items = dbGet(KEYS.ITEMS) || [];

    const totalItens = items.length;
    const totalDisp = items.reduce((s, i) => s + (i.disponivel || 0), 0);
    const emReparo = items.filter(
      (i) => i.condicao === "reparo" || i.condicao === "ruim",
    ).length;
    const inativos = items.filter((i) => i.condicao === "inativo").length;

    const kpis = [
      {
        label: "Total de Itens",
        value: fmt(totalItens),
        sub: `${fmt(totalDisp)} unidades disponíveis`,
        iconClass: "blue",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                 <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                 <line x1="8" y1="18" x2="21" y2="18"/>
                 <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
                 <line x1="3" y1="18" x2="3.01" y2="18"/>
               </svg>`,
        href: "estoque.html",
      },
      {
        label: "Em Bom Estado",
        value: fmt(
          items.filter((i) => i.condicao === "otimo" || i.condicao === "bom")
            .length,
        ),
        sub:
          pct(
            items.filter((i) => i.condicao === "otimo" || i.condicao === "bom")
              .length,
            totalItens,
          ) + " do acervo",
        iconClass: "green",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                 <polyline points="20 6 9 17 4 12"/>
               </svg>`,
        href: "estoque.html",
      },
      {
        label: "Para Reparo",
        value: fmt(emReparo),
        sub: "precisam de atenção",
        iconClass: "yellow",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                 <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
               </svg>`,
        href: "estoque.html",
      },
      {
        label: "Inativos",
        value: fmt(inativos),
        sub: "aguardando descarte",
        iconClass: "red",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                 <polyline points="3 6 5 6 21 6"/>
                 <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                 <path d="M10 11v6"/><path d="M14 11v6"/>
               </svg>`,
        href: "estoque.html",
      },
    ];

    grid.innerHTML = kpis
      .map(
        (k) => `
      <a href="${k.href}" class="kpi-card" style="text-decoration:none; display:block;">
        <div class="kpi-card-header">
          <span class="kpi-label">${k.label}</span>
          <span class="kpi-icon ${k.iconClass}">${k.icon}</span>
        </div>
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-change neutral" style="margin-top:var(--space-1);">${k.sub}</div>
      </a>`,
      )
      .join("");
  }

  /* ================================================================
     DONUT — DISTRIBUIÇÃO POR CONDIÇÃO (5 estados)
     ================================================================ */
  function loadConditionChart() {
    const wrap = document.getElementById("conditionChart");
    if (!wrap) return;

    const items = dbGet(KEYS.ITEMS) || [];
    const total = items.length;
    if (total === 0) {
      wrap.innerHTML = emptyMsg("Nenhum item cadastrado");
      return;
    }

    const condMap = {
      otimo: { label: "Ótimo", color: "#10B981" },
      bom: { label: "Bom", color: "#3B82F6" },
      reparo: { label: "Reparo", color: "#F59E0B" },
      ruim: { label: "Ruim", color: "#F97316" },
      inativo: { label: "Inativo", color: "#EF4444" },
    };

    const segments = Object.entries(condMap)
      .map(([key, meta]) => ({
        value: items.filter((i) => i.condicao === key).length,
        color: meta.color,
        label: meta.label,
      }))
      .filter((s) => s.value > 0);

    const r = 44;
    const cx = 60;
    const circ = 2 * Math.PI * r;

    let cumulative = 0;
    const arcs = segments.map((s) => {
      const dash = (s.value / total) * circ;
      const gap = circ - dash;
      const offset = circ / 4 - (cumulative / total) * circ;
      cumulative += s.value;
      return `<circle class="donut-segment" cx="${cx}" cy="${cx}" r="${r}"
                stroke="${s.color}"
                stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
                stroke-dashoffset="${offset.toFixed(2)}" />`;
    });

    wrap.innerHTML = `
      <div class="donut">
        <svg viewBox="0 0 120 120">
          <circle class="donut-track" cx="${cx}" cy="${cx}" r="${r}" />
          ${arcs.join("")}
        </svg>
        <div class="donut-center">
          <span class="donut-center-value">${fmt(total)}</span>
          <span class="donut-center-label">itens</span>
        </div>
      </div>
      <div class="donut-legend">
        ${segments
          .map(
            (s) => `
          <div class="donut-legend-item">
            <span class="donut-legend-dot" style="background:${s.color};"></span>
            <span class="donut-legend-label">${s.label}</span>
            <span class="donut-legend-val">${fmt(s.value)}</span>
            <span class="donut-legend-pct">${pct(s.value, total)}</span>
          </div>`,
          )
          .join("")}
      </div>`;
  }

  /* ================================================================
     BARRAS — TOP CATEGORIAS (por nº de itens e quantidade disponível)
     ================================================================ */
  function loadCategoryChart() {
    const wrap = document.getElementById("categoryChart");
    if (!wrap) return;

    const items = dbGet(KEYS.ITEMS) || [];
    const catMap = {};
    items.forEach((i) => {
      const cat = i.categoria || "Sem categoria";
      if (!catMap[cat]) catMap[cat] = { count: 0, disp: 0 };
      catMap[cat].count++;
      catMap[cat].disp += i.disponivel || 0;
    });

    const cats = Object.entries(catMap)
      .map(([name, d]) => ({ name, count: d.count, disp: d.disp }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    if (!cats.length) {
      wrap.innerHTML = emptyMsg("Sem categorias cadastradas");
      return;
    }

    const max = Math.max(...cats.map((c) => c.count), 1);

    wrap.innerHTML = cats
      .map(
        (c) => `
      <div class="bar-item">
        <div class="bar-item-header">
          <span class="bar-item-label">${SC.escHtml(c.name)}</span>
          <span class="bar-item-value">${fmt(c.count)} item${c.count !== 1 ? "s" : ""}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${Math.round((c.count / max) * 100)}%;"></div>
        </div>
      </div>`,
      )
      .join("");
  }

  /* ================================================================
     TABELA — MOVIMENTAÇÕES RECENTES
     ================================================================ */
  function loadRecentMovements() {
    const tbody = document.getElementById("movementsBody");
    if (!tbody) return;

    const rows = (dbGet(KEYS.MOVEMENTS) || [])
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8);

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:var(--space-6); color:var(--color-text-muted);">Nenhuma movimentação registrada.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows
      .map(
        (r) => `
      <tr>
        <td>
          <div class="table-item-info">
            <div>
              <div class="table-item-name">${SC.escHtml(r.nome || "—")}</div>
              <div class="table-item-meta">${SC.escHtml(r.patrimonio || "")}</div>
            </div>
          </div>
        </td>
        <td>${movBadge(r.tipo)}</td>
        <td style="text-align:right; font-weight:600;">${fmt(r.quantidade)}</td>
        <td>${SC.escHtml(r.responsavel || "—")}</td>
        <td style="color:var(--color-text-muted); font-size:0.8125rem;">${SC.fmtDate(r.created_at)}</td>
      </tr>`,
      )
      .join("");
  }

  /* ================================================================
     ALERTAS DO SISTEMA
     ================================================================ */
  function loadSystemAlerts() {
    const wrap = document.getElementById("systemAlerts");
    const countBadge = document.getElementById("alertCount");
    if (!wrap) return;

    const alerts = (dbGet(KEYS.ALERTS) || []).filter((a) => a.unread);

    if (countBadge) {
      countBadge.textContent = alerts.length || "";
      countBadge.style.display = alerts.length ? "inline-flex" : "none";
    }

    if (!alerts.length) {
      wrap.innerHTML = `<p style="font-size:0.875rem; color:var(--color-text-muted); padding:var(--space-2) 0;">Nenhum alerta ativo.</p>`;
      return;
    }

    const iconMap = {
      LOW_STOCK: { cls: "warning", svg: iconWarn() },
      DISCARD: { cls: "danger", svg: iconTrash() },
      REPARO: { cls: "warning", svg: iconWrench() },
      INFO: { cls: "info", svg: iconInfo() },
    };

    wrap.innerHTML = alerts
      .map((a) => {
        const { cls, svg } = iconMap[a.type] || iconMap.INFO;
        return `
        <div class="alert-item">
          <div class="alert-item-icon ${cls}">${svg}</div>
          <div class="alert-item-body">
            <div class="alert-item-title">${SC.escHtml(a.title)}</div>
            <div class="alert-item-meta">${SC.fmtRelTime(a.created_at)}</div>
          </div>
        </div>`;
      })
      .join("");
  }

  /* ================================================================
     META DE COLETA
     ================================================================ */
  function loadGoal() {
    const wrap = document.getElementById("goalCard");
    if (!wrap) return;

    const goal = dbGet(KEYS.GOAL);
    if (!goal || !goal.target_quantity) {
      wrap.innerHTML = `
        <p style="font-size:0.875rem; color:var(--color-text-muted);">Nenhuma meta configurada.</p>
        <a href="configuracoes.html" class="btn btn-secondary btn-sm" style="margin-top:var(--space-3);">Configurar</a>`;
      return;
    }

    const current = goal.current_quantity || 0;
    const target = goal.target_quantity;
    const pctVal = Math.min(100, Math.round((current / target) * 100));
    const barCls = pctVal >= 100 ? "success" : pctVal >= 60 ? "" : "warning";

    wrap.innerHTML = `
      <div class="goal-header">
        <div>
          <div class="goal-title">${SC.escHtml(goal.description || "Meta de Coleta")}</div>
          <div class="goal-sub">${SC.fmtDate(goal.start_date)} — ${SC.fmtDate(goal.end_date)}</div>
        </div>
        <span class="goal-pct">${pctVal}%</span>
      </div>
      <div class="progress">
        <div class="progress-bar ${barCls}" style="width:${pctVal}%;"></div>
      </div>
      <div style="display:flex; justify-content:space-between; margin-top:var(--space-2); font-size:0.8125rem;">
        <span style="color:var(--color-text-muted);">Coletados: <strong>${fmt(current)}</strong></span>
        <span style="color:var(--color-text-muted);">Meta: <strong>${fmt(target)}</strong></span>
      </div>
      <div style="margin-top:var(--space-3); font-size:0.8125rem; color:var(--color-text-muted);">
        Restam <strong>${fmt(Math.max(0, target - current))}</strong> itens · ${daysLeft(goal.end_date)}
      </div>`;
  }

  /* ================================================================
     MODAL QR — busca por patrimônio ou id
     ================================================================ */
  function wireQRModal() {
    const qrScanBtn = document.getElementById("qrScanBtn");
    const qrInput = document.getElementById("qrInput");
    const confirmBtn = document.getElementById("qrSearchConfirm");

    qrScanBtn &&
      qrScanBtn.addEventListener("click", () => {
        SC.openModal("qrModal");
        setTimeout(() => qrInput && qrInput.focus(), 100);
      });

    const doSearch = () => {
      const token = (qrInput && qrInput.value.trim()) || "";
      if (!token) {
        SC.toastWarning("Informe o código ou patrimônio.");
        return;
      }

      const items = dbGet(KEYS.ITEMS) || [];
      const found = items.find(
        (i) =>
          (i.patrimonio || "").toLowerCase() === token.toLowerCase() ||
          (i.id || "").toLowerCase() === token.toLowerCase() ||
          (i.numeroSerie || "").toLowerCase() === token.toLowerCase(),
      );

      if (found) {
        SC.closeModal("qrModal");
        window.location.href = `estoque.html?item=${found.id}`;
      } else {
        SC.toastError("Item não encontrado para este código.");
      }
    };

    confirmBtn && confirmBtn.addEventListener("click", doSearch);
    qrInput &&
      qrInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doSearch();
      });
  }

  /* ================================================================
     UTILITÁRIOS
     ================================================================ */
  function fmt(n) {
    if (n == null) return "—";
    return Number(n).toLocaleString("pt-BR");
  }

  function pct(part, total) {
    if (!total) return "0%";
    return Math.round((part / total) * 100) + "%";
  }

  function daysLeft(isoEnd) {
    if (!isoEnd) return "—";
    const diff = new Date(isoEnd) - Date.now();
    if (diff < 0) return "Encerrada";
    const d = Math.ceil(diff / 86_400_000);
    return `${d} dia${d !== 1 ? "s" : ""} restante${d !== 1 ? "s" : ""}`;
  }

  function emptyMsg(msg) {
    return `<p style="font-size:0.875rem; color:var(--color-text-muted); padding:var(--space-4) 0; text-align:center;">${msg}</p>`;
  }

  /* Badge de tipo de movimentação */
  function movBadge(tipo) {
    const map = {
      ENTRADA: ["movement-entrada", "↑ Entrada"],
      SAIDA: ["movement-saida", "↓ Saída"],
      DOACAO: ["movement-doacao", "♥ Doação"],
      DESCARTE: ["movement-descarte", "✕ Descarte"],
      TRANSFERENCIA: ["movement-transferencia", "⇄ Transferência"],
    };
    const [cls, label] = map[tipo] || ["", tipo || "—"];
    return `<span class="movement-type ${cls}">${SC.escHtml(label)}</span>`;
  }

  /* SVG icons para alertas */
  function iconWarn() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  }
  function iconTrash() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;
  }
  function iconWrench() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`;
  }
  function iconInfo() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  }

  onReady(init);
})();
