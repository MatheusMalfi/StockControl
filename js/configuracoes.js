"use strict";

// ── Mock / seed data ──────────────────────────────────────────────────────────
const MOCK = {
  usuario: {
    id: 'u1', nome: 'Maria Silva', email: 'maria@uscs.edu.br',
    cargo: 'Administradora', role: 'admin', senha: 'admin123',
    avatar: null, criadoEm: '2023-08-01',
  },
  usuarios: [
    { id: 'u1', nome: 'Maria Silva',  email: 'maria@uscs.edu.br', cargo: 'Administradora', role: 'admin',    ativo: true,  criadoEm: '2023-08-01' },
    { id: 'u2', nome: 'João Pereira', email: 'joao@uscs.edu.br',  cargo: 'Operador',       role: 'operator', ativo: true,  criadoEm: '2023-09-15' },
    { id: 'u3', nome: 'Ana Costa',    email: 'ana@uscs.edu.br',   cargo: 'Visualizadora',  role: 'viewer',   ativo: false, criadoEm: '2024-01-10' },
  ],
  categorias: {
    categorias: ['Informática', 'Móveis', 'Eletrodomésticos', 'Eletrônicos', 'Vestuário', 'Ferramentas'],
    marcas:     ['Dell', 'HP', 'Samsung', 'LG', 'Apple', 'Lenovo', 'Positivo'],
  },
  localizacoes: ['Depósito Principal', 'Sala 1', 'Sala 2', 'Sala 3 — Armário B', 'Almoxarifado'],
  organizacao: {
    nome: 'USCS — Inovação Social', tipo: 'ONG',
    email: 'contato@uscs.edu.br', telefone: '(11) 4239-3200',
    endereco: 'Rua Galvão Bueno, 868, São Paulo — SP',
    meta: { quantidade: 200, inicio: '2024-01-01', fim: '2024-12-31' },
  },
  regrasNotif: { estoqueBaixo: true, descarte: true, doacaoPendente: false, minimo: 5, email: false },
  preferencias: { tema: 'light', idioma: 'pt-BR', paginacao: 20 },
  logAcessos: [
    { id: 'la1', usuario: 'Maria Silva', email: 'maria@uscs.edu.br', ip: '192.168.1.10', dispositivo: 'Chrome / Windows 11',  inicio: '2024-05-01T08:30:00', fim: null,                  atual: true  },
    { id: 'la2', usuario: 'Maria Silva', email: 'maria@uscs.edu.br', ip: '192.168.1.10', dispositivo: 'Chrome / Windows 11',  inicio: '2024-04-30T09:15:00', fim: '2024-04-30T17:45:00', atual: false },
    { id: 'la3', usuario: 'Maria Silva', email: 'maria@uscs.edu.br', ip: '177.92.3.55',  dispositivo: 'Safari / iPhone',       inicio: '2024-04-28T20:05:00', fim: '2024-04-28T20:30:00', atual: false },
  ],
};

function seedLocalStorage() {
  const seed = (key, val) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(val)); };
  seed('sc_usuario',      MOCK.usuario);
  seed('sc_usuarios',     MOCK.usuarios);
  seed('sc_categorias',   MOCK.categorias);
  seed('sc_localizacoes', MOCK.localizacoes);
  seed('sc_organizacao',  MOCK.organizacao);
  seed('sc_notif_rules',  MOCK.regrasNotif);
  seed('sc_preferencias', MOCK.preferencias);
  seed('log_acessos',     MOCK.logAcessos);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, tipo = 'info') {
  const cont = document.getElementById('toastContainer');
  if (!cont) return;
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.textContent = msg;
  cont.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    t.classList.add('saindo');
    setTimeout(() => t.remove(), 400);
  }, 3200);
}

function obterUsuarioAtual() {
  try { return JSON.parse(localStorage.getItem('sc_usuario')); } catch { return null; }
}

function registrarAuditoria(acao, detalhe = '') {
  const log = JSON.parse(localStorage.getItem('sc_audit_log') || '[]');
  const u = obterUsuarioAtual();
  log.unshift({ acao, detalhe, usuario: u?.nome || '?', ts: new Date().toISOString() });
  localStorage.setItem('sc_audit_log', JSON.stringify(log.slice(0, 100)));
}

function formatarData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function initNav() {
  const navItems = document.querySelectorAll('.settings-nav-item[data-panel]');
  const panels   = document.querySelectorAll('.settings-panel');

  function activatePanel(id, reload) {
    panels.forEach(p => p.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));
    const panel = document.getElementById('panel-' + id);
    if (panel) panel.classList.add('active');
    const nav = document.querySelector(`.settings-nav-item[data-panel="${id}"]`);
    if (nav) nav.classList.add('active');
    history.replaceState(null, '', '#' + id);
    if (reload) loadPanelData(id);
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => activatePanel(item.dataset.panel, true));
  });

  const hash = location.hash.slice(1);
  activatePanel(hash || 'perfil', false);
}

function loadPanelData(id) {
  switch (id) {
    case 'usuarios':   renderUsersTable();    break;
    case 'categorias':
      renderTagList('categoriesList', 'sc_categorias', 'categorias');
      renderTagList('brandsList',     'sc_categorias', 'marcas');
      renderLocalizacoes();
      break;
    case 'seguranca':  renderLogAcessos(3);   break;
  }
}

// ── Profile ───────────────────────────────────────────────────────────────────
function initProfile() {
  const u = obterUsuarioAtual();
  if (!u) return;

  const nameEl     = document.getElementById('profileName');
  const emailEl    = document.getElementById('profileEmail');
  const roleEl     = document.getElementById('profileRole');
  const initialsEl = document.getElementById('profileAvatarInitials');
  const imgEl      = document.getElementById('profileAvatarImg');

  if (nameEl)     nameEl.value     = u.nome  || '';
  if (emailEl)    emailEl.value    = u.email || '';
  if (roleEl)     roleEl.value     = u.cargo || '';
  if (initialsEl) initialsEl.textContent = (u.nome || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  if (u.avatar && imgEl) {
    imgEl.src = u.avatar;
    imgEl.classList.add('is-visible');
    if (initialsEl) initialsEl.style.display = 'none';
  }

  document.getElementById('avatarInput')?.addEventListener('change', function () {
    const file = this.files[0];
    if (!file || !file.type.startsWith('image/')) { showToast('Selecione uma imagem válida.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      if (imgEl) { imgEl.src = e.target.result; imgEl.classList.add('is-visible'); }
      if (initialsEl) initialsEl.style.display = 'none';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('removeAvatarBtn')?.addEventListener('click', () => {
    if (imgEl) { imgEl.src = ''; imgEl.classList.remove('is-visible'); }
    if (initialsEl) initialsEl.style.display = '';
    const inp = document.getElementById('avatarInput');
    if (inp) inp.value = '';
  });

  document.getElementById('saveProfileBtn')?.addEventListener('click', () => {
    const usuario = obterUsuarioAtual();
    if (!usuario) return;
    usuario.nome  = nameEl?.value.trim()  || usuario.nome;
    usuario.email = emailEl?.value.trim() || usuario.email;
    localStorage.setItem('sc_usuario', JSON.stringify(usuario));
    registrarAuditoria('Perfil atualizado', `Nome: ${usuario.nome}`);
    showToast('Perfil atualizado!', 'success');
  });
}

// ── Organização ───────────────────────────────────────────────────────────────
function initOrg() {
  const org = JSON.parse(localStorage.getItem('sc_organizacao') || 'null') || MOCK.organizacao;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  set('orgName',    org.nome);
  set('orgEmail',   org.email);
  set('orgPhone',   org.telefone);
  set('orgAddress', org.endereco);
  set('goalTarget', org.meta?.quantidade);
  set('goalStart',  org.meta?.inicio);
  set('goalEnd',    org.meta?.fim);

  document.getElementById('saveOrgBtn')?.addEventListener('click', () => {
    const o = JSON.parse(localStorage.getItem('sc_organizacao') || '{}');
    o.nome      = document.getElementById('orgName')?.value.trim();
    o.email     = document.getElementById('orgEmail')?.value.trim();
    o.telefone  = document.getElementById('orgPhone')?.value.trim();
    o.endereco  = document.getElementById('orgAddress')?.value.trim();
    localStorage.setItem('sc_organizacao', JSON.stringify(o));
    showToast('Dados da organização salvos!', 'success');
  });

  document.getElementById('saveGoalBtn')?.addEventListener('click', () => {
    const o = JSON.parse(localStorage.getItem('sc_organizacao') || '{}');
    o.meta = {
      quantidade: parseInt(document.getElementById('goalTarget')?.value) || null,
      inicio:     document.getElementById('goalStart')?.value || null,
      fim:        document.getElementById('goalEnd')?.value   || null,
    };
    localStorage.setItem('sc_organizacao', JSON.stringify(o));
    showToast('Meta salva!', 'success');
  });
}

// ── Usuários ──────────────────────────────────────────────────────────────────
function initUsers() {
  renderUsersTable();

  document.getElementById('inviteBtn')?.addEventListener('click', () => {
    const emailEl = document.getElementById('inviteEmail');
    const roleEl  = document.getElementById('inviteRole');
    const email   = emailEl?.value.trim();
    if (!email) { showToast('Informe um e-mail.', 'error'); return; }

    const lista = JSON.parse(localStorage.getItem('sc_usuarios') || '[]');
    lista.push({
      id: 'u' + Date.now(),
      nome:     email.split('@')[0],
      email,
      cargo:    roleEl?.value === 'ADMIN' ? 'Administrador' : roleEl?.value === 'OPERATOR' ? 'Operador' : 'Visualizador',
      role:     (roleEl?.value || 'VIEWER').toLowerCase(),
      ativo:    true,
      criadoEm: new Date().toISOString().slice(0, 10),
    });
    localStorage.setItem('sc_usuarios', JSON.stringify(lista));
    if (emailEl) emailEl.value = '';
    renderUsersTable();
    showToast('Usuário adicionado!', 'success');
  });
}

function renderUsersTable() {
  const tbody = document.getElementById('usersBody');
  if (!tbody) return;
  const lista = JSON.parse(localStorage.getItem('sc_usuarios') || '[]');
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:var(--space-6);color:var(--color-text-muted);">Nenhum usuário</td></tr>`;
    return;
  }
  const roleLabel = { admin: 'Admin', operator: 'Operador', viewer: 'Visualizador' };
  tbody.innerHTML = lista.map(u => `
    <tr data-id="${u.id}">
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--color-primary-light);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:var(--color-primary)">
            ${esc((u.nome || u.email || '?')[0].toUpperCase())}
          </div>
          <div>
            <div style="font-weight:500;font-size:13px">${esc(u.nome || '—')}</div>
            <div style="font-size:12px;color:var(--color-text-muted)">${esc(u.email)}</div>
          </div>
        </div>
      </td>
      <td><span class="user-role-badge role-${esc(u.role)}">${esc(roleLabel[u.role] || u.role)}</span></td>
      <td><span class="badge ${u.ativo ? 'badge-success' : 'badge-default'}">${u.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td style="font-size:0.8125rem;color:var(--color-text-muted)">${esc(u.criadoEm || '—')}</td>
      <td>
        <button class="btn btn-ghost btn-sm" data-remove-user="${esc(u.id)}" title="Remover">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-remove-user]').forEach(btn => {
    btn.addEventListener('click', () => {
      const uid     = btn.dataset.removeUser;
      const updated = JSON.parse(localStorage.getItem('sc_usuarios') || '[]').filter(u => u.id !== uid);
      localStorage.setItem('sc_usuarios', JSON.stringify(updated));
      renderUsersTable();
      showToast('Usuário removido.', 'success');
    });
  });
}

// ── Categorias ────────────────────────────────────────────────────────────────
function initCategorias() {
  renderTagList('categoriesList', 'sc_categorias', 'categorias');
  renderTagList('brandsList',     'sc_categorias', 'marcas');
  renderLocalizacoes();

  document.getElementById('addCategoryBtn')?.addEventListener('click', () =>
    adicionarTag('newCategory', 'sc_categorias', 'categorias', 'categoriesList'));
  document.getElementById('addBrandBtn')?.addEventListener('click', () =>
    adicionarTag('newBrand', 'sc_categorias', 'marcas', 'brandsList'));
  document.getElementById('addLocationBtn')?.addEventListener('click', () => {
    const inp = document.getElementById('newLocation');
    const val = inp?.value.trim();
    if (!val) return;
    const lista = JSON.parse(localStorage.getItem('sc_localizacoes') || '[]');
    if (lista.includes(val)) { showToast('Já existe.', 'warning'); return; }
    lista.push(val);
    localStorage.setItem('sc_localizacoes', JSON.stringify(lista));
    if (inp) inp.value = '';
    renderLocalizacoes();
  });
}

function renderTagList(containerId, storageKey, subKey) {
  const cont = document.getElementById(containerId);
  if (!cont) return;
  const data  = JSON.parse(localStorage.getItem(storageKey) || '{}');
  const items = data[subKey] || [];
  cont.innerHTML = items.map((item, i) => `
    <span class="tag-edit-chip">
      ${esc(item)}
      <button type="button" class="tag-edit-remove"
        data-idx="${i}" data-subkey="${subKey}" data-storage="${storageKey}" data-cont="${containerId}"
        aria-label="Remover">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </span>`).join('');

  cont.querySelectorAll('.tag-edit-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = JSON.parse(localStorage.getItem(btn.dataset.storage) || '{}');
      d[btn.dataset.subkey].splice(parseInt(btn.dataset.idx), 1);
      localStorage.setItem(btn.dataset.storage, JSON.stringify(d));
      renderTagList(btn.dataset.cont, btn.dataset.storage, btn.dataset.subkey);
    });
  });
}

function adicionarTag(inputId, storageKey, subKey, listContId) {
  const inp = document.getElementById(inputId);
  const val = inp?.value.trim();
  if (!val) return;
  const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
  if (!data[subKey]) data[subKey] = [];
  if (data[subKey].includes(val)) { showToast('Já existe.', 'warning'); return; }
  data[subKey].push(val);
  localStorage.setItem(storageKey, JSON.stringify(data));
  if (inp) inp.value = '';
  renderTagList(listContId, storageKey, subKey);
}

function renderLocalizacoes() {
  const cont = document.getElementById('locationsList');
  if (!cont) return;
  const lista = JSON.parse(localStorage.getItem('sc_localizacoes') || '[]');
  cont.innerHTML = lista.map((item, i) => `
    <span class="tag-edit-chip">
      ${esc(item)}
      <button type="button" class="tag-edit-remove" data-loc-idx="${i}" aria-label="Remover">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </span>`).join('');

  cont.querySelectorAll('[data-loc-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const l = JSON.parse(localStorage.getItem('sc_localizacoes') || '[]');
      l.splice(parseInt(btn.dataset.locIdx), 1);
      localStorage.setItem('sc_localizacoes', JSON.stringify(l));
      renderLocalizacoes();
    });
  });
}

// ── Notificações ──────────────────────────────────────────────────────────────
function initNotificacoes() {
  const r = JSON.parse(localStorage.getItem('sc_notif_rules') || 'null') || MOCK.regrasNotif;
  const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = Boolean(val); };
  setChk('notifLowStock',  r.estoqueBaixo);
  setChk('notifDiscard',   r.descarte);
  setChk('notifDonation',  r.doacaoPendente);
  setChk('notifEmail',     r.email);
  const threshEl = document.getElementById('lowStockThreshold');
  if (threshEl) threshEl.value = r.minimo ?? 5;

  document.getElementById('saveNotifBtn')?.addEventListener('click', () => {
    const regras = {
      estoqueBaixo:   document.getElementById('notifLowStock')?.checked,
      descarte:       document.getElementById('notifDiscard')?.checked,
      doacaoPendente: document.getElementById('notifDonation')?.checked,
      email:          document.getElementById('notifEmail')?.checked,
      minimo:         parseInt(document.getElementById('lowStockThreshold')?.value) || 5,
    };
    localStorage.setItem('sc_notif_rules', JSON.stringify(regras));
    showToast('Preferências salvas!', 'success');
  });
}

// ── Segurança ─────────────────────────────────────────────────────────────────
function initSeguranca() {
  initPasswordToggles();
  initAlterarSenha();
  initLogAcessos();
  initExportarDados();
  initLimparDados();
  initDangerZone();
}

function initPasswordToggles() {
  document.querySelectorAll('.password-toggle[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const ocultando = input.type === 'password';
      input.type = ocultando ? 'text' : 'password';
      const svg = btn.querySelector('svg');
      if (svg) {
        svg.innerHTML = ocultando
          ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
          : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
      }
    });
  });
}

function calcForcaSenha(senha) {
  if (!senha) return { score: 0, label: '—', cor: '' };
  let score = 0;
  if (senha.length >= 8)           score++;
  if (/[A-Z]/.test(senha))         score++;
  if (/[0-9]/.test(senha))         score++;
  if (/[^A-Za-z0-9]/.test(senha))  score++;
  const niveis = [
    { label: '—',     cor: '' },
    { label: 'Fraca', cor: '#ef4444' },
    { label: 'Média', cor: '#f59e0b' },
    { label: 'Forte', cor: '#22c55e' },
    { label: 'Forte', cor: '#22c55e' },
  ];
  return { score, ...niveis[score] };
}

function atualizarRequisitos(senha) {
  const reqs = document.getElementById('pwdRequirements');
  if (!reqs) return;
  const checks = {
    len:     senha.length >= 8,
    upper:   /[A-Z]/.test(senha),
    number:  /[0-9]/.test(senha),
    special: /[^A-Za-z0-9]/.test(senha),
  };
  reqs.querySelectorAll('li[data-req]').forEach(li => {
    const ok = checks[li.dataset.req];
    li.style.color = ok ? '#22c55e' : 'var(--color-text-muted)';
    li.textContent = (ok ? '✓ ' : '✗ ') + li.dataset.text;
  });
}

function initAlterarSenha() {
  const newPwdEl = document.getElementById('newPwd');
  const barEl    = document.getElementById('pwdStrengthBar');
  const labelEl  = document.getElementById('pwdStrengthLabel');

  newPwdEl?.addEventListener('input', () => {
    const v = newPwdEl.value;
    const { score, label, cor } = calcForcaSenha(v);
    if (barEl) {
      barEl.style.width      = `${(score / 4) * 100}%`;
      barEl.style.background = cor || '';
    }
    if (labelEl) { labelEl.textContent = label; labelEl.style.color = cor || ''; }
    atualizarRequisitos(v);
  });

  document.getElementById('changePasswordBtn')?.addEventListener('click', () => {
    const atualEl    = document.getElementById('currentPwd');
    const novaEl     = document.getElementById('newPwd');
    const confirmaEl = document.getElementById('confirmPwd');
    const atual      = atualEl?.value || '';
    const nova       = novaEl?.value  || '';
    const confirma   = confirmaEl?.value || '';

    const hideErr = id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };
    const showErr = id => { const el = document.getElementById(id); if (el) el.style.display = 'block'; };
    hideErr('errorCurrentPwd'); hideErr('errorNewPwd'); hideErr('errorConfirmPwd');
    document.getElementById('groupCurrentPwd')?.classList.remove('has-error');
    document.getElementById('groupNewPwd')?.classList.remove('has-error');
    document.getElementById('groupConfirmPwd')?.classList.remove('has-error');

    const usuario = obterUsuarioAtual();
    let valido = true;

    if (!usuario || atual !== usuario.senha) {
      showErr('errorCurrentPwd');
      document.getElementById('groupCurrentPwd')?.classList.add('has-error');
      valido = false;
    }
    if (nova.length < 8) {
      showErr('errorNewPwd');
      document.getElementById('groupNewPwd')?.classList.add('has-error');
      valido = false;
    }
    if (nova !== confirma) {
      showErr('errorConfirmPwd');
      document.getElementById('groupConfirmPwd')?.classList.add('has-error');
      valido = false;
    }
    if (!valido) return;

    usuario.senha = nova;
    localStorage.setItem('sc_usuario', JSON.stringify(usuario));
    registrarAuditoria('Senha alterada', '');

    if (atualEl)    atualEl.value    = '';
    if (novaEl)     novaEl.value     = '';
    if (confirmaEl) confirmaEl.value = '';
    if (barEl)   { barEl.style.width = '0%'; barEl.style.background = ''; }
    if (labelEl) { labelEl.textContent = '—'; labelEl.style.color = ''; }
    atualizarRequisitos('');

    showToast('Senha alterada com sucesso!', 'success');
  });
}

// ── Log de Acessos ────────────────────────────────────────────────────────────
function initLogAcessos() {
  renderLogAcessos(3);
  document.getElementById('btnVerMaisLog')?.addEventListener('click', function () {
    const lista = JSON.parse(localStorage.getItem('log_acessos') || '[]');
    renderLogAcessos(lista.length);
    this.style.display = 'none';
  });
}

function renderLogAcessos(limite) {
  const cont = document.getElementById('logAcessosLista');
  if (!cont) return;
  const lista = JSON.parse(localStorage.getItem('log_acessos') || '[]');
  const itens = lista.slice(0, limite);

  if (!itens.length) {
    cont.innerHTML = '<p style="color:var(--color-text-muted);font-size:0.875rem;">Nenhum acesso registrado.</p>';
    return;
  }

  cont.innerHTML = itens.map(entry => `
    <div style="display:flex;align-items:flex-start;gap:var(--space-3);padding:var(--space-3) 0;border-bottom:1px solid var(--color-border-light);">
      <div style="margin-top:4px;width:10px;height:10px;border-radius:50%;flex-shrink:0;background:${entry.atual ? '#22c55e' : 'var(--color-border-strong)'};"></div>
      <div style="flex:1;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-2);">
          <span style="font-size:0.875rem;font-weight:500;color:var(--color-text-primary);">${esc(entry.dispositivo)}</span>
          ${entry.atual ? '<span style="font-size:0.75rem;font-weight:600;color:#22c55e;background:#dcfce7;padding:1px 8px;border-radius:20px;">Sessão atual</span>' : ''}
        </div>
        <div style="font-size:0.8125rem;color:var(--color-text-muted);margin-top:2px;">
          IP: ${esc(entry.ip)} · ${entry.atual
            ? 'Desde ' + formatarData(entry.inicio)
            : formatarData(entry.inicio) + (entry.fim ? ' — ' + formatarData(entry.fim) : '')}
        </div>
      </div>
    </div>`).join('');

  const btnVerMais = document.getElementById('btnVerMaisLog');
  if (btnVerMais) btnVerMais.style.display = lista.length > limite ? '' : 'none';
}

// ── Exportar Dados ────────────────────────────────────────────────────────────
function initExportarDados() {
  document.getElementById('btnExportarDados')?.addEventListener('click', () => {
    const dados = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      try   { dados[key] = JSON.parse(localStorage.getItem(key)); }
      catch { dados[key] = localStorage.getItem(key); }
    }
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const hoje = new Date();
    const dd   = String(hoje.getDate()).padStart(2, '0');
    const mm   = String(hoje.getMonth() + 1).padStart(2, '0');
    a.href     = url;
    a.download = `backup_sistema_${dd}-${mm}-${hoje.getFullYear()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    registrarAuditoria('Exportação de dados', 'Backup JSON gerado');
    showToast('Backup exportado com sucesso!', 'success');
  });
}

// ── Limpar Dados ──────────────────────────────────────────────────────────────
function initLimparDados() {
  document.getElementById('btnLimparDados')?.addEventListener('click', () => {
    if (!confirm('Atenção: esta ação irá remover TODOS os dados do sistema. Esta operação não pode ser desfeita. Continuar?')) return;
    const digitado = prompt('Para confirmar, digite CONFIRMAR:');
    if (digitado !== 'CONFIRMAR') {
      showToast('Operação cancelada.', 'info');
      return;
    }
    localStorage.clear();
    showToast('Dados removidos. Redirecionando…', 'success');
    setTimeout(() => { window.location.href = 'login.html'; }, 1500);
  });
}

// ── Danger Zone ───────────────────────────────────────────────────────────────
function initDangerZone() {
  document.getElementById('logoutAllBtn')?.addEventListener('click', () => {
    if (!confirm('Isso encerrará todas as sessões ativas. Continuar?')) return;
    const log = JSON.parse(localStorage.getItem('log_acessos') || '[]');
    log.forEach(entry => {
      if (entry.atual) { entry.atual = false; entry.fim = new Date().toISOString(); }
    });
    localStorage.setItem('log_acessos', JSON.stringify(log));
    registrarAuditoria('Sessões encerradas', '');
    showToast('Todas as sessões foram encerradas.', 'success');
    setTimeout(() => { window.location.href = 'login.html'; }, 1300);
  });

  document.getElementById('deleteAccountBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('deleteAccountModal');
    if (modal) modal.style.display = 'flex';
  });

  document.querySelectorAll('[data-close-modal="deleteAccountModal"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = document.getElementById('deleteAccountModal');
      if (modal) modal.style.display = 'none';
    });
  });

  document.getElementById('confirmDeleteAccountBtn')?.addEventListener('click', () => {
    const pw      = document.getElementById('deleteConfirmPwd')?.value || '';
    const usuario = obterUsuarioAtual();
    if (!pw || pw !== usuario?.senha) {
      showToast('Senha incorreta.', 'error');
      return;
    }
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'login.html';
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  seedLocalStorage();
  initProfile();
  initOrg();
  initUsers();
  initCategorias();
  initNotificacoes();
  initSeguranca();
  initNav();
});
