"use strict";

document.addEventListener("sc:ready", function () {
  // ── Side nav ─────────────────────────────────────────────────────────────
  const navLinks = document.querySelectorAll(".settings-nav-link");
  const panels   = document.querySelectorAll(".settings-panel");

  function activatePanel(targetId) {
    panels.forEach(p => p.classList.remove("active"));
    navLinks.forEach(l => l.classList.remove("active"));
    const panel = document.getElementById(targetId);
    if (panel) panel.classList.add("active");
    const link = document.querySelector(`.settings-nav-link[data-panel="${targetId}"]`);
    if (link) link.classList.add("active");
    history.replaceState(null, "", `#${targetId}`);
  }

  navLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      activatePanel(link.dataset.panel);
    });
  });

  // Activate panel from hash or default to "perfil"
  const hash = location.hash.slice(1);
  activatePanel(hash || "perfil");

  // ── Profile panel ─────────────────────────────────────────────────────────
  const profileForm    = document.getElementById("form-profile");
  const avatarInput    = document.getElementById("avatar-file");
  const avatarPreview  = document.getElementById("avatar-preview");
  const avatarInitials = document.getElementById("avatar-initials");
  const fieldName      = document.getElementById("field-name");
  const fieldEmail     = document.getElementById("field-email");

  async function loadProfile() {
    try {
      const user = SC.currentUser || await SC.api("/users/me");
      if (fieldName)  fieldName.value  = user.name  || "";
      if (fieldEmail) fieldEmail.value = user.email || "";
      if (avatarPreview && user.avatarUrl) {
        avatarPreview.src = user.avatarUrl;
        avatarPreview.style.display = "block";
        if (avatarInitials) avatarInitials.style.display = "none";
      } else if (avatarInitials && user.name) {
        avatarInitials.textContent = user.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
      }
    } catch (_) {}
  }

  avatarInput?.addEventListener("change", () => {
    const file = avatarInput.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { SC.toastError("Selecione uma imagem."); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (avatarPreview)  { avatarPreview.src = e.target.result; avatarPreview.style.display = "block"; }
      if (avatarInitials) avatarInitials.style.display = "none";
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("btn-remove-avatar")?.addEventListener("click", () => {
    if (avatarPreview)  { avatarPreview.src = ""; avatarPreview.style.display = "none"; }
    if (avatarInitials) avatarInitials.style.display = "flex";
    if (avatarInput)    avatarInput.value = "";
  });

  profileForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = profileForm.querySelector('[type="submit"]');
    btn && (btn.disabled = true, btn.classList.add("loading"));
    try {
      const payload = { name: fieldName?.value.trim(), email: fieldEmail?.value.trim() };
      if (avatarInput?.files[0]) {
        const fd = new FormData();
        fd.append("avatar", avatarInput.files[0]);
        await SC.api("/users/me/avatar", { method: "POST", body: fd, headers: {} });
      }
      await SC.api("/users/me", { method: "PUT", body: JSON.stringify(payload) });
      SC.toastSuccess("Perfil atualizado!");
    } catch (err) {
      SC.toastError(err.message || "Erro ao salvar perfil.");
    } finally {
      btn && (btn.disabled = false, btn.classList.remove("loading"));
    }
  });

  // ── Org panel ─────────────────────────────────────────────────────────────
  const orgForm = document.getElementById("form-org");

  async function loadOrg() {
    try {
      const org = await SC.api("/organizations/me");
      const fields = ["org-name", "org-type", "org-email", "org-phone", "org-address",
                      "goal-target", "goal-start", "goal-end"];
      const map = {
        "org-name": org.name, "org-type": org.type, "org-email": org.contactEmail,
        "org-phone": org.phone, "org-address": org.address,
        "goal-target": org.goal?.target, "goal-start": org.goal?.startDate?.slice(0,10),
        "goal-end": org.goal?.endDate?.slice(0,10),
      };
      fields.forEach(id => {
        const el = document.getElementById(`field-${id}`);
        if (el && map[id] !== undefined) el.value = map[id] ?? "";
      });
    } catch (_) {}
  }

  orgForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = orgForm.querySelector('[type="submit"]');
    btn && (btn.disabled = true, btn.classList.add("loading"));
    try {
      const payload = {
        name:         document.getElementById("field-org-name")?.value.trim(),
        type:         document.getElementById("field-org-type")?.value,
        contactEmail: document.getElementById("field-org-email")?.value.trim(),
        phone:        document.getElementById("field-org-phone")?.value.trim(),
        address:      document.getElementById("field-org-address")?.value.trim(),
        goal: {
          target:    parseInt(document.getElementById("field-goal-target")?.value) || null,
          startDate: document.getElementById("field-goal-start")?.value || null,
          endDate:   document.getElementById("field-goal-end")?.value   || null,
        },
      };
      await SC.api("/organizations/me", { method: "PUT", body: JSON.stringify(payload) });
      SC.toastSuccess("Dados da organização salvos!");
    } catch (err) {
      SC.toastError(err.message || "Erro ao salvar organização.");
    } finally {
      btn && (btn.disabled = false, btn.classList.remove("loading"));
    }
  });

  // ── Users panel ───────────────────────────────────────────────────────────
  const inviteForm   = document.getElementById("form-invite");
  const usersTableBody = document.getElementById("users-tbody");

  async function loadUsers() {
    if (!usersTableBody) return;
    usersTableBody.innerHTML = `<tr><td colspan="4"><div class="skeleton" style="height:40px;border-radius:6px"></div></td></tr>`;
    try {
      const data = await SC.api("/organizations/me/users");
      const users = data.items || data || [];
      if (!users.length) {
        usersTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--color-text-muted);padding:1.5rem">Nenhum usuário</td></tr>`;
        return;
      }
      usersTableBody.innerHTML = users.map(u => `
        <tr data-id="${u.id}">
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <div style="width:32px;height:32px;border-radius:50%;background:var(--color-primary-light);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:var(--color-primary)">
                ${SC.escHtml((u.name || u.email || "?")[0].toUpperCase())}
              </div>
              <div>
                <div style="font-weight:500;font-size:13px">${SC.escHtml(u.name || "—")}</div>
                <div style="font-size:12px;color:var(--color-text-muted)">${SC.escHtml(u.email)}</div>
              </div>
            </div>
          </td>
          <td>
            <select class="form-select select-role" data-user-id="${u.id}" style="font-size:12px;padding:4px 8px">
              <option value="admin"    ${u.role === "admin"    ? "selected" : ""}>Administrador</option>
              <option value="manager"  ${u.role === "manager"  ? "selected" : ""}>Gestor</option>
              <option value="operator" ${u.role === "operator" ? "selected" : ""}>Operador</option>
              <option value="viewer"   ${u.role === "viewer"   ? "selected" : ""}>Visualizador</option>
            </select>
          </td>
          <td><span class="badge ${u.active ? "badge-success" : "badge-default"}">${u.active ? "Ativo" : "Inativo"}</span></td>
          <td>
            <button class="btn btn-ghost btn-sm btn-remove-user" data-id="${u.id}" data-name="${SC.escHtml(u.name || u.email)}" title="Remover usuário">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </td>
        </tr>`).join("");

      usersTableBody.querySelectorAll(".select-role").forEach(sel => {
        sel.addEventListener("change", async () => {
          try {
            await SC.api(`/organizations/me/users/${sel.dataset.userId}`, {
              method: "PATCH",
              body: JSON.stringify({ role: sel.value }),
            });
            SC.toastSuccess("Papel atualizado!");
          } catch (err) {
            SC.toastError(err.message || "Erro ao atualizar papel.");
          }
        });
      });

      usersTableBody.querySelectorAll(".btn-remove-user").forEach(btn => {
        btn.addEventListener("click", async () => {
          if (!confirm(`Remover ${btn.dataset.name} da organização?`)) return;
          try {
            await SC.api(`/organizations/me/users/${btn.dataset.id}`, { method: "DELETE" });
            btn.closest("tr").remove();
            SC.toastSuccess("Usuário removido.");
          } catch (err) {
            SC.toastError(err.message || "Erro ao remover usuário.");
          }
        });
      });
    } catch (err) {
      usersTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--color-danger)">Erro ao carregar usuários.</td></tr>`;
    }
  }

  inviteForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const emailEl = document.getElementById("invite-email");
    const roleEl  = document.getElementById("invite-role");
    const btn = inviteForm.querySelector('[type="submit"]');
    if (!emailEl?.value.trim()) return;

    btn && (btn.disabled = true, btn.classList.add("loading"));
    try {
      await SC.api("/organizations/me/invites", {
        method: "POST",
        body: JSON.stringify({ email: emailEl.value.trim(), role: roleEl?.value || "operator" }),
      });
      SC.toastSuccess("Convite enviado!");
      emailEl.value = "";
      loadUsers();
    } catch (err) {
      SC.toastError(err.message || "Erro ao enviar convite.");
    } finally {
      btn && (btn.disabled = false, btn.classList.remove("loading"));
    }
  });

  // ── Tags / categories panel ────────────────────────────────────────────────
  const TAG_CONFIGS = [
    { containerId: "tags-categories", inputId: "input-category",  endpoint: "/categories" },
    { containerId: "tags-brands",     inputId: "input-brand",     endpoint: "/brands" },
    { containerId: "tags-locations",  inputId: "input-location",  endpoint: "/locations" },
  ];

  async function loadTagGroup(cfg) {
    const container = document.getElementById(cfg.containerId);
    if (!container) return;
    container.innerHTML = `<span class="skeleton" style="display:inline-block;width:80px;height:24px;border-radius:12px"></span>`;
    try {
      const data = await SC.api(cfg.endpoint);
      const items = data.items || data || [];
      renderTagGroup(container, items, cfg);
    } catch (_) {
      container.innerHTML = "";
    }
  }

  function renderTagGroup(container, items, cfg) {
    container.innerHTML = items.map(item =>
      `<span class="tag-chip" data-id="${item.id}">
        ${SC.escHtml(item.name)}
        <button type="button" class="tag-remove" data-id="${item.id}" data-endpoint="${cfg.endpoint}" aria-label="Remover">×</button>
      </span>`
    ).join("");

    container.querySelectorAll(".tag-remove").forEach(btn => {
      btn.addEventListener("click", async () => {
        try {
          await SC.api(`${btn.dataset.endpoint}/${btn.dataset.id}`, { method: "DELETE" });
          btn.closest(".tag-chip").remove();
        } catch (err) {
          SC.toastError(err.message || "Erro ao remover.");
        }
      });
    });

    // Add input
    const inputEl = document.getElementById(cfg.inputId);
    inputEl?.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter" && e.key !== ",") return;
      e.preventDefault();
      const val = inputEl.value.trim().replace(/,$/, "");
      if (!val) return;
      try {
        const created = await SC.api(cfg.endpoint, {
          method: "POST",
          body: JSON.stringify({ name: val }),
        });
        const chip = document.createElement("span");
        chip.className = "tag-chip";
        chip.dataset.id = created.id;
        chip.innerHTML = `${SC.escHtml(created.name)}<button type="button" class="tag-remove" data-id="${created.id}" data-endpoint="${cfg.endpoint}" aria-label="Remover">×</button>`;
        chip.querySelector(".tag-remove").addEventListener("click", async () => {
          try {
            await SC.api(`${cfg.endpoint}/${created.id}`, { method: "DELETE" });
            chip.remove();
          } catch (err) {
            SC.toastError(err.message || "Erro ao remover.");
          }
        });
        container.appendChild(chip);
        inputEl.value = "";
      } catch (err) {
        SC.toastError(err.message || "Erro ao adicionar.");
      }
    });
  }

  // ── Notifications panel ────────────────────────────────────────────────────
  const notifForm = document.getElementById("form-notifications");

  async function loadNotifSettings() {
    try {
      const data = await SC.api("/users/me/notifications-settings");
      Object.entries(data).forEach(([key, val]) => {
        const toggle = document.getElementById(`toggle-${key}`);
        if (toggle) toggle.checked = Boolean(val);
      });
    } catch (_) {}
  }

  notifForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = notifForm.querySelector('[type="submit"]');
    btn && (btn.disabled = true, btn.classList.add("loading"));
    const toggles = notifForm.querySelectorAll(".toggle-switch input[type='checkbox']");
    const payload = {};
    toggles.forEach(t => { payload[t.id.replace("toggle-", "")] = t.checked; });
    try {
      await SC.api("/users/me/notifications-settings", { method: "PUT", body: JSON.stringify(payload) });
      SC.toastSuccess("Preferências salvas!");
    } catch (err) {
      SC.toastError(err.message || "Erro ao salvar.");
    } finally {
      btn && (btn.disabled = false, btn.classList.remove("loading"));
    }
  });

  // ── Security panel ─────────────────────────────────────────────────────────
  const pwForm    = document.getElementById("form-password");
  const pwCurrent = document.getElementById("field-pw-current");
  const pwNew     = document.getElementById("field-pw-new");
  const pwConfirm = document.getElementById("field-pw-confirm");
  const pwStrengthBar = document.getElementById("pw-strength-bar");
  const pwStrengthLabel = document.getElementById("pw-strength-label");

  pwNew?.addEventListener("input", () => {
    const { score, label } = calcPasswordStrength(pwNew.value);
    if (pwStrengthBar) {
      pwStrengthBar.style.width = `${(score / 4) * 100}%`;
      pwStrengthBar.className = `strength-bar-fill strength-${["", "weak", "fair", "good", "strong"][score] || "weak"}`;
    }
    if (pwStrengthLabel) pwStrengthLabel.textContent = label;
  });

  function calcPasswordStrength(pw) {
    if (!pw) return { score: 0, label: "" };
    let score = 0;
    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const labels = ["", "Fraca", "Regular", "Boa", "Forte"];
    return { score, label: labels[score] || "Fraca" };
  }

  pwForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (pwNew?.value !== pwConfirm?.value) {
      SC.toastError("As senhas não coincidem.");
      return;
    }
    if ((pwNew?.value || "").length < 8) {
      SC.toastError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    const btn = pwForm.querySelector('[type="submit"]');
    btn && (btn.disabled = true, btn.classList.add("loading"));
    try {
      await SC.api("/users/me/password", {
        method: "PUT",
        body: JSON.stringify({ current: pwCurrent?.value, password: pwNew?.value }),
      });
      SC.toastSuccess("Senha alterada!");
      pwForm.reset();
      if (pwStrengthBar)  pwStrengthBar.style.width = "0";
      if (pwStrengthLabel) pwStrengthLabel.textContent = "";
    } catch (err) {
      SC.toastError(err.message || "Erro ao alterar senha.");
    } finally {
      btn && (btn.disabled = false, btn.classList.remove("loading"));
    }
  });

  document.getElementById("btn-logout-all")?.addEventListener("click", async () => {
    if (!confirm("Isso encerrará todas as suas sessões ativas. Continuar?")) return;
    try {
      await SC.api("/auth/sessions", { method: "DELETE" });
      SC.toastSuccess("Todas as sessões encerradas.");
      setTimeout(() => { window.location.href = "login.html"; }, 1200);
    } catch (err) {
      SC.toastError(err.message || "Erro ao encerrar sessões.");
    }
  });

  // Delete account
  const deleteModal = document.getElementById("modal-delete-account");
  const deleteConfirmInput = document.getElementById("delete-confirm-pw");
  const btnDeleteConfirm   = document.getElementById("btn-delete-confirm");

  document.getElementById("btn-delete-account")?.addEventListener("click", () => {
    SC.openModal("modal-delete-account");
  });

  document.getElementById("btn-delete-cancel")?.addEventListener("click", () => {
    SC.closeModal("modal-delete-account");
  });

  btnDeleteConfirm?.addEventListener("click", async () => {
    const pw = deleteConfirmInput?.value;
    if (!pw) { SC.toastError("Digite sua senha para confirmar."); return; }
    btnDeleteConfirm.disabled = true;
    btnDeleteConfirm.classList.add("loading");
    try {
      await SC.api("/users/me", { method: "DELETE", body: JSON.stringify({ password: pw }) });
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "login.html";
    } catch (err) {
      SC.toastError(err.message || "Erro ao excluir conta.");
      btnDeleteConfirm.disabled = false;
      btnDeleteConfirm.classList.remove("loading");
    }
  });

  // ── Load data for initial panel ───────────────────────────────────────────
  async function loadPanelData(panelId) {
    switch (panelId) {
      case "perfil":
        await loadProfile();
        break;
      case "organizacao":
        await loadOrg();
        break;
      case "usuarios":
        await loadUsers();
        break;
      case "categorias":
        await Promise.all(TAG_CONFIGS.map(loadTagGroup));
        break;
      case "notificacoes":
        await loadNotifSettings();
        break;
    }
  }

  // Re-load data when switching panels
  navLinks.forEach(link => {
    link.addEventListener("click", () => loadPanelData(link.dataset.panel));
  });

  // Load initial panel data
  loadPanelData(hash || "perfil");
});
