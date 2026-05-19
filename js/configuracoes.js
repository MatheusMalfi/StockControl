"use strict";

// ── Constantes ────────────────────────────────────────────────────────────────
const TIPO_LOCAL_LABEL = { deposito: 'Depósito', sala: 'Sala', armario: 'Armário', externo: 'Externo', outro: 'Outro' };
const ROLE_LABEL       = { admin: 'Admin', operator: 'Operador', viewer: 'Visualizador' };

const MOCK = {
  usuario:      { id: '', nome: '', email: '', cargo: '', avatar: null },
  usuarios:     [],
  organizacao:  { nome: '', email: '', telefone: '', endereco: '', cnpj: '', logo: null, meta: null },
  regrasNotif:  { estoqueBaixo: true, descarte: true, doacaoPendente: true, email: false, minimo: 5 },
  preferencias: { tema: 'claro', idioma: 'pt-BR', paginacao: 20, formatoData: 'DD/MM/AAAA' },
  categorias:   { categorias: [], marcas: [] },
  localizacoes: [],
  logAcessos:   [],
};


// ── Seed / migração ───────────────────────────────────────────────────────────
function carregarDados() {
  const { organization_id: _oid } = _getOrgData();
  _cfgApi("GET", `/api/configuracoes${_oid ? "?organization_id=" + _oid : ""}`)
    .then(data => {
      if (data.usuario) localStorage.setItem('sc_usuario', JSON.stringify(data.usuario));

      if (data.usuarios) {
        localStorage.setItem('sc_usuarios', JSON.stringify(data.usuarios));
        carregarUsuarios();
      }

      if (data.organizacao) {
        // Preserve locally-stored logo and meta — API doesn't return them
        const prev = carregarDoLocalStorage('sc_organizacao', {});
        localStorage.setItem('sc_organizacao', JSON.stringify({
          ...data.organizacao,
          logo: prev.logo || null,
          meta: prev.meta || null,
        }));
        carregarOrganizacao();
      }

      if (data.preferencias) {
        localStorage.setItem('sc_preferencias', JSON.stringify(data.preferencias));
        const p = data.preferencias;
        const setS = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
        setS('prefTema',        p.tema        || 'claro');
        setS('prefIdioma',      p.idioma      || 'pt-BR');
        setS('prefPaginacao',   p.paginacao   || 20);
        setS('prefFormatoData', p.formatoData || 'DD/MM/AAAA');
        aplicarTema(p.tema || 'claro');
      }

      if (data.categorias) localStorage.setItem('sc_categorias', JSON.stringify(data.categorias));
    })
    .catch(() => {});

  const seed = (key, val) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(val)); };
  seed('sc_usuario',      MOCK.usuario);
  seed('sc_usuarios',     MOCK.usuarios);
  seed('sc_organizacao',  MOCK.organizacao);
  seed('sc_notif_rules',  MOCK.regrasNotif);
  seed('sc_preferencias', MOCK.preferencias);
  seed('log_acessos',     MOCK.logAcessos);

  // Migrate categories: string[] → object[]
  const catRaw = localStorage.getItem('sc_categorias');
  if (!catRaw) {
    salvarNoLocalStorage('sc_categorias', MOCK.categorias);
  } else {
    try {
      const parsed = JSON.parse(catRaw);
      // Old format: { categorias: ['str', ...], marcas: ['str', ...] }
      if (parsed.categorias && typeof parsed.categorias[0] === 'string') {
        parsed.categorias = parsed.categorias.map((nome, i) => ({ id: gerarId(), nome, cor: '#3b82f6', ordem: i }));
        parsed.marcas = (parsed.marcas || []).map(nome => typeof nome === 'string' ? { id: gerarId(), nome } : nome);
        salvarNoLocalStorage('sc_categorias', parsed);
      }
    } catch { salvarNoLocalStorage('sc_categorias', MOCK.categorias); }
  }

  // Migrate locations: string[] → object[]
  const locRaw = localStorage.getItem('sc_localizacoes');
  if (!locRaw) {
    salvarNoLocalStorage('sc_localizacoes', MOCK.localizacoes);
  } else {
    try {
      const parsed = JSON.parse(locRaw);
      if (Array.isArray(parsed) && parsed.length && typeof parsed[0] === 'string') {
        const migrated = parsed.map((nome, i) => ({ id: gerarId(), nome, tipo: 'outro', descricao: '', capacidade: null, ordem: i }));
        salvarNoLocalStorage('sc_localizacoes', migrated);
      }
    } catch { salvarNoLocalStorage('sc_localizacoes', MOCK.localizacoes); }
  }
}

// ── Utilitários ───────────────────────────────────────────────────────────────
function gerarId() {
  return 'id' + Date.now() + Math.random().toString(36).slice(2, 7);
}

function gerarIniciais(nome) {
  if (!nome) return '?';
  return (nome || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function gerarCorAvatar(nome) {
  const cores = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#14b8a6'];
  let hash = 0;
  for (let i = 0; i < (nome || '').length; i++) hash = (hash * 31 + nome.charCodeAt(i)) & 0xffffffff;
  return cores[Math.abs(hash) % cores.length];
}

function formatarCNPJ(v) {
  return v.replace(/\D/g, '').slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function formatarTelefone(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarCNPJ(cnpj) {
  const n = cnpj.replace(/\D/g, '');
  if (n.length !== 14 || /^(\d)\1+$/.test(n)) return false;
  const calc = (arr, peso) => arr.reduce((s, d, i) => s + d * peso[i], 0);
  const d = n.split('').map(Number);
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const mod = x => (x % 11 < 2 ? 0 : 11 - (x % 11));
  return d[12] === mod(calc(d.slice(0, 12), p1)) && d[13] === mod(calc(d.slice(0, 13), p2));
}

function validarSenha(senha) {
  return {
    len:     senha.length >= 8,
    upper:   /[A-Z]/.test(senha),
    number:  /[0-9]/.test(senha),
    special: /[^A-Za-z0-9]/.test(senha),
  };
}

function verificarEmailUnico(email, excluirId) {
  const lista = carregarDoLocalStorage('sc_usuarios', []);
  return !lista.some(u => u.email === email && u.id !== excluirId);
}

function gerarSenhaAleatoria() {
  const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower   = 'abcdefghijklmnopqrstuvwxyz';
  const nums    = '0123456789';
  const special = '!@#$%&*';
  const all     = upper + lower + nums + special;
  let pw = upper[Math.floor(Math.random() * upper.length)]
         + lower[Math.floor(Math.random() * lower.length)]
         + nums[Math.floor(Math.random() * nums.length)]
         + special[Math.floor(Math.random() * special.length)];
  for (let i = 4; i < 12; i++) pw += all[Math.floor(Math.random() * all.length)];
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

function calcularForcaSenha(senha) {
  if (!senha) return { nivel: '', pct: 0, cor: '' };
  const v = validarSenha(senha);
  const score = Object.values(v).filter(Boolean).length;
  if (score <= 1) return { nivel: 'Fraca', pct: 25,  cor: '#ef4444' };
  if (score <= 2) return { nivel: 'Média', pct: 50,  cor: '#f59e0b' };
  if (score <= 3) return { nivel: 'Boa',   pct: 75,  cor: '#3b82f6' };
  return             { nivel: 'Forte', pct: 100, cor: '#22c55e' };
}

function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

function esc(s) {
  return typeof SC !== 'undefined' ? SC.escHtml(s) : String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function salvarNoLocalStorage(chave, dados) {
  localStorage.setItem(chave, JSON.stringify(dados));
}

function carregarDoLocalStorage(chave, padrao) {
  try { const v = localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; }
  catch { return padrao; }
}

// ── API helpers ───────────────────────────────────────────────────────────────
function _cfgToken() {
  return localStorage.getItem("sc_token") || sessionStorage.getItem("sc_token");
}

function _getOrgData() {
  try {
    return JSON.parse(
      localStorage.getItem("sc_user") || sessionStorage.getItem("sc_user") || "{}"
    ) || {};
  } catch { return {}; }
}
function _cfgApi(method, url, body) {
  const token = _cfgToken();
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body != null ? { body: JSON.stringify(body) } : {}),
  }).then(r => r.ok ? r.json() : Promise.reject(r.status));
}

function _syncCatMarcasToApi(data) {
  const { organization_id } = _getOrgData();
  if (!organization_id) return;
  _cfgApi('PUT', '/api/configuracoes/categorias', {
    organization_id,
    categorias: data.categorias || [],
    marcas:     data.marcas     || [],
  }).catch(() => {});
}

function contarItensPorCategoria(catNome) {
  const itens = carregarDoLocalStorage('estoque_itens', []);
  return itens.filter(i => i.categoria === catNome).length;
}

function contarItensPorLocalizacao(locNome) {
  const itens = carregarDoLocalStorage('estoque_itens', []);
  return itens.filter(i => i.localizacao === locNome).length;
}

function registrarLog(acao, modulo, item, detalhes) {
  const u = carregarDoLocalStorage('sc_usuario', {});
  const log = carregarDoLocalStorage('sc_audit_log', []);
  log.unshift({ acao, modulo, item, detalhes, usuario: u.nome || '?', ts: new Date().toISOString() });
  salvarNoLocalStorage('sc_audit_log', log.slice(0, 200));
}

// ── UI Helpers ────────────────────────────────────────────────────────────────
function showToast(msg, tipo = 'info') {
  if (typeof SC !== 'undefined' && SC.toast) {
    SC.toast(msg, tipo);
  } else {
    const cont = document.getElementById('toastContainer');
    if (!cont) return;
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    t.textContent = msg;
    cont.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast-visible'));
    setTimeout(() => { t.classList.add('hiding'); setTimeout(() => t.remove(), 350); }, 3200);
  }
}

let _confirmarCallback = null;
function confirmarAcao(titulo, msg, callback) {
  const tEl = document.getElementById('modalConfirmarTitulo');
  const mEl = document.getElementById('modalConfirmarMensagem');
  if (tEl) tEl.textContent = titulo;
  if (mEl) mEl.textContent = msg;
  _confirmarCallback = callback;
  abrirModal('modalConfirmar');
}

function abrirModal(id) {
  if (typeof SC !== 'undefined' && SC.openModal) SC.openModal(id);
  else { const el = document.getElementById(id); if (el) el.classList.add('is-open'); }
}

function fecharModal(id) {
  if (typeof SC !== 'undefined' && SC.closeModal) SC.closeModal(id);
  else { const el = document.getElementById(id); if (el) el.classList.remove('is-open'); }
}

function fecharModalClicandoFora(e) { /* handled globally by main.js */ }

// ── Nav + Init ────────────────────────────────────────────────────────────────
function initConfiguracoes() {
  const navItems = document.querySelectorAll('.settings-nav-item[data-panel]');
  const panels   = document.querySelectorAll('.settings-panel');

  function activar(id, reload) {
    panels.forEach(p => p.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));
    const p = document.getElementById('panel-' + id);
    if (p) p.classList.add('active');
    const n = document.querySelector(`.settings-nav-item[data-panel="${id}"]`);
    if (n) n.classList.add('active');
    history.replaceState(null, '', '#' + id);
    if (reload) navegarSecao(id);
  }

  navItems.forEach(item => item.addEventListener('click', () => activar(item.dataset.panel, true)));

  const hash = location.hash.slice(1);
  activar(hash || 'perfil', false);

  // Wire generic confirm btn
  document.getElementById('btnConfirmarSim')?.addEventListener('click', () => {
    fecharModal('modalConfirmar');
    if (_confirmarCallback) { _confirmarCallback(); _confirmarCallback = null; }
  });

  // Wire modal senha strength
  document.getElementById('modalUsuarioSenha')?.addEventListener('input', function () {
    const { nivel, pct, cor } = calcularForcaSenha(this.value);
    const bar  = document.getElementById('senhaModalBarra');
    const hint = document.getElementById('senhaModalHint');
    if (bar)  { bar.style.width = pct + '%'; bar.style.background = cor; }
    if (hint) { hint.textContent = nivel; hint.style.color = cor; }
  });

  // Load initial panel data
  const init = hash || 'perfil';
  carregarPerfil();
  carregarOrganizacao();
  carregarUsuarios();
  carregarCategorias();
  carregarMarcas();
  carregarLocalizacoes();
  carregarPreferenciasNotificacao();
  carregarLogAcessos();

  // Apply saved theme
  const prefs = carregarDoLocalStorage('sc_preferencias', MOCK.preferencias);
  aplicarTema(prefs.tema || 'claro');
}

function navegarSecao(secao) {
  switch (secao) {
    case 'perfil':        carregarPerfil();                 break;
    case 'organizacao':   carregarOrganizacao();            break;
    case 'usuarios':      carregarUsuarios();               break;
    case 'categorias':    carregarCategorias(); carregarMarcas(); break;
    case 'locais':        carregarLocalizacoes();           break;
    case 'notificacoes':  carregarPreferenciasNotificacao(); break;
    case 'seguranca':     carregarLogAcessos();             break;
  }
}

// ── Perfil ────────────────────────────────────────────────────────────────────
let _perfilSnapshot = {};

function carregarPerfil() {
  // Real session (set by login) lives in sc_user with field "name"; sc_usuario is local profile data
  const session = _getOrgData();
  const u       = carregarDoLocalStorage('sc_usuario', {});
  const nome    = session.name  || u.nome  || '';
  const email   = session.email || u.email || '';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  set('profileName',  nome);
  set('profileEmail', email);
  set('profileRole',  u.cargo || '');

  const initialsEl = document.getElementById('profileAvatarInitials');
  const imgEl      = document.getElementById('profileAvatarImg');
  if (initialsEl) initialsEl.textContent = gerarIniciais(nome);
  if (u.avatar && imgEl) { imgEl.src = u.avatar; imgEl.classList.add('is-visible'); if (initialsEl) initialsEl.style.display = 'none'; }

  _perfilSnapshot = { nome, email };
  detectarMudancasPerfil();

  // Load display prefs
  const prefs = carregarDoLocalStorage('sc_preferencias', MOCK.preferencias);
  const setS = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  setS('prefTema', prefs.tema || 'claro');
  setS('prefIdioma', prefs.idioma || 'pt-BR');
  setS('prefPaginacao', prefs.paginacao || 20);
  setS('prefFormatoData', prefs.formatoData || 'DD/MM/AAAA');
}

function salvarPerfil() {
  const nomeEl  = document.getElementById('profileName');
  const emailEl = document.getElementById('profileEmail');
  const nome    = nomeEl?.value.trim();
  const email   = emailEl?.value.trim();
  if (!nome)            { showToast('Nome é obrigatório.', 'error'); return; }
  if (!validarEmail(email || '')) { showToast('E-mail inválido.', 'error'); return; }

  const u = carregarDoLocalStorage('sc_usuario', {});
  u.nome  = nome;
  u.email = email;
  salvarNoLocalStorage('sc_usuario', u);

  // Keep sc_user (real session) in sync so the header name updates immediately
  ['localStorage', 'sessionStorage'].forEach(store => {
    try {
      const raw = window[store].getItem('sc_user');
      if (raw) { const s = JSON.parse(raw); s.name = nome; window[store].setItem('sc_user', JSON.stringify(s)); }
    } catch {}
  });

  const { id: _uid, organization_id: _poid } = _getOrgData();
  _cfgApi("PUT", "/api/configuracoes/perfil", { nome, email, user_id: _uid, organization_id: _poid }).catch(() => {});
  registrarLog('Perfil atualizado', 'perfil', nome, '');
  atualizarAvatarHeader();
  _perfilSnapshot = { nome, email };
  detectarMudancasPerfil();
  showToast('Perfil atualizado!', 'success');
}

function uploadFotoPerfil(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Selecione uma imagem.', 'error'); return; }
  if (file.size > 2 * 1024 * 1024)    { showToast('Imagem deve ter menos de 2 MB.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const imgEl      = document.getElementById('profileAvatarImg');
    const initialsEl = document.getElementById('profileAvatarInitials');
    if (imgEl) { imgEl.src = e.target.result; imgEl.classList.add('is-visible'); }
    if (initialsEl) initialsEl.style.display = 'none';
    const u = carregarDoLocalStorage('sc_usuario', {});
    u.avatar = e.target.result;
    salvarNoLocalStorage('sc_usuario', u);
    atualizarAvatarHeader();
    showToast('Foto atualizada!', 'success');
  };
  reader.readAsDataURL(file);
}

function removerFotoPerfil() {
  confirmarAcao('Remover foto', 'Deseja remover a foto de perfil?', () => {
    const imgEl      = document.getElementById('profileAvatarImg');
    const initialsEl = document.getElementById('profileAvatarInitials');
    const inp        = document.getElementById('avatarInput');
    if (imgEl)      { imgEl.src = ''; imgEl.classList.remove('is-visible'); }
    if (initialsEl) initialsEl.style.display = '';
    if (inp)        inp.value = '';
    const u = carregarDoLocalStorage('sc_usuario', {});
    u.avatar = null;
    salvarNoLocalStorage('sc_usuario', u);
    atualizarAvatarHeader();
    showToast('Foto removida.', 'info');
  });
}

function atualizarAvatarHeader() {
  const u = carregarDoLocalStorage('sc_usuario', {});
  const iniciais = gerarIniciais(u.nome);
  const siEl = document.getElementById('sidebarInitials');
  const haEl = document.getElementById('headerAvatar');
  if (siEl) siEl.textContent = iniciais;
  if (haEl) haEl.textContent = iniciais;
}

function detectarMudancasPerfil() {
  const nomeEl  = document.getElementById('profileName');
  const emailEl = document.getElementById('profileEmail');
  const btn     = document.getElementById('saveProfileBtn');
  if (!btn) return;
  const mudou = (nomeEl?.value.trim() !== _perfilSnapshot.nome) ||
                (emailEl?.value.trim() !== _perfilSnapshot.email);
  btn.disabled = !mudou;
  if (nomeEl && !nomeEl._profileWired) {
    nomeEl._profileWired = true;
    nomeEl.addEventListener('input', detectarMudancasPerfil);
    emailEl?.addEventListener('input', detectarMudancasPerfil);
  }
}

function salvarPreferenciasExibicao() {
  const prefs = {
    tema:        document.getElementById('prefTema')?.value        || 'claro',
    idioma:      document.getElementById('prefIdioma')?.value      || 'pt-BR',
    paginacao:   parseInt(document.getElementById('prefPaginacao')?.value) || 20,
    formatoData: document.getElementById('prefFormatoData')?.value || 'DD/MM/AAAA',
  };
  salvarNoLocalStorage('sc_preferencias', prefs);
  const { organization_id: _preoid } = _getOrgData();
  _cfgApi("PUT", "/api/configuracoes/preferencias", { ...prefs, organization_id: _preoid }).catch(() => {});
  aplicarTema(prefs.tema);
  showToast('Preferências salvas!', 'success');
}

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

// ── Organização ───────────────────────────────────────────────────────────────
function carregarOrganizacao() {
  const org = carregarDoLocalStorage('sc_organizacao', MOCK.organizacao);
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  set('orgName',    org.nome);
  set('orgEmail',   org.email);
  set('orgPhone',   org.telefone);
  set('orgAddress', org.endereco);
  set('orgCNPJ',    org.cnpj ? formatarCNPJ(org.cnpj) : '');
  set('goalTarget', org.meta?.quantidade);
  set('goalStart',  org.meta?.inicio);
  set('goalEnd',    org.meta?.fim);

  const imgEl    = document.getElementById('orgLogoImg');
  const placehEl = document.getElementById('logoPlaceholder');
  const remBtn   = document.getElementById('btnRemoverLogo');
  if (org.logo && imgEl) {
    imgEl.src = org.logo;
    imgEl.classList.add('is-visible');
    if (placehEl) placehEl.style.display = 'none';
    if (remBtn)   remBtn.style.display = '';
  }

  // CNPJ mask input
  document.getElementById('orgCNPJ')?.addEventListener('input', function () {
    this.value = formatarCNPJ(this.value);
  });

  // Phone mask
  document.getElementById('orgPhone')?.addEventListener('input', function () {
    this.value = formatarTelefone(this.value);
  });
}

function salvarOrganizacao() {
  const cnpjEl = document.getElementById('orgCNPJ');
  const cnpjRaw = (cnpjEl?.value || '').replace(/\D/g, '');
  if (cnpjRaw && !validarCNPJ(cnpjRaw)) {
    const errEl = document.getElementById('errorOrgCNPJ');
    if (errEl) errEl.style.display = 'block';
    showToast('CNPJ inválido.', 'error');
    return;
  }
  const errEl = document.getElementById('errorOrgCNPJ');
  if (errEl) errEl.style.display = 'none';

  const org = carregarDoLocalStorage('sc_organizacao', {});
  org.nome      = document.getElementById('orgName')?.value.trim();
  org.email     = document.getElementById('orgEmail')?.value.trim();
  org.telefone  = document.getElementById('orgPhone')?.value.trim();
  org.endereco  = document.getElementById('orgAddress')?.value.trim();
  org.cnpj      = cnpjRaw;
  salvarNoLocalStorage('sc_organizacao', org);
  const { organization_id: _ooid } = _getOrgData();
  _cfgApi("PUT", "/api/configuracoes/organizacao", { ...org, organization_id: _ooid }).catch(() => {});
  registrarLog('Organização atualizada', 'organizacao', org.nome, '');
  showToast('Dados da organização salvos!', 'success');
}

function uploadLogoOrganizacao(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Selecione uma imagem.', 'error'); return; }
  if (file.size > 1024 * 1024)         { showToast('Logo deve ter menos de 1 MB.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const imgEl    = document.getElementById('orgLogoImg');
    const placehEl = document.getElementById('logoPlaceholder');
    const remBtn   = document.getElementById('btnRemoverLogo');
    if (imgEl)    { imgEl.src = e.target.result; imgEl.classList.add('is-visible'); }
    if (placehEl) placehEl.style.display = 'none';
    if (remBtn)   remBtn.style.display = '';
    const org = carregarDoLocalStorage('sc_organizacao', {});
    org.logo = e.target.result;
    salvarNoLocalStorage('sc_organizacao', org);
    showToast('Logo atualizado!', 'success');
  };
  reader.readAsDataURL(file);
}

function removerLogoOrganizacao() {
  confirmarAcao('Remover logo', 'Deseja remover o logo da organização?', () => {
    const imgEl    = document.getElementById('orgLogoImg');
    const placehEl = document.getElementById('logoPlaceholder');
    const remBtn   = document.getElementById('btnRemoverLogo');
    if (imgEl)    { imgEl.src = ''; imgEl.classList.remove('is-visible'); }
    if (placehEl) placehEl.style.display = '';
    if (remBtn)   remBtn.style.display = 'none';
    const org = carregarDoLocalStorage('sc_organizacao', {});
    org.logo = null;
    salvarNoLocalStorage('sc_organizacao', org);
    showToast('Logo removido.', 'info');
  });
}

// ── Usuários ──────────────────────────────────────────────────────────────────
function carregarUsuarios() {
  // Render cached immediately so the "Carregando…" placeholder is always replaced
  renderTabelaUsuarios(carregarDoLocalStorage('sc_usuarios', []));

  const { organization_id } = _getOrgData();
  if (!organization_id) return;
  _cfgApi("GET", `/api/usuarios?organization_id=${organization_id}`)
    .then(data => {
      if (Array.isArray(data.usuarios)) {
        salvarNoLocalStorage('sc_usuarios', data.usuarios);
        renderTabelaUsuarios(data.usuarios);
      }
    })
    .catch(() => {});
}

function renderTabelaUsuarios(lista) {
  const tbody = document.getElementById('usersBody');
  if (!tbody) return;
  if (!lista || !lista.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:var(--space-6);color:var(--color-text-muted);">Nenhum usuário cadastrado.</td></tr>`;
    return;
  }
  tbody.innerHTML = lista.map(u => {
    const iniciais = gerarIniciais(u.nome);
    const cor      = gerarCorAvatar(u.nome);
    return `
    <tr data-id="${esc(u.id)}">
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:32px;height:32px;border-radius:50%;background:${esc(cor)};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0;">
            ${esc(iniciais)}
          </div>
          <div>
            <div style="font-weight:500;font-size:13px;">${esc(u.nome || '—')}</div>
            <div style="font-size:12px;color:var(--color-text-muted);">${esc(u.email)}</div>
          </div>
        </div>
      </td>
      <td><span class="user-role-badge role-${esc(u.role)}">${esc(ROLE_LABEL[u.role] || u.role)}</span></td>
      <td><span class="badge ${u.ativo ? 'badge-success' : 'badge-default'}">${u.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td style="font-size:0.8125rem;color:var(--color-text-muted);">${esc(u.criadoEm || '—')}</td>
      <td>
        <div style="display:flex;gap:4px;justify-content:flex-end;">
          <button class="btn btn-ghost btn-sm" onclick="abrirModalEditarUsuario('${esc(u.id)}')" title="Editar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-ghost btn-sm" onclick="toggleStatusUsuario('${esc(u.id)}')" title="${u.ativo ? 'Desativar' : 'Ativar'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
          </button>
          <button class="btn btn-ghost btn-sm" onclick="excluirUsuario('${esc(u.id)}')" title="Excluir" style="color:var(--color-danger);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function buscarUsuarios(termo) {
  const t     = (termo || '').toLowerCase();
  const lista = carregarDoLocalStorage('sc_usuarios', []);
  renderTabelaUsuarios(t ? lista.filter(u =>
    (u.nome || '').toLowerCase().includes(t) || (u.email || '').toLowerCase().includes(t)
  ) : lista);
}

function abrirModalNovoUsuario() {
  document.getElementById('modalUsuarioTitulo').textContent = 'Novo Usuário';
  document.getElementById('modalUsuarioId').value    = '';
  document.getElementById('modalUsuarioNome').value  = '';
  document.getElementById('modalUsuarioEmail').value = '';
  document.getElementById('modalUsuarioCargo').value = '';
  document.getElementById('modalUsuarioRole').value  = 'operator';
  document.getElementById('modalUsuarioSenha').value = '';
  const errEl = document.getElementById('errorModalEmail');
  if (errEl) errEl.style.display = 'none';
  const grupoSenha = document.getElementById('grupoSenhaModal');
  const opcionalEl = document.getElementById('senhaModalOpcional');
  if (grupoSenha) grupoSenha.style.display = '';
  if (opcionalEl) opcionalEl.style.display = 'none';
  const bar = document.getElementById('senhaModalBarra');
  const hint = document.getElementById('senhaModalHint');
  if (bar)  { bar.style.width = '0%'; bar.style.background = ''; }
  if (hint) hint.textContent = '';
  abrirModal('modalUsuario');
}

function abrirModalEditarUsuario(id) {
  const u = carregarDoLocalStorage('sc_usuarios', []).find(x => x.id === id);
  if (!u) return;
  document.getElementById('modalUsuarioTitulo').textContent = 'Editar Usuário';
  document.getElementById('modalUsuarioId').value    = u.id;
  document.getElementById('modalUsuarioNome').value  = u.nome || '';
  document.getElementById('modalUsuarioEmail').value = u.email || '';
  document.getElementById('modalUsuarioCargo').value = u.cargo || '';
  document.getElementById('modalUsuarioRole').value  = u.role || 'operator';
  document.getElementById('modalUsuarioSenha').value = '';
  const errEl = document.getElementById('errorModalEmail');
  if (errEl) errEl.style.display = 'none';
  const grupoSenha = document.getElementById('grupoSenhaModal');
  const opcionalEl = document.getElementById('senhaModalOpcional');
  if (grupoSenha) grupoSenha.style.display = '';
  if (opcionalEl) opcionalEl.style.display = '';
  abrirModal('modalUsuario');
}

function salvarUsuario() {
  const id    = document.getElementById('modalUsuarioId').value.trim();
  const nome  = document.getElementById('modalUsuarioNome')?.value.trim();
  const email = document.getElementById('modalUsuarioEmail')?.value.trim();
  const cargo = document.getElementById('modalUsuarioCargo')?.value.trim();
  const role  = document.getElementById('modalUsuarioRole')?.value;
  const senha = document.getElementById('modalUsuarioSenha')?.value;
  const errEl = document.getElementById('errorModalEmail');

  if (!nome)               { showToast('Nome é obrigatório.', 'error'); return; }
  if (!validarEmail(email)) { showToast('E-mail inválido.', 'error'); return; }
  if (!id && !senha)        { showToast('Senha é obrigatória para novos usuários.', 'error'); return; }
  if (senha && senha.length < 8) { showToast('Senha deve ter pelo menos 8 caracteres.', 'error'); return; }

  if (!verificarEmailUnico(email, id)) {
    if (errEl) errEl.style.display = 'block';
    showToast('E-mail já cadastrado.', 'error');
    return;
  }
  if (errEl) errEl.style.display = 'none';

  const lista = carregarDoLocalStorage('sc_usuarios', []);
  if (id) {
    const idx = lista.findIndex(u => u.id === id);
    if (idx !== -1) {
      lista[idx] = { ...lista[idx], nome, email, cargo, role, ...(senha ? { senha } : {}) };
    }
    _cfgApi("PUT", `/api/usuarios/${id}`, { nome, email, cargo, role, ...(senha ? { senha } : {}) }).catch(() => {});
  } else {
    const novoId = gerarId();
    lista.push({ id: novoId, nome, email, cargo, role, senha, ativo: true, criadoEm: new Date().toISOString().slice(0, 10) });
    const { organization_id: _uoid } = _getOrgData();
    _cfgApi("POST", "/api/usuarios", { nome, email, cargo, role, senha, organization_id: _uoid }).catch(() => {});
  }
  salvarNoLocalStorage('sc_usuarios', lista);
  fecharModal('modalUsuario');
  carregarUsuarios();
  registrarLog(id ? 'Usuário editado' : 'Usuário criado', 'usuarios', nome, '');
  showToast(id ? 'Usuário atualizado!' : 'Usuário criado!', 'success');
}

function toggleStatusUsuario(id) {
  const lista = carregarDoLocalStorage('sc_usuarios', []);
  const u = lista.find(x => x.id === id);
  if (!u) return;
  u.ativo = !u.ativo;
  salvarNoLocalStorage('sc_usuarios', lista);
  carregarUsuarios();
  showToast(`Usuário ${u.ativo ? 'ativado' : 'desativado'}.`, 'info');
}

function excluirUsuario(id) {
  const atual = carregarDoLocalStorage('sc_usuario', {});
  if (id === atual.id) { showToast('Você não pode excluir sua própria conta aqui.', 'error'); return; }
  const u = carregarDoLocalStorage('sc_usuarios', []).find(x => x.id === id);
  confirmarAcao('Excluir usuário', `Excluir ${u?.nome || 'este usuário'}? Esta ação não pode ser desfeita.`, () => {
    const lista = carregarDoLocalStorage('sc_usuarios', []).filter(x => x.id !== id);
    salvarNoLocalStorage('sc_usuarios', lista);
    carregarUsuarios();
    registrarLog('Usuário excluído', 'usuarios', u?.nome || id, '');
    showToast('Usuário excluído.', 'success');
  });
}

function gerarESenha() {
  const pw  = gerarSenhaAleatoria();
  const inp = document.getElementById('modalUsuarioSenha');
  if (inp) {
    inp.type  = 'text';
    inp.value = pw;
    inp.dispatchEvent(new Event('input'));
  }
}

// ── Categorias ────────────────────────────────────────────────────────────────
function carregarCategorias() {
  const data = carregarDoLocalStorage('sc_categorias', MOCK.categorias);
  renderListaCategorias(data.categorias || []);
  const { organization_id } = _getOrgData();
  if (!organization_id) return;
  _cfgApi('GET', `/api/configuracoes/categorias?organization_id=${organization_id}`)
    .then(res => {
      if (!res.success) return;
      const stored = carregarDoLocalStorage('sc_categorias', MOCK.categorias);
      stored.categorias = res.categorias;
      stored.marcas     = res.marcas;
      salvarNoLocalStorage('sc_categorias', stored);
      renderListaCategorias(res.categorias);
    })
    .catch(() => {});
}

function renderListaCategorias(cats) {
  const cont = document.getElementById('listaCategorias');
  if (!cont) return;
  if (!cats || !cats.length) {
    cont.innerHTML = '<p style="color:var(--color-text-muted);font-size:0.875rem;padding:var(--space-3) 0;">Nenhuma categoria cadastrada.</p>';
    return;
  }
  const sorted = [...cats].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  cont.innerHTML = sorted.map(cat => {
    const count = contarItensPorCategoria(cat.nome);
    return `<div class="categoria-item" draggable="true" data-id="${esc(cat.id)}">
      <span class="categoria-drag" aria-hidden="true">⠿</span>
      <span class="categoria-cor" style="background:${esc(cat.cor || '#94a3b8')};"></span>
      <span class="categoria-nome">${esc(cat.nome)}</span>
      <span class="categoria-count">${count} ${count === 1 ? 'item' : 'itens'}</span>
      <div class="categoria-actions">
        <button class="btn btn-ghost btn-sm" onclick="abrirModalEditarCategoria('${esc(cat.id)}')" title="Editar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn btn-ghost btn-sm" onclick="excluirCategoria('${esc(cat.id)}')" title="Excluir" style="color:var(--color-danger);">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
  initDragDropCategorias();
}

function buscarCategorias(termo) {
  const t    = (termo || '').toLowerCase();
  const data = carregarDoLocalStorage('sc_categorias', MOCK.categorias);
  const cats = data.categorias || [];
  renderListaCategorias(t ? cats.filter(c => c.nome.toLowerCase().includes(t)) : cats);
}

function abrirModalNovaCategoria() {
  document.getElementById('modalCategoriaTitulo').textContent = 'Nova Categoria';
  document.getElementById('modalCategoriaId').value    = '';
  document.getElementById('modalCategoriaNome').value  = '';
  document.getElementById('modalCategoriaCor').value   = '#3b82f6';
  selecionarCorCategoria('#3b82f6', document.querySelector('#corPickerCategoria .cor-swatch'));
  abrirModal('modalCategoria');
}

function abrirModalEditarCategoria(id) {
  const data = carregarDoLocalStorage('sc_categorias', MOCK.categorias);
  const cat  = (data.categorias || []).find(c => c.id === id);
  if (!cat) return;
  document.getElementById('modalCategoriaTitulo').textContent = 'Editar Categoria';
  document.getElementById('modalCategoriaId').value   = cat.id;
  document.getElementById('modalCategoriaNome').value = cat.nome;
  document.getElementById('modalCategoriaCor').value  = cat.cor || '#3b82f6';
  const sw = document.querySelector(`#corPickerCategoria .cor-swatch[data-cor="${CSS.escape(cat.cor || '#3b82f6')}"]`);
  if (sw) selecionarCorCategoria(cat.cor || '#3b82f6', sw);
  abrirModal('modalCategoria');
}

function salvarCategoria() {
  const id   = document.getElementById('modalCategoriaId')?.value.trim();
  const nome = document.getElementById('modalCategoriaNome')?.value.trim();
  const cor  = document.getElementById('modalCategoriaCor')?.value || '#3b82f6';
  if (!nome) { showToast('Nome da categoria é obrigatório.', 'error'); return; }

  const data = carregarDoLocalStorage('sc_categorias', MOCK.categorias);
  const cats = data.categorias || [];
  if (id) {
    const idx = cats.findIndex(c => c.id === id);
    if (idx !== -1) cats[idx] = { ...cats[idx], nome, cor };
  } else {
    cats.push({ id: gerarId(), nome, cor, ordem: cats.length });
  }
  data.categorias = cats;
  salvarNoLocalStorage('sc_categorias', data);
  _syncCatMarcasToApi(data);
  fecharModal('modalCategoria');
  renderListaCategorias(cats);
  registrarLog(id ? 'Categoria editada' : 'Categoria criada', 'categorias', nome, '');
  showToast(id ? 'Categoria atualizada!' : 'Categoria criada!', 'success');
}

function excluirCategoria(id) {
  const data = carregarDoLocalStorage('sc_categorias', MOCK.categorias);
  const cat  = (data.categorias || []).find(c => c.id === id);
  if (!cat) return;
  const count = contarItensPorCategoria(cat.nome);
  const warn  = count > 0 ? ` (${count} ${count === 1 ? 'item usa' : 'itens usam'} esta categoria)` : '';
  confirmarAcao('Excluir categoria', `Excluir "${cat.nome}"?${warn}`, () => {
    data.categorias = (data.categorias || []).filter(c => c.id !== id).map((c, i) => ({ ...c, ordem: i }));
    salvarNoLocalStorage('sc_categorias', data);
    _syncCatMarcasToApi(data);
    renderListaCategorias(data.categorias);
    registrarLog('Categoria excluída', 'categorias', cat.nome, '');
    showToast('Categoria excluída.', 'success');
  });
}

function selecionarCorCategoria(cor, el) {
  document.getElementById('modalCategoriaCor').value = cor;
  document.querySelectorAll('#corPickerCategoria .cor-swatch').forEach(s => s.classList.remove('selecionada'));
  if (el) el.classList.add('selecionada');
}

function initDragDropCategorias() {
  const lista = document.getElementById('listaCategorias');
  if (!lista) return;
  let dragEl = null;

  lista.addEventListener('dragstart', e => {
    dragEl = e.target.closest('.categoria-item');
    if (dragEl) { setTimeout(() => dragEl.classList.add('dragging'), 0); }
  });
  lista.addEventListener('dragend', () => {
    if (dragEl) { dragEl.classList.remove('dragging'); dragEl = null; }
    lista.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  });
  lista.addEventListener('dragover', e => {
    e.preventDefault();
    const over = e.target.closest('.categoria-item');
    lista.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    if (!over || over === dragEl) return;
    const rect  = over.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    over.classList.add('drag-over');
    if (dragEl) lista.insertBefore(dragEl, after ? over.nextSibling : over);
  });
  lista.addEventListener('drop', e => {
    e.preventDefault();
    const data = carregarDoLocalStorage('sc_categorias', MOCK.categorias);
    const novosIds = [...lista.querySelectorAll('.categoria-item')].map(el => el.dataset.id);
    data.categorias = novosIds.map((id, i) => {
      const cat = (data.categorias || []).find(c => c.id === id);
      return cat ? { ...cat, ordem: i } : null;
    }).filter(Boolean);
    salvarNoLocalStorage('sc_categorias', data);
    _syncCatMarcasToApi(data);
  });
}

// ── Marcas ────────────────────────────────────────────────────────────────────
function carregarMarcas() {
  const data   = carregarDoLocalStorage('sc_categorias', MOCK.categorias);
  renderListaMarcas(data.marcas || []);
  const { organization_id } = _getOrgData();
  if (!organization_id) return;
  _cfgApi('GET', `/api/configuracoes/categorias?organization_id=${organization_id}`)
    .then(res => {
      if (!res.success) return;
      const stored = carregarDoLocalStorage('sc_categorias', MOCK.categorias);
      stored.categorias = res.categorias;
      stored.marcas     = res.marcas;
      salvarNoLocalStorage('sc_categorias', stored);
      renderListaMarcas(res.marcas);
    })
    .catch(() => {});
}

function renderListaMarcas(marcas) {
  const cont = document.getElementById('brandsList');
  if (!cont) return;
  cont.innerHTML = marcas.map((m, i) => `
    <span class="tag-edit-chip">
      ${esc(m.nome || m)}
      <button type="button" class="tag-edit-remove" data-marca-idx="${i}" aria-label="Remover">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </span>`).join('');

  cont.querySelectorAll('[data-marca-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = carregarDoLocalStorage('sc_categorias', MOCK.categorias);
      d.marcas.splice(parseInt(btn.dataset.marcaIdx), 1);
      salvarNoLocalStorage('sc_categorias', d);
      _syncCatMarcasToApi(d);
      renderListaMarcas(d.marcas);
    });
  });
}

function adicionarMarca() {
  const inp = document.getElementById('newBrand');
  const val = inp?.value.trim();
  if (!val) return;
  const data = carregarDoLocalStorage('sc_categorias', MOCK.categorias);
  if (!data.marcas) data.marcas = [];
  if (data.marcas.some(m => (m.nome || m) === val)) { showToast('Marca já existe.', 'warning'); return; }
  data.marcas.push({ id: gerarId(), nome: val });
  salvarNoLocalStorage('sc_categorias', data);
  _syncCatMarcasToApi(data);
  if (inp) inp.value = '';
  renderListaMarcas(data.marcas);
}

// ── Localizações ──────────────────────────────────────────────────────────────
function _syncLocToApi(lista) {
  const { organization_id } = _getOrgData();
  if (!organization_id) return;
  _cfgApi('PUT', '/api/configuracoes/localizacoes', { organization_id, localizacoes: lista })
    .catch(() => {});
}

function carregarLocalizacoes() {
  const lista = carregarDoLocalStorage('sc_localizacoes', MOCK.localizacoes);
  renderListaLocalizacoes(lista);
  const { organization_id } = _getOrgData();
  if (!organization_id) return;
  _cfgApi('GET', `/api/configuracoes/localizacoes?organization_id=${organization_id}`)
    .then(res => {
      if (!res.success) return;
      salvarNoLocalStorage('sc_localizacoes', res.localizacoes);
      renderListaLocalizacoes(res.localizacoes);
    })
    .catch(() => {});
}

function renderListaLocalizacoes(locs) {
  const cont = document.getElementById('listaLocalizacoes');
  if (!cont) return;
  if (!locs || !locs.length) {
    cont.innerHTML = '<p style="color:var(--color-text-muted);font-size:0.875rem;padding:var(--space-3) 0;">Nenhuma localização cadastrada.</p>';
    return;
  }
  cont.innerHTML = locs.map(loc => {
    const count = contarItensPorLocalizacao(loc.nome);
    const capBar = loc.capacidade
      ? `<div style="font-size:0.75rem;color:var(--color-text-muted);flex-shrink:0;">${count}/${loc.capacidade}</div>`
      : '';
    return `<div class="localizacao-item" data-id="${esc(loc.id)}" data-tipo="${esc(loc.tipo)}">
      <span class="loc-tipo-badge">${esc(TIPO_LOCAL_LABEL[loc.tipo] || loc.tipo)}</span>
      <div style="flex:1;min-width:0;">
        <div class="loc-nome">${esc(loc.nome)}</div>
        ${loc.descricao ? `<div class="loc-desc">${esc(loc.descricao)}</div>` : ''}
      </div>
      <span class="loc-count">${count} itens</span>
      ${capBar}
      <div class="localizacao-actions">
        <button class="btn btn-ghost btn-sm" onclick="abrirModalEditarLocalizacao('${esc(loc.id)}')" title="Editar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn btn-ghost btn-sm" onclick="excluirLocalizacao('${esc(loc.id)}')" title="Excluir" style="color:var(--color-danger);">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

function buscarLocalizacoes(termo) {
  const t     = (termo || '').toLowerCase();
  const tipo  = document.getElementById('filtroTipoLocalizacao')?.value || '';
  let   lista = carregarDoLocalStorage('sc_localizacoes', MOCK.localizacoes);
  if (tipo) lista = lista.filter(l => l.tipo === tipo);
  if (t)    lista = lista.filter(l => l.nome.toLowerCase().includes(t));
  renderListaLocalizacoes(lista);
}

function filtrarLocalizacoesPorTipo(tipo) {
  const termo = document.getElementById('buscaLocalizacoes')?.value || '';
  let   lista = carregarDoLocalStorage('sc_localizacoes', MOCK.localizacoes);
  if (tipo)  lista = lista.filter(l => l.tipo === tipo);
  if (termo) lista = lista.filter(l => l.nome.toLowerCase().includes(termo.toLowerCase()));
  renderListaLocalizacoes(lista);
}

function abrirModalNovaLocalizacao() {
  document.getElementById('modalLocalizacaoTitulo').textContent = 'Nova Localização';
  document.getElementById('modalLocalizacaoId').value          = '';
  document.getElementById('modalLocalizacaoNome').value        = '';
  document.getElementById('modalLocalizacaoTipo').value        = 'deposito';
  document.getElementById('modalLocalizacaoCapacidade').value  = '';
  document.getElementById('modalLocalizacaoDescricao').value   = '';
  abrirModal('modalLocalizacao');
}

function abrirModalEditarLocalizacao(id) {
  const loc = carregarDoLocalStorage('sc_localizacoes', []).find(l => l.id === id);
  if (!loc) return;
  document.getElementById('modalLocalizacaoTitulo').textContent = 'Editar Localização';
  document.getElementById('modalLocalizacaoId').value          = loc.id;
  document.getElementById('modalLocalizacaoNome').value        = loc.nome;
  document.getElementById('modalLocalizacaoTipo').value        = loc.tipo || 'deposito';
  document.getElementById('modalLocalizacaoCapacidade').value  = loc.capacidade || '';
  document.getElementById('modalLocalizacaoDescricao').value   = loc.descricao || '';
  abrirModal('modalLocalizacao');
}

function salvarLocalizacao() {
  const id   = document.getElementById('modalLocalizacaoId')?.value.trim();
  const nome = document.getElementById('modalLocalizacaoNome')?.value.trim();
  const tipo = document.getElementById('modalLocalizacaoTipo')?.value || 'outro';
  const cap  = parseInt(document.getElementById('modalLocalizacaoCapacidade')?.value) || null;
  const desc = document.getElementById('modalLocalizacaoDescricao')?.value.trim() || '';
  if (!nome) { showToast('Nome é obrigatório.', 'error'); return; }

  const lista = carregarDoLocalStorage('sc_localizacoes', []);
  if (id) {
    const idx = lista.findIndex(l => l.id === id);
    if (idx !== -1) lista[idx] = { ...lista[idx], nome, tipo, capacidade: cap, descricao: desc };
  } else {
    lista.push({ id: gerarId(), nome, tipo, capacidade: cap, descricao: desc, ordem: lista.length });
  }
  salvarNoLocalStorage('sc_localizacoes', lista);
  _syncLocToApi(lista);
  fecharModal('modalLocalizacao');
  renderListaLocalizacoes(lista);
  registrarLog(id ? 'Localização editada' : 'Localização criada', 'localizacoes', nome, '');
  showToast(id ? 'Localização atualizada!' : 'Localização criada!', 'success');
}

function excluirLocalizacao(id) {
  const loc   = carregarDoLocalStorage('sc_localizacoes', []).find(l => l.id === id);
  if (!loc) return;
  const count = contarItensPorLocalizacao(loc.nome);
  const warn  = count > 0 ? ` (${count} ${count === 1 ? 'item está' : 'itens estão'} aqui)` : '';
  confirmarAcao('Excluir localização', `Excluir "${loc.nome}"?${warn}`, () => {
    const lista = carregarDoLocalStorage('sc_localizacoes', []).filter(l => l.id !== id);
    salvarNoLocalStorage('sc_localizacoes', lista);
    _syncLocToApi(lista);
    renderListaLocalizacoes(lista);
    registrarLog('Localização excluída', 'localizacoes', loc.nome, '');
    showToast('Localização excluída.', 'success');
  });
}

// ── Notificações ──────────────────────────────────────────────────────────────
function _aplicarRegrasNotif(r) {
  const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = Boolean(val); };
  setChk('notifLowStock',  r.estoqueBaixo);
  setChk('notifDiscard',   r.descarte);
  setChk('notifDonation',  r.doacaoPendente);
  setChk('notifEmail',     r.email);
  const thEl = document.getElementById('lowStockThreshold');
  if (thEl) thEl.value = r.minimo ?? 5;
  toggleRegra('estoqueBaixo', r.estoqueBaixo);
}

function carregarPreferenciasNotificacao() {
  _aplicarRegrasNotif(carregarDoLocalStorage('sc_notif_rules', MOCK.regrasNotif));
  const { organization_id } = _getOrgData();
  if (!organization_id) return;
  _cfgApi('GET', `/api/configuracoes/notificacoes?organization_id=${organization_id}`)
    .then(res => {
      if (!res.success || !res.regras) return;
      salvarNoLocalStorage('sc_notif_rules', res.regras);
      _aplicarRegrasNotif(res.regras);
    })
    .catch(() => {});
}

function salvarPreferenciasNotificacao() {
  const regras = {
    estoqueBaixo:   document.getElementById('notifLowStock')?.checked,
    descarte:       document.getElementById('notifDiscard')?.checked,
    doacaoPendente: document.getElementById('notifDonation')?.checked,
    email:          document.getElementById('notifEmail')?.checked,
    minimo:         parseInt(document.getElementById('lowStockThreshold')?.value) || 5,
  };
  salvarNoLocalStorage('sc_notif_rules', regras);
  const { organization_id: _noid } = _getOrgData();
  _cfgApi("PUT", "/api/configuracoes/notificacoes", { ...regras, organization_id: _noid }).catch(() => {});
  showToast('Preferências salvas!', 'success');
}

function toggleRegra(nomeRegra, ativo) {
  if (nomeRegra === 'estoqueBaixo') {
    const thEl = document.getElementById('lowStockThreshold');
    if (thEl) thEl.disabled = !ativo;
  }
}

// ── Segurança ─────────────────────────────────────────────────────────────────
function initSeguranca() {
  const newPwdEl = document.getElementById('newPwd');
  const barEl    = document.getElementById('pwdStrengthBar');
  const labelEl  = document.getElementById('pwdStrengthLabel');

  newPwdEl?.addEventListener('input', () => {
    const v = newPwdEl.value;
    const { nivel, pct, cor } = calcularForcaSenha(v);
    if (barEl)   { barEl.style.width = pct + '%'; barEl.style.background = cor || ''; }
    if (labelEl) { labelEl.textContent = nivel || '—'; labelEl.style.color = cor || ''; }
    renderChecklistSenha(v);
  });

  document.getElementById('changePasswordBtn')?.addEventListener('click', alterarSenha);
}

function alterarSenha() {
  const atualEl    = document.getElementById('currentPwd');
  const novaEl     = document.getElementById('newPwd');
  const confirmaEl = document.getElementById('confirmPwd');
  const atual      = atualEl?.value    || '';
  const nova       = novaEl?.value     || '';
  const confirma   = confirmaEl?.value || '';

  const hideErr = id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };
  const showErr = (id, msg) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (msg) el.textContent = msg;
    el.style.display = 'block';
  };
  hideErr('errorCurrentPwd'); hideErr('errorNewPwd'); hideErr('errorConfirmPwd');

  if (!atual) { showErr('errorCurrentPwd', 'Senha atual é obrigatória.'); return; }

  const v = validarSenha(nova);
  if (!v.len || !v.upper || !v.number || !v.special) {
    showErr('errorNewPwd', 'A senha deve ter 8+ caracteres, letra maiúscula, número e caractere especial.');
    return;
  }
  if (nova !== confirma) { showErr('errorConfirmPwd', 'As senhas não coincidem.'); return; }

  const token = _cfgToken();
  fetch('/api/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ senhaAtual: atual, novaSenha: nova }),
  })
    .then(async r => { const d = await r.json(); if (!r.ok) throw d; return d; })
    .then(() => {
      registrarLog('Senha alterada', 'seguranca', carregarDoLocalStorage('sc_usuario', {}).nome || '', '');
      if (atualEl)    atualEl.value    = '';
      if (novaEl)     novaEl.value     = '';
      if (confirmaEl) confirmaEl.value = '';
      const barEl   = document.getElementById('pwdStrengthBar');
      const labelEl = document.getElementById('pwdStrengthLabel');
      if (barEl)   { barEl.style.width = '0%'; barEl.style.background = ''; }
      if (labelEl) { labelEl.textContent = '—'; labelEl.style.color = ''; }
      renderChecklistSenha('');
      showToast('Senha alterada com sucesso!', 'success');
    })
    .catch(err => {
      const msg = (err?.mensagem || '').toLowerCase();
      if (msg.includes('atual') || msg.includes('incorreta')) {
        showErr('errorCurrentPwd', 'Senha atual incorreta.');
      } else if (msg) {
        showToast(err.mensagem, 'error');
      } else {
        showToast('Erro ao alterar senha. Tente novamente.', 'error');
      }
    });
}

function renderChecklistSenha(senha) {
  const reqs = document.getElementById('pwdRequirements');
  if (!reqs) return;
  const checks = validarSenha(senha);
  const typing = senha.length > 0;
  reqs.querySelectorAll('li[data-req]').forEach(li => {
    const ok = checks[li.dataset.req] || false;
    li.style.color = ok ? '#22c55e' : (typing ? '#ef4444' : 'var(--color-text-muted)');
    li.textContent = (ok ? '✓ ' : '✗ ') + li.dataset.text;
  });
}

function togglePwdVisibility(e, btn) {
  e.stopPropagation();
  const inp = document.getElementById(btn.dataset.target);
  if (!inp) return;
  const hidden = inp.type === 'password';
  inp.type = hidden ? 'text' : 'password';
  const svg = btn.querySelector('svg');
  if (svg) svg.innerHTML = hidden
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

function renderBarraForca(senha) {
  const { pct, cor } = calcularForcaSenha(senha);
  const bar   = document.getElementById('pwdStrengthBar');
  const label = document.getElementById('pwdStrengthLabel');
  if (bar)   { bar.style.width = pct + '%'; bar.style.background = cor; }
  if (label) { label.textContent = pct > 0 ? calcularForcaSenha(senha).nivel : '—'; }
}

function carregarLogAcessos() {
  renderLogAcessos(3);
  document.getElementById('btnVerMaisLog')?.addEventListener('click', function () {
    const lista = carregarDoLocalStorage('log_acessos', []);
    renderLogAcessos(lista.length);
    this.style.display = 'none';
  });
}

function renderLogAcessos(limite) {
  const cont = document.getElementById('logAcessosLista');
  if (!cont) return;
  const lista = carregarDoLocalStorage('log_acessos', []);
  const itens = lista.slice(0, limite);
  if (!itens.length) { cont.innerHTML = '<p style="color:var(--color-text-muted);font-size:0.875rem;">Nenhum acesso registrado.</p>'; return; }
  const fmt = iso => { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  cont.innerHTML = itens.map(e => `
    <div style="display:flex;align-items:flex-start;gap:var(--space-3);padding:var(--space-3) 0;border-bottom:1px solid var(--color-border-light);">
      <div style="margin-top:4px;width:10px;height:10px;border-radius:50%;flex-shrink:0;background:${e.atual ? '#22c55e' : 'var(--color-border-strong)'};"></div>
      <div style="flex:1;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-2);">
          <span style="font-size:0.875rem;font-weight:500;">${esc(e.dispositivo)}</span>
          ${e.atual ? '<span style="font-size:0.75rem;font-weight:600;color:#22c55e;background:#dcfce7;padding:1px 8px;border-radius:20px;">Sessão atual</span>' : ''}
        </div>
        <div style="font-size:0.8125rem;color:var(--color-text-muted);margin-top:2px;">
          IP: ${esc(e.ip)} · ${e.atual ? 'Desde ' + fmt(e.inicio) : fmt(e.inicio) + (e.fim ? ' — ' + fmt(e.fim) : '')}
        </div>
      </div>
    </div>`).join('');
  const btn = document.getElementById('btnVerMaisLog');
  if (btn) btn.style.display = lista.length > limite ? '' : 'none';
}

function exportarTodosDados() {
  const dados = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    try   { dados[key] = JSON.parse(localStorage.getItem(key)); }
    catch { dados[key] = localStorage.getItem(key); }
  }
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const d    = new Date();
  a.href     = url;
  a.download = `backup_sistema_${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  registrarLog('Exportação de dados', 'seguranca', '', 'Backup JSON gerado');
  showToast('Backup exportado com sucesso!', 'success');
}

function limparTodosDados() {
  confirmarAcao('Limpar todos os dados',
    'Esta ação remove TODOS os dados do sistema e não pode ser desfeita. Continuar?',
    () => {
      const digitado = prompt('Para confirmar, digite CONFIRMAR:');
      if (digitado !== 'CONFIRMAR') { showToast('Operação cancelada.', 'info'); return; }
      localStorage.clear();
      showToast('Dados removidos. Redirecionando…', 'success');
      setTimeout(() => { window.location.href = '/acesso/login/login.html'; }, 1500);
    });
}

function initDangerZone() {
  document.getElementById('logoutAllBtn')?.addEventListener('click', () => {
    confirmarAcao('Encerrar sessões', 'Isso encerrará todas as sessões ativas. Continuar?', () => {
      const log = carregarDoLocalStorage('log_acessos', []);
      log.forEach(e => { if (e.atual) { e.atual = false; e.fim = new Date().toISOString(); } });
      salvarNoLocalStorage('log_acessos', log);
      registrarLog('Sessões encerradas', 'seguranca', '', '');
      showToast('Todas as sessões foram encerradas.', 'success');
      setTimeout(() => { window.location.href = '/acesso/login/login.html'; }, 1300);
    });
  });

  document.getElementById('btnExportarDados')?.addEventListener('click', exportarTodosDados);
  document.getElementById('btnLimparDados')?.addEventListener('click', limparTodosDados);

  document.getElementById('deleteAccountBtn')?.addEventListener('click', () => abrirModal('deleteAccountModal'));

  document.getElementById('confirmDeleteAccountBtn')?.addEventListener('click', () => {
    const pw      = document.getElementById('deleteConfirmPwd')?.value || '';
    const usuario = carregarDoLocalStorage('sc_usuario', {});
    if (!pw || pw !== usuario.senha) { showToast('Senha incorreta.', 'error'); return; }
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/acesso/login/login.html';
  });
}

// ── Event wiring helpers ──────────────────────────────────────────────────────
function wireProfileEvents() {
  document.getElementById('avatarInput')?.addEventListener('change', function () {
    uploadFotoPerfil(this.files[0]);
  });
  document.getElementById('removeAvatarBtn')?.addEventListener('click', removerFotoPerfil);
  document.getElementById('saveProfileBtn')?.addEventListener('click', salvarPerfil);
  document.getElementById('savePrefsBtn')?.addEventListener('click', salvarPreferenciasExibicao);
}

function wireOrgEvents() {
  document.getElementById('saveOrgBtn')?.addEventListener('click', salvarOrganizacao);
  document.getElementById('saveGoalBtn')?.addEventListener('click', () => {
    const org = carregarDoLocalStorage('sc_organizacao', {});
    org.meta  = {
      quantidade: parseInt(document.getElementById('goalTarget')?.value) || null,
      inicio:     document.getElementById('goalStart')?.value || null,
      fim:        document.getElementById('goalEnd')?.value   || null,
    };
    salvarNoLocalStorage('sc_organizacao', org);
    showToast('Meta salva!', 'success');
  });
  document.getElementById('orgLogoInput')?.addEventListener('change', function () {
    uploadLogoOrganizacao(this.files[0]);
  });
  document.getElementById('btnRemoverLogo')?.addEventListener('click', removerLogoOrganizacao);
}

function wireNotifEvents() {
  document.getElementById('saveNotifBtn')?.addEventListener('click', salvarPreferenciasNotificacao);
  document.getElementById('notifLowStock')?.addEventListener('change', function () {
    toggleRegra('estoqueBaixo', this.checked);
  });
}

function wireCategoriasEvents() {
  document.getElementById('addBrandBtn')?.addEventListener('click', adicionarMarca);
  document.getElementById('newBrand')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); adicionarMarca(); }
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Password toggle — event delegation so it works regardless of init order
  document.addEventListener('click', e => {
    const btn = e.target.closest('.password-toggle[data-target]');
    if (!btn) return;
    const inp = document.getElementById(btn.dataset.target);
    if (!inp) return;
    const hidden = inp.type === 'password';
    inp.type = hidden ? 'text' : 'password';
    const svg = btn.querySelector('svg');
    if (svg) svg.innerHTML = hidden
      ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
      : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  });

  carregarDados();
  wireProfileEvents();
  wireOrgEvents();
  wireNotifEvents();
  wireCategoriasEvents();
  initSeguranca();
  initDangerZone();
  initConfiguracoes();
});
