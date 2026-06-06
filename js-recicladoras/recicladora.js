(function bootRecicladora() {
  if (!window.SC || !window.SC.ready) {
    document.addEventListener("sc:ready", bootRecicladora, { once: true });
    return;
  }

  const partnerList = document.getElementById("partnerList");
  const partnerTotalBadge = document.getElementById("partnerTotalBadge");
  const historyModal = document.getElementById("historyModal");
  const historyYear = document.getElementById("historyYear");
  const historyTableBody = document.getElementById("historyTableBody");
  const closeHistoryModal = document.getElementById("closeHistoryModal");
  const btnHistory2026 = document.getElementById("btnHistory2026");
  const btnHistoryMore = document.getElementById("btnHistoryMore");

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
    const metaText =
      count === 0
        ? "Sem solicitações de coleta"
        : `${count} solicitações de coleta`;

    const href = `/recicladora/pedidos-recicladora.html?org_id=${encodeURIComponent(
      org.id,
    )}&org_name=${encodeURIComponent(org.name)}`;

    return `
      <a href="${href}" class="partner-card">
        <div class="partner-logo ${logoClass}">${getInitial(org.name)}</div>
        <div class="partner-info">
          <div class="partner-name-row">
            <div class="partner-name">${esc(org.name)}</div>
          </div>
          <div class="partner-meta">${esc(metaText)}</div>
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
      const total = items.reduce(
        (sum, org) => sum + (parseInt(org.request_count, 10) || 0),
        0,
      );
      partnerTotalBadge.textContent = `${total} solicitações`;
    }
  }

  function closeModal() {
    if (historyModal) historyModal.classList.remove("is-open");
  }

  async function openHistoryModal(year) {
    if (!historyModal || !historyTableBody) return;
    if (historyYear) historyYear.textContent = year;
    historyModal.classList.add("is-open");
    historyTableBody.innerHTML =
      '<tr><td colspan="4" style="text-align:center;">Carregando histórico...</td></tr>';

    try {
      const data = await SC.api(
        `/recycler/collections/history?year=${encodeURIComponent(year)}`,
      );
      const rows = Array.isArray(data) ? data : data.history || [];

      if (!rows.length) {
        historyTableBody.innerHTML =
          '<tr><td colspan="4" style="text-align:center;">Nenhum agendamento encontrado neste ano.</td></tr>';
        return;
      }

      historyTableBody.innerHTML = rows
        .map((row) => {
          const scheduledDate = row.scheduled_date
            ? new Date(row.scheduled_date + "T00:00:00").toLocaleDateString(
                "pt-BR",
              )
            : "-";
          return `
            <tr>
              <td>${esc(
                String(row.id || "")
                  .substring(0, 8)
                  .toUpperCase(),
              )}</td>
              <td>${esc(row.org_name)}</td>
              <td>${esc(scheduledDate)}</td>
              <td>${esc(row.status)}</td>
            </tr>
          `;
        })
        .join("");
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
      historyTableBody.innerHTML =
        '<tr><td colspan="4" style="text-align:center;">Erro ao carregar histórico.</td></tr>';
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

  if (btnHistory2026) {
    btnHistory2026.addEventListener("click", () => openHistoryModal(2026));
  }

  if (btnHistoryMore) {
    btnHistoryMore.addEventListener("click", () => openHistoryModal(2026));
  }

  if (closeHistoryModal) {
    closeHistoryModal.addEventListener("click", closeModal);
  }

  if (historyModal) {
    historyModal.addEventListener("click", (event) => {
      if (event.target === historyModal) closeModal();
    });
  }

  const initialYear = new URLSearchParams(window.location.search).get(
    "open_history",
  );
  if (initialYear) {
    openHistoryModal(initialYear);
  }

  loadPartners();
})();
