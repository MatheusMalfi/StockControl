/**
 * dashboard.js — StockControl
 * Data layer: localStorage (sem dependência de backend para dados do dashboard).
 * Semeia dados mock realistas na primeira execução.
 */

(() => {
  "use strict";

  function onReady(fn) {
    if (window.SC && SC.ready) fn();
    else document.addEventListener("sc:ready", fn, { once: true });
  }

  onReady(init);

  /* ================================================================
     CHAVES DO LOCALSTORAGE
     ================================================================ */
  const KEYS = {
    ITEMS    : "sc_items",
    MOVEMENTS: "sc_movements",
    ALERTS   : "sc_alerts",
    GOAL     : "sc_goal",
  };

  function dbGet(key)       { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } }
  function dbSet(key, val)  { localStorage.setItem(key, JSON.stringify(val)); }

  /* ================================================================
     DADOS MOCK — semeados na primeira execução
     ================================================================ */
  function ago(days) {
    return new Date(Date.now() - days * 86_400_000).toISOString();
  }

  const MOCK_ITEMS = [
    /* Informática */
    { id:  1, name: "Notebook Dell Inspiron 15",  asset_tag: "USCS-001", category: "Informática",  condition: "OTIMO",    location: "Lab. Informática 1", value:  3500, created_at: ago(120) },
    { id:  2, name: "Notebook Lenovo ThinkPad",   asset_tag: "USCS-002", category: "Informática",  condition: "OTIMO",    location: "Lab. Informática 1", value:  4200, created_at: ago(115) },
    { id:  3, name: "Desktop HP ProDesk",         asset_tag: "USCS-003", category: "Informática",  condition: "REPARO",   location: "TI",                 value:  2800, created_at: ago(110) },
    { id:  4, name: "Monitor Samsung 27\"",       asset_tag: "USCS-004", category: "Informática",  condition: "OTIMO",    location: "Lab. Informática 2", value:  1200, created_at: ago(108) },
    { id:  5, name: "Impressora HP LaserJet",     asset_tag: "USCS-005", category: "Informática",  condition: "REPARO",   location: "Secretaria",         value:   850, created_at: ago(100) },
    { id:  6, name: "Servidor Dell PowerEdge",    asset_tag: "USCS-006", category: "Informática",  condition: "OTIMO",    location: "Datacenter",         value: 12000, created_at: ago(90)  },
    { id:  7, name: "Switch Cisco Catalyst 2960", asset_tag: "USCS-007", category: "Informática",  condition: "OTIMO",    location: "Datacenter",         value:  3200, created_at: ago(88)  },
    /* Audiovisual */
    { id:  8, name: "Projetor Epson EB-X41",      asset_tag: "USCS-008", category: "Audiovisual",  condition: "OTIMO",    location: "Sala 201",           value:  2400, created_at: ago(118) },
    { id:  9, name: "Projetor BenQ MX532",        asset_tag: "USCS-009", category: "Audiovisual",  condition: "OTIMO",    location: "Auditório",          value:  2200, created_at: ago(116) },
    { id: 10, name: "Sistema de Som JBL",         asset_tag: "USCS-010", category: "Audiovisual",  condition: "REPARO",   location: "Auditório",          value:  3800, created_at: ago(95)  },
    { id: 11, name: "Câmera Sony FHD",            asset_tag: "USCS-011", category: "Audiovisual",  condition: "DESCARTAR",location: "Almoxarifado",       value:   600, created_at: ago(400) },
    /* Mobiliário */
    { id: 12, name: "Mesa de Reunião 10 lugares", asset_tag: "USCS-012", category: "Mobiliário",   condition: "OTIMO",    location: "Sala Diretoria",     value:  1800, created_at: ago(125) },
    { id: 13, name: "Cadeira Ergonômica",         asset_tag: "USCS-013", category: "Mobiliário",   condition: "OTIMO",    location: "Lab. Informática 1", value:   650, created_at: ago(122) },
    { id: 14, name: "Armário de Aço 4 Portas",   asset_tag: "USCS-014", category: "Mobiliário",   condition: "OTIMO",    location: "Almoxarifado",       value:   980, created_at: ago(110) },
    { id: 15, name: "Mesa para Aluno",            asset_tag: "USCS-015", category: "Mobiliário",   condition: "REPARO",   location: "Sala 103",           value:   280, created_at: ago(380) },
    { id: 16, name: "Quadro Branco 200×120",      asset_tag: "USCS-016", category: "Mobiliário",   condition: "DESCARTAR",location: "Almoxarifado",       value:   320, created_at: ago(520) },
    /* Laboratório */
    { id: 17, name: "Microscópio Óptico Binocular",asset_tag: "USCS-017", category: "Laboratório", condition: "OTIMO",    location: "Lab. Biologia",      value:  5200, created_at: ago(130) },
    { id: 18, name: "Centrífuga Digital Excelsa", asset_tag: "USCS-018", category: "Laboratório",  condition: "OTIMO",    location: "Lab. Química",       value:  3600, created_at: ago(128) },
    { id: 19, name: "Estufa Bacteriológica",      asset_tag: "USCS-019", category: "Laboratório",  condition: "REPARO",   location: "Lab. Microbiologia", value:  4100, created_at: ago(45)  },
    { id: 20, name: "Balança Analítica 0,1mg",   asset_tag: "USCS-020", category: "Laboratório",  condition: "OTIMO",    location: "Lab. Química",       value:  2900, created_at: ago(30)  },
    /* Limpeza */
    { id: 21, name: "Aspirador Industrial 30L",   asset_tag: "USCS-021", category: "Limpeza",      condition: "OTIMO",    location: "Almoxarifado",       value:   750, created_at: ago(113) },
    { id: 22, name: "Lavadora de Pisos Kärcher",  asset_tag: "USCS-022", category: "Limpeza",      condition: "OTIMO",    location: "Almoxarifado",       value:  2100, created_at: ago(105) },
    /* Segurança */
    { id: 23, name: "Câmera IP Intelbras VIP",    asset_tag: "USCS-023", category: "Segurança",    condition: "OTIMO",    location: "Entrada Principal",  value:   480, created_at: ago(118) },
    { id: 24, name: "DVR Intelbras 16 Canais",    asset_tag: "USCS-024", category: "Segurança",    condition: "OTIMO",    location: "Recepção",           value:  1200, created_at: ago(118) },
    { id: 25, name: "Controle de Acesso HID",     asset_tag: "USCS-025", category: "Segurança",    condition: "DESCARTAR",location: "Almoxarifado",       value:   890, created_at: ago(600) },
  ];

  const MOCK_MOVEMENTS = [
    { id:  1, item_id:  1, item_name: "Notebook Dell Inspiron 15",  asset_tag: "USCS-001", movement_type: "ENTRADA",       quantity: 1, user_name: "Carlos Silva",   created_at: ago(1)  },
    { id:  2, item_id:  8, item_name: "Projetor Epson EB-X41",      asset_tag: "USCS-008", movement_type: "SAIDA",         quantity: 1, user_name: "Ana Pereira",    created_at: ago(1)  },
    { id:  3, item_id:  3, item_name: "Desktop HP ProDesk",         asset_tag: "USCS-003", movement_type: "SAIDA",         quantity: 1, user_name: "Carlos Silva",   created_at: ago(2)  },
    { id:  4, item_id: 17, item_name: "Microscópio Óptico Binocular",asset_tag: "USCS-017", movement_type: "ENTRADA",      quantity: 1, user_name: "Prof. Maria",    created_at: ago(3)  },
    { id:  5, item_id: 12, item_name: "Mesa de Reunião 10 lugares", asset_tag: "USCS-012", movement_type: "TRANSFERENCIA", quantity: 1, user_name: "Fernanda Lima",  created_at: ago(3)  },
    { id:  6, item_id:  5, item_name: "Impressora HP LaserJet",     asset_tag: "USCS-005", movement_type: "SAIDA",         quantity: 1, user_name: "Carlos Silva",   created_at: ago(4)  },
    { id:  7, item_id: 21, item_name: "Aspirador Industrial 30L",   asset_tag: "USCS-021", movement_type: "ENTRADA",       quantity: 1, user_name: "João Santos",    created_at: ago(5)  },
    { id:  8, item_id: 11, item_name: "Câmera Sony FHD",            asset_tag: "USCS-011", movement_type: "DESCARTE",      quantity: 1, user_name: "Carlos Silva",   created_at: ago(6)  },
    { id:  9, item_id:  6, item_name: "Servidor Dell PowerEdge",    asset_tag: "USCS-006", movement_type: "ENTRADA",       quantity: 1, user_name: "Equipe TI",      created_at: ago(7)  },
    { id: 10, item_id: 19, item_name: "Estufa Bacteriológica",      asset_tag: "USCS-019", movement_type: "SAIDA",         quantity: 1, user_name: "Prof. Roberto",  created_at: ago(8)  },
  ];

  const MOCK_ALERTS = [
    { id: 1, type: "LOW_STOCK", title: "Estoque baixo: Impressora HP LaserJet (1 unid.)", created_at: ago(0), unread: true  },
    { id: 2, type: "DISCARD",   title: "3 itens aguardando descarte formal",              created_at: ago(1), unread: true  },
    { id: 3, type: "REPARO",    title: "Estufa Bacteriológica em manutenção",             created_at: ago(2), unread: true  },
    { id: 4, type: "INFO",      title: "Inventário mensal agendado para o dia 30",        created_at: ago(3), unread: false },
  ];

  const MOCK_GOAL = {
    description     : "Meta de Patrimônio USCS — Semestre 1/2025",
    current_quantity: 19,
    target_quantity : 25,
    start_date      : "2025-01-01",
    end_date        : "2025-06-30",
  };

  function seedIfEmpty() {
    if (!dbGet(KEYS.ITEMS))     dbSet(KEYS.ITEMS,     MOCK_ITEMS);
    if (!dbGet(KEYS.MOVEMENTS)) dbSet(KEYS.MOVEMENTS, MOCK_MOVEMENTS);
    if (!dbGet(KEYS.ALERTS))    dbSet(KEYS.ALERTS,    MOCK_ALERTS);
    if (!dbGet(KEYS.GOAL))      dbSet(KEYS.GOAL,      MOCK_GOAL);
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

    const items     = dbGet(KEYS.ITEMS) || [];
    const total     = items.length;
    const otimo     = items.filter(i => i.condition === "OTIMO").length;
    const reparo    = items.filter(i => i.condition === "REPARO").length;
    const descartar = items.filter(i => i.condition === "DESCARTAR").length;

    const kpis = [
      {
        label: "Total de Itens",
        value: fmt(total),
        sub:   "itens cadastrados",
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
        label: "Em Ótimo Estado",
        value: fmt(otimo),
        sub:   pct(otimo, total) + " do estoque",
        iconClass: "green",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                 <polyline points="20 6 9 17 4 12"/>
               </svg>`,
        href: "estoque.html?condition=OTIMO",
      },
      {
        label: "Para Reparo",
        value: fmt(reparo),
        sub:   "precisam de atenção",
        iconClass: "yellow",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                 <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
               </svg>`,
        href: "estoque.html?condition=REPARO",
      },
      {
        label: "Para Descarte",
        value: fmt(descartar),
        sub:   "aguardando descarte",
        iconClass: "red",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                 <polyline points="3 6 5 6 21 6"/>
                 <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                 <path d="M10 11v6"/><path d="M14 11v6"/>
               </svg>`,
        href: "estoque.html?condition=DESCARTAR",
      },
    ];

    grid.innerHTML = kpis.map(k => `
      <a href="${k.href}" class="kpi-card" style="text-decoration:none; display:block;">
        <div class="kpi-card-header">
          <span class="kpi-label">${k.label}</span>
          <span class="kpi-icon ${k.iconClass}">${k.icon}</span>
        </div>
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-change neutral" style="font-size:0.8125rem; margin-top:var(--space-1);">
          ${k.sub}
        </div>
      </a>`).join("");
  }

  /* ================================================================
     DONUT — DISTRIBUIÇÃO POR CONDIÇÃO
     ================================================================ */
  function loadConditionChart() {
    const wrap = document.getElementById("conditionChart");
    if (!wrap) return;

    const items     = dbGet(KEYS.ITEMS) || [];
    const total     = items.length;
    const otimo     = items.filter(i => i.condition === "OTIMO").length;
    const reparo    = items.filter(i => i.condition === "REPARO").length;
    const descartar = items.filter(i => i.condition === "DESCARTAR").length;

    if (total === 0) { wrap.innerHTML = emptyMsg("Nenhum item cadastrado"); return; }

    const r   = 44;
    const cx  = 60;
    const circ = 2 * Math.PI * r;

    const segments = [
      { value: otimo,     color: "#10B981", label: "Ótimo"     },
      { value: reparo,    color: "#F59E0B", label: "Reparo"    },
      { value: descartar, color: "#EF4444", label: "Descartar" },
    ];

    /* Build SVG arc segments */
    let cumulative = 0;
    const arcs = segments.map(s => {
      const dash   = (s.value / total) * circ;
      const gap    = circ - dash;
      const offset = circ / 4 - (cumulative / total) * circ;
      cumulative  += s.value;
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
          <span class="donut-center-label">total</span>
        </div>
      </div>
      <div class="donut-legend">
        ${segments.map(s => `
          <div class="donut-legend-item">
            <span class="donut-legend-dot" style="background:${s.color};"></span>
            <span class="donut-legend-label">${s.label}</span>
            <span class="donut-legend-val">${fmt(s.value)}</span>
            <span class="donut-legend-pct">${pct(s.value, total)}</span>
          </div>`).join("")}
      </div>`;
  }

  /* ================================================================
     BARRAS — TOP CATEGORIAS
     ================================================================ */
  function loadCategoryChart() {
    const wrap = document.getElementById("categoryChart");
    if (!wrap) return;

    const items  = dbGet(KEYS.ITEMS) || [];
    const catMap = {};
    items.forEach(i => {
      const cat = i.category || "Sem categoria";
      catMap[cat] = (catMap[cat] || 0) + 1;
    });

    const cats = Object.entries(catMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    if (!cats.length) { wrap.innerHTML = emptyMsg("Sem categorias cadastradas"); return; }

    const max = Math.max(...cats.map(c => c.count), 1);

    wrap.innerHTML = cats.map(c => `
      <div class="bar-item">
        <div class="bar-item-header">
          <span class="bar-item-label">${SC.escHtml(c.name)}</span>
          <span class="bar-item-value">${fmt(c.count)}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${Math.round((c.count / max) * 100)}%;"></div>
        </div>
      </div>`).join("");
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

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>
          <div class="table-item-info">
            <div>
              <div class="table-item-name">${SC.escHtml(r.item_name || "—")}</div>
              <div class="table-item-meta">${SC.escHtml(r.asset_tag || "")}</div>
            </div>
          </div>
        </td>
        <td>${movBadge(r.movement_type)}</td>
        <td style="text-align:right; font-weight:600;">${fmt(r.quantity)}</td>
        <td>${SC.escHtml(r.user_name || "—")}</td>
        <td style="color:var(--color-text-muted); font-size:0.8125rem;">${SC.fmtDate(r.created_at)}</td>
      </tr>`).join("");
  }

  /* ================================================================
     ALERTAS DO SISTEMA
     ================================================================ */
  function loadSystemAlerts() {
    const wrap       = document.getElementById("systemAlerts");
    const countBadge = document.getElementById("alertCount");
    if (!wrap) return;

    const alerts = (dbGet(KEYS.ALERTS) || []).filter(a => a.unread);

    if (countBadge) {
      countBadge.textContent    = alerts.length || "";
      countBadge.style.display  = alerts.length ? "inline-flex" : "none";
    }

    if (!alerts.length) {
      wrap.innerHTML = `<p style="font-size:0.875rem; color:var(--color-text-muted); padding:var(--space-2) 0;">Nenhum alerta ativo.</p>`;
      return;
    }

    const iconMap = {
      LOW_STOCK: { cls: "warning", svg: iconWarn() },
      DISCARD:   { cls: "danger",  svg: iconTrash() },
      REPARO:    { cls: "warning", svg: iconWrench() },
      INFO:      { cls: "info",    svg: iconInfo() },
    };

    wrap.innerHTML = alerts.map(a => {
      const { cls, svg } = iconMap[a.type] || iconMap.INFO;
      return `
        <div class="alert-item">
          <div class="alert-item-icon ${cls}">${svg}</div>
          <div class="alert-item-body">
            <div class="alert-item-title">${SC.escHtml(a.title)}</div>
            <div class="alert-item-meta">${SC.fmtRelTime(a.created_at)}</div>
          </div>
        </div>`;
    }).join("");
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

    const current  = goal.current_quantity || 0;
    const target   = goal.target_quantity;
    const pctVal   = Math.min(100, Math.round((current / target) * 100));
    const barCls   = pctVal >= 100 ? "success" : pctVal >= 60 ? "" : "warning";

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
     MODAL QR
     ================================================================ */
  function wireQRModal() {
    const qrScanBtn  = document.getElementById("qrScanBtn");
    const qrInput    = document.getElementById("qrInput");
    const confirmBtn = document.getElementById("qrSearchConfirm");

    qrScanBtn && qrScanBtn.addEventListener("click", () => {
      SC.openModal("qrModal");
      setTimeout(() => qrInput && qrInput.focus(), 100);
    });

    const doSearch = () => {
      const token = (qrInput && qrInput.value.trim()) || "";
      if (!token) { SC.toastWarning("Informe o código ou patrimônio."); return; }

      const items = dbGet(KEYS.ITEMS) || [];
      const found = items.find(i =>
        (i.asset_tag || "").toLowerCase() === token.toLowerCase() ||
        String(i.id)  === token
      );

      if (found) {
        SC.closeModal("qrModal");
        window.location.href = `estoque.html?item=${found.id}`;
      } else {
        SC.toastError("Item não encontrado para este código.");
      }
    };

    confirmBtn && confirmBtn.addEventListener("click", doSearch);
    qrInput    && qrInput.addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });
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

  /* Movement type badge (local, sem depender de SC.movTypeBadge para evitar regressão) */
  function movBadge(type) {
    const map = {
      ENTRADA      : ["movement-entrada",       "↑ Entrada"      ],
      SAIDA        : ["movement-saida",         "↓ Saída"        ],
      DOACAO       : ["movement-doacao",        "♥ Doação"       ],
      DESCARTE     : ["movement-descarte",      "✕ Descarte"     ],
      TRANSFERENCIA: ["movement-transferencia", "⇄ Transferência"],
    };
    const [cls, label] = map[type] || ["", type || "—"];
    return `<span class="movement-type ${cls}">${SC.escHtml(label)}</span>`;
  }

  /* Inline SVG icons para alertas */
  function iconWarn()   { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`; }
  function iconTrash()  { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`; }
  function iconWrench() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`; }
  function iconInfo()   { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`; }

})();
