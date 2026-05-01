/**
 * dashboard.js — StockControl
 * Handles all data fetching and rendering for index.html (dashboard).
 */

(() => {
  "use strict";

  /* Wait for main.js to finish bootstrapping */
  function onReady(fn) {
    if (window.SC && SC.ready) fn();
    else document.addEventListener("sc:ready", fn, { once: true });
  }

  onReady(init);

  /* ============================================================
     INIT
     ============================================================ */
  async function init() {
    await Promise.all([
      loadKPIs(),
      loadConditionChart(),
      loadCategoryChart(),
      loadRecentMovements(),
      loadSystemAlerts(),
      loadGoal(),
    ]);

    wireQRModal();
  }

  /* ============================================================
     KPI CARDS
     ============================================================ */
  async function loadKPIs() {
    const grid = document.getElementById("kpiGrid");
    if (!grid) return;

    try {
      const data = await SC.api("/dashboard/kpis");

      const kpis = [
        {
          label: "Total de Itens",
          value: fmt(data.total_items),
          sub:   "itens cadastrados",
          icon:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                    <line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
                    <line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>`,
          color: "var(--color-primary)",
          bg:    "var(--color-primary-light)",
          href:  "estoque.html",
        },
        {
          label: "Em Ótimo Estado",
          value: fmt(data.condition_otimo),
          sub:   pct(data.condition_otimo, data.total_items) + " do estoque",
          icon:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>`,
          color: "var(--color-success-dark)",
          bg:    "var(--color-success-light)",
          href:  "estoque.html?condition=OTIMO",
        },
        {
          label: "Para Reparo",
          value: fmt(data.condition_reparo),
          sub:   "precisam de atenção",
          icon:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                  </svg>`,
          color: "var(--color-warning-dark)",
          bg:    "var(--color-warning-light)",
          href:  "estoque.html?condition=REPARO",
        },
        {
          label: "Para Descarte",
          value: fmt(data.condition_descartar),
          sub:   "aguardando descarte",
          icon:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/>
                  </svg>`,
          color: "var(--color-danger-dark)",
          bg:    "var(--color-danger-light)",
          href:  "estoque.html?condition=DESCARTAR",
        },
      ];

      grid.innerHTML = kpis.map(k => `
        <a href="${k.href}" class="kpi-card" style="text-decoration:none;">
          <div class="kpi-card-header">
            <span class="kpi-card-label">${k.label}</span>
            <span class="kpi-card-icon" style="background:${k.bg}; color:${k.color};">
              ${k.icon}
            </span>
          </div>
          <div class="kpi-card-value" style="color:${k.color};">${k.value}</div>
          <div class="kpi-card-sub">${k.sub}</div>
        </a>`).join("");

    } catch (err) {
      grid.innerHTML = renderKPIError();
      console.error("KPIs:", err);
    }
  }

  /* ============================================================
     CONDITION DONUT CHART
     ============================================================ */
  async function loadConditionChart() {
    const wrap = document.getElementById("conditionChart");
    if (!wrap) return;

    try {
      const data = await SC.api("/dashboard/kpis");

      const total    = data.total_items || 0;
      const otimo    = data.condition_otimo    || 0;
      const reparo   = data.condition_reparo   || 0;
      const descartar= data.condition_descartar|| 0;

      if (total === 0) {
        wrap.innerHTML = emptyChart("Nenhum item no estoque");
        return;
      }

      /* SVG donut params */
      const r = 44;
      const cx = 60;
      const circumference = 2 * Math.PI * r;

      const segments = [
        { value: otimo,     color: "var(--color-success)", label: "Ótimo" },
        { value: reparo,    color: "var(--color-warning)", label: "Reparo" },
        { value: descartar, color: "var(--color-danger)",  label: "Descartar" },
      ];

      let offset = 0;
      const paths = segments.map(s => {
        const frac  = s.value / total;
        const dash  = frac * circumference;
        const gap   = circumference - dash;
        const path  = `<circle class="donut-segment" cx="${cx}" cy="${cx}" r="${r}"
                         stroke="${s.color}"
                         stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
                         stroke-dashoffset="${(-offset * circumference / total + circumference / 4).toFixed(2)}" />`;
        offset += s.value;
        return path;
      });

      wrap.innerHTML = `
        <div class="donut">
          <svg viewBox="0 0 120 120">
            <circle class="donut-track" cx="${cx}" cy="${cx}" r="${r}" />
            ${paths.join("")}
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

    } catch (err) {
      wrap.innerHTML = emptyChart("Erro ao carregar dados");
      console.error("ConditionChart:", err);
    }
  }

  /* ============================================================
     CATEGORY BAR CHART
     ============================================================ */
  async function loadCategoryChart() {
    const wrap = document.getElementById("categoryChart");
    if (!wrap) return;

    try {
      const data = await SC.api("/dashboard/categories");
      const cats  = Array.isArray(data) ? data : (data.categories || []);

      if (!cats.length) {
        wrap.innerHTML = `<p style="font-size:0.875rem; color:var(--color-text-muted);">Sem dados de categorias.</p>`;
        return;
      }

      const max = Math.max(...cats.map(c => c.total || c.count || 0), 1);

      wrap.innerHTML = cats.slice(0, 6).map(c => {
        const val  = c.total || c.count || 0;
        const w    = Math.round((val / max) * 100);
        return `
          <div class="bar-item">
            <div class="bar-item-header">
              <span class="bar-item-label">${SC.escHtml(c.name || c.category_name || "—")}</span>
              <span class="bar-item-value">${fmt(val)}</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${w}%;"></div>
            </div>
          </div>`;
      }).join("");

    } catch (err) {
      wrap.innerHTML = `<p style="font-size:0.875rem; color:var(--color-text-muted);">Erro ao carregar categorias.</p>`;
      console.error("CategoryChart:", err);
    }
  }

  /* ============================================================
     RECENT MOVEMENTS TABLE
     ============================================================ */
  async function loadRecentMovements() {
    const tbody = document.getElementById("movementsBody");
    if (!tbody) return;

    try {
      const data = await SC.api("/stock-movements?limit=8&sort=created_at:desc");
      const rows  = Array.isArray(data) ? data : (data.movements || data.items || []);

      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:var(--space-6); color:var(--color-text-muted);">Nenhuma movimentação registrada.</td></tr>`;
        return;
      }

      tbody.innerHTML = rows.map(r => `
        <tr>
          <td>
            <div class="table-item-info">
              <div class="table-item-thumb-placeholder">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
              <div>
                <div class="table-item-name">${SC.escHtml(r.product_name || r.item_name || "—")}</div>
                <div class="table-item-meta">${SC.escHtml(r.asset_tag || "")}</div>
              </div>
            </div>
          </td>
          <td>${SC.movTypeBadge(r.movement_type || r.type)}</td>
          <td style="text-align:right; font-weight:600;">${fmt(r.quantity)}</td>
          <td>${SC.escHtml(r.user_name || r.responsible || "—")}</td>
          <td style="color:var(--color-text-muted); font-size:0.8125rem;">${SC.fmtDate(r.created_at || r.moved_at)}</td>
        </tr>`).join("");

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:var(--space-6); color:var(--color-text-muted);">Erro ao carregar movimentações.</td></tr>`;
      console.error("Movements:", err);
    }
  }

  /* ============================================================
     SYSTEM ALERTS
     ============================================================ */
  async function loadSystemAlerts() {
    const wrap      = document.getElementById("systemAlerts");
    const countBadge= document.getElementById("alertCount");
    if (!wrap) return;

    try {
      const data   = await SC.api("/notifications?unread=true&limit=5");
      const alerts = Array.isArray(data) ? data : (data.notifications || []);

      if (countBadge) {
        if (alerts.length) {
          countBadge.textContent = alerts.length;
          countBadge.style.display = "inline-flex";
        } else {
          countBadge.style.display = "none";
        }
      }

      if (!alerts.length) {
        wrap.innerHTML = `<p style="font-size:0.875rem; color:var(--color-text-muted); padding:var(--space-2) 0;">Nenhum alerta ativo.</p>`;
        return;
      }

      const iconMap = {
        LOW_STOCK: { cls: "warning", svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>` },
        DISCARD:   { cls: "danger",  svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>` },
        INFO:      { cls: "info",    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>` },
      };

      wrap.innerHTML = alerts.map(a => {
        const type = a.type || "INFO";
        const { cls, svg } = iconMap[type] || iconMap.INFO;
        return `
          <div class="alert-item">
            <div class="alert-item-icon ${cls}">${svg}</div>
            <div class="alert-item-body">
              <div class="alert-item-title">${SC.escHtml(a.title || a.message || "Notificação")}</div>
              <div class="alert-item-meta">${SC.fmtRelTime(a.created_at)}</div>
            </div>
          </div>`;
      }).join("");

    } catch (err) {
      wrap.innerHTML = `<p style="font-size:0.875rem; color:var(--color-text-muted);">Erro ao carregar alertas.</p>`;
      console.error("Alerts:", err);
    }
  }

  /* ============================================================
     COLLECTION GOAL
     ============================================================ */
  async function loadGoal() {
    const wrap = document.getElementById("goalCard");
    if (!wrap) return;

    try {
      const data = await SC.api("/collection-goals/active");
      const goal  = data.goal || data;

      if (!goal || !goal.target_quantity) {
        wrap.innerHTML = `<p style="font-size:0.875rem; color:var(--color-text-muted);">Nenhuma meta ativa configurada.</p>
          <a href="configuracoes.html#organizacao" class="btn btn-secondary btn-sm" style="margin-top:var(--space-3);">Configurar Meta</a>`;
        return;
      }

      const current = goal.current_quantity || 0;
      const target  = goal.target_quantity  || 1;
      const pctVal  = Math.min(100, Math.round((current / target) * 100));
      const barColor = pctVal >= 100 ? "var(--color-success)"
                     : pctVal >= 60  ? "var(--color-primary)"
                     : "var(--color-warning)";

      wrap.innerHTML = `
        <div class="goal-header">
          <div>
            <div class="goal-title">${SC.escHtml(goal.description || "Meta de Coleta")}</div>
            <div class="goal-sub">
              ${SC.fmtDate(goal.start_date)} — ${SC.fmtDate(goal.end_date)}
            </div>
          </div>
          <span class="goal-pct">${pctVal}%</span>
        </div>
        <div class="progress">
          <div class="progress-bar" style="width:${pctVal}%; background:${barColor};"></div>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:var(--space-2); font-size:0.8125rem;">
          <span style="color:var(--color-text-muted);">Coletados: <strong style="color:var(--color-text-primary);">${fmt(current)}</strong></span>
          <span style="color:var(--color-text-muted);">Meta: <strong style="color:var(--color-text-primary);">${fmt(target)}</strong></span>
        </div>
        <div style="margin-top:var(--space-4); display:flex; gap:var(--space-2);">
          <div class="stat-row" style="flex:1; border:none; padding:0;">
            <span class="stat-row-label">Restantes</span>
            <span class="stat-row-value">${fmt(Math.max(0, target - current))}</span>
          </div>
          <div class="stat-row" style="flex:1; border:none; padding:0;">
            <span class="stat-row-label">Dias restantes</span>
            <span class="stat-row-value">${daysLeft(goal.end_date)}</span>
          </div>
        </div>`;

    } catch {
      wrap.innerHTML = `
        <p style="font-size:0.875rem; color:var(--color-text-muted);">Nenhuma meta configurada.</p>
        <a href="configuracoes.html" class="btn btn-secondary btn-sm" style="margin-top:var(--space-3);">Configurar</a>`;
    }
  }

  /* ============================================================
     QR SEARCH MODAL
     ============================================================ */
  function wireQRModal() {
    const qrScanBtn = document.getElementById("qrScanBtn");
    const qrInput   = document.getElementById("qrInput");
    const confirmBtn= document.getElementById("qrSearchConfirm");

    qrScanBtn && qrScanBtn.addEventListener("click", () => {
      SC.openModal("qrModal");
      setTimeout(() => qrInput && qrInput.focus(), 100);
    });

    confirmBtn && confirmBtn.addEventListener("click", async () => {
      const token = (qrInput && qrInput.value.trim()) || "";
      if (!token) {
        SC.toastWarning("Informe o token QR.");
        return;
      }

      confirmBtn.classList.add("is-loading");
      confirmBtn.disabled = true;

      try {
        const data = await SC.api(`/items/qr/${encodeURIComponent(token)}`);
        const id   = data.id || (data.item && data.item.id);
        if (id) {
          window.location.href = `estoque.html?item=${id}`;
        } else {
          SC.toastError("Item não encontrado para este token.");
        }
      } catch (err) {
        SC.toastError(err.status === 404 ? "Token QR não encontrado." : "Erro ao buscar item.");
      } finally {
        confirmBtn.classList.remove("is-loading");
        confirmBtn.disabled = false;
      }
    });

    /* Enter key inside qrInput triggers search */
    qrInput && qrInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirmBtn && confirmBtn.click();
    });
  }

  /* ============================================================
     HELPERS
     ============================================================ */
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
    return Math.ceil(diff / 86400000) + " dias";
  }

  function emptyChart(msg) {
    return `<div style="width:100%; padding:var(--space-8); text-align:center; color:var(--color-text-muted); font-size:0.875rem;">${msg}</div>`;
  }

  function renderKPIError() {
    return Array(4).fill(0).map(() =>
      `<div class="kpi-card" style="display:flex; align-items:center; justify-content:center; color:var(--color-text-muted); font-size:0.875rem;">Erro ao carregar</div>`
    ).join("");
  }

})();
