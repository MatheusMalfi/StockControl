(function bootRecicladora() {
  if (!window.SC || !window.SC.ready) {
    document.addEventListener("sc:ready", bootRecicladora, { once: true });
    return;
  }

  const partnerList = document.getElementById("partnerList");
  const partnerTotalBadge = document.getElementById("partnerTotalBadge");

  function esc(value) {
    return SC.escHtml(String(value || ""));
  }

  function getInitial(name) {
    if (!name) return "?";
    return esc(name.trim()[0].toUpperCase());
  }

  function buildCard(org, index) {
    const colors = ["logo-impact", "logo-recicla", "logo-metal"];
    const logoClass = colors[index % colors.length];
    const count = parseInt(org.request_count, 10) || 0;
    const approved = parseInt(org.approved_count, 10) || 0;
    const approvedText =
      approved > 0
        ? `${approved} solicitação${approved === 1 ? "" : "ões"} aprovada${approved === 1 ? "" : "s"}`
        : count === 0
        ? "Sem solicitações de coleta"
        : `${count} solicitações de coleta`;

    return `
      <a href="/solicitacoes.html" class="partner-card${approved > 0 ? " partner-card--approved" : ""}">
        <div class="partner-logo ${logoClass}">${getInitial(org.name)}</div>
        <div class="partner-info">
          <div class="partner-name-row">
            <div class="partner-name">${esc(org.name)}</div>
            ${approved > 0 ? `<span class="partner-new-badge">${approved}</span>` : ""}
          </div>
          <div class="partner-meta">${esc(approvedText)}</div>
        </div>
        <div class="count-badge">${count}</div>
      </a>
    `;
  }

  function renderPartners(items) {
    if (!partnerList) return;

    if (!items || !items.length) {
      partnerList.innerHTML = `
        <div class="partner-card" style="justify-content:center;">
          Nenhuma ONG parceira cadastrada.
        </div>
      `;
      if (partnerTotalBadge) partnerTotalBadge.textContent = "0 solicitações";
      return;
    }

    partnerList.innerHTML = items.map(buildCard).join("");

    if (partnerTotalBadge) {
      const total = items.reduce((sum, org) => sum + (parseInt(org.request_count, 10) || 0), 0);
      partnerTotalBadge.textContent = `${total} solicitações`;
    }
  }

  async function loadPartners() {
    try {
      const data = await SC.api("/recycler/ongs/solicitacoes");
      const list = Array.isArray(data) ? data : data.ongs || [];
      renderPartners(list);
    } catch (err) {
      console.error("Erro ao carregar ONGs parceiras:", err);
      if (partnerList) {
        partnerList.innerHTML = `
          <div class="partner-card" style="justify-content:center;">
            Erro ao carregar ONGs parceiras.
          </div>
        `;
      }
      if (partnerTotalBadge) partnerTotalBadge.textContent = "Erro";
    }
  }

  loadPartners();
})();
