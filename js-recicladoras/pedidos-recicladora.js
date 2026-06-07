(function bootPedidosRecicladora() {
  if (!window.SC || !window.SC.ready) {
    document.addEventListener("sc:ready", bootPedidosRecicladora, {
      once: true,
    });
    return;
  }

  const orderCountBadge = document.getElementById("orderCountBadge");
  const recyclerLogo = document.getElementById("recyclerLogo");
  const recyclerName = document.getElementById("recyclerName");
  const recyclerMeta = document.getElementById("recyclerMeta");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const orgSwitcher = document.getElementById("orgSwitcher");
  const ordersTableBody = document.getElementById("ordersTableBody");
  const mobileOrderList = document.getElementById("mobileOrderList");
  const btnHeaderDetails = document.getElementById("btnHeaderDetails");
  const btnHeaderSchedule = document.getElementById("btnHeaderSchedule");
  let availableOrgs = [];

  function getInitial(name) {
    if (!name) return "?";
    return name.trim()[0].toUpperCase();
  }

  function getStatusBadge(status) {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "concluida") return "badge badge-primary";
    if (normalized === "coleta_agendada") return "badge badge-success";
    if (normalized === "pendente") return "badge badge-warning";
    if (normalized === "recusada") return "badge badge-danger";
    return "badge badge-secondary";
  }

  function getStatusLabel(status) {
    const normalized = String(status || "pendente").toLowerCase();
    if (normalized === "coleta_agendada") return "Agendada";
    if (normalized === "concluida") return "Concluída";
    if (normalized === "pendente") return "Pendente";
    if (normalized === "recusada") return "Recusada";
    return String(status || "Pendente");
  }

  function isSchedulable(status) {
    const normalized = String(status || "").toLowerCase();
    return normalized === "aprovada";
  }

  function esc(value) {
    return SC.escHtml(String(value || ""));
  }

  function buildOrderActions(orderId, isApproved) {
    const detailsButton = `
      <button class="btn btn-primary btn-sm" type="button" onclick="window.location.href='/recicladora/detalhes-pedido.html?solicitacao_id=${encodeURIComponent(
        orderId,
      )}'">Detalhes</button>
    `;

    const scheduleButton = isApproved
      ? `
      <button class="btn btn-primary btn-sm" type="button" onclick="window.location.href='/recicladora/agendamento-coleta.html?solicitacao_id=${encodeURIComponent(
        orderId,
      )}'">Agendar coleta</button>
    `
      : "";

    return {
      details: `<div class="order-actions">${detailsButton}</div>`,
      schedule: scheduleButton
        ? `<div class="order-actions">${scheduleButton}</div>`
        : '<span class="order-meta">-</span>',
      mobile: `<div class="order-actions">${detailsButton}${scheduleButton}</div>`,
    };
  }

  function buildOrderRow(order, index, orgName) {
    const description = order.item || order.obs || "Sem descrição";
    const statusText = order.status
      ? String(order.status).toLowerCase()
      : "pendente";
    const isApproved = isSchedulable(statusText);
    const orderNumber = `Pedido ${index + 1}`;
    const actions = buildOrderActions(order.id, isApproved);

    return `
      <tr>
        <td>
          <div class="order-title">${esc(orderNumber)}</div>
          <div class="order-meta">${esc(description)}</div>
        </td>
        <td>
          <span class="${getStatusBadge(statusText)}">${esc(getStatusLabel(order.status))}</span>
        </td>
        <td>${esc(orgName)}</td>
        <td style="text-align:center;">
          ${actions.details}
        </td>
        <td style="text-align:center;">
          ${actions.schedule}
        </td>
      </tr>
    `;
  }

  function buildMobileOrder(order, index, orgName) {
    const description = order.item || order.obs || "Sem descrição";
    const statusText = order.status
      ? String(order.status).toLowerCase()
      : "pendente";
    const isApproved = isSchedulable(statusText);
    const actions = buildOrderActions(order.id, isApproved);

    return `
      <div class="mobile-order-card">
        <div class="mobile-order-header">
          <div>
            <div class="order-title">Pedido ${index + 1}</div>
            <div class="order-meta">${esc(description)}</div>
            <div class="order-meta">ONG: ${esc(orgName)}</div>
          </div>
          <span class="${getStatusBadge(statusText)}">${esc(getStatusLabel(order.status))}</span>
        </div>
        <div class="mobile-order-actions">
          ${actions.mobile}
        </div>
      </div>
    `;
  }

  function updateHeader(orgName, count) {
    if (recyclerName) recyclerName.textContent = orgName;
    if (recyclerLogo) recyclerLogo.textContent = getInitial(orgName);
    if (recyclerMeta)
      recyclerMeta.textContent =
        count > 0
          ? `Parceiro com ${count} pedido${count === 1 ? "" : "s"} aguardando coleta.`
          : "Nenhum pedido encontrado para esta ONG.";
    if (pageSubtitle)
      pageSubtitle.textContent = `Pedidos pendentes de coleta de ${orgName}`;
    if (orderCountBadge)
      orderCountBadge.textContent = `${count} pedido${count === 1 ? "" : "s"}`;
  }

  function updateHeaderButtons(orders) {
    if (!orders || !orders.length) {
      if (btnHeaderDetails) btnHeaderDetails.disabled = true;
      if (btnHeaderSchedule) btnHeaderSchedule.disabled = true;
      return;
    }
    const firstOrder = orders[0];
    const approvedOrders = orders.filter((o) => isSchedulable(o.status));

    if (btnHeaderDetails) {
      btnHeaderDetails.disabled = false;
      btnHeaderDetails.onclick = () =>
        (window.location.href = `/recicladora/detalhes-pedido.html?solicitacao_id=${encodeURIComponent(
          firstOrder.id,
        )}`);
    }
    if (btnHeaderSchedule) {
      if (approvedOrders.length) {
        const params = new URLSearchParams();
        approvedOrders.forEach((order) => {
          params.append("solicitacao_id", order.id);
        });

        btnHeaderSchedule.disabled = false;
        btnHeaderSchedule.onclick = () =>
          (window.location.href = `/recicladora/agendamento-coleta.html?${params.toString()}`);
      } else {
        btnHeaderSchedule.disabled = true;
      }
    }
  }

  function renderOrders(orders, orgName) {
    if (!orders || !orders.length) {
      if (ordersTableBody)
        ordersTableBody.innerHTML =
          "<tr><td colspan=5>Não há pedidos de coleta para esta ONG.</td></tr>";
      if (mobileOrderList)
        mobileOrderList.innerHTML =
          '<div class="mobile-order-card">Nenhum pedido de coleta encontrado.</div>';
      updateHeader(orgName, 0);
      updateHeaderButtons([]);
      return;
    }

    if (ordersTableBody)
      ordersTableBody.innerHTML = orders
        .map((order, index) => buildOrderRow(order, index, orgName))
        .join("");

    if (mobileOrderList)
      mobileOrderList.innerHTML = orders
        .map((order, index) => buildMobileOrder(order, index, orgName))
        .join("");

    updateHeader(orgName, orders.length);
    updateHeaderButtons(orders);
  }

  function updateRoute(orgId, orgName) {
    const nextParams = new URLSearchParams(window.location.search);
    nextParams.set("org_id", orgId);
    nextParams.set("org_name", orgName || "ONG");
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${nextParams.toString()}`,
    );
  }

  function renderOrgSwitcher(selectedOrgId) {
    if (!orgSwitcher) return;
    if (!availableOrgs.length) {
      orgSwitcher.innerHTML = "";
      return;
    }

    orgSwitcher.innerHTML = availableOrgs
      .map((org) => {
        const isActive = String(org.id) === String(selectedOrgId);
        return `
          <button
            type="button"
            class="org-chip${isActive ? " is-active" : ""}"
            data-org-id="${esc(org.id)}"
            data-org-name="${esc(org.name || "ONG")}">
            ${esc(org.name || "ONG")}
          </button>
        `;
      })
      .join("");

    orgSwitcher.querySelectorAll(".org-chip").forEach((button) => {
      button.addEventListener("click", () => {
        const nextOrgId = button.getAttribute("data-org-id");
        const nextOrgName = button.getAttribute("data-org-name") || "ONG";
        if (!nextOrgId || String(nextOrgId) === String(selectedOrgId)) return;
        updateRoute(nextOrgId, nextOrgName);
        loadOrders();
      });
    });
  }

  async function resolveOrganizationFromRoute() {
    const params = new URLSearchParams(window.location.search);
    const orgId = params.get("org_id");
    const orgName = params.get("org_name")
      ? decodeURIComponent(params.get("org_name"))
      : "";

    if (orgId) {
      return { orgId, orgName: orgName || "ONG" };
    }

    const fallbackOrg =
      availableOrgs.find((org) => (parseInt(org.request_count, 10) || 0) > 0) ||
      availableOrgs[0] ||
      null;

    if (!fallbackOrg) {
      return null;
    }

    updateRoute(fallbackOrg.id, fallbackOrg.name || "ONG");

    return {
      orgId: String(fallbackOrg.id),
      orgName: fallbackOrg.name || "ONG",
    };
  }

  async function loadOrders() {
    let routeInfo;

    try {
      const data = await SC.api("/recycler/ongs/solicitacoes");
      availableOrgs = Array.isArray(data) ? data : data.ongs || [];
      routeInfo = await resolveOrganizationFromRoute();
    } catch (err) {
      console.error("Erro ao resolver ONG da rota:", err);
    }

    const orgId = routeInfo?.orgId || null;
    const orgName = routeInfo?.orgName || "ONG";

    renderOrgSwitcher(orgId);

    if (!orgId) {
      if (ordersTableBody)
        ordersTableBody.innerHTML =
          "<tr><td colspan=5>Nenhuma ONG disponível para visualizar pedidos.</td></tr>";
      if (mobileOrderList)
        mobileOrderList.innerHTML =
          '<div class="mobile-order-card">Nenhuma ONG disponível para visualizar pedidos.</div>';
      if (recyclerMeta)
        recyclerMeta.textContent =
          "Nenhuma ONG disponível para visualizar os pedidos.";
      updateHeader(orgName, 0);
      return;
    }

    try {
      const response = await SC.api(
        `/solicitacoes?organization_id=${encodeURIComponent(orgId)}`,
      );
      const orders = Array.isArray(response)
        ? response
        : response.solicitacoes || [];
      renderOrders(orders, orgName);
    } catch (err) {
      console.error("Erro ao carregar pedidos da ONG:", err);
      if (ordersTableBody)
        ordersTableBody.innerHTML =
          "<tr><td colspan=5>Erro ao carregar pedidos.</td></tr>";
      if (mobileOrderList)
        mobileOrderList.innerHTML =
          '<div class="mobile-order-card">Erro ao carregar pedidos da ONG.</div>';
      if (recyclerMeta)
        recyclerMeta.textContent = "Erro ao carregar pedidos desta ONG.";
      updateHeader(orgName, 0);
    }
  }

  loadOrders();
})();
