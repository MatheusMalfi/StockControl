/**
 * layout.js — StockControl
 * Injeta dinamicamente o sidebar e o header em todas as páginas autenticadas.
 * Deve ser carregado ANTES de main.js, no final do <body>.
 */
(function () {
  "use strict";

  /* ── Sidebar HTML ── */
  const sidebarHTML = `
<aside class="sidebar" id="sidebar">
  <div class="sidebar-header">
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
      <div class="sidebar-logo-text">
        <span class="sidebar-logo-name">StockControl</span>
        <span class="sidebar-logo-sub">USCS</span>
      </div>
    </div>
  </div>

  <nav class="sidebar-nav">
    <div class="nav-section">
      <span class="nav-section-label">Principal</span>
      <a href="/index.html" class="nav-item" data-page="index.html">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        <span class="nav-label">Dashboard</span>
      </a>
      <a href="/estoque.html" class="nav-item" data-page="estoque.html">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        <span class="nav-label">Estoque</span>
      </a>
      <a href="/movimentacoes.html" class="nav-item" data-page="movimentacoes.html">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
        <span class="nav-label">Movimentações</span>
      </a>
      <a href="/solicitacoes.html" class="nav-item" data-page="solicitacoes.html">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
        <span class="nav-label">Solicitações</span>
      </a>
      <a href="/relatorios.html" class="nav-item" data-page="relatorios.html">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        <span class="nav-label">Relatórios</span>
      </a>
      <a href="/notificacoes.html" class="nav-item" data-page="notificacoes.html">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <span class="nav-label">Notificações</span>
      </a>
    </div>
    <div class="nav-section">
      <span class="nav-section-label">Gerenciar</span>
      <a href="/form-item.html" class="nav-item" data-page="form-item.html">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        <span class="nav-label">Novo Item</span>
      </a>
      <a href="/parceiros.html" class="nav-item" data-page="parceiros.html">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span class="nav-label">Parceiros</span>
      </a>
      <a href="/etiquetas.html" class="nav-item" data-page="etiquetas.html">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
        <span class="nav-label">Etiquetas</span>
      </a>
      <a href="/configuracoes.html" class="nav-item" data-page="configuracoes.html">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
        <span class="nav-label">Configurações</span>
      </a>
    </div>
  </nav>

  <div class="sidebar-footer">
    <div class="sidebar-user">
      <div class="avatar"><span id="sidebarInitials">--</span></div>
      <div class="sidebar-user-info">
        <span class="sidebar-user-name" id="sidebarUserName">Carregando…</span>
        <span class="sidebar-user-role" id="sidebarUserRole">—</span>
      </div>
    </div>
  </div>
</aside>`;

  /* ── Header HTML ── */
  const headerHTML = `
<header class="header">
  <button class="header-menu-btn" id="headerMenuBtn" aria-label="Abrir menu">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="6"  x2="21" y2="6"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  </button>

  <div class="header-search">
    <svg class="header-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <input type="search" class="header-search-input" placeholder="Buscar item, patrimônio, QR…" id="globalSearch" />
  </div>

  <div class="header-actions">
    <div class="dropdown" id="notifDropdown">
      <button class="header-notif-btn" id="notifBtn" aria-label="Notificações">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span class="notif-badge" id="notifBadge" style="display:none;">0</span>
      </button>
      <div class="dropdown-menu" id="notifMenu" style="min-width:300px; right:0; max-height:360px; overflow-y:auto;">
        <div class="dropdown-header">Notificações</div>
        <div id="notifListDrop">
          <div style="padding:var(--space-4); text-align:center; color:var(--color-text-muted); font-size:0.875rem;">
            Sem notificações
          </div>
        </div>
      </div>
    </div>

    <div class="dropdown" id="userDropdown">
      <button class="header-user-btn" id="userBtn">
        <div class="avatar avatar-sm" id="headerAvatar">--</div>
        <span class="header-user-name" id="headerUserName">Usuário</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <div class="dropdown-menu" id="userMenu">
        <a href="/configuracoes.html" class="dropdown-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          Meu Perfil
        </a>
        <a href="/configuracoes.html" class="dropdown-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
          </svg>
          Configurações
        </a>
        <div class="dropdown-separator"></div>
        <button class="dropdown-item danger" id="logoutBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sair
        </button>
      </div>
    </div>
  </div>
</header>`;

  /* ── Injeção no DOM ── */
  const pageMain = document.querySelector("main.page-content");
  if (!pageMain) return; // página sem layout padrão (ex: login)

  // Overlay mobile
  const overlay = document.createElement("div");
  overlay.className = "sidebar-overlay";
  overlay.id = "sidebarOverlay";

  // Sidebar
  const sidebarWrapper = document.createElement("div");
  sidebarWrapper.innerHTML = sidebarHTML.trim();
  const sidebarEl = sidebarWrapper.firstElementChild;

  // Main wrapper com header
  const mainWrapper = document.createElement("div");
  mainWrapper.className = "main-wrapper";
  mainWrapper.innerHTML = headerHTML.trim();
  mainWrapper.appendChild(pageMain); // move o <main> para dentro do wrapper

  // Insere tudo no body
  document.body.prepend(overlay);
  document.body.prepend(sidebarEl);
  document.body.appendChild(mainWrapper);

  /* ── Item ativo no nav ── */
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  sidebarEl.querySelectorAll("a.nav-item[data-page]").forEach((a) => {
    a.classList.toggle("active", a.dataset.page === currentPage);
  });
})();
