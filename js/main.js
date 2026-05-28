/**
 * main.js — StockControl
 * Shared bootstrap for every authenticated page.
 *
 * Responsibilities:
 *  - Auth guard (redirect to login if no token)
 *  - Populate sidebar user info + header avatar
 *  - Sidebar collapse / mobile drawer
 *  - Dropdown menus (notifications, user)
 *  - Modal open / close
 *  - Toast notifications
 *  - Global API helper (SC.api)
 *  - Logout
 */

(() => {
  "use strict";

  /* ============================================================
     CONSTANTS
     ============================================================ */
  const API_BASE = "/api";
  const TOKEN_KEY = "sc_token";
  const USER_KEY = "sc_user";

  /* ============================================================
     SESSION
     ============================================================ */
  function getToken() {
    return (
      localStorage.getItem(TOKEN_KEY) ||
      sessionStorage.getItem(TOKEN_KEY) ||
      null
    );
  }

  function getUser() {
    const raw =
      localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function clearSession() {
    [localStorage, sessionStorage].forEach((s) => {
      s.removeItem(TOKEN_KEY);
      s.removeItem(USER_KEY);
    });
  }

  /* ============================================================
     AUTH GUARD
     ============================================================ */
  const token = getToken();
  if (!token) {
    window.location.replace("/acesso/login/login.html");
    /* Stop execution — the rest of this file must not run */
    throw new Error("unauthenticated");
  }

  /* ============================================================
     API HELPER
     ============================================================ */
  const SC = (window.SC = window.SC || {});

  /* ============================================================
     THEME MANAGER
     ============================================================ */
  function aplicarTema(tema) {
    const html = document.documentElement;
    if (tema === 'escuro') {
      html.setAttribute('data-theme', 'dark');
    } else if (tema === 'auto') {
      html.setAttribute('data-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } else {
      html.setAttribute('data-theme', 'light');
    }
  }

  function getCurrentPreferencesStorageKey() {
    const user = getUser() || {};
    const orgId = user.organization_id || user.organizationId || user.orgId || '';
    return orgId ? `sc_preferencias_${orgId}` : 'sc_preferencias';
  }

  function carregarTemaPreferido() {
    try {
      const prefsRaw = localStorage.getItem(getCurrentPreferencesStorageKey());
      const prefs = prefsRaw ? JSON.parse(prefsRaw) : {};
      const tema = prefs.tema || 'claro';
      aplicarTema(tema);
    } catch {}
  }

  carregarTemaPreferido();

  /* Expose theme manager to global scope */
  SC.aplicarTema = aplicarTema;
  SC.carregarTemaPreferido = carregarTemaPreferido;

  SC.storageKey = function (key, orgId) {
    const user = getUser() || {};
    const organizationId = orgId || user.organization_id || user.organizationId || user.org;
    return organizationId ? `${key}_${organizationId}` : key;
  };

  /**
   * SC.api(path, options)
   * Thin wrapper around fetch that:
   *  - Prepends API_BASE
   *  - Injects Authorization header
   *  - Parses JSON
   *  - On 401 → clears session and redirects to login
   */
  SC.api = async function (path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers || {}),
    };

    /* FormData bodies must NOT have Content-Type set (browser sets it) */
    if (options.body instanceof FormData) {
      delete headers["Content-Type"];
    }

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401) {
      clearSession();
      window.location.replace("/acesso/login/login.html");
      throw new Error("Session expired");
    }

    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await res.json().catch(() => ({}))
      : await res.text().catch(() => "");

    if (!res.ok) {
      const msg =
        (data && data.message) || (data && data.error) || `HTTP ${res.status}`;
      throw Object.assign(new Error(msg), { status: res.status, data });
    }

    return data;
  };

  /* ============================================================
     TOAST SYSTEM
     ============================================================ */
  SC.toast = function (message, type = "info", duration = 4000) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const icons = {
      success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
      error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    };

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" aria-label="Fechar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>`;

    container.appendChild(toast);

    /* Animate in */
    requestAnimationFrame(() => toast.classList.add("toast-visible"));

    const dismiss = () => {
      toast.classList.remove("toast-visible");
      toast.addEventListener("transitionend", () => toast.remove(), {
        once: true,
      });
    };

    toast.querySelector(".toast-close").addEventListener("click", dismiss);
    if (duration > 0) setTimeout(dismiss, duration);

    return dismiss;
  };

  /* Convenience aliases */
  SC.toastSuccess = (msg, d) => SC.toast(msg, "success", d);
  SC.toastError = (msg, d) => SC.toast(msg, "error", d);
  SC.toastWarning = (msg, d) => SC.toast(msg, "warning", d);
  SC.toastInfo = (msg, d) => SC.toast(msg, "info", d);

  /* ============================================================
     MODAL SYSTEM
     ============================================================ */
  SC.openModal = function (id) {
    const backdrop = document.getElementById(id);
    if (!backdrop) return;
    backdrop.classList.add("is-open");
    document.body.style.overflow = "hidden";
    /* Focus first focusable element */
    const focusable = backdrop.querySelector(
      "input, select, textarea, button:not(.modal-close)",
    );
    if (focusable) setTimeout(() => focusable.focus(), 80);
  };

  SC.closeModal = function (id) {
    const backdrop = document.getElementById(id);
    if (!backdrop) return;
    backdrop.classList.remove("is-open");
    document.body.style.overflow = "";
  };

  /* Close on backdrop click */
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-backdrop")) {
      SC.closeModal(e.target.id);
    }
  });

  /* Close via data-close-modal attribute */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-close-modal]");
    if (btn) SC.closeModal(btn.dataset.closeModal);
  });

  /* Escape key closes top-most open modal */
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = document.querySelector(".modal-backdrop.is-open");
    if (open) SC.closeModal(open.id);
  });

  /* ============================================================
     SIDEBAR — expande por hover (CSS), drawer no mobile
     ============================================================ */
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const headerMenuBtn = document.getElementById("headerMenuBtn");

  function isMobile() {
    return window.innerWidth < 769;
  }

  function openMobileDrawer() {
    sidebar && sidebar.classList.add("mobile-open");
    sidebarOverlay && sidebarOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }
  function closeMobileDrawer() {
    sidebar && sidebar.classList.remove("mobile-open");
    sidebarOverlay && sidebarOverlay.classList.remove("active");
    document.body.style.overflow = "";
  }

  headerMenuBtn &&
    headerMenuBtn.addEventListener("click", () => {
      if (isMobile()) {
        openMobileDrawer();
      } else {
        sidebar && sidebar.classList.toggle("pinned");
      }
    });

  sidebarOverlay && sidebarOverlay.addEventListener("click", closeMobileDrawer);

  window.addEventListener("resize", () => {
    if (!isMobile()) closeMobileDrawer();
  });

  /* ============================================================
     DROPDOWN MENUS
     ============================================================ */
  function closeAllDropdowns(except) {
    document.querySelectorAll(".dropdown-menu.is-open").forEach((m) => {
      if (m !== except) m.classList.remove("is-open");
    });
  }

  document.addEventListener("click", (e) => {
    const dropdownEl = e.target.closest(".dropdown");

    if (!dropdownEl) {
      closeAllDropdowns(null);
      return;
    }

    const menu = dropdownEl.querySelector(".dropdown-menu");
    if (!menu) return;

    /* Toggle clicked dropdown, close others */
    const isOpen = menu.classList.contains("is-open");
    closeAllDropdowns(null);
    if (!isOpen) menu.classList.add("is-open");
  });

  /* ============================================================
     USER INFO — populate header & sidebar
     ============================================================ */
  function getInitials(name) {
    if (!name) return "--";
    return name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  function applyUserInfo(user) {
    if (!user) return;
    const initials = getInitials(user.name);
    const roleLabels = {
      ADMIN: "Administrador",
      OPERATOR: "Operador",
      VIEWER: "Visualizador",
    };
    const roleLabel = roleLabels[user.role] || user.role || "—";

    // Try to load user's avatar from local storage
    const getUserStorageKey = () => {
      const id = user?.id || user?.user_id || user?.userId || '';
      return id ? `sc_usuario_${id}` : 'sc_usuario';
    };
    let userAvatar = null;
    try {
      const userDataRaw = localStorage.getItem(getUserStorageKey());
      const userData = userDataRaw ? JSON.parse(userDataRaw) : {};
      userAvatar = userData.avatar || null;
    } catch {}

    /* Sidebar */
    const sidebarInitials = document.getElementById("sidebarInitials");
    const sidebarUserName = document.getElementById("sidebarUserName");
    const sidebarUserRole = document.getElementById("sidebarUserRole");
    
    if (sidebarInitials) {
      const sidebarAvatar = sidebarInitials.parentElement;
      if (sidebarAvatar && userAvatar) {
        sidebarInitials.style.display = 'none';
        let img = sidebarAvatar.querySelector('img');
        if (!img) {
          img = document.createElement('img');
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          img.style.borderRadius = 'inherit';
          sidebarAvatar.appendChild(img);
        }
        img.src = userAvatar;
      } else if (sidebarInitials) {
        sidebarInitials.textContent = initials;
        sidebarInitials.style.display = '';
        if (sidebarAvatar) {
          const img = sidebarAvatar.querySelector('img');
          if (img) img.remove();
        }
      }
    }
    
    if (sidebarUserName) sidebarUserName.textContent = user.name || "Usuário";
    if (sidebarUserRole) sidebarUserRole.textContent = roleLabel;

    /* Header */
    const headerAvatar = document.getElementById("headerAvatar");
    const headerUserName = document.getElementById("headerUserName");
    
    if (headerAvatar) {
      if (userAvatar) {
        headerAvatar.textContent = '';
        let img = headerAvatar.querySelector('img');
        if (!img) {
          img = document.createElement('img');
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          img.style.borderRadius = 'inherit';
          headerAvatar.appendChild(img);
        }
        img.src = userAvatar;
      } else {
        headerAvatar.textContent = initials;
        const img = headerAvatar.querySelector('img');
        if (img) img.remove();
      }
    }
    
    if (headerUserName)
      headerUserName.textContent = user.name
        ? user.name.split(" ")[0]
        : "Usuário";
  }

  /* Try from session cache first, then fetch */
  const cachedUser = getUser();
  if (cachedUser) applyUserInfo(cachedUser);

  SC.api("/users/me")
    .then((data) => {
      const user = data.user || data;
      /* Update cache */
      const storage = localStorage.getItem(TOKEN_KEY)
        ? localStorage
        : sessionStorage;
      storage.setItem(USER_KEY, JSON.stringify(user));
      applyUserInfo(user);
      SC.currentUser = user;
    })
    .catch(() => {
      /* Non-critical: keep showing cached data */
    });

  /* ============================================================
     NOTIFICATIONS DROPDOWN
     ============================================================ */
  function mergeNotificationState(remoteNotifs) {
    const cacheKey = SC.storageKey("sc_notifications");
    const localNotifs = JSON.parse(localStorage.getItem(cacheKey) || "[]") || [];
    return remoteNotifs.map((n) => {
      const local = localNotifs.find(x => x.id === n.id) || {};
      return {
        ...n,
        lida: typeof local.lida === "boolean" ? local.lida : Boolean(n.lida),
        arquivada: typeof local.arquivada === "boolean" ? local.arquivada : Boolean(n.arquivada),
        criadaEm: n.criadaEm || n.created_at || n.createdAt || "",
      };
    });
  }

  async function loadNotifications() {
    const badge = document.getElementById("notifBadge");
    const listDrop = document.getElementById("notifListDrop");

    try {
      const _u2 = SC.currentUser || getUser();
      const _qs = _u2?.organization_id
        ? `?organization_id=${_u2.organization_id}`
        : "";
      const data = await SC.api(`/notificacoes${_qs}`);
      const rawNotifs = Array.isArray(data)
        ? data
        : data.notificacoes || data.notifications || [];
      const notifs = mergeNotificationState(rawNotifs)
        .filter(n => !n.arquivada);
      const unread = notifs.filter(n => !n.lida).length;

      if (badge) {
        if (unread > 0) {
          badge.textContent = unread > 9 ? "9+" : unread;
          badge.style.display = "flex";
        } else {
          badge.style.display = "none";
        }
      }

      if (listDrop) {
        const current = notifs.filter(n => !n.lida).slice(0, 5);
        if (!current.length) {
          listDrop.innerHTML = `<div style="padding:var(--space-4);text-align:center;color:var(--color-text-muted);font-size:0.875rem;">Tudo lido</div>`;
        } else {
          listDrop.innerHTML = current
            .map(
              (n) => `
          <div class="dropdown-item" style="white-space:normal; cursor:default; padding:var(--space-3);">
            <div style="font-size:0.875rem; font-weight:500; color:var(--color-text-primary); margin-bottom:2px;">
              ${escHtml(n.titulo || n.title || n.mensagem || n.message || "Notificação")}
            </div>
            <div style="font-size:0.8125rem; color:var(--color-text-muted);">
              ${n.criadaEm ? formatRelTime(n.criadaEm) : ""}
            </div>
          </div>`,
            )
            .join("");
        }
      }
    } catch {
      /* Silently fail */
    }
  }

  loadNotifications();

  /* ============================================================
     LOGOUT
     ============================================================ */
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      window.location.replace("/acesso/login/login.html");
    });
  }

  /* ============================================================
     GLOBAL SEARCH
     ============================================================ */
  const globalSearch = document.getElementById("globalSearch");
  if (globalSearch) {
    let searchTimer;
    globalSearch.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const q = globalSearch.value.trim();
        if (q) window.location.href = `estoque.html?q=${encodeURIComponent(q)}`;
      }
    });
    /* Debounced live search could be added here */
  }

  /* ============================================================
     UTILS (exported on SC)
     ============================================================ */

  /** Escape HTML to prevent XSS */
  SC.escHtml = function (str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };
  const escHtml = SC.escHtml;

  function getSavedDateFormat() {
    try {
      const raw = localStorage.getItem(getCurrentPreferencesStorageKey());
      const prefs = raw ? JSON.parse(raw) : {};
      return prefs.formatoData || 'DD/MM/AAAA';
    } catch {
      return 'DD/MM/AAAA';
    }
  }

  function formatDateByPattern(date, pattern) {
    const pad = (value) => String(value).padStart(2, '0');
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();

    switch (pattern) {
      case 'MM/DD/AAAA':
        return `${month}/${day}/${year}`;
      case 'AAAA-MM-DD':
        return `${year}-${month}-${day}`;
      default:
        return `${day}/${month}/${year}`;
    }
  }

  function parseDateValue(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    const isoDate = new Date(trimmed);
    if (!Number.isNaN(isoDate.getTime())) return isoDate;

    const pattern = getSavedDateFormat();
    const dateTimeSplit = trimmed.split(' ');
    const datePart = dateTimeSplit[0];
    const timePart = dateTimeSplit[1] || null;

    let match;
    if ((match = datePart.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/))) {
      const [, year, month, day] = match.map(Number);
      return new Date(year, month - 1, day);
    }

    if ((match = datePart.match(/^([0-9]{2})\/([0-9]{2})\/([0-9]{4})$/))) {
      const [_, a, b, c] = match;
      const n1 = Number(a);
      const n2 = Number(b);
      const n3 = Number(c);
      if (pattern === 'MM/DD/AAAA') {
        return new Date(n3, n1 - 1, n2);
      }
      return new Date(n3, n2 - 1, n1);
    }

    if (timePart && (match = trimmed.match(/^([0-9]{2})\/([0-9]{2})\/([0-9]{4})\s+([0-9]{2}):([0-9]{2})$/))) {
      const [, a, b, c, h, m] = match.map(Number);
      if (pattern === 'MM/DD/AAAA') {
        return new Date(c, a - 1, b, h, m);
      }
      return new Date(c, b - 1, a, h, m);
    }

    return null;
  }

  /** Format ISO date string to local short date */
  SC.fmtDate = function (iso) {
    if (!iso) return "—";
    const d = parseDateValue(iso);
    if (!d) return iso;
    return formatDateByPattern(d, getSavedDateFormat());
  };

  /** Format ISO date+time */
  SC.fmtDateTime = function (iso) {
    if (!iso) return "—";
    const d = parseDateValue(iso);
    if (!d) return iso;
    const datePart = formatDateByPattern(d, getSavedDateFormat());
    const timePart = d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${datePart} ${timePart}`;
  };

  /** Relative time label */
  function formatRelTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "Agora";
    if (min < 60) return `Há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `Há ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `Há ${d} dia${d > 1 ? "s" : ""}`;
    return SC.fmtDate(iso);
  }
  SC.fmtRelTime = formatRelTime;

  /** Format currency */
  SC.fmtCurrency = function (val) {
    if (val == null || val === "") return "—";
    return Number(val).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  /** Condition badge HTML */
  SC.conditionBadge = function (code) {
    const map = {
      OTIMO: ["badge-otimo", "Ótimo"],
      REPARO: ["badge-reparo", "Reparo"],
      DESCARTAR: ["badge-descartar", "Descartar"],
    };
    const [cls, label] = map[code] || ["badge-neutral", code || "—"];
    return `<span class="badge ${cls}"><span class="badge-dot"></span>${escHtml(label)}</span>`;
  };

  /** Movement type label */
  SC.movTypeBadge = function (type) {
    const map = {
      ENTRADA: ["mov-entrada", "Entrada"],
      SAIDA: ["mov-saida", "Saída"],
      DOACAO: ["mov-doacao", "Doação"],
      DESCARTE: ["mov-descarte", "Descarte"],
      TRANSFERENCIA: ["mov-transferencia", "Transferência"],
    };
    const [cls, label] = map[type] || ["", type];
    return `<span class="movement-type ${cls}">
      <span style="width:7px;height:7px;border-radius:50%;background:currentColor;display:inline-block;flex-shrink:0;"></span>
      ${escHtml(label)}
    </span>`;
  };

  /** Build simple pagination controls */
  SC.renderPagination = function ({
    containerId,
    infoId,
    page,
    perPage,
    total,
    onPageChange,
  }) {
    const info = document.getElementById(infoId);
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const from = total === 0 ? 0 : (page - 1) * perPage + 1;
    const to = Math.min(page * perPage, total);

    if (info) info.textContent = `${from}–${to} de ${total}`;

    /* Build page buttons with ellipsis */
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("…");
      for (
        let i = Math.max(2, page - 1);
        i <= Math.min(totalPages - 1, page + 1);
        i++
      )
        pages.push(i);
      if (page < totalPages - 2) pages.push("…");
      pages.push(totalPages);
    }

    container.innerHTML = `
      <button class="page-btn" data-page="${page - 1}" ${page === 1 ? "disabled" : ""} aria-label="Anterior">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      ${pages
        .map((p) =>
          p === "…"
            ? `<span class="page-ellipsis">…</span>`
            : `<button class="page-btn ${p === page ? "active" : ""}" data-page="${p}">${p}</button>`,
        )
        .join("")}
      <button class="page-btn" data-page="${page + 1}" ${page === totalPages ? "disabled" : ""} aria-label="Próximo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>`;

    container.querySelectorAll(".page-btn[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = Number(btn.dataset.page);
        if (p >= 1 && p <= totalPages && p !== page) onPageChange(p);
      });
    });
  };

  /** Debounce utility */
  SC.debounce = function (fn, ms = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  };

  /** Copy text to clipboard */
  SC.copyText = function (text, successMsg = "Copiado!") {
    navigator.clipboard
      .writeText(text)
      .then(() => SC.toastSuccess(successMsg, 2000))
      .catch(() => SC.toastError("Não foi possível copiar."));
  };

  /** Read URL search params as object */
  SC.urlParams = function () {
    return Object.fromEntries(new URLSearchParams(window.location.search));
  };

  /* ============================================================
     SETTINGS PAGE — tab navigation (only wired when on that page)
     ============================================================ */
  document.querySelectorAll(".settings-nav-item[data-panel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      /* Nav active state */
      document
        .querySelectorAll(".settings-nav-item")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      /* Panel visibility */
      document
        .querySelectorAll(".settings-panel")
        .forEach((p) => p.classList.remove("active"));
      const target = document.getElementById(`panel-${btn.dataset.panel}`);
      if (target) target.classList.add("active");
    });
  });

  /* ============================================================
     REPORT CARD SELECTION (only wired when on relatorios page)
     ============================================================ */
  document.querySelectorAll(".report-card[data-report]").forEach((card) => {
    card.addEventListener("click", () => {
      document
        .querySelectorAll(".report-card")
        .forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      /* Emit custom event so relatorios.js can react */
      document.dispatchEvent(
        new CustomEvent("reportSelected", { detail: card.dataset.report }),
      );
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        card.click();
      }
    });
  });

  /* ============================================================
     READY
     ============================================================ */
  SC.ready = true;
  setTimeout(() => document.dispatchEvent(new Event("sc:ready")), 0);
})();
