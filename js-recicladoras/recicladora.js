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
  const currentYear = new Date().getFullYear();

  function esc(value) {
    return SC.escHtml(String(value || ""));
  }

  function getStatusLabel(status) {
    const normalized = String(status || "pendente").toLowerCase();
    if (normalized === "coleta_agendada") return "Agendada";
    if (normalized === "concluida") return "Concluída";
    if (normalized === "pendente") return "Pendente";
    if (normalized === "recusada") return "Recusada";
    return String(status || "Pendente");
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
          '<tr><td colspan="4" style="text-align:center;">Nenhuma coleta concluída encontrada neste ano.</td></tr>';
        return;
      }

      historyTableBody.innerHTML = rows
        .map((row) => {
          const retiradaDate = row.scheduled_date
            ? new Date(row.scheduled_date).toLocaleDateString("pt-BR")
            : "-";
          return `
            <tr>
              <td>${esc(String(row.id || "").toUpperCase())}</td>
              <td>${esc(row.org_name)}</td>
              <td>${esc(retiradaDate)}</td>
              <td>${esc(getStatusLabel(row.status))}</td>
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
    const title = btnHistory2026.querySelector(".history-title");
    if (title) title.textContent = `Histórico de Coleta ${currentYear}`;
    btnHistory2026.addEventListener("click", () =>
      openHistoryModal(currentYear),
    );
  }

  if (btnHistoryMore) {
    btnHistoryMore.addEventListener("click", () =>
      openHistoryModal(currentYear),
    );
  }

  if (closeHistoryModal) {
    closeHistoryModal.addEventListener("click", closeModal);
  }

  if (historyModal) {
    historyModal.addEventListener("click", (event) => {
      if (event.target === historyModal) closeModal();
    });
  }

  const initialYear = parseInt(
    new URLSearchParams(window.location.search).get("open_history"),
    10,
  );
  if (Number.isFinite(initialYear)) {
    openHistoryModal(initialYear);
  }

  loadPartners();
})();
