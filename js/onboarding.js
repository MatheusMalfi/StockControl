"use strict";

document.addEventListener("sc:ready", function () {
  let currentStep = 1;
  const TOTAL_STEPS = 5;

  const state = {
    org:      { type: "ong", name: "", email: "", phone: "", desc: "" },
    cats:     [],
    item:     null,
    invites:  [],
    goal:     null,
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  function goTo(step) {
    document.getElementById(`step-${currentStep}`).style.display = "none";
    currentStep = step;
    const card = document.getElementById(`step-${step}`);
    if (card) { card.style.display = "block"; card.scrollIntoView({ behavior: "smooth", block: "start" }); }
    updateStepper();
  }

  function updateStepper() {
    document.querySelectorAll(".step[data-step]").forEach(el => {
      const n = parseInt(el.dataset.step);
      el.classList.remove("active", "done");
      if (n < currentStep) el.classList.add("done");
      else if (n === currentStep) el.classList.add("active");

      const circle = el.querySelector(".step-circle");
      if (circle) {
        if (n < currentStep) circle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
        else circle.textContent = n;
      }
    });
  }

  function showDone() {
    document.getElementById(`step-${currentStep}`).style.display = "none";
    document.getElementById("done-screen").style.display = "block";
    document.getElementById("stepper").style.display = "none";
    document.getElementById("btn-skip").style.display = "none";
    document.getElementById("done-screen").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Step 1: Org ───────────────────────────────────────────────────────────
  document.querySelectorAll(".type-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".type-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      state.org.type = card.querySelector("input")?.value || "ong";
    });
  });

  document.getElementById("btn-next-1")?.addEventListener("click", async () => {
    const name = document.getElementById("s1-name")?.value.trim();
    if (!name) { SC.toastError("Nome da organização é obrigatório."); return; }
    state.org.name  = name;
    state.org.email = document.getElementById("s1-email")?.value.trim();
    state.org.phone = document.getElementById("s1-phone")?.value.trim();
    state.org.desc  = document.getElementById("s1-desc")?.value.trim();

    const btn = document.getElementById("btn-next-1");
    btn.disabled = true; btn.classList.add("loading");
    try {
      await SC.api("/organizations/me", { method: "PUT", body: JSON.stringify({ name: state.org.name, type: state.org.type, contactEmail: state.org.email, phone: state.org.phone, description: state.org.desc }) });
      goTo(2);
    } catch (err) {
      SC.toastError(err.message || "Erro ao salvar organização.");
    } finally {
      btn.disabled = false; btn.classList.remove("loading");
    }
  });

  // ── Step 2: Categories ────────────────────────────────────────────────────
  function renderCatTags() {
    const container = document.getElementById("cats-container");
    if (!container) return;
    container.innerHTML = state.cats.map((c, i) =>
      `<span class="tag-chip">${escHtml(c)}<button type="button" class="tag-remove" data-i="${i}">×</button></span>`
    ).join("");
    container.querySelectorAll(".tag-remove").forEach(btn => {
      btn.addEventListener("click", () => { state.cats.splice(parseInt(btn.dataset.i), 1); renderCatTags(); updateCatSelect(); });
    });
    updateCatSelect();
  }

  function addCat(val) {
    if (val && !state.cats.includes(val)) { state.cats.push(val); renderCatTags(); }
  }

  document.getElementById("cat-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addCat(document.getElementById("cat-input").value.trim().replace(/,$/, "")); document.getElementById("cat-input").value = ""; }
  });
  document.getElementById("btn-add-cat")?.addEventListener("click", () => { addCat(document.getElementById("cat-input").value.trim()); document.getElementById("cat-input").value = ""; });

  document.querySelectorAll("[data-suggest]").forEach(btn => {
    btn.addEventListener("click", () => { addCat(btn.dataset.suggest); });
  });

  document.getElementById("btn-prev-2")?.addEventListener("click", () => goTo(1));
  document.getElementById("btn-next-2")?.addEventListener("click", async () => {
    if (!state.cats.length) { SC.toastError("Adicione pelo menos uma categoria."); return; }
    const btn = document.getElementById("btn-next-2");
    btn.disabled = true; btn.classList.add("loading");
    try {
      await SC.api("/categories/bulk", { method: "POST", body: JSON.stringify({ names: state.cats }) });
      goTo(3);
    } catch (err) {
      SC.toastError(err.message || "Erro ao salvar categorias.");
    } finally {
      btn.disabled = false; btn.classList.remove("loading");
    }
  });

  function updateCatSelect() {
    const sel = document.getElementById("s3-category");
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecionar</option>' + state.cats.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join("");
  }

  // ── Step 3: First item ────────────────────────────────────────────────────
  document.querySelectorAll('input[name="s3-condition"]').forEach(r => {
    r.closest("label").addEventListener("click", () => {
      document.querySelectorAll('input[name="s3-condition"]').forEach(rx => {
        const lbl = rx.closest("label");
        lbl.style.borderColor = rx.checked ? "var(--color-primary)" : "var(--color-border)";
        lbl.style.background  = rx.checked ? "var(--color-primary-light)" : "";
      });
    });
  });
  // Set initial active style
  setTimeout(() => { document.querySelector('input[name="s3-condition"]:checked')?.closest("label")?.click(); }, 50);

  document.getElementById("btn-prev-3")?.addEventListener("click", () => goTo(2));
  document.getElementById("btn-skip-3")?.addEventListener("click", () => goTo(4));
  document.getElementById("btn-next-3")?.addEventListener("click", async () => {
    const name = document.getElementById("s3-name")?.value.trim();
    if (!name) { SC.toastError("Nome do item é obrigatório."); return; }
    const btn = document.getElementById("btn-next-3");
    btn.disabled = true; btn.classList.add("loading");
    const condition = document.querySelector('input[name="s3-condition"]:checked')?.value || "OTIMO";
    try {
      await SC.api("/items", { method: "POST", body: JSON.stringify({ name, quantity: parseInt(document.getElementById("s3-qty")?.value) || 1, condition, categoryName: document.getElementById("s3-category")?.value || null }) });
      state.item = name;
      goTo(4);
    } catch (err) {
      SC.toastError(err.message || "Erro ao salvar item.");
    } finally {
      btn.disabled = false; btn.classList.remove("loading");
    }
  });

  // ── Step 4: Team ──────────────────────────────────────────────────────────
  function renderInvites() {
    const list = document.getElementById("invite-list");
    if (!list) return;
    list.innerHTML = state.invites.map((inv, i) =>
      `<div class="invite-chip">
        <span class="chip-email">${escHtml(inv.email)}</span>
        <span class="chip-role">${escHtml({ manager: "Gestor", operator: "Operador", viewer: "Visualizador" }[inv.role] || inv.role)}</span>
        <button class="chip-del" data-i="${i}" aria-label="Remover">×</button>
      </div>`
    ).join("");
    list.querySelectorAll(".chip-del").forEach(btn => {
      btn.addEventListener("click", () => { state.invites.splice(parseInt(btn.dataset.i), 1); renderInvites(); });
    });
  }

  document.getElementById("btn-add-invite")?.addEventListener("click", () => {
    const email = document.getElementById("invite-email")?.value.trim();
    const role  = document.getElementById("invite-role")?.value || "operator";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { SC.toastError("E-mail inválido."); return; }
    if (state.invites.find(i => i.email === email)) { SC.toastWarning("E-mail já adicionado."); return; }
    state.invites.push({ email, role });
    renderInvites();
    document.getElementById("invite-email").value = "";
  });

  document.getElementById("btn-prev-4")?.addEventListener("click", () => goTo(3));
  document.getElementById("btn-skip-4")?.addEventListener("click", () => goTo(5));
  document.getElementById("btn-next-4")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-next-4");
    btn.disabled = true; btn.classList.add("loading");
    try {
      if (state.invites.length) {
        await SC.api("/organizations/me/invites/bulk", { method: "POST", body: JSON.stringify({ invites: state.invites }) });
      }
      goTo(5);
    } catch (err) {
      SC.toastError(err.message || "Erro ao enviar convites.");
    } finally {
      btn.disabled = false; btn.classList.remove("loading");
    }
  });

  // ── Step 5: Goal ──────────────────────────────────────────────────────────
  // Pre-fill dates
  const today = new Date(); today.setSeconds(0,0);
  const endDefault = new Date(); endDefault.setMonth(endDefault.getMonth() + 3);
  const s5Start = document.getElementById("s5-start");
  const s5End   = document.getElementById("s5-end");
  if (s5Start) s5Start.value = today.toISOString().slice(0,10);
  if (s5End)   s5End.value   = endDefault.toISOString().slice(0,10);

  document.getElementById("btn-prev-5")?.addEventListener("click", () => goTo(4));
  document.getElementById("btn-skip-5")?.addEventListener("click",  showDone);
  document.getElementById("btn-finish")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-finish");
    btn.disabled = true; btn.classList.add("loading");
    const target = parseInt(document.getElementById("s5-target")?.value);
    try {
      if (target && target > 0) {
        await SC.api("/collection-goals", { method: "POST", body: JSON.stringify({
          target,
          startDate: document.getElementById("s5-start")?.value || null,
          endDate:   document.getElementById("s5-end")?.value   || null,
          description: document.getElementById("s5-desc")?.value.trim() || null,
        }) });
      }
      await SC.api("/users/me", { method: "PATCH", body: JSON.stringify({ onboardingCompleted: true }) });
      showDone();
    } catch (err) {
      SC.toastError(err.message || "Erro ao salvar meta.");
      btn.disabled = false; btn.classList.remove("loading");
    }
  });

  // ── Skip all ──────────────────────────────────────────────────────────────
  document.getElementById("btn-skip")?.addEventListener("click", () => {
    if (confirm("Pular configuração? Você pode configurar depois em Configurações.")) {
      window.location.href = "index.html";
    }
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function escHtml(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }
});
