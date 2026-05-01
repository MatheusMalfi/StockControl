"use strict";

document.addEventListener("sc:ready", function () {
  const STORAGE_KEY = "sc_parceiros";
  const AUDIT_KEY   = "sc_audit_log";
  const MOVS_KEY    = "sc_movements";
  const ITEMS_KEY   = "sc_items";
  const NOTIF_KEY   = "sc_notifications";

  // ── Mock data ──────────────────────────────────────────────────────────────
  const MOCK = [
    {
      id: "parc_001", tipo: "doador", nome: "ONG Educação Digital",
      cnpj: "12.345.678/0001-90", email: "contato@ongeducacao.org",
      telefone: "(11) 98765-4321", whatsapp: "(11) 98765-4321",
      responsavel: "João Silva", cargo: "Diretor", website: "www.ongeducacao.org",
      areaAtuacao: "Educação", enderecoTexto: "São Paulo, SP",
      endereco: { logradouro: "Av. Paulista", numero: "1000", bairro: "Bela Vista", cidade: "São Paulo", estado: "SP" },
      observacoes: "Parceiro desde 2023, excelente relacionamento",
      itensTotais: 15, primeiroContato: "2023-03-10", ultimoContato: "2024-01-15",
      criadoEm: "2023-03-10T10:00:00", ativo: true,
    },
    {
      id: "parc_002", tipo: "recebedor", nome: "Associação Viver Bem",
      cnpj: "98.765.432/0001-10", email: "associacao@vivembem.org.br",
      telefone: "(21) 3333-4444", whatsapp: "(21) 99888-7766",
      responsavel: "Maria Santos", cargo: "Presidente", website: "",
      areaAtuacao: "Assistência Social", enderecoTexto: "Rio de Janeiro, RJ",
      endereco: { logradouro: "Rua da Assembleia", numero: "200", bairro: "Centro", cidade: "Rio de Janeiro", estado: "RJ" },
      observacoes: "Recebe principalmente móveis e eletrodomésticos",
      itensTotais: 8, primeiroContato: "2023-06-15", ultimoContato: "2024-01-20",
      criadoEm: "2023-06-15T14:00:00", ativo: true,
    },
    {
      id: "parc_003", tipo: "ambos", nome: "Instituto Reciclar SP",
      cnpj: "11.222.333/0001-44", email: "contato@reciclarsp.org",
      telefone: "(11) 4444-5555", whatsapp: "",
      responsavel: "Pedro Lima", cargo: "Coordenador", website: "www.reciclarsp.org",
      areaAtuacao: "Meio Ambiente", enderecoTexto: "São Paulo, SP",
      endereco: { logradouro: "Av. Brigadeiro Faria Lima", numero: "3900", bairro: "Itaim Bibi", cidade: "São Paulo", estado: "SP" },
      observacoes: "Parceiro estratégico para descarte sustentável",
      itensTotais: 22, primeiroContato: "2023-01-05", ultimoContato: "2024-01-10",
      criadoEm: "2023-01-05T09:00:00", ativo: true,
    },
    {
      id: "parc_004", tipo: "empresa", nome: "TechStore Equipamentos",
      cnpj: "55.666.777/0001-88", email: "vendas@techstore.com.br",
      telefone: "(11) 2222-3333", whatsapp: "(11) 99111-2233",
      responsavel: "Ana Costa", cargo: "Gerente Comercial", website: "www.techstore.com.br",
      areaAtuacao: "Tecnologia", enderecoTexto: "São Paulo, SP",
      endereco: { logradouro: "Praça da Sé", numero: "50", bairro: "Sé", cidade: "São Paulo", estado: "SP" },
      observacoes: "Fornecedor de equipamentos de informática",
      itensTotais: 30, primeiroContato: "2022-11-20", ultimoContato: "2024-01-25",
      criadoEm: "2022-11-20T11:00:00", ativo: true,
    },
    {
      id: "parc_005", tipo: "orgao_publico", nome: "Secretaria Municipal de Educação",
      cnpj: "44.555.666/0001-77", email: "patrimonio@sme.prefeitura.sp.gov.br",
      telefone: "(11) 3333-9999", whatsapp: "",
      responsavel: "Carlos Ferreira", cargo: "Gestor de Patrimônio", website: "www.sme.prefeitura.sp.gov.br",
      areaAtuacao: "Educação Pública", enderecoTexto: "São Paulo, SP",
      endereco: { logradouro: "Praça da Sé", numero: "100", bairro: "Centro", cidade: "São Paulo", estado: "SP" },
      observacoes: "Parceria para doação de materiais escolares",
      itensTotais: 45, primeiroContato: "2022-08-01", ultimoContato: "2024-01-05",
      criadoEm: "2022-08-01T08:00:00", ativo: true,
    },
  ];

  // ── Labels & classes ───────────────────────────────────────────────────────
  const TIPO_LABEL = {
    doador:       "Doador",
    recebedor:    "Recebedor",
    ambos:        "Ambos",
    empresa:      "Empresa",
    orgao_publico:"Órgão Público",
  };
  const TIPO_CSS = {
    doador:       "partner-type-doador",
    recebedor:    "partner-type-recebedor",
    ambos:        "partner-type-ambos",
    empresa:      "partner-type-empresa",
    orgao_publico:"partner-type-publico",
  };

  // ── State ─────────────────────────────────────────────────────────────────
  const state = {
    page: 1, perPage: 12, total: 0,
    search: "", tipo: "", view: "grid",
    filtered: [], activeId: null,
  };

  let pendingDeleteId = null;

  // ── Storage helpers ───────────────────────────────────────────────────────
  function getPartners() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  }
  function savePartners(list) { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

  function getMovements() {
    try { return JSON.parse(localStorage.getItem(MOVS_KEY) || "[]"); } catch { return []; }
  }
  function getItems() {
    try { return JSON.parse(localStorage.getItem(ITEMS_KEY) || "[]"); } catch { return []; }
  }

  function addAuditLog(acao, tipo, entidadeId) {
    try {
      const logs = JSON.parse(localStorage.getItem(AUDIT_KEY) || "[]");
      logs.unshift({ id: "log_" + Date.now(), acao, tipo, entidadeId, criadoEm: new Date().toISOString() });
      if (logs.length > 500) logs.length = 500;
      localStorage.setItem(AUDIT_KEY, JSON.stringify(logs));
    } catch (_) {}
  }

  // ── Seed ──────────────────────────────────────────────────────────────────
  function seedIfNeeded() {
    if (!getPartners().length) savePartners(MOCK);
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  function updateKPIs() {
    const all = getPartners().filter(p => p.ativo !== false);
    const donors     = all.filter(p => p.tipo === "doador"    || p.tipo === "ambos").length;
    const receivers  = all.filter(p => p.tipo === "recebedor" || p.tipo === "ambos").length;
    const totalItems = all.reduce((s, p) => s + (p.itensTotais || 0), 0);
    setText("kpi-total",      all.length);
    setText("kpi-donors",     donors);
    setText("kpi-recipients", receivers);
    setText("kpi-donated",    totalItems);
  }

  // ── Filter & render ───────────────────────────────────────────────────────
  function loadAndRender() {
    let list = getPartners().filter(p => p.ativo !== false);

    if (state.search) {
      const q = state.search.toLowerCase();
      list = list.filter(p =>
        (p.nome        || "").toLowerCase().includes(q) ||
        (p.cnpj        || "").toLowerCase().includes(q) ||
        (p.email       || "").toLowerCase().includes(q) ||
        (p.responsavel || "").toLowerCase().includes(q) ||
        (p.areaAtuacao || "").toLowerCase().includes(q)
      );
    }
    if (state.tipo) list = list.filter(p => p.tipo === state.tipo);

    state.filtered = list;
    state.total    = list.length;

    const start   = (state.page - 1) * state.perPage;
    const pageData = list.slice(start, start + state.perPage);

    render(pageData);
    renderPagination();
    updateKPIs();
    updateNotifBadge();
  }

  function render(pageData) {
    const gridEl  = document.getElementById("partners-grid");
    const tableEl = document.getElementById("partners-table-wrap");
    const emptyEl = document.getElementById("empty-state");

    if (!state.filtered.length) {
      if (gridEl)  { gridEl.innerHTML = ""; gridEl.style.display = "none"; }
      if (tableEl) tableEl.style.display = "none";
      if (emptyEl) emptyEl.style.display = "flex";
      return;
    }
    if (emptyEl) emptyEl.style.display = "none";

    if (state.view === "grid") {
      if (tableEl) tableEl.style.display = "none";
      if (gridEl) {
        gridEl.style.display = "grid";
        gridEl.innerHTML = pageData.map(renderCard).join("");
        wireCardEvents(gridEl);
      }
    } else {
      if (gridEl) gridEl.style.display = "none";
      const tbody = document.getElementById("partners-tbody");
      if (tableEl) tableEl.style.display = "block";
      if (tbody) {
        tbody.innerHTML = pageData.map(renderRow).join("");
        wireRowEvents(tbody);
      }
    }
  }

  function renderCard(p) {
    const initial = SC.escHtml((p.nome || "?")[0].toUpperCase());
    const tipo    = SC.escHtml(TIPO_LABEL[p.tipo] || p.tipo || "");
    const tipoCss = TIPO_CSS[p.tipo] || "partner-type-doador";
    return `<div class="partner-card" data-id="${p.id}">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <div class="partner-avatar">${initial}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${SC.escHtml(p.nome || "")}</div>
          <span class="partner-type-badge ${tipoCss}">${tipo}</span>
        </div>
        <div style="display:flex;gap:2px;flex-shrink:0">
          <button class="btn btn-ghost btn-sm btn-edit-card" data-id="${p.id}" title="Editar" onclick="event.stopPropagation()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn btn-ghost btn-sm btn-delete-card" data-id="${p.id}" title="Excluir" onclick="event.stopPropagation()" style="color:var(--color-danger)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          </button>
        </div>
      </div>
      ${p.email    ? `<div style="font-size:12px;color:var(--color-text-muted);margin-bottom:2px">✉ ${SC.escHtml(p.email)}</div>` : ""}
      ${p.telefone ? `<div style="font-size:12px;color:var(--color-text-muted)">☎ ${SC.escHtml(p.telefone)}</div>` : ""}
      <div class="partner-stats">
        <div>
          <div class="partner-stat-label">Itens</div>
          <div class="partner-stat-value">${p.itensTotais || 0}</div>
        </div>
        <div>
          <div class="partner-stat-label">Último contato</div>
          <div class="partner-stat-value" style="font-size:12px">${p.ultimoContato ? SC.fmtDate(p.ultimoContato) : "—"}</div>
        </div>
      </div>
    </div>`;
  }

  function renderRow(p) {
    const initial = SC.escHtml((p.nome || "?")[0].toUpperCase());
    const tipo    = SC.escHtml(TIPO_LABEL[p.tipo] || p.tipo || "");
    const tipoCss = TIPO_CSS[p.tipo] || "partner-type-doador";
    const loc     = p.enderecoTexto || (p.endereco ? [p.endereco.cidade, p.endereco.estado].filter(Boolean).join(", ") : "");
    return `<tr data-id="${p.id}" style="cursor:pointer">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="partner-avatar" style="width:32px;height:32px;font-size:13px">${initial}</div>
          <div>
            <div style="font-weight:500;font-size:13px">${SC.escHtml(p.nome || "")}</div>
            ${loc ? `<div style="font-size:11px;color:var(--color-text-muted)">${SC.escHtml(loc)}</div>` : ""}
          </div>
        </div>
      </td>
      <td><span class="partner-type-badge ${tipoCss}">${tipo}</span></td>
      <td style="font-size:13px">${p.email ? SC.escHtml(p.email) : "—"}</td>
      <td style="font-size:13px;font-family:monospace">${p.cnpj ? SC.escHtml(p.cnpj) : "—"}</td>
      <td style="text-align:right;font-weight:600">${p.itensTotais || 0}</td>
      <td style="font-size:12px;color:var(--color-text-muted)">${p.ultimoContato ? SC.fmtDate(p.ultimoContato) : "—"}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm btn-edit-row" data-id="${p.id}" title="Editar" onclick="event.stopPropagation()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="btn btn-ghost btn-sm btn-delete-row" data-id="${p.id}" title="Excluir" onclick="event.stopPropagation()" style="color:var(--color-danger)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          </svg>
        </button>
      </td>
    </tr>`;
  }

  function wireCardEvents(container) {
    container.querySelectorAll(".partner-card").forEach(card => {
      card.addEventListener("click", () => openDrawer(card.dataset.id));
    });
    container.querySelectorAll(".btn-edit-card").forEach(btn => {
      btn.addEventListener("click", e => { e.stopPropagation(); openEditModal(btn.dataset.id); });
    });
    container.querySelectorAll(".btn-delete-card").forEach(btn => {
      btn.addEventListener("click", e => { e.stopPropagation(); openDeleteModal(btn.dataset.id); });
    });
  }

  function wireRowEvents(tbody) {
    tbody.querySelectorAll("tr[data-id]").forEach(tr => {
      tr.addEventListener("click", () => openDrawer(tr.dataset.id));
    });
    tbody.querySelectorAll(".btn-edit-row").forEach(btn => {
      btn.addEventListener("click", e => { e.stopPropagation(); openEditModal(btn.dataset.id); });
    });
    tbody.querySelectorAll(".btn-delete-row").forEach(btn => {
      btn.addEventListener("click", e => { e.stopPropagation(); openDeleteModal(btn.dataset.id); });
    });
  }

  // ── Pagination ────────────────────────────────────────────────────────────
  function renderPagination() {
    SC.renderPagination({
      containerId: "parcPagControls",
      infoId:      "parcPagInfo",
      page:        state.page,
      perPage:     state.perPage,
      total:       state.total,
      onPageChange: p => { state.page = p; loadAndRender(); },
    });
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  function wireFilters() {
    document.getElementById("search-input")?.addEventListener("input", SC.debounce(() => {
      state.search = document.getElementById("search-input")?.value.trim() || "";
      state.page = 1;
      loadAndRender();
    }, 300));

    document.getElementById("filter-type")?.addEventListener("change", e => {
      state.tipo = e.target.value;
      state.page = 1;
      loadAndRender();
    });

    document.getElementById("btn-view-grid")?.addEventListener("click", () => {
      state.view = "grid"; loadAndRender();
    });
    document.getElementById("btn-view-table")?.addEventListener("click", () => {
      state.view = "table"; loadAndRender();
    });
  }

  // ── Modal: save partner ───────────────────────────────────────────────────
  function wireModal() {
    document.getElementById("btn-new-partner")?.addEventListener("click",  openNewModal);
    document.getElementById("empty-add-btn")?.addEventListener("click",    openNewModal);
    document.getElementById("btn-save-partner")?.addEventListener("click", savePartner);
  }

  function openNewModal() {
    clearForm();
    setVal("partner-id", "");
    setText2("partner-modal-title", "Novo Parceiro");
    SC.openModal("modal-partner");
  }

  function openEditModal(id) {
    const p = getPartners().find(x => String(x.id) === String(id));
    if (!p) return;
    state.activeId = id;

    setVal("partner-id",          p.id);
    setVal("partner-name",        p.nome        || "");
    setVal("partner-type",        p.tipo        || "doador");
    setVal("partner-cnpj",        p.cnpj        || "");
    setVal("partner-email",       p.email       || "");
    setVal("partner-phone",       p.telefone    || "");
    setVal("partner-whatsapp",    p.whatsapp    || "");
    setVal("partner-responsavel", p.responsavel || "");
    setVal("partner-cargo",       p.cargo       || "");
    setVal("partner-website",     p.website     || "");
    setVal("partner-area",        p.areaAtuacao || "");
    setVal("partner-address",     p.enderecoTexto ||
      (p.endereco ? [p.endereco.cidade, p.endereco.estado].filter(Boolean).join(", ") : ""));
    setVal("partner-notes",       p.observacoes || "");

    setText2("partner-modal-title", "Editar Parceiro");
    SC.openModal("modal-partner");
  }

  function savePartner() {
    const nome = getVal("partner-name").trim();
    if (!nome) { SC.toastError("Nome é obrigatório."); return; }

    const id  = getVal("partner-id");
    const btn = document.getElementById("btn-save-partner");
    if (btn) { btn.disabled = true; btn.classList.add("loading"); }

    const now      = new Date().toISOString();
    const partners = getPartners();

    try {
      if (id) {
        const idx = partners.findIndex(p => String(p.id) === String(id));
        if (idx === -1) { SC.toastError("Parceiro não encontrado."); return; }
        partners[idx] = {
          ...partners[idx],
          nome,
          tipo:           getVal("partner-type")        || "doador",
          cnpj:           getVal("partner-cnpj").trim(),
          email:          getVal("partner-email").trim(),
          telefone:       getVal("partner-phone").trim(),
          whatsapp:       getVal("partner-whatsapp").trim(),
          responsavel:    getVal("partner-responsavel").trim(),
          cargo:          getVal("partner-cargo").trim(),
          website:        getVal("partner-website").trim(),
          areaAtuacao:    getVal("partner-area").trim(),
          enderecoTexto:  getVal("partner-address").trim(),
          observacoes:    getVal("partner-notes").trim(),
          atualizadoEm:   now,
        };
        savePartners(partners);
        addAuditLog(`Parceiro atualizado: ${nome}`, "parceiro", id);
        SC.toastSuccess("Parceiro atualizado!");
      } else {
        const newId = "parc_" + Date.now();
        partners.push({
          id: newId, nome,
          tipo:          getVal("partner-type")        || "doador",
          cnpj:          getVal("partner-cnpj").trim(),
          email:         getVal("partner-email").trim(),
          telefone:      getVal("partner-phone").trim(),
          whatsapp:      getVal("partner-whatsapp").trim(),
          responsavel:   getVal("partner-responsavel").trim(),
          cargo:         getVal("partner-cargo").trim(),
          website:       getVal("partner-website").trim(),
          areaAtuacao:   getVal("partner-area").trim(),
          enderecoTexto: getVal("partner-address").trim(),
          observacoes:   getVal("partner-notes").trim(),
          itensTotais:   0,
          primeiroContato: now.slice(0, 10),
          ultimoContato:   now.slice(0, 10),
          criadoEm:        now,
          ativo:           true,
        });
        savePartners(partners);
        addAuditLog(`Parceiro criado: ${nome}`, "parceiro", newId);
        SC.toastSuccess("Parceiro cadastrado!");
      }
      SC.closeModal("modal-partner");
      state.page = 1;
      loadAndRender();
    } finally {
      if (btn) { btn.disabled = false; btn.classList.remove("loading"); }
    }
  }

  function clearForm() {
    ["partner-name","partner-cnpj","partner-email","partner-phone","partner-whatsapp",
     "partner-responsavel","partner-cargo","partner-website","partner-area",
     "partner-address","partner-notes"].forEach(id => setVal(id, ""));
    setVal("partner-type", "doador");
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  function openDeleteModal(id) {
    const p = getPartners().find(x => String(x.id) === String(id));
    if (!p) return;
    pendingDeleteId = id;

    const nameEl = document.getElementById("deletePartnerNameDisplay");
    if (nameEl) nameEl.textContent = p.nome || "este parceiro";

    // Check for history in movements
    const movs     = getMovements();
    const histCount = movs.filter(m => m.parceiroId === id || m.parceiro === p.nome || m.parceiro === id).length;
    const warnEl   = document.getElementById("deleteImpactWarn");
    if (warnEl) {
      if (histCount > 0) {
        warnEl.textContent = `Atenção: este parceiro possui ${histCount} registro(s) no histórico de movimentações. Os dados históricos serão preservados.`;
        warnEl.classList.add("is-visible");
      } else {
        warnEl.textContent = "";
        warnEl.classList.remove("is-visible");
      }
    }

    SC.openModal("deletePartnerModal");
  }

  function confirmDelete() {
    if (!pendingDeleteId) return;

    const partners = getPartners();
    const p        = partners.find(x => String(x.id) === String(pendingDeleteId));
    if (!p) return;

    const updated = partners.filter(x => String(x.id) !== String(pendingDeleteId));
    savePartners(updated);
    addAuditLog(`Parceiro excluído: ${p.nome}`, "parceiro", pendingDeleteId);

    SC.closeModal("deletePartnerModal");
    SC.toastSuccess(`Parceiro "${p.nome}" removido.`);

    // Close drawer if the deleted partner was open
    if (state.activeId === pendingDeleteId) closeDrawer();
    pendingDeleteId = null;

    state.page = 1;
    loadAndRender();
  }

  // ── Drawer ────────────────────────────────────────────────────────────────
  function wireDrawer() {
    document.getElementById("drawer-close")?.addEventListener("click",       closeDrawer);
    document.getElementById("drawer-overlay")?.addEventListener("click",     closeDrawer);
    document.getElementById("btn-edit-partner")?.addEventListener("click",   () => { closeDrawer(); openEditModal(state.activeId); });
    document.getElementById("btn-delete-partner")?.addEventListener("click", () => { closeDrawer(); openDeleteModal(state.activeId); });
  }

  function openDrawer(id) {
    state.activeId = id;
    document.getElementById("partner-drawer")?.classList.add("is-open");
    document.getElementById("drawer-overlay")?.classList.add("is-visible");

    const p = getPartners().find(x => String(x.id) === String(id));
    const body = document.getElementById("drawer-body");
    if (!p || !body) return;

    const movs = getMovements()
      .filter(m => m.parceiroId === id || m.parceiro === p.nome || m.parceiro === id)
      .slice(0, 10);

    body.innerHTML = buildDrawerContent(p, movs);
  }

  function buildDrawerContent(p, history) {
    const tipo    = SC.escHtml(TIPO_LABEL[p.tipo] || p.tipo || "");
    const tipoCss = TIPO_CSS[p.tipo] || "partner-type-doador";
    const initial = SC.escHtml((p.nome || "?")[0].toUpperCase());
    const addr    = p.enderecoTexto ||
      (p.endereco ? [p.endereco.logradouro, p.endereco.numero, p.endereco.bairro, p.endereco.cidade, p.endereco.estado].filter(Boolean).join(", ") : "");

    const websiteHtml = p.website
      ? `<a href="${p.website.startsWith("http") ? "" : "https://"}${SC.escHtml(p.website)}" target="_blank" rel="noopener" style="color:var(--color-primary)">${SC.escHtml(p.website)}</a>`
      : "";

    return `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <div class="partner-avatar" style="width:56px;height:56px;font-size:22px;border-radius:12px">${initial}</div>
        <div>
          <div style="font-size:17px;font-weight:700;margin-bottom:4px">${SC.escHtml(p.nome || "")}</div>
          <span class="partner-type-badge ${tipoCss}">${tipo}</span>
        </div>
      </div>
      <dl style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;font-size:13px;margin-bottom:20px">
        ${p.cnpj        ? `<div><dt style="color:var(--color-text-muted);margin-bottom:2px">CNPJ</dt><dd style="font-family:monospace">${SC.escHtml(p.cnpj)}</dd></div>` : ""}
        ${p.email       ? `<div><dt style="color:var(--color-text-muted);margin-bottom:2px">E-mail</dt><dd>${SC.escHtml(p.email)}</dd></div>` : ""}
        ${p.telefone    ? `<div><dt style="color:var(--color-text-muted);margin-bottom:2px">Telefone</dt><dd>${SC.escHtml(p.telefone)}</dd></div>` : ""}
        ${p.whatsapp    ? `<div><dt style="color:var(--color-text-muted);margin-bottom:2px">WhatsApp</dt><dd>${SC.escHtml(p.whatsapp)}</dd></div>` : ""}
        ${p.responsavel ? `<div><dt style="color:var(--color-text-muted);margin-bottom:2px">Responsável</dt><dd>${SC.escHtml(p.responsavel)}${p.cargo ? ` — ${SC.escHtml(p.cargo)}` : ""}</dd></div>` : ""}
        ${p.website     ? `<div><dt style="color:var(--color-text-muted);margin-bottom:2px">Website</dt><dd>${websiteHtml}</dd></div>` : ""}
        ${p.areaAtuacao ? `<div><dt style="color:var(--color-text-muted);margin-bottom:2px">Área</dt><dd>${SC.escHtml(p.areaAtuacao)}</dd></div>` : ""}
        <div><dt style="color:var(--color-text-muted);margin-bottom:2px">Total de itens</dt><dd style="font-weight:700;font-size:15px">${p.itensTotais || 0}</dd></div>
        ${p.primeiroContato ? `<div><dt style="color:var(--color-text-muted);margin-bottom:2px">Primeiro contato</dt><dd>${SC.fmtDate(p.primeiroContato)}</dd></div>` : ""}
        ${p.ultimoContato   ? `<div><dt style="color:var(--color-text-muted);margin-bottom:2px">Último contato</dt><dd>${SC.fmtDate(p.ultimoContato)}</dd></div>` : ""}
        ${addr ? `<div style="grid-column:1/-1"><dt style="color:var(--color-text-muted);margin-bottom:2px">Endereço</dt><dd>${SC.escHtml(addr)}</dd></div>` : ""}
        ${p.observacoes ? `<div style="grid-column:1/-1"><dt style="color:var(--color-text-muted);margin-bottom:2px">Observações</dt><dd style="font-style:italic;color:var(--color-text-secondary)">${SC.escHtml(p.observacoes)}</dd></div>` : ""}
      </dl>
      ${history.length ? `
        <div style="border-top:1px solid var(--color-border);padding-top:16px">
          <div style="font-weight:600;font-size:13px;margin-bottom:10px">Histórico de Movimentações</div>
          <ul class="history-list">
            ${history.map(h => `
              <li class="history-item">
                <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:var(--color-surface-alt);color:var(--color-text-secondary);flex-shrink:0">${SC.escHtml(h.tipo || h.type || "—")}</span>
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${SC.escHtml(h.item || h.itemNome || h.nome || "—")}</span>
                <span style="color:var(--color-text-muted);flex-shrink:0">${h.quantidade ?? h.quantity ?? "?"} un.</span>
                <span style="color:var(--color-text-muted);flex-shrink:0">${SC.fmtDate(h.data || h.criadaEm || h.created_at || "")}</span>
              </li>`).join("")}
          </ul>
        </div>` : ""}`;
  }

  function closeDrawer() {
    document.getElementById("partner-drawer")?.classList.remove("is-open");
    document.getElementById("drawer-overlay")?.classList.remove("is-visible");
  }

  // ── Global search dropdown ────────────────────────────────────────────────
  function wireGlobalSearch() {
    const input    = document.getElementById("globalSearch");
    const dropdown = document.getElementById("searchDropdown");
    if (!input || !dropdown) return;

    input.addEventListener("input", SC.debounce(() => {
      const q = input.value.trim();
      if (!q) { dropdown.style.display = "none"; return; }
      showSearchResults(q, dropdown);
    }, 250));

    document.addEventListener("click", e => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = "none";
      }
    });

    input.addEventListener("keydown", e => {
      if (e.key === "Escape") { dropdown.style.display = "none"; input.value = ""; }
    });
  }

  function showSearchResults(q, dropdown) {
    const ql = q.toLowerCase();

    const partnerResults = getPartners().filter(p =>
      (p.nome  || "").toLowerCase().includes(ql) ||
      (p.cnpj  || "").toLowerCase().includes(ql) ||
      (p.email || "").toLowerCase().includes(ql)
    ).slice(0, 4);

    const itemResults = getItems().filter(i =>
      (i.nome       || "").toLowerCase().includes(ql) ||
      (i.patrimonio || "").toLowerCase().includes(ql)
    ).slice(0, 3);

    if (!partnerResults.length && !itemResults.length) {
      dropdown.innerHTML = `<div style="padding:var(--space-3) var(--space-4);color:var(--color-text-muted);font-size:13px;">Sem resultados para "<strong>${SC.escHtml(q)}</strong>"</div>`;
      dropdown.style.display = "block";
      return;
    }

    let html = "";
    if (partnerResults.length) {
      html += `<div class="search-result-group">Parceiros (${partnerResults.length})</div>`;
      html += partnerResults.map(p => {
        const tipoCss = TIPO_CSS[p.tipo] || "partner-type-doador";
        return `<div class="search-result-item" data-partner-id="${p.id}">
          <span class="partner-type-badge ${tipoCss}" style="flex-shrink:0">${SC.escHtml(TIPO_LABEL[p.tipo] || p.tipo)}</span>
          <span style="flex:1">${SC.escHtml(p.nome || "")}</span>
          ${p.cnpj ? `<span style="color:var(--color-text-muted);font-family:monospace;font-size:11px">${SC.escHtml(p.cnpj)}</span>` : ""}
        </div>`;
      }).join("");
    }
    if (itemResults.length) {
      html += `<div class="search-result-group">Itens (${itemResults.length})</div>`;
      html += itemResults.map(i =>
        `<a href="estoque.html" class="search-result-item">
          <span style="flex:1">${SC.escHtml(i.nome || "")}</span>
          <span style="color:var(--color-text-muted);font-size:11px">${SC.escHtml(i.patrimonio || "")}</span>
        </a>`
      ).join("");
    }

    dropdown.innerHTML = html;
    dropdown.style.display = "block";

    dropdown.querySelectorAll("[data-partner-id]").forEach(el => {
      el.addEventListener("click", () => {
        dropdown.style.display = "none";
        document.getElementById("globalSearch").value = "";
        openDrawer(el.dataset.partnerId);
      });
    });
  }

  // ── Notification badge ────────────────────────────────────────────────────
  function updateNotifBadge() {
    try {
      const notifs = JSON.parse(localStorage.getItem(NOTIF_KEY) || "[]");
      const unread = notifs.filter(n => !n.lida && !n.arquivada).length;
      const badge  = document.getElementById("notifBadge");
      if (badge) {
        badge.textContent   = unread > 99 ? "99+" : String(unread);
        badge.style.display = unread > 0  ? "" : "none";
      }

      const listDrop = document.getElementById("notifListDrop");
      if (listDrop && unread > 0) {
        const top5 = notifs.filter(n => !n.lida && !n.arquivada).slice(0, 5);
        listDrop.innerHTML = top5.map(n => `
          <div class="dropdown-item" style="white-space:normal;cursor:default;padding:var(--space-3);">
            <div style="font-size:0.875rem;font-weight:500;color:var(--color-text-primary);margin-bottom:2px;">${SC.escHtml(n.titulo || "Notificação")}</div>
            <div style="font-size:0.8125rem;color:var(--color-text-muted);">${SC.fmtRelTime(n.criadaEm)}</div>
          </div>`).join("");
      }
    } catch (_) {}
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getVal(id)     { return document.getElementById(id)?.value || ""; }
  function setVal(id, v)  { const el = document.getElementById(id); if (el) el.value = v; }
  function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
  function setText2(id,v) { setText(id, v); }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    seedIfNeeded();
    wireFilters();
    wireModal();
    wireDrawer();
    wireGlobalSearch();
    document.getElementById("btnConfirmDelete")?.addEventListener("click", confirmDelete);
    loadAndRender();
  }

  init();
});
