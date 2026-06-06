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
    if (value == null || value === "") return "-";
    const num = parseFloat(value);
    if (isNaN(num)) return "-";
    return `${currency === "USD" ? "$" : "R$"} ${num.toFixed(2)}`;
  }

  function parseNumeric(value) {
    if (value == null || value === "") return NaN;
    if (typeof value === "number") return value;
    let str = String(value).trim();
    if (!str) return NaN;

    // Remove currency symbols and non-numeric chars except digits, dot, comma, minus
    str = str.replace(/[^0-9\.,-]+/g, "");
    if (!str) return NaN;

    const hasComma = str.includes(",");
    const hasDot = str.includes(".");
    if (hasComma && !hasDot) {
      str = str.replace(/,/g, ".");
    } else if (hasComma && hasDot) {
      const lastComma = str.lastIndexOf(",");
      const lastDot = str.lastIndexOf(".");
      if (lastComma > lastDot) {
        str = str.replace(/\./g, "").replace(",", ".");
      } else {
        str = str.replace(/,/g, "");
      }
    }

    return parseFloat(str);
  }

  function getItemQuantity(item) {
    const rawQty = item.quantity ?? item.quantidade ?? item.total ?? item.qtd ?? 1;
    const qty = parseNumeric(rawQty);
    return Number.isFinite(qty) && qty >= 0 ? qty : 1;
  }

  function getItemAvailableQuantity(item) {
    const rawAvail =
      item.quantity_available ??
      item.disponivel ??
      item.disponivel_total ??
      item.available_quantity ??
      item.qtdDisponivel ??
      item.quantity ??
      item.quantidade;
    const avail = parseNumeric(rawAvail);
    return Number.isFinite(avail) && avail > 0 ? avail : null;
  }

  function getItemValue(item) {
    const totalValue = parseNumeric(
      item.estimated_value ??
        item.valor_estimado ??
        item.valor ??
        item.value ??
        item.valor_total ??
        item.total_value ??
        0,
    );

    const availableQty = parseNumeric(
      item.quantity_available ??
        item.disponivel ??
        item.disponivel_total ??
        item.available_quantity ??
        item.qtdDisponivel ??
        item.quantity ??
        item.quantidade ??
        item.total ??
        0,
    );

    const requestQty = parseNumeric(
      item.quantity ?? item.quantidade ?? item.total ?? item.qtd ?? 1,
    );

    if (!Number.isFinite(requestQty) || requestQty <= 0) return 0;
    if (Number.isFinite(totalValue) && totalValue > 0 && Number.isFinite(availableQty) && availableQty > 0) {
      return (totalValue / availableQty) * requestQty;
    }

    return Number.isFinite(totalValue) ? totalValue * requestQty : 0;
  }

  function getStatusColor(status) {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "concluida") return "badge-primary";
    if (normalized === "coleta_agendada") return "badge-success";
    if (normalized === "pendente") return "badge-warning";
    if (normalized === "recusada") return "badge-danger";
    return "badge-secondary";
  }

  function getStatusLabel(status) {
    const normalized = String(status || "pendente").toLowerCase();
    if (normalized === "coleta_agendada") return "Agendada";
    if (normalized === "concluida") return "Concluída";
    if (normalized === "pendente") return "Pendente";
    if (normalized === "recusada") return "Recusada";
    return String(status || "Pendente");
  }

  function buildItemRow(item, index) {
    const productName =
      item.product_name || item.nome_item || item.item || item.tipo || "Item";
    const location = item.storage_location || item.localizacao || "Sem localização";
    const quantity = parseNumeric(item.quantity ?? item.quantidade ?? item.total ?? item.qtd ?? 1);
    const itemValue = getItemValue(item);
    const value = formatCurrency(itemValue, item.currency || item.moeda);
    const weightText = item.weight_kg ? `${item.weight_kg} kg` : "-";

    return `
      <tr>
        <td>
          <div class="product-cell">
            <div class="product-icon">${index + 1}</div>
            <div>
              <div class="product-title">${esc(productName)}</div>
              <div class="product-description">${esc(item.brand_name || item.marca || "")} ${esc(item.model_name || item.modelo || "")}</div>
            </div>
          </div>
        </td>
        <td>${esc(location)}</td>
        <td>${esc(weightText)}</td>
        <td>${esc(value)}</td>
        <td>${esc(quantity)} unidade${quantity === 1 ? "" : "s"}</td>
      </tr>
    `;
  }

  function calculateTotals(items) {
    let totalValueValue = 0;
    let currency = "BRL";

    items.forEach((item) => {
      totalValueValue += getItemValue(item);
      if (item.currency) {
        currency = item.currency;
      }
    });

    return {
      value: totalValueValue,
      currency,
    };
  }

  function renderSolicitacao(solicitacao, items) {
    const statusText = solicitacao.status || "pendente";
    const normalizedStatus = String(statusText).toLowerCase();
    const isApproved =
      normalizedStatus === "concluida";

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
      statusBadge.textContent = getStatusLabel(statusText);
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
      console.debug("[detalhes-pedido] response:", response);

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
