function getQueryParam(param) {
  return new URLSearchParams(window.location.search).get(param);
}

document.addEventListener("DOMContentLoaded", async () => {
  const rawUser = localStorage.getItem("sc_user");
  if (!rawUser) {
    return (window.location.href = "/acesso/login/login.html");
  }

  const user = JSON.parse(rawUser);

  if (user.org_type !== "RECYCLER" && user.role !== "ADMIN") {
    return (window.location.href = "/navigation-screens/home/home.html");
  }

  const orgId  = getQueryParam("org_id");
  const ongName = getQueryParam("ong");

  const h4 = document.querySelector(".ong-container h4");
  if (h4 && ongName) h4.textContent = ongName;

  const painelExterno = document.querySelector(".painel-externo");

  if (!orgId) {
    if (painelExterno) painelExterno.style.display = "none";
    const erro = document.createElement("div");
    erro.style.cssText = "color:#ff2d2d;text-align:center;font-size:1.5rem;margin-top:60px;";
    erro.textContent = "Erro: Nenhuma ONG selecionada. Volte e selecione uma ONG.";
    document.body.appendChild(erro);
    return;
  }

  await carregarPedidos(orgId);

  async function carregarPedidos(orgId) {
    const container = document.querySelector(".painel-externo") || document.body;

    try {
      const resp = await fetch(`/api/recycler/orders?org_id=${orgId}&status=REQUESTED`);
      const data = await resp.json();

      if (!resp.ok || !data.success || !data.orders.length) {
        container.innerHTML += "<p style='color:#9ca3af;text-align:center;margin-top:2rem;'>Nenhum pedido pendente para esta ONG.</p>";
        return;
      }

      // Carrega o primeiro pedido pendente (mais recente)
      const order = data.orders[0];
      await carregarDetalhes(order.id);
    } catch (err) {
      console.error("Erro ao carregar pedidos:", err);
    }
  }

  async function carregarDetalhes(orderId) {
    try {
      const resp = await fetch(`/api/recycler/orders/${orderId}`);
      const data = await resp.json();

      if (!resp.ok || !data.success) return;

      const order = data.order;
      const itemsContainer = document.getElementById("items-container") || criarContainerItens();

      if (!order.items.length) {
        itemsContainer.innerHTML = "<p style='color:#9ca3af;'>Nenhum item neste pedido.</p>";
        return;
      }

      itemsContainer.innerHTML = order.items.map((item) => `
        <div class="item-card" data-item-id="${item.id}">
          <img src="/api/items/${item.id}/photo" alt="${item.product_name}" onerror="this.style.display='none'" />
          <div class="item-info">
            <h4>${item.product_name}</h4>
            <p>${[item.brand, item.model].filter(Boolean).join(" - ") || "Sem marca/modelo"}</p>
            <p>${item.description || ""}</p>
            <span class="condition">${item.condition_label}</span>
          </div>
        </div>
      `).join("");

      // Botão de confirmar coleta
      let btnConfirm = document.getElementById("btn-confirm-pickup");
      if (!btnConfirm) {
        btnConfirm = document.createElement("button");
        btnConfirm.id = "btn-confirm-pickup";
        btnConfirm.textContent = "CONFIRMAR COLETA";
        btnConfirm.style.cssText = "margin:2rem auto;display:block;padding:1rem 2rem;background:#00c896;color:#fff;border:none;border-radius:8px;font-size:1rem;cursor:pointer;";
        itemsContainer.after(btnConfirm);
      }

      btnConfirm.addEventListener("click", async () => {
        btnConfirm.disabled = true;
        btnConfirm.textContent = "Confirmando...";

        try {
          const confirmResp = await fetch(`/api/recycler/orders/${orderId}/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recycler_user_id: user.user_id }),
          });
          const confirmData = await confirmResp.json();

          if (confirmResp.ok && confirmData.success) {
            btnConfirm.textContent = "Coleta confirmada!";
            btnConfirm.style.background = "#4caf50";
            setTimeout(() => {
              window.location.href =
                "/navigation-screens/impact-metais/home-impact-metais/home.html";
            }, 1500);
          } else {
            alert(confirmData.message || "Erro ao confirmar coleta.");
            btnConfirm.disabled = false;
            btnConfirm.textContent = "CONFIRMAR COLETA";
          }
        } catch (err) {
          console.error("Erro ao confirmar:", err);
          alert("Erro ao conectar ao servidor.");
          btnConfirm.disabled = false;
          btnConfirm.textContent = "CONFIRMAR COLETA";
        }
      });
    } catch (err) {
      console.error("Erro ao carregar detalhes:", err);
    }
  }

  function criarContainerItens() {
    const div = document.createElement("div");
    div.id = "items-container";
    div.style.cssText = "padding:1rem;";
    document.querySelector(".painel-externo")?.appendChild(div) || document.body.appendChild(div);
    return div;
  }
});
