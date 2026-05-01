"use strict";

document.addEventListener("sc:ready", function () {
  const state = {
    page: 1, perPage: 20, total: 0,
    activeTab: "all",
    notifications: [],
    unreadCount: 0,
  };

  const listEl    = document.getElementById("notif-list");
  const emptyEl   = document.getElementById("notif-empty");
  const pagEl     = document.getElementById("notif-pagination");

  const ICONS = {
    stock:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    repair:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    donation: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    request:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    system:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  };
  const ICON_CLASS = { stock: "notif-icon-stock", repair: "notif-icon-repair", donation: "notif-icon-donation", request: "notif-icon-request", system: "notif-icon-system" };

  async function init() {
    wireTabs();
    wireActions();
    wireRules();
    await Promise.all([loadNotifications(), loadRules()]);
  }

  // ── Load notifications ────────────────────────────────────────────────────
  async function loadNotifications() {
    showSkeleton();
    const qp = new URLSearchParams({ page: state.page, limit: state.perPage });
    if (state.activeTab !== "all") qp.set("type", state.activeTab);
    if (state.activeTab === "unread") { qp.delete("type"); qp.set("unread", "true"); }
    try {
      const data = await SC.api(`/notifications?${qp}`);
      state.notifications = data.items || data.data || [];
      state.total         = data.total ?? state.notifications.length;
      state.unreadCount   = data.unreadCount ?? 0;
      updateBadges(data);
      renderList();
      renderPagination();
    } catch (err) {
      if (listEl) listEl.innerHTML = `<div style="padding:24px;text-align:center;color:var(--color-danger)">${SC.escHtml(err.message)}</div>`;
    }
  }

  function updateBadges(data) {
    const total  = data.total   ?? 0;
    const unread = data.unreadCount ?? 0;
    setEl("tab-badge-all",    total);
    setEl("tab-badge-unread", unread);
    const notifBadge = document.getElementById("notifBadge");
    if (notifBadge) notifBadge.style.display = unread > 0 ? "block" : "none";
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function renderList() {
    if (!listEl) return;
    if (!state.notifications.length) {
      listEl.innerHTML = "";
      emptyEl && (emptyEl.style.display = "flex");
      return;
    }
    emptyEl && (emptyEl.style.display = "none");

    listEl.innerHTML = state.notifications.map(n => {
      const typeKey   = (n.type || "system").toLowerCase();
      const iconClass = ICON_CLASS[typeKey] || "notif-icon-system";
      const icon      = ICONS[typeKey]      || ICONS.system;
      return `
        <div class="notif-item ${n.read ? "" : "unread"}" data-id="${n.id}">
          <div class="notif-icon ${iconClass}">${icon}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:${n.read ? "400" : "600"};line-height:1.4">${SC.escHtml(n.title || n.message || "—")}</div>
            ${n.body || n.description ? `<div style="font-size:12px;color:var(--color-text-muted);margin-top:2px;line-height:1.4">${SC.escHtml(n.body || n.description)}</div>` : ""}
            <div style="font-size:11px;color:var(--color-text-muted);margin-top:4px">${SC.fmtRelTime(n.createdAt || n.created_at)}</div>
          </div>
          ${!n.read ? `<div class="notif-dot"></div>` : ""}
          ${n.actionUrl ? `<a href="${SC.escHtml(n.actionUrl)}" class="btn btn-ghost btn-sm" style="flex-shrink:0" onclick="event.stopPropagation()">Ver</a>` : ""}
        </div>`;
    }).join("");

    listEl.querySelectorAll(".notif-item").forEach(item => {
      item.addEventListener("click", async () => {
        const id = item.dataset.id;
        if (!item.classList.contains("unread")) return;
        try {
          await SC.api(`/notifications/${id}/read`, { method: "POST" });
          item.classList.remove("unread");
          item.querySelector(".notif-dot")?.remove();
          const badge = document.getElementById("tab-badge-unread");
          if (badge) badge.textContent = Math.max(0, parseInt(badge.textContent || "0") - 1);
        } catch (_) {}
      });
    });
  }

  function renderPagination() {
    if (!pagEl) return;
    pagEl.innerHTML = SC.renderPagination({ page: state.page, perPage: state.perPage, total: state.total, onPage: (p) => { state.page = p; loadNotifications(); } });
  }

  function showSkeleton() {
    if (!listEl) return;
    emptyEl && (emptyEl.style.display = "none");
    listEl.innerHTML = Array(5).fill(`
      <div class="notif-item">
        <div class="skeleton" style="width:36px;height:36px;border-radius:50%"></div>
        <div style="flex:1"><div class="skeleton" style="height:13px;border-radius:4px;margin-bottom:6px"></div><div class="skeleton" style="height:11px;border-radius:4px;width:60%"></div></div>
      </div>`).join("");
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  function wireTabs() {
    document.querySelectorAll(".tab[data-tab]").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab[data-tab]").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        state.activeTab = tab.dataset.tab;
        state.page = 1;
        loadNotifications();
      });
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  function wireActions() {
    document.getElementById("btn-mark-all-read")?.addEventListener("click", async () => {
      try {
        await SC.api("/notifications/read-all", { method: "POST" });
        SC.toastSuccess("Todas as notificações marcadas como lidas.");
        loadNotifications();
      } catch (err) {
        SC.toastError(err.message || "Erro.");
      }
    });
  }

  // ── Rules ─────────────────────────────────────────────────────────────────
  async function loadRules() {
    try {
      const rules = await SC.api("/notifications/rules");
      setCheck("rule-low-stock", rules.lowStock ?? true);
      setCheck("rule-discard",   rules.discard  ?? true);
      setCheck("rule-request",   rules.request  ?? true);
      setCheck("rule-goal",      rules.goal     ?? true);
      setCheck("rule-email",     rules.email    ?? false);
      if (rules.lowStockThreshold) setVal("rule-stock-threshold", rules.lowStockThreshold);
      if (rules.discardDays)       setVal("rule-discard-days",    rules.discardDays);
      if (rules.goalDays)          setVal("rule-goal-days",       rules.goalDays);
    } catch (_) {}
  }

  function wireRules() {
    document.getElementById("btn-save-rules")?.addEventListener("click", saveRules);
  }

  async function saveRules() {
    const btn = document.getElementById("btn-save-rules");
    btn.disabled = true; btn.classList.add("loading");
    try {
      await SC.api("/notifications/rules", { method: "PUT", body: JSON.stringify({
        lowStock:          getCheck("rule-low-stock"),
        lowStockThreshold: parseInt(getVal("rule-stock-threshold")) || 5,
        discard:           getCheck("rule-discard"),
        discardDays:       parseInt(getVal("rule-discard-days")) || 30,
        request:           getCheck("rule-request"),
        goal:              getCheck("rule-goal"),
        goalDays:          parseInt(getVal("rule-goal-days")) || 7,
        email:             getCheck("rule-email"),
      }) });
      SC.toastSuccess("Regras salvas!");
    } catch (err) {
      SC.toastError(err.message || "Erro ao salvar regras.");
    } finally {
      btn.disabled = false; btn.classList.remove("loading");
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function setEl(id,v)      { const el = document.getElementById(id); if (el) el.textContent = v; }
  function getVal(id)       { return document.getElementById(id)?.value || ""; }
  function setVal(id,v)     { const el = document.getElementById(id); if (el) el.value = v; }
  function getCheck(id)     { return document.getElementById(id)?.checked ?? false; }
  function setCheck(id,v)   { const el = document.getElementById(id); if (el) el.checked = v; }

  init();
});
