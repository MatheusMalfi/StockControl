(function bootDetalhesPedido() {
  if (!window.SC || !window.SC.ready) {
    document.addEventListener("sc:ready", bootDetalhesPedido, { once: true });
    return;
  }

  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const orgInitial = document.getElementById("orgInitial");
  const orgName = document.getElementById("orgName");
  const orgMeta = document.getElementById("orgMeta");
  const orderCode = document.getElementById("orderCode");
  const productsCount = document.getElementById("productsCount");
  const totalWeight = document.getElementById("totalWeight");
  const totalValue = document.getElementById("totalValue");
  const valueCurrency = document.getElementById("valueCurrency");
  const statusBadge = document.getElementById("statusBadge");
  const itemsTableBody = document.getElementById("itemsTableBody");
  const scheduleBtn = document.getElementById("scheduleBtn");
  const scheduleBtn2 = document.getElementById("scheduleBtn2");

  function esc(value) {
    return SC.escHtml(String(value || ""));
  }

  function getInitial(name) {
    if (!name) return "?";
    return name.trim()[0].toUpperCase();
  }

  function formatCurrency(value, currency) {
    if (!value) return "-";
    const num = parseFloat(value);
    if (isNaN(num)) return "-";
    return `${currency === "USD" ? "$" : "R$"} ${num.toFixed(2)}`;
  }

  function getStatusColor(status) {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "concluída" || normalized === "coleta_agendada")
      return "badge-success";
    if (normalized === "pendente") return "badge-warning";
    if (normalized === "recusada") return "badge-danger";
    return "badge-secondary";
  }

  function buildItemRow(item, index) {
    const location = item.storage_location || "Sem localização";
    const value = formatCurrency(item.estimated_value, item.currency);
    const weightText = item.weight_kg ? `${item.weight_kg} kg` : "-";

    return `
      <tr>
        <td>
          <div class="product-cell">
            <div class="product-icon">${index + 1}</div>
            <div>
              <div class="product-title">${esc(item.product_name)}</div>
              <div class="product-description">${esc(item.brand_name || "")} ${esc(item.model_name || "")}</div>
            </div>
          </div>
        </td>
        <td>${esc(location)}</td>
        <td>${esc(weightText)}</td>
        <td>${esc(value)}</td>
        <td>${item.quantity || 1} unidade${item.quantity === 1 ? "" : "s"}</td>
      </tr>
    `;
  }

  function calculateTotals(items) {
    let totalWeightValue = 0;
    let totalValueValue = 0;
    let currency = "BRL";

    items.forEach((item) => {
      if (item.weight_kg) {
        totalWeightValue += parseFloat(item.weight_kg) || 0;
      }
      if (item.estimated_value) {
        totalValueValue += parseFloat(item.estimated_value) || 0;
      }
      if (item.currency) {
        currency = item.currency;
      }
    });

    return {
      weight: totalWeightValue,
      value: totalValueValue,
      currency,
    };
  }

  function renderSolicitacao(solicitacao, items) {
    const statusText = solicitacao.status || "pendente";
    const normalizedStatus = String(statusText).toLowerCase();
    const isApproved =
      normalizedStatus === "concluida" || normalizedStatus === "concluída";

    if (pageTitle)
      pageTitle.textContent = `Detalhe do Pedido #${solicitacao.id.substring(0, 8)}`;
    if (pageSubtitle)
      pageSubtitle.textContent = `Solicitação de ${solicitacao.org_name}`;

    if (orgInitial) orgInitial.textContent = getInitial(solicitacao.org_name);
    if (orgName) orgName.textContent = solicitacao.org_name;
    if (orgMeta) orgMeta.textContent = `Controle de Estoque • Pedido de coleta`;
    if (orderCode) orderCode.textContent = `${solicitacao.id.substring(0, 8)}`;

    if (statusBadge) {
      statusBadge.className = `badge ${getStatusColor(statusText)}`;
      statusBadge.textContent =
        statusText.charAt(0).toUpperCase() + statusText.slice(1);
    }

    if (itemsTableBody) {
      if (!items || !items.length) {
        itemsTableBody.innerHTML =
          "<tr><td colspan=5>Nenhum item encontrado nesta solicitação.</td></tr>";
      } else {
        itemsTableBody.innerHTML = items
          .map((item, index) => buildItemRow(item, index))
          .join("");
      }
    }

    const totals = calculateTotals(items || []);
    if (productsCount) productsCount.textContent = (items || []).length;
    if (totalWeight) totalWeight.textContent = `${totals.weight.toFixed(3)} kg`;
    if (totalValue)
      totalValue.textContent = formatCurrency(totals.value, totals.currency);
    if (valueCurrency) valueCurrency.textContent = `em ${totals.currency}`;

    if (scheduleBtn && scheduleBtn2) {
      if (isApproved) {
        scheduleBtn.style.display = "block";
        scheduleBtn2.style.display = "block";
        scheduleBtn.onclick = () =>
          (window.location.href = `/recicladora/agendamento-coleta.html?solicitacao_id=${encodeURIComponent(
            solicitacao.id,
          )}`);
        scheduleBtn2.onclick = () =>
          (window.location.href = `/recicladora/agendamento-coleta.html?solicitacao_id=${encodeURIComponent(
            solicitacao.id,
          )}`);
      } else {
        scheduleBtn.style.display = "none";
        scheduleBtn2.style.display = "none";
      }
    }
  }

  async function loadDetalhe() {
    const params = new URLSearchParams(window.location.search);
    const solicitacaoId = params.get("solicitacao_id");

    if (!solicitacaoId) {
      if (itemsTableBody)
        itemsTableBody.innerHTML =
          "<tr><td colspan=5>Parâmetro solicitacao_id não informado.</td></tr>";
      return;
    }

    try {
      const response = await SC.api(
        `/solicitacoes/${encodeURIComponent(solicitacaoId)}/detalhes`,
      );

      if (!response.success) {
        throw new Error(response.message || "Erro ao carregar dados");
      }

      renderSolicitacao(response.solicitacao, response.items || []);
    } catch (err) {
      console.error("Erro ao carregar detalhes:", err);
      if (itemsTableBody)
        itemsTableBody.innerHTML =
          "<tr><td colspan=5>Erro ao carregar detalhes da solicitação.</td></tr>";
      if (orgMeta)
        orgMeta.textContent = "Erro ao carregar dados da solicitação.";
    }
  }

  loadDetalhe();
})();
