"use strict";

document.addEventListener("sc:ready", function () {
  const state = {
    page: 1, perPage: 30, total: 0,
    search: "", category: "",
    items: [],
    selected: new Set(),
    size: "sm",
    showAsset: true, showCondition: true, showQty: true, showOrg: true,
    orgName: "",
  };

  const itemsList   = document.getElementById("items-list");
  const previewArea = document.getElementById("label-preview-area");
  const printArea   = document.getElementById("print-area");
  const printBtn    = document.getElementById("btn-print");
  const pdfBtn      = document.getElementById("btn-export-pdf");
  const printCount  = document.getElementById("print-count");
  const selCount    = document.getElementById("selected-count");

  async function init() {
    state.orgName = SC.currentUser?.organizationName || SC.currentUser?.organization?.name || "StockControl";
    wireFilters();
    wireTemplates();
    wireFieldToggles();
    wirePrintButtons();
    await loadCategories();
    await loadItems();
  }

  // ── Categories ────────────────────────────────────────────────────────────
  async function loadCategories() {
    try {
      const data = await SC.api("/categories");
      const cats = data.items || data || [];
      const sel  = document.getElementById("filter-category");
      if (sel) {
        sel.innerHTML = '<option value="">Todas as categorias</option>' +
          cats.map(c => `<option value="${c.id}">${SC.escHtml(c.name)}</option>`).join("");
      }
    } catch (_) {}
  }

  // ── Load items ────────────────────────────────────────────────────────────
  async function loadItems() {
    showSkeleton();
    const qp = new URLSearchParams({ page: state.page, limit: state.perPage });
    if (state.search)   qp.set("search",   state.search);
    if (state.category) qp.set("category", state.category);
    try {
      const data = await SC.api(`/items?${qp}`);
      state.items = data.items || data.data || [];
      state.total = data.total ?? state.items.length;
      renderList();
      renderPagination();
    } catch (err) {
      if (itemsList) itemsList.innerHTML = `<div style="padding:24px;text-align:center;color:var(--color-danger)">${SC.escHtml(err.message)}</div>`;
    }
  }

  // ── Render list ───────────────────────────────────────────────────────────
  function renderList() {
    if (!itemsList) return;
    if (!state.items.length) {
      itemsList.innerHTML = `<div style="padding:24px;text-align:center;color:var(--color-text-muted);font-size:13px">Nenhum item encontrado</div>`;
      return;
    }
    itemsList.innerHTML = state.items.map(item => `
      <div class="item-row ${state.selected.has(String(item.id)) ? "selected" : ""}" data-id="${item.id}">
        <input type="checkbox" class="form-checkbox item-check" data-id="${item.id}" ${state.selected.has(String(item.id)) ? "checked" : ""} />
        ${item.photoUrl ? `<img src="${SC.escHtml(item.photoUrl)}" width="32" height="32" style="border-radius:4px;object-fit:cover;flex-shrink:0" alt="">` : `<div style="width:32px;height:32px;border-radius:4px;background:var(--color-surface-alt);flex-shrink:0"></div>`}
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${SC.escHtml(item.name)}</div>
          <div style="font-size:11px;color:var(--color-text-muted)">${item.assetTag ? SC.escHtml(item.assetTag) : "Sem patrimônio"} · Qtd: ${item.quantity ?? item.qty ?? 0}</div>
        </div>
        ${SC.conditionBadge(item.condition || "OTIMO")}
      </div>`).join("");

    itemsList.querySelectorAll(".item-check").forEach(cb => {
      cb.addEventListener("change", () => {
        const id = cb.dataset.id;
        if (cb.checked) state.selected.add(id);
        else state.selected.delete(id);
        cb.closest(".item-row").classList.toggle("selected", cb.checked);
        syncSelectAll();
        updateCounters();
        renderPreview();
      });
    });

    itemsList.querySelectorAll(".item-row").forEach(row => {
      row.addEventListener("click", (e) => {
        if (e.target.type === "checkbox") return;
        const cb = row.querySelector(".item-check");
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event("change"));
      });
    });
  }

  function showSkeleton() {
    if (!itemsList) return;
    itemsList.innerHTML = Array(5).fill(`
      <div class="item-row">
        <div class="skeleton" style="width:16px;height:16px;border-radius:3px"></div>
        <div class="skeleton" style="width:32px;height:32px;border-radius:4px"></div>
        <div style="flex:1"><div class="skeleton" style="height:12px;border-radius:4px;margin-bottom:4px"></div><div class="skeleton" style="height:10px;border-radius:4px;width:60%"></div></div>
      </div>`).join("");
  }

  function renderPagination() {
    const el = document.getElementById("items-pagination");
    if (!el) return;
    el.innerHTML = SC.renderPagination({ page: state.page, perPage: state.perPage, total: state.total, onPage: (p) => { state.page = p; loadItems(); } });
  }

  // ── Select all ────────────────────────────────────────────────────────────
  function syncSelectAll() {
    const cb = document.getElementById("select-all");
    if (!cb) return;
    const pageIds = state.items.map(i => String(i.id));
    const allChecked = pageIds.every(id => state.selected.has(id));
    const someChecked = pageIds.some(id => state.selected.has(id));
    cb.checked       = allChecked;
    cb.indeterminate = someChecked && !allChecked;
  }

  function updateCounters() {
    const n = state.selected.size;
    if (selCount)  selCount.textContent = `${n} selecionado${n !== 1 ? "s" : ""}`;
    if (printCount) printCount.textContent = n;
    if (printBtn) printBtn.disabled = n === 0;
    if (pdfBtn)   pdfBtn.disabled   = n === 0;
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  function wireFilters() {
    document.getElementById("search-input")?.addEventListener("input", SC.debounce(() => {
      state.search = document.getElementById("search-input").value.trim();
      state.page = 1; loadItems();
    }, 350));
    document.getElementById("filter-category")?.addEventListener("change", (e) => { state.category = e.target.value; state.page = 1; loadItems(); });
    document.getElementById("select-all")?.addEventListener("change", (e) => {
      state.items.forEach(item => {
        if (e.target.checked) state.selected.add(String(item.id));
        else state.selected.delete(String(item.id));
      });
      renderList();
      updateCounters();
      renderPreview();
    });
  }

  // ── Templates ─────────────────────────────────────────────────────────────
  function wireTemplates() {
    document.querySelectorAll(".label-tpl").forEach(tpl => {
      tpl.addEventListener("click", () => {
        document.querySelectorAll(".label-tpl").forEach(t => t.classList.remove("active"));
        tpl.classList.add("active");
        state.size = tpl.dataset.size;
        renderPreview();
      });
    });
  }

  // ── Field toggles ─────────────────────────────────────────────────────────
  function wireFieldToggles() {
    const map = { "show-asset": "showAsset", "show-condition": "showCondition", "show-qty": "showQty", "show-org": "showOrg" };
    Object.entries(map).forEach(([id, key]) => {
      document.getElementById(id)?.addEventListener("change", (e) => {
        state[key] = e.target.checked;
        renderPreview();
      });
    });
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  function renderPreview() {
    if (!previewArea) return;
    const selectedItems = state.items.filter(i => state.selected.has(String(i.id)));
    if (!selectedItems.length) {
      previewArea.innerHTML = `<div style="color:var(--color-text-muted);font-size:13px;text-align:center">Selecione itens para visualizar</div>`;
      return;
    }
    // Show max 3 in preview
    previewArea.innerHTML = selectedItems.slice(0, 3).map(item => buildLabelHTML(item)).join("") +
      (selectedItems.length > 3 ? `<div style="font-size:12px;color:var(--color-text-muted)">+${selectedItems.length - 3} etiqueta(s) adicionais</div>` : "");
  }

  function buildLabelHTML(item) {
    const condClass = { OTIMO: "label-cond-otimo", REPARO: "label-cond-reparo", DESCARTAR: "label-cond-descartar" }[item.condition] || "label-cond-otimo";
    const condLabel = { OTIMO: "Ótimo", REPARO: "Reparo", DESCARTAR: "Descartar" }[item.condition] || "Ótimo";
    const sizeClass = `label-${state.size}`;
    return `
      <div class="label-item ${sizeClass}">
        ${state.showOrg ? `<div class="label-org">${SC.escHtml(state.orgName)}</div>` : ""}
        <div class="label-name">${SC.escHtml(item.name)}</div>
        <div class="label-meta">
          ${state.showAsset && item.assetTag ? `<span class="label-asset">${SC.escHtml(item.assetTag)}</span>` : ""}
          ${state.showCondition ? `<span class="label-cond ${condClass}">${condLabel}</span>` : ""}
          ${state.showQty ? `<span class="label-qty">Qtd: ${item.quantity ?? item.qty ?? 0}</span>` : ""}
        </div>
        <div class="label-qr">
          <div style="font-size:9px;color:#888">${new Date().toLocaleDateString("pt-BR")}</div>
          <div class="label-qr-placeholder" title="QR Code"></div>
        </div>
      </div>`;
  }

  // ── Print ─────────────────────────────────────────────────────────────────
  function wirePrintButtons() {
    printBtn?.addEventListener("click", () => {
      const selectedItems = state.items.filter(i => state.selected.has(String(i.id)));
      if (!selectedItems.length) return;
      if (printArea) {
        printArea.innerHTML = selectedItems.map(item => buildLabelHTML(item)).join("");
        printArea.style.display = "flex";
      }
      setTimeout(() => {
        window.print();
        setTimeout(() => { if (printArea) printArea.style.display = "none"; }, 500);
      }, 100);
    });

    pdfBtn?.addEventListener("click", () => {
      SC.toastInfo("Exportação PDF disponível em breve.");
    });
  }

  init();
});
