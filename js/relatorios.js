"use strict";

document.addEventListener("sc:ready", function () {
  // ── State ────────────────────────────────────────────────────────────────
  const state = {
    reportType: null,
    page: 1,
    perPage: 20,
    total: 0,
    dateFrom: "",
    dateTo: "",
    condition: "",
    category: "",
    movType: "",
    rows: [],
    kpis: {},
    chart: [],
    conditionDist: [],
    generating: false,
  };

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const reportCards    = document.querySelectorAll(".report-type-card");
  const builderPanel   = document.getElementById("report-builder");
  const builderTitle   = document.getElementById("builder-title");
  const btnGenerate    = document.getElementById("btn-generate");
  const btnExportCsv   = document.getElementById("btn-export-csv");
  const btnExportPdf   = document.getElementById("btn-export-pdf");
  const btnPrint       = document.getElementById("btn-print");

  const filterDateFrom  = document.getElementById("filter-date-from");
  const filterDateTo    = document.getElementById("filter-date-to");
  const filterCondition = document.getElementById("filter-condition");
  const filterCategory  = document.getElementById("filter-category");
  const filterMovType   = document.getElementById("filter-mov-type");

  const filterRowDate    = document.getElementById("filter-row-date");
  const filterRowCond    = document.getElementById("filter-row-cond");
  const filterRowCat     = document.getElementById("filter-row-cat");
  const filterRowMovType = document.getElementById("filter-row-mov-type");

  const kpiTotal    = document.getElementById("kpi-total");
  const kpiGood     = document.getElementById("kpi-good");
  const kpiRepair   = document.getElementById("kpi-repair");
  const kpiDiscard  = document.getElementById("kpi-discard");

  const chartContainer = document.getElementById("bar-chart");
  const chartLegend    = document.getElementById("chart-legend");
  const condBar        = document.getElementById("condition-bar");
  const condLabels     = document.getElementById("condition-labels");

  const tableBody      = document.getElementById("report-tbody");
  const tableHead      = document.getElementById("report-thead");
  const paginationEl   = document.getElementById("pagination");
  const emptyState     = document.getElementById("empty-state");
  const loadingState   = document.getElementById("loading-state");

  // ── Report definitions ────────────────────────────────────────────────────
  const REPORTS = {
    inventory: {
      label: "Inventário Geral",
      filters: ["date", "condition", "category"],
      columns: [
        { key: "name",       label: "Item" },
        { key: "assetTag",   label: "Patrimônio" },
        { key: "category",   label: "Categoria" },
        { key: "condition",  label: "Condição" },
        { key: "quantity",   label: "Qtd", align: "right" },
        { key: "location",   label: "Localização" },
        { key: "updatedAt",  label: "Atualizado" },
      ],
      endpoint: "/reports/inventory",
    },
    movements: {
      label: "Movimentações",
      filters: ["date", "movType"],
      columns: [
        { key: "date",       label: "Data/Hora" },
        { key: "item",       label: "Item" },
        { key: "type",       label: "Tipo" },
        { key: "quantity",   label: "Qtd", align: "right" },
        { key: "destination",label: "Destino" },
        { key: "user",       label: "Usuário" },
      ],
      endpoint: "/reports/movements",
    },
    conditions: {
      label: "Estado dos Itens",
      filters: ["category"],
      columns: [
        { key: "name",      label: "Item" },
        { key: "category",  label: "Categoria" },
        { key: "condition", label: "Condição" },
        { key: "quantity",  label: "Qtd", align: "right" },
        { key: "location",  label: "Localização" },
      ],
      endpoint: "/reports/conditions",
    },
    donations: {
      label: "Doações e Impacto",
      filters: ["date"],
      columns: [
        { key: "date",       label: "Data" },
        { key: "item",       label: "Item" },
        { key: "quantity",   label: "Qtd", align: "right" },
        { key: "destination",label: "Donatário" },
        { key: "user",       label: "Registrado por" },
      ],
      endpoint: "/reports/donations",
    },
    discards: {
      label: "Descartes e Reciclagem",
      filters: ["date"],
      columns: [
        { key: "date",   label: "Data" },
        { key: "item",   label: "Item" },
        { key: "reason", label: "Motivo" },
        { key: "qty",    label: "Qtd", align: "right" },
        { key: "user",   label: "Registrado por" },
      ],
      endpoint: "/reports/discards",
    },
    audit: {
      label: "Log de Auditoria",
      filters: ["date"],
      columns: [
        { key: "date",   label: "Data/Hora" },
        { key: "user",   label: "Usuário" },
        { key: "action", label: "Ação" },
        { key: "target", label: "Objeto" },
        { key: "ip",     label: "IP" },
      ],
      endpoint: "/reports/audit",
    },
  };

  // ── Init ─────────────────────────────────────────────────────────────────
  function init() {
    wireCards();
    wireFilters();
    wireExports();
    loadCategories();
  }

  async function loadCategories() {
    try {
      const data = await SC.api("/categories");
      const cats = data.items || data || [];
      if (filterCategory) {
        filterCategory.innerHTML = '<option value="">Todas as categorias</option>' +
          cats.map(c => `<option value="${c.id}">${SC.escHtml(c.name)}</option>`).join("");
      }
    } catch (_) {}
  }

  // ── Report cards ──────────────────────────────────────────────────────────
  function wireCards() {
    reportCards.forEach(card => {
      card.addEventListener("click", () => {
        reportCards.forEach(c => c.classList.remove("active"));
        card.classList.add("active");
        const type = card.dataset.report;
        selectReport(type);
      });
    });
  }

  function selectReport(type) {
    const def = REPORTS[type];
    if (!def) return;
    state.reportType = type;
    state.page = 1;
    state.rows = [];

    if (builderPanel) builderPanel.style.display = "block";
    if (builderTitle) builderTitle.textContent = def.label;

    // Show/hide filters
    const has = (f) => def.filters.includes(f);
    if (filterRowDate)    filterRowDate.style.display    = has("date") ? "flex" : "none";
    if (filterRowCond)    filterRowCond.style.display    = has("condition") ? "flex" : "none";
    if (filterRowCat)     filterRowCat.style.display     = has("category") ? "flex" : "none";
    if (filterRowMovType) filterRowMovType.style.display = has("movType") ? "flex" : "none";

    clearResults();
    buildTableHead(def.columns);
  }

  function buildTableHead(columns) {
    if (!tableHead) return;
    tableHead.innerHTML = `<tr>${columns.map(c =>
      `<th ${c.align ? `style="text-align:${c.align}"` : ""}>${SC.escHtml(c.label)}</th>`
    ).join("")}</tr>`;
  }

  // ── Generate ──────────────────────────────────────────────────────────────
  function wireFilters() {
    btnGenerate?.addEventListener("click", () => {
      state.page = 1;
      generateReport();
    });

    [filterDateFrom, filterDateTo, filterCondition, filterCategory, filterMovType].forEach(el => {
      el?.addEventListener("change", () => {
        if (state.reportType) {
          state.dateFrom   = filterDateFrom?.value   || "";
          state.dateTo     = filterDateTo?.value     || "";
          state.condition  = filterCondition?.value  || "";
          state.category   = filterCategory?.value   || "";
          state.movType    = filterMovType?.value    || "";
        }
      });
    });
  }

  async function generateReport() {
    if (!state.reportType || state.generating) return;
    const def = REPORTS[state.reportType];
    if (!def) return;

    state.generating = true;
    state.dateFrom  = filterDateFrom?.value  || "";
    state.dateTo    = filterDateTo?.value    || "";
    state.condition = filterCondition?.value || "";
    state.category  = filterCategory?.value  || "";
    state.movType   = filterMovType?.value   || "";

    showLoading();

    const qp = new URLSearchParams({ page: state.page, limit: state.perPage });
    if (state.dateFrom)  qp.set("dateFrom",  state.dateFrom);
    if (state.dateTo)    qp.set("dateTo",    state.dateTo);
    if (state.condition) qp.set("condition", state.condition);
    if (state.category)  qp.set("category",  state.category);
    if (state.movType)   qp.set("type",      state.movType);

    try {
      const data = await SC.api(`${def.endpoint}?${qp}`);
      state.rows  = data.items || data.data || [];
      state.total = data.total ?? state.rows.length;
      state.kpis  = data.kpis || {};
      state.chart = data.chart || [];
      state.conditionDist = data.conditionDist || [];

      renderKPIs();
      renderChart();
      renderConditionBar();
      renderTableBody(def.columns);
      renderPagination();
    } catch (err) {
      SC.toastError("Erro ao gerar relatório: " + (err.message || ""));
      clearResults();
    } finally {
      state.generating = false;
      hideLoading();
    }
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  function renderKPIs() {
    if (kpiTotal)   kpiTotal.textContent   = state.kpis.total   ?? state.total ?? "—";
    if (kpiGood)    kpiGood.textContent    = state.kpis.good    ?? state.kpis.otimo   ?? "—";
    if (kpiRepair)  kpiRepair.textContent  = state.kpis.repair  ?? state.kpis.reparo  ?? "—";
    if (kpiDiscard) kpiDiscard.textContent = state.kpis.discard ?? state.kpis.descartar ?? "—";
  }

  // ── Bar chart ─────────────────────────────────────────────────────────────
  function renderChart() {
    if (!chartContainer || !state.chart.length) return;
    const max = Math.max(...state.chart.map(c => c.value || 0), 1);
    chartContainer.innerHTML = state.chart.map(item => {
      const pct = Math.round(((item.value || 0) / max) * 100);
      return `
        <div class="bar-item" title="${SC.escHtml(item.label)}: ${item.value}">
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%" data-value="${item.value}">
              <span class="bar-tooltip">${item.value}</span>
            </div>
          </div>
          <span class="bar-label">${SC.escHtml(item.label)}</span>
        </div>`;
    }).join("");

    if (chartLegend) {
      chartLegend.innerHTML = state.chart.slice(0, 5).map((item, i) =>
        `<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--color-text-muted)">
          <span style="width:10px;height:10px;border-radius:50%;background:var(--color-primary);opacity:${1 - i * 0.15}"></span>
          ${SC.escHtml(item.label)}
        </span>`
      ).join("");
    }
  }

  // ── Condition distribution bar ────────────────────────────────────────────
  function renderConditionBar() {
    if (!condBar || !state.conditionDist.length) return;
    const total = state.conditionDist.reduce((s, d) => s + (d.count || 0), 0) || 1;
    const colors = { OTIMO: "var(--color-success)", REPARO: "var(--color-warning)", DESCARTAR: "var(--color-danger)" };

    condBar.innerHTML = state.conditionDist.map(d => {
      const pct = Math.round((d.count / total) * 100);
      const color = colors[d.condition] || "var(--color-primary)";
      return `<div style="flex:${pct};background:${color};height:100%;min-width:${pct > 0 ? 4 : 0}px" title="${d.label || d.condition}: ${d.count} (${pct}%)"></div>`;
    }).join("");

    if (condLabels) {
      condLabels.innerHTML = state.conditionDist.map(d => {
        const pct = Math.round((d.count / total) * 100);
        const color = colors[d.condition] || "var(--color-primary)";
        return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--color-text-muted)">
          <span style="width:10px;height:10px;border-radius:2px;background:${color}"></span>
          ${SC.escHtml(d.label || d.condition)} (${pct}%)
        </span>`;
      }).join("");
    }
  }

  // ── Table body ────────────────────────────────────────────────────────────
  function renderTableBody(columns) {
    if (!tableBody) return;

    if (!state.rows.length) {
      tableBody.innerHTML = "";
      emptyState && (emptyState.style.display = "flex");
      return;
    }
    emptyState && (emptyState.style.display = "none");

    tableBody.innerHTML = state.rows.map(row => `
      <tr>${columns.map(col => {
        let val = row[col.key] ?? "—";
        if (col.key === "condition") val = SC.conditionBadge(val);
        else if (col.key === "type") val = SC.movTypeBadge(val);
        else if (col.key === "date" || col.key === "updatedAt") val = SC.fmtDateTime(val);
        else val = SC.escHtml(String(val));
        const align = col.align ? `style="text-align:${col.align}"` : "";
        return `<td ${align}>${val}</td>`;
      }).join("")}</tr>`).join("");
  }

  function renderPagination() {
    if (!paginationEl) return;
    paginationEl.innerHTML = SC.renderPagination({
      page: state.page,
      perPage: state.perPage,
      total: state.total,
      onPage: (p) => { state.page = p; generateReport(); },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function showLoading() {
    if (loadingState) loadingState.style.display = "flex";
    if (tableBody)    tableBody.innerHTML = "";
    emptyState && (emptyState.style.display = "none");
    if (btnGenerate) { btnGenerate.disabled = true; btnGenerate.classList.add("loading"); }
  }

  function hideLoading() {
    if (loadingState) loadingState.style.display = "none";
    if (btnGenerate) { btnGenerate.disabled = false; btnGenerate.classList.remove("loading"); }
  }

  function clearResults() {
    if (tableBody)    tableBody.innerHTML = "";
    if (chartContainer) chartContainer.innerHTML = "";
    if (condBar)      condBar.innerHTML   = "";
    if (condLabels)   condLabels.innerHTML = "";
    if (chartLegend)  chartLegend.innerHTML = "";
    if (kpiTotal)     kpiTotal.textContent   = "—";
    if (kpiGood)      kpiGood.textContent    = "—";
    if (kpiRepair)    kpiRepair.textContent  = "—";
    if (kpiDiscard)   kpiDiscard.textContent = "—";
    emptyState && (emptyState.style.display = "none");
    if (paginationEl) paginationEl.innerHTML = "";
  }

  // ── Exports ───────────────────────────────────────────────────────────────
  function wireExports() {
    btnExportCsv?.addEventListener("click", () => {
      if (!state.rows.length) { SC.toastWarning("Gere o relatório primeiro."); return; }
      exportCsv();
    });

    btnExportPdf?.addEventListener("click", () => {
      if (!state.rows.length) { SC.toastWarning("Gere o relatório primeiro."); return; }
      SC.toastInfo("Exportação PDF disponível em breve.");
    });

    btnPrint?.addEventListener("click", () => {
      if (!state.rows.length) { SC.toastWarning("Gere o relatório primeiro."); return; }
      window.print();
    });
  }

  function exportCsv() {
    const def = REPORTS[state.reportType];
    if (!def) return;
    const headers = def.columns.map(c => c.label).join(",");
    const csvRows = state.rows.map(row =>
      def.columns.map(c => {
        const val = row[c.key] ?? "";
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(",")
    );
    const csv = [headers, ...csvRows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.reportType}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  init();
});
