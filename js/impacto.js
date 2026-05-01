"use strict";

(async function () {
  // ── Helpers ───────────────────────────────────────────────────────────────
  function escHtml(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d) ? "—" : d.toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric" });
  }
  function setEl(id, html, asText) {
    const el = document.getElementById(id);
    if (!el) return;
    if (asText) el.textContent = html;
    else el.innerHTML = html;
  }
  function animateCount(el, target, duration) {
    if (!el) return;
    const start = performance.now();
    const from  = 0;
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(from + (target - from) * eased).toLocaleString("pt-BR");
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ── API base (no auth — public page) ─────────────────────────────────────
  const BASE = "/api";
  async function api(path) {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ── Load all data ─────────────────────────────────────────────────────────
  let orgSlug = new URLSearchParams(location.search).get("org") || "";
  const qs = orgSlug ? `?org=${encodeURIComponent(orgSlug)}` : "";

  const [impact, goal, categories, donors, donations] = await Promise.allSettled([
    api(`/public/impact${qs}`),
    api(`/public/goal${qs}`),
    api(`/public/categories${qs}`),
    api(`/public/donors${qs}`),
    api(`/public/donations${qs}&limit=8`),
  ]).then(results => results.map(r => r.status === "fulfilled" ? r.value : null));

  // ── Org info ──────────────────────────────────────────────────────────────
  if (impact) {
    const name     = impact.orgName || "Organização";
    const initials = name.split(" ").slice(0,2).map(w => w[0]).join("").toUpperCase();
    setEl("org-initials", escHtml(initials), true);
    setEl("org-name",     escHtml(name),     true);
    if (impact.tagline) setEl("org-tagline", escHtml(impact.tagline), true);
    document.title = `Impacto Social — ${name}`;

    // Metrics
    const grid = document.getElementById("metric-grid");
    if (grid) {
      const metrics = [
        { icon: "📦", value: impact.totalCollected ?? 0, label: "Itens Arrecadados" },
        { icon: "🎁", value: impact.totalDonated    ?? 0, label: "Itens Doados" },
        { icon: "♻️", value: impact.kgRecycled       ?? 0, label: "Kg Reciclados" },
        { icon: "👨‍👩‍👧", value: impact.familiesServed ?? 0, label: "Famílias Atendidas" },
      ];
      grid.innerHTML = metrics.map(m => `
        <div class="metric-card">
          <div class="metric-icon">${m.icon}</div>
          <div class="metric-value" data-target="${m.value}">0</div>
          <div class="metric-label">${escHtml(m.label)}</div>
        </div>`).join("");
      grid.querySelectorAll(".metric-value[data-target]").forEach(el => {
        animateCount(el, parseInt(el.dataset.target) || 0, 1200);
      });
    }
  }

  // ── Goal ──────────────────────────────────────────────────────────────────
  if (goal) {
    const section = document.getElementById("goal-section");
    if (section) section.style.display = "block";
    const current = goal.current ?? 0;
    const target  = goal.target  ?? 1;
    const pct     = Math.min(Math.round((current / target) * 100), 100);
    const el = document.getElementById("goal-current");
    if (el) animateCount(el, current, 1000);
    setEl("goal-target", `meta: ${target.toLocaleString("pt-BR")} itens`, true);
    setTimeout(() => {
      const fill = document.getElementById("goal-fill");
      if (fill) fill.style.width = `${pct}%`;
    }, 200);
    setEl("goal-pct", `${pct}% concluído`, true);
    if (goal.endDate) {
      const days = Math.ceil((new Date(goal.endDate) - new Date()) / 86400000);
      setEl("goal-days", days > 0 ? `${days} dias restantes` : "Prazo encerrado", true);
    }
  }

  // ── Categories chart ──────────────────────────────────────────────────────
  const catEl = document.getElementById("cat-chart");
  if (catEl) {
    const cats = (categories?.items || categories || []).slice(0, 6);
    if (cats.length) {
      const max = Math.max(...cats.map(c => c.count || 0), 1);
      catEl.innerHTML = cats.map(c => `
        <div class="cat-bar-row">
          <span class="cat-bar-label" title="${escHtml(c.name)}">${escHtml(c.name)}</span>
          <div class="cat-bar-track">
            <div class="cat-bar-fill" style="width:${Math.round(((c.count||0)/max)*100)}%"></div>
          </div>
          <span class="cat-bar-val">${(c.count||0).toLocaleString("pt-BR")}</span>
        </div>`).join("");
    } else {
      catEl.innerHTML = `<p style="color:#94a3b8;font-size:13px;text-align:center">Sem dados disponíveis</p>`;
    }
  }

  // ── Donors ────────────────────────────────────────────────────────────────
  const donorsEl = document.getElementById("donors-list");
  if (donorsEl) {
    const list = (donors?.items || donors || []).slice(0, 5);
    if (list.length) {
      donorsEl.innerHTML = list.map((d, i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;${i < list.length-1 ? "border-bottom:1px solid var(--color-border)" : ""}">
          <div style="width:32px;height:32px;border-radius:8px;background:#DBEAFE;color:#1D4ED8;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">
            ${escHtml((d.name||"?")[0].toUpperCase())}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(d.name)}</div>
          </div>
          <span style="font-size:13px;font-weight:600;color:var(--color-primary)">${(d.totalDonated||0).toLocaleString("pt-BR")} itens</span>
        </div>`).join("");
    } else {
      donorsEl.innerHTML = `<p style="color:#94a3b8;font-size:13px;text-align:center">Nenhum doador ainda</p>`;
    }
  }

  // ── Donations timeline ────────────────────────────────────────────────────
  const tlEl = document.getElementById("donations-timeline");
  if (tlEl) {
    const items = donations?.items || donations || [];
    if (items.length) {
      tlEl.innerHTML = items.map(d => `
        <li class="timeline-entry">
          <div class="tl-dot">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </div>
          <div class="tl-body">
            <div class="tl-title">${d.quantity ?? d.qty ?? "?"} × ${escHtml(d.itemName || d.item?.name || "Item")}</div>
            <div class="tl-detail">Para: ${escHtml(d.destination || d.donor || "—")}</div>
            <div class="tl-date">${fmtDate(d.date || d.created_at || d.createdAt)}</div>
          </div>
        </li>`).join("");
    } else {
      tlEl.innerHTML = `<li style="color:#94a3b8;font-size:13px;text-align:center;padding:16px 0">Nenhuma doação registrada ainda</li>`;
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  setEl("updated-at", new Date().toLocaleString("pt-BR", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }), true);

  // ── Share ─────────────────────────────────────────────────────────────────
  document.getElementById("btn-copy-link")?.addEventListener("click", () => {
    navigator.clipboard.writeText(location.href).then(() => {
      const btn = document.getElementById("btn-copy-link");
      if (btn) { const prev = btn.textContent; btn.textContent = "Link copiado!"; setTimeout(() => btn.textContent = prev, 2000); }
    }).catch(() => {});
  });

  // ── Responsive 2-col ─────────────────────────────────────────────────────
  function handleResize() {
    const twoCol = document.getElementById("two-col");
    if (twoCol) twoCol.style.gridTemplateColumns = window.innerWidth < 640 ? "1fr" : "1fr 1fr";
  }
  window.addEventListener("resize", handleResize);
  handleResize();
})();
