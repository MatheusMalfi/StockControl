"use strict";

document.addEventListener("sc:ready", function () {
  // ── Constants ─────────────────────────────────────────────────────────────
  const KEYS = {
    NOTIFS:   "sc_notifications",
    RULES:    "sc_notif_rules",
    ITEMS:    "sc_items",
    MOVEMENTS:"sc_movements",
    REQUESTS: "sc_requests",
  };

  const DEFAULT_RULES = {
    lowStock: true,  lowStockThreshold: 5,
    discard:  true,  discardDays: 30,
    request:  true,
    goal:     true,  goalDays: 7,
    email:    false,
  };

  // ── State ─────────────────────────────────────────────────────────────────
  const state = { activeTab: "all", page: 1, perPage: 15 };

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const listEl    = document.getElementById("notif-list");
  const emptyEl   = document.getElementById("notif-empty");
  const pagRow    = document.getElementById("notifPagination");
  const notifBadge = document.getElementById("notifBadge");
  const rulesCount = document.getElementById("rulesAlertCount");

  // ── Data helpers ──────────────────────────────────────────────────────────
  function dbGet(key) {
    try { return JSON.parse(localStorage.getItem(SC.storageKey(key)) || "null") || []; } catch { return []; }
  }
  function dbGetObj(key, def) {
    try { const v = JSON.parse(localStorage.getItem(SC.storageKey(key)) || "null"); return v && typeof v === "object" && !Array.isArray(v) ? v : def; } catch { return def; }
  }
  function dbSet(key, val) {
    try { localStorage.setItem(SC.storageKey(key), JSON.stringify(val)); } catch {}
  }

  // ── API helpers ───────────────────────────────────────────────────────────
  function _notifToken() {
    return localStorage.getItem("sc_token") || sessionStorage.getItem("sc_token");
  }
  function _notifApi(method, url, body) {
    const token = _notifToken();
    return fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body != null ? { body: JSON.stringify(body) } : {}),
    }).then(r => r.ok ? r.json() : Promise.reject(r.status));
  }
  function getOrganizationId() {
    const u = JSON.parse(localStorage.getItem("sc_user") || sessionStorage.getItem("sc_user") || "{}") || {};
    return u.organization_id || u.organizationId || u.org || null;
  }
  function uid() {
    return "notif_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function daysAgo(n) {
    const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString();
  }
  function hoursAgo(n) {
    const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString();
  }

  // ── Notification helpers ──────────────────────────────────────────────────
  function allNotifs()      { return dbGet(KEYS.NOTIFS); }
    function saveNotifs(arr)  {
    dbSet(KEYS.NOTIFS, arr);

    if (typeof SC.loadNotifications === "function") {
      SC.loadNotifications();
    }

    const orgId = getOrganizationId();
    const payload = { notificacoes: arr, ...(orgId ? { organization_id: orgId } : {}) };

    return _notifApi("POST", "/api/notificacoes/sync", payload).catch(() => {});
  }

  function getRules() { return { ...DEFAULT_RULES, ...dbGetObj(KEYS.RULES, {}) }; }
  function saveRulesData(r) {
    dbSet(KEYS.RULES, r);
    const orgId = getOrganizationId();
    const payload = { ...r, ...(orgId ? { organization_id: orgId } : {}) };
    _notifApi("PUT", "/api/notificacoes/rules", payload).catch(() => {});
  }

  function getFiltered() {
    const notifs = allNotifs().filter(n => !n.arquivada);
    switch (state.activeTab) {
      case "unread":  return notifs.filter(n => !n.lida);
      case "stock":   return notifs.filter(n => n.tipo === "estoque" || n.tipo === "descarte");
      case "request": return notifs.filter(n => n.tipo === "solicitacao");
      case "system":  return notifs.filter(n => n.tipo === "sistema" || n.tipo === "meta");
      default:        return notifs;
    }
  }

  // ── Seed mock notifications ───────────────────────────────────────────────
  function mergeNotificationState(remoteNotifs) {
    const localNotifs = allNotifs();
    return remoteNotifs.map((n) => {
      const local = localNotifs.find(x => x.id === n.id) || {};
      return {
        ...n,
        lida: typeof local.lida === "boolean" ? local.lida : Boolean(n.lida),
        arquivada: typeof local.arquivada === "boolean" ? local.arquivada : Boolean(n.arquivada),
        criadaEm: n.criadaEm || n.created_at || n.createdAt || new Date().toISOString(),
        lidaEm: local.lidaEm || n.lidaEm || null,
      };
    });
  }

  async function seedIfNeeded() {
    const _nu = JSON.parse(localStorage.getItem("sc_user") || sessionStorage.getItem("sc_user") || "{}") || {};
    try {
      const data = await _notifApi("GET", `/api/notificacoes${_nu.organization_id ? `?organization_id=${_nu.organization_id}` : ""}`);
      const notifs = Array.isArray(data) ? data : data.notificacoes || [];
      const merged = mergeNotificationState(notifs);
      if (merged.length) {
        dbSet(KEYS.NOTIFS, merged);
        renderList();
      }
    } catch (_) {
      /* Ignorar falha ao buscar notificações remotas */
    }

    const existing = allNotifs();
    if (existing.length) return;

    const mock = [
      {
        id: uid(), tipo: "estoque", subtipo: "estoque_baixo",
        titulo: "Estoque crítico: Monitor 24\"",
        mensagem: "Monitor 24\" está com 0 unidades disponíveis. Reposição urgente necessária.",
        itemId: "item_002", itemNome: "Monitor 24\"",
        prioridade: "critica", lida: false, arquivada: false,
        criadaEm: hoursAgo(2), lidaEm: null,
        acao: { label: "Ver item", url: "estoque.html" },
      },
      {
        id: uid(), tipo: "estoque", subtipo: "estoque_baixo",
        titulo: "Estoque baixo: Notebook Dell",
        mensagem: "Notebook Dell Inspiron está com apenas 2 unidades disponíveis (limite: 5).",
        itemId: "item_001", itemNome: "Notebook Dell Inspiron",
        prioridade: "alta", lida: false, arquivada: false,
        criadaEm: hoursAgo(5), lidaEm: null,
        acao: { label: "Ver item", url: "estoque.html" },
      },
      {
        id: uid(), tipo: "estoque", subtipo: "estoque_baixo",
        titulo: "Estoque baixo: Mouse Óptico",
        mensagem: "Mouse Óptico está com 3 unidades disponíveis (limite: 5).",
        itemId: "item_004", itemNome: "Mouse Óptico",
        prioridade: "media", lida: false, arquivada: false,
        criadaEm: daysAgo(1), lidaEm: null,
        acao: { label: "Ver item", url: "estoque.html" },
      },
      {
        id: uid(), tipo: "descarte", subtipo: "descarte_pendente",
        titulo: "Descarte pendente: Cadeira Escritório",
        mensagem: "Cadeira Escritório está marcada para descarte há 45 dias sem movimentação.",
        itemId: "item_007", itemNome: "Cadeira Escritório",
        prioridade: "alta", lida: false, arquivada: false,
        criadaEm: daysAgo(2), lidaEm: null,
        acao: { label: "Ver item", url: "estoque.html" },
      },
      {
        id: uid(), tipo: "descarte", subtipo: "descarte_pendente",
        titulo: "Descarte pendente: Monitor Antigo",
        mensagem: "Monitor CRT está marcado para descarte há 62 dias e não foi processado.",
        itemId: "item_999", itemNome: "Monitor CRT",
        prioridade: "critica", lida: true, arquivada: false,
        criadaEm: daysAgo(3), lidaEm: daysAgo(3),
        acao: null,
      },
      {
        id: uid(), tipo: "solicitacao", subtipo: "solicitacao_nova",
        titulo: "Nova solicitação urgente — Enfermaria",
        mensagem: "Setor Enfermaria solicitou 1x Cadeira de Rodas. Urgência: Urgente.",
        itemId: "item_011", itemNome: "Cadeira de Rodas",
        prioridade: "critica", lida: false, arquivada: false,
        criadaEm: hoursAgo(1), lidaEm: null,
        acao: { label: "Ver solicitação", url: "solicitacoes.html" },
      },
      {
        id: uid(), tipo: "solicitacao", subtipo: "solicitacao_nova",
        titulo: "Nova solicitação — Lab TI",
        mensagem: "Lab TI solicitou 2x Notebook Dell Inspiron. Urgência: Alta.",
        itemId: "item_001", itemNome: "Notebook Dell Inspiron",
        prioridade: "alta", lida: false, arquivada: false,
        criadaEm: hoursAgo(3), lidaEm: null,
        acao: { label: "Ver solicitação", url: "solicitacoes.html" },
      },
      {
        id: uid(), tipo: "solicitacao", subtipo: "solicitacao_nova",
        titulo: "Nova solicitação — Sala A01",
        mensagem: "Sala A01 solicitou 3x Teclado USB. Urgência: Média.",
        itemId: "item_003", itemNome: "Teclado USB",
        prioridade: "media", lida: true, arquivada: false,
        criadaEm: daysAgo(1), lidaEm: daysAgo(1),
        acao: { label: "Ver solicitação", url: "solicitacoes.html" },
      },
      {
        id: uid(), tipo: "solicitacao", subtipo: "solicitacao_aprovada",
        titulo: "Solicitação aprovada",
        mensagem: "A solicitação de 1x Oxímetro pelo Setor Saúde foi aprovada.",
        itemId: "item_013", itemNome: "Oxímetro",
        prioridade: "baixa", lida: true, arquivada: false,
        criadaEm: daysAgo(2), lidaEm: daysAgo(2),
        acao: null,
      },
      {
        id: uid(), tipo: "meta", subtipo: "meta_prazo",
        titulo: "Meta de arrecadação: 7 dias restantes",
        mensagem: "A meta de doações de equipamentos para ONGs vence em 7 dias. Progresso atual: 68%.",
        itemId: null, itemNome: null,
        prioridade: "alta", lida: false, arquivada: false,
        criadaEm: hoursAgo(6), lidaEm: null,
        acao: { label: "Ver relatório", url: "relatorios.html" },
      },
      {
        id: uid(), tipo: "meta", subtipo: "meta_progresso",
        titulo: "Meta de doações: 80% concluída",
        mensagem: "Parabéns! A meta de arrecadação de equipamentos atingiu 80% do objetivo.",
        itemId: null, itemNome: null,
        prioridade: "media", lida: true, arquivada: false,
        criadaEm: daysAgo(4), lidaEm: daysAgo(4),
        acao: { label: "Ver relatório", url: "relatorios.html" },
      },
      {
        id: uid(), tipo: "sistema", subtipo: "sistema_backup",
        titulo: "Backup concluído com sucesso",
        mensagem: "Backup automático dos dados do sistema realizado às 02:00. Sem erros.",
        itemId: null, itemNome: null,
        prioridade: "baixa", lida: true, arquivada: false,
        criadaEm: daysAgo(1), lidaEm: daysAgo(1),
        acao: null,
      },
      {
        id: uid(), tipo: "sistema", subtipo: "sistema_atualizacao",
        titulo: "Nova versão disponível: v2.4.1",
        mensagem: "StockControl v2.4.1 está disponível com melhorias de desempenho e correções de segurança.",
        itemId: null, itemNome: null,
        prioridade: "media", lida: false, arquivada: false,
        criadaEm: daysAgo(1), lidaEm: null,
        acao: null,
      },
      {
        id: uid(), tipo: "sistema", subtipo: "sistema_importacao",
        titulo: "Importação de dados concluída",
        mensagem: "42 itens foram importados com sucesso a partir do arquivo de inventário.",
        itemId: null, itemNome: null,
        prioridade: "baixa", lida: true, arquivada: false,
        criadaEm: daysAgo(5), lidaEm: daysAgo(5),
        acao: null,
      },
      {
        id: uid(), tipo: "sistema", subtipo: "sistema_relatorio",
        titulo: "Relatório mensal gerado",
        mensagem: "O relatório de movimentações do mês foi gerado e está disponível na seção Relatórios.",
        itemId: null, itemNome: null,
        prioridade: "baixa", lida: true, arquivada: false,
        criadaEm: daysAgo(7), lidaEm: daysAgo(7),
        acao: { label: "Ver relatório", url: "relatorios.html" },
      },
      {
        id: uid(), tipo: "estoque", subtipo: "estoque_baixo",
        titulo: "Estoque zerado: Teclado USB",
        mensagem: "Teclado USB atingiu 0 unidades disponíveis. Reposição necessária.",
        itemId: "item_003", itemNome: "Teclado USB",
        prioridade: "critica", lida: false, arquivada: false,
        criadaEm: hoursAgo(8), lidaEm: null,
        acao: { label: "Ver item", url: "estoque.html" },
      },
    ];

    // Sort newest first
    mock.sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
    saveNotifs(mock);
  }

  // ── Scan for new alerts from data ─────────────────────────────────────────
  function scanForAlerts() {
  const rules = getRules();
  const now = new Date();

  let generatedCount = 0;

  const RULE_ALERT_SUBTYPES = new Set([
    "estoque_baixo",
    "descarte_pendente",
    "solicitacao_nova",
    "meta_prazo",
  ]);

  const previousNotifs = allNotifs();

  // Mantém notificações que NÃO são geradas pelas regras
  // e remove as antigas das regras para gerar tudo novamente.
  const notifs = previousNotifs.filter(n => !RULE_ALERT_SUBTYPES.has(n.subtipo));

  // Regra 1: Estoque baixo
  if (rules.lowStock) {
    const threshold = parseInt(rules.lowStockThreshold, 10) || 5;

    dbGet(KEYS.ITEMS).forEach(it => {
      const disp = parseInt(it.disponivel, 10) || 0;

      if (disp > threshold) return;

      const prio = disp === 0 ? "critica" : disp <= 2 ? "alta" : "media";

      const msg = disp === 0
        ? `${it.nome} está com 0 unidades disponíveis. Reposição necessária.`
        : `${it.nome} está com apenas ${disp} unidade${disp > 1 ? "s" : ""} disponível (limite: ${threshold}).`;

      notifs.unshift({
        id: uid(),
        tipo: "estoque",
        subtipo: "estoque_baixo",
        titulo: disp === 0 ? `Estoque zerado: ${it.nome}` : `Estoque baixo: ${it.nome}`,
        mensagem: msg,
        itemId: it.id,
        itemNome: it.nome,
        prioridade: prio,
        lida: false,
        arquivada: false,
        criadaEm: new Date().toISOString(),
        lidaEm: null,
        acao: { label: "Ver item", url: "estoque.html" },
      });

      generatedCount++;
    });
  }

  // Regra 2: Itens para descarte
  if (rules.discard) {
    const limitDays = parseInt(rules.discardDays, 10) || 30;
    const movs = dbGet(KEYS.MOVEMENTS);

    dbGet(KEYS.ITEMS)
      .filter(it => it.condicao === "inativo")
      .forEach(it => {
        const lastMov = movs
          .filter(m => m.item_id === it.id)
          .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0];

        const refDate = lastMov
          ? new Date(lastMov.created_at)
          : new Date(it.created_at || 0);

        const daysSince = Math.floor((now - refDate) / 86400000);

        if (daysSince < limitDays) return;

        notifs.unshift({
          id: uid(),
          tipo: "descarte",
          subtipo: "descarte_pendente",
          titulo: `Descarte pendente: ${it.nome}`,
          mensagem: `${it.nome} está marcado para descarte há ${daysSince} dia${daysSince !== 1 ? "s" : ""} sem movimentação.`,
          itemId: it.id,
          itemNome: it.nome,
          prioridade: daysSince > 60 ? "critica" : "alta",
          lida: false,
          arquivada: false,
          criadaEm: new Date().toISOString(),
          lidaEm: null,
          acao: { label: "Ver item", url: "estoque.html" },
        });

        generatedCount++;
      });
  }

  // Regra 3: Solicitações pendentes
  if (rules.request) {
    const urgPrio = {
      urgente: "critica",
      alta: "alta",
      media: "media",
      baixa: "baixa",
    };

    dbGet(KEYS.REQUESTS)
      .filter(r => r.status === "pendente")
      .forEach(r => {
        notifs.unshift({
          id: uid(),
          tipo: "solicitacao",
          subtipo: "solicitacao_nova",
          titulo: `Nova solicitação — ${r.setor || "Setor"}`,
          mensagem: `${r.solicitante || "Usuário"} solicitou ${r.quantidade}x ${r.nome_item}. Urgência: ${r.urgencia || "—"}.`,
          itemId: r.id,
          itemNome: r.nome_item,
          prioridade: urgPrio[r.urgencia] || "media",
          lida: false,
          arquivada: false,
          criadaEm: r.created_at || new Date().toISOString(),
          lidaEm: null,
          acao: { label: "Ver solicitação", url: "solicitacoes.html" },
        });

        generatedCount++;
      });
  }

  saveNotifs(notifs);

  if (rulesCount) {
    rulesCount.textContent = generatedCount;
    rulesCount.style.display = generatedCount > 0 ? "inline-flex" : "none";

    setTimeout(() => {
      if (rulesCount) rulesCount.style.display = "none";
    }, 5000);
  }

  return generatedCount;
}

  // ── Render ────────────────────────────────────────────────────────────────
  const TYPE_ICON = {
    estoque:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    descarte:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`,
    solicitacao:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    meta:       `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    sistema:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  };
  const TYPE_ICON_CLASS = {
    estoque:    "notif-icon-stock",
    descarte:   "notif-icon-repair",
    solicitacao:"notif-icon-request",
    meta:       "notif-icon-donation",
    sistema:    "notif-icon-system",
  };
  const TIPO_LABEL = {
    estoque: "Estoque", descarte: "Descarte",
    solicitacao: "Solicitações", meta: "Metas", sistema: "Sistema",
  };

  function priorityBadge(p) {
    if (p === "critica") return `<span class="notif-priority notif-priority-critica">Crítica</span>`;
    if (p === "alta")    return `<span class="notif-priority notif-priority-alta">Alta</span>`;
    if (p === "media")   return `<span class="notif-priority notif-priority-media">Média</span>`;
    return "";
  }

  function renderList() {
    if (!listEl) return;
    const filtered = getFiltered();
    const total    = filtered.length;
    const start    = (state.page - 1) * state.perPage;
    const pageRows = filtered.slice(start, start + state.perPage);

    updateBadges();

    if (!total) {
      listEl.innerHTML = "";
      if (emptyEl) emptyEl.style.display = "flex";
      if (pagRow)  pagRow.style.display  = "none";
      return;
    }
    if (emptyEl) emptyEl.style.display = "none";

    listEl.innerHTML = pageRows.map(n => {
      const iconCls = TYPE_ICON_CLASS[n.tipo] || "notif-icon-system";
      const icon    = TYPE_ICON[n.tipo]       || TYPE_ICON.sistema;
      const tipoLbl = TIPO_LABEL[n.tipo]      || n.tipo;
      const actHtml = n.acao
        ? `<a href="${SC.escHtml(n.acao.url)}" class="notif-action-btn" onclick="event.stopPropagation()">${SC.escHtml(n.acao.label)} →</a>`
        : "";
      return `<div class="notif-item${n.lida ? "" : " unread"}" data-id="${SC.escHtml(n.id)}" role="button" tabindex="0" aria-label="${SC.escHtml(n.titulo)}">
        <div class="notif-icon ${iconCls}">${icon}</div>
        <div class="notif-body">
          <div class="notif-title-row">
            <span class="notif-title">${SC.escHtml(n.titulo)}</span>
            ${priorityBadge(n.prioridade)}
          </div>
          <div class="notif-msg">${SC.escHtml(n.mensagem)}</div>
          <div class="notif-time">${SC.fmtRelTime(n.criadaEm)} · ${SC.escHtml(tipoLbl)}</div>
        </div>
        ${!n.lida ? `<div class="notif-dot" aria-hidden="true"></div>` : ""}
        <div class="notif-item-actions">
          ${actHtml}
          <button class="notif-delete-btn" data-delete="${SC.escHtml(n.id)}" aria-label="Arquivar" title="Arquivar" onclick="event.stopPropagation()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>`;
    }).join("");

    // Wire click handlers
    listEl.querySelectorAll(".notif-item").forEach(el => {
      el.addEventListener("click", () => markRead(el.dataset.id));
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); markRead(el.dataset.id); } });
    });
    listEl.querySelectorAll("[data-delete]").forEach(btn => {
      btn.addEventListener("click", () => archiveNotif(btn.dataset.delete));
    });

    // Pagination
    if (pagRow) pagRow.style.display = total > state.perPage ? "" : "none";
    SC.renderPagination({
      containerId: "notifPagControls",
      infoId:      "notifPagInfo",
      page:        state.page,
      perPage:     state.perPage,
      total,
      onPageChange: p => { state.page = p; renderList(); },
    });
  }

  // ── Badge updates ─────────────────────────────────────────────────────────
  function updateBadges() {
    const notifs  = allNotifs().filter(n => !n.arquivada);
    const all     = notifs.length;
    const unread  = notifs.filter(n => !n.lida).length;
    const stock   = notifs.filter(n => n.tipo === "estoque" || n.tipo === "descarte").length;
    const request = notifs.filter(n => n.tipo === "solicitacao").length;
    const system  = notifs.filter(n => n.tipo === "sistema" || n.tipo === "meta").length;

    function setEl(id, val) { const e = document.getElementById(id); if (e) e.textContent = val; }
    setEl("tab-badge-all",    all);
    setEl("tab-badge-unread", unread);

    // Update per-tab badge (only show on non-zero tabs that have specific badges)
    const tabBadgeStock   = document.querySelector(".tab[data-tab='stock'] .badge");
    const tabBadgeRequest = document.querySelector(".tab[data-tab='request'] .badge");
    const tabBadgeSystem  = document.querySelector(".tab[data-tab='system'] .badge");

    if (tabBadgeStock)   tabBadgeStock.textContent   = stock;
    if (tabBadgeRequest) tabBadgeRequest.textContent = request;
    if (tabBadgeSystem)  tabBadgeSystem.textContent  = system;

    // Header badge
    if (notifBadge) {
      if (unread > 0) {
        notifBadge.textContent = unread > 9 ? "9+" : unread;
        notifBadge.style.display = "flex";
      } else {
        notifBadge.style.display = "none";
      }
    }

    // Update header dropdown list
    updateHeaderDropdown(notifs.filter(n => !n.lida).slice(0, 5));
  }

  function updateHeaderDropdown(unreadNotifs) {
    const listDrop = document.getElementById("notifListDrop");
    if (!listDrop) return;
    if (!unreadNotifs.length) {
      listDrop.innerHTML = `<div style="padding:var(--space-4);text-align:center;color:var(--color-text-muted);font-size:0.875rem;">Tudo lido</div>`;
      return;
    }
    listDrop.innerHTML = unreadNotifs.map(n => `
      <a href="notificacoes.html" class="dropdown-item" style="white-space:normal;padding:var(--space-3);">
        <div style="font-size:0.8125rem;font-weight:500;color:var(--color-text-primary);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${SC.escHtml(n.titulo)}</div>
        <div style="font-size:0.75rem;color:var(--color-text-muted);">${SC.fmtRelTime(n.criadaEm)}</div>
      </a>`).join("") +
      `<div class="dropdown-separator"></div>
       <a href="notificacoes.html" class="dropdown-item" style="text-align:center;font-size:0.8125rem;">Ver todas</a>`;
  }

  // ── Mark read ─────────────────────────────────────────────────────────────
  function markRead(id) {
    const notifs = allNotifs();
    const n      = notifs.find(x => x.id === id);
    if (!n || n.lida) return;
    n.lida   = true;
    n.lidaEm = new Date().toISOString();
    saveNotifs(notifs);
    renderList();
  }

  function markAllRead() {
    const notifs   = allNotifs();
    const filtered = getFiltered();
    const ids      = new Set(filtered.map(n => n.id));
    let changed    = false;
    notifs.forEach(n => {
      if (ids.has(n.id) && !n.lida) { n.lida = true; n.lidaEm = new Date().toISOString(); changed = true; }
    });
    if (!changed) { SC.toastInfo("Nenhuma notificação não lida nesta aba."); return; }
    saveNotifs(notifs);
    renderList();
    SC.toastSuccess("Notificações marcadas como lidas.");
  }

  // ── Archive (delete) ──────────────────────────────────────────────────────
  function archiveNotif(id) {
    const notifs = allNotifs();
    const n      = notifs.find(x => x.id === id);
    if (!n) return;
    n.arquivada = true;
    saveNotifs(notifs);
    state.page = 1;
    renderList();
  }

  // ── Rules UI ──────────────────────────────────────────────────────────────
  function loadRulesToUI(rules) {
    function setCheck(id, v) { const el = document.getElementById(id); if (el) el.checked = v; }
    function setVal(id, v)   { const el = document.getElementById(id); if (el) el.value = v; }
    setCheck("rule-low-stock",       rules.lowStock);
    setCheck("rule-discard",         rules.discard);
    setCheck("rule-request",         rules.request);
    setCheck("rule-goal",            rules.goal);
    setCheck("rule-email",           rules.email);
    setVal("rule-stock-threshold",   rules.lowStockThreshold);
    setVal("rule-discard-days",      rules.discardDays);
    setVal("rule-goal-days",         rules.goalDays);
    syncRuleCardState();
  }

  function syncRuleCardState() {
    const pairs = [
      ["rule-low-stock", "ruleCardLowStock"],
      ["rule-discard",   "ruleCardDiscard"],
      ["rule-request",   "ruleCardRequest"],
      ["rule-goal",      "ruleCardGoal"],
      ["rule-email",     "ruleCardEmail"],
    ];
    pairs.forEach(([checkId, cardId]) => {
      const chk  = document.getElementById(checkId);
      const card = document.getElementById(cardId);
      if (chk && card) card.classList.toggle("rule-disabled", !chk.checked);
    });
  }

  function collectRules() {
    function getCheck(id) { return document.getElementById(id)?.checked ?? false; }
    function getVal(id)   { return document.getElementById(id)?.value || ""; }
    return {
      lowStock:          getCheck("rule-low-stock"),
      lowStockThreshold: Math.max(1, parseInt(getVal("rule-stock-threshold")) || 5),
      discard:           getCheck("rule-discard"),
      discardDays:       Math.max(1, parseInt(getVal("rule-discard-days")) || 30),
      request:           getCheck("rule-request"),
      goal:              getCheck("rule-goal"),
      goalDays:          Math.max(1, parseInt(getVal("rule-goal-days")) || 7),
      email:             getCheck("rule-email"),
    };
  }

  function saveRules() {
  const btn = document.getElementById("btn-save-rules");
  const rules = collectRules();

  if (btn) btn.disabled = true;

  saveRulesData(rules);
  loadRulesToUI(rules);
  renderList();

  if (btn) btn.disabled = false;

  SC.toastSuccess("Regras de alertas salvas com sucesso. Clique em Gerar Alertas para atualizar a lista.");
}

  // ── Wire tabs ─────────────────────────────────────────────────────────────
  function wireTabs() {
    document.querySelectorAll(".tab[data-tab]").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab[data-tab]").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        state.activeTab = tab.dataset.tab;
        state.page      = 1;
        renderList();
      });
    });
  }

  // ── Wire actions ──────────────────────────────────────────────────────────
  function wireActions() {
    document.getElementById("btn-mark-all-read")?.addEventListener("click", markAllRead);
    document.getElementById("btn-save-rules")?.addEventListener("click", saveRules);
    document.getElementById("btnScanAlerts")?.addEventListener("click", () => {
  const n = scanForAlerts();

  state.page = 1;
  renderList();

  if (typeof SC.loadNotifications === "function") {
    SC.loadNotifications();
  }

  SC.toastSuccess(
    n > 0
      ? `${n} alerta${n > 1 ? "s" : ""} gerado${n > 1 ? "s" : ""} com base nas regras ativas.`
      : "Nenhum alerta foi gerado com as regras ativas."
  );
});

    // Toggle dimming
    const toggleIds = ["rule-low-stock","rule-discard","rule-request","rule-goal","rule-email"];
    toggleIds.forEach(id => {
      document.getElementById(id)?.addEventListener("change", syncRuleCardState);
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
  const rules = getRules();
  loadRulesToUI(rules);
  await seedIfNeeded();
  wireTabs();
  wireActions();
  renderList();
}

  init();
});
