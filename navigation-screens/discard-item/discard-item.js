document.addEventListener("DOMContentLoaded", () => {
  // Notificações customizadas (padrão do sistema)
  const notify = {
    _base(message, type) {
      document
        .querySelectorAll(".notification-loading")
        .forEach((n) => n.remove());

      const notification = document.createElement("div");
      notification.classList.add("notification", `notification-${type}`);
      notification.innerHTML = message;

      document.body.appendChild(notification);

      setTimeout(() => {
        notification.classList.add("show");
      }, 10);

      if (type !== "loading") {
        setTimeout(() => {
          notification.classList.remove("show");
          setTimeout(() => {
            notification.remove();
          }, 500);
        }, 3000);
      }
    },
    success(message) {
      this._base(message, "success");
    },
    error(message) {
      this._base(message, "error");
    },
    critical(message) {
      this._base(message, "critical");
    },
    loading(message) {
      this._base(message, "loading");
    },
  };
  // Verifica se o usuário está logado
  const rawUser = localStorage.getItem("sc_user");
  if (!rawUser) {
    window.location.href = "/acesso/login/login.html";
    return;
  }
  const user = JSON.parse(rawUser);

  const container = document.getElementById("itemsContainer");
  const discardButton = document.querySelector(".btn-discard button");

  if (!container || !discardButton) {
    console.error("Elementos da tela de descarte não encontrados.");
    return;
  }

  carregarItens();

  async function carregarItens() {
    container.innerHTML = `<p style="color:#89ffdb;">Carregando itens...</p>`;

    try {
      const resp = await fetch(
        `/api/home?organization_id=${user.organization_id}`,
      );
      const data = await resp.json();

      if (!resp.ok || !data.success) {
        console.error("Erro ao carregar /api/home:", data);
        container.innerHTML = `<p style="color:#ff7b72;">Erro ao carregar itens.</p>`;
        return;
      }

      // Usa apenas os itens realmente disponíveis para descarte
      const itens = data.itensDisponiveisParaDescarte || [];
      renderizarCards(itens);
    } catch (err) {
      console.error("Erro ao buscar itens:", err);
      container.innerHTML = `<p style="color:#ff7b72;">Erro de conexão ao carregar itens.</p>`;
    }
  }

  function renderizarCards(itens) {
    if (!itens.length) {
      container.innerHTML = `<p style="color:#9ca3af;">Nenhum item disponível para descarte.</p>`;
      discardButton.disabled = true;
      return;
    }

    container.innerHTML = "";

    itens.forEach((item) => {
      const card = document.createElement("div");
      card.className = "item";
      card.dataset.id = item.id; // ID REAL DO BANCO

      const label = item.condition_label || "";
      const dotClass = mapConditionToDot(item.condition_code);
      const foto = item.id
        ? `/api/items/${item.id}/photo`
        : "https://via.placeholder.com/80";

      card.innerHTML = `
        <img src="${foto}" alt="${item.product_name}" />
        <div class="item-info">
          <h4>${item.product_name}</h4>
          <p>${(item.brand || "") + (item.model ? " - " + item.model : "")}</p>
          <div class="status">
            <span class="dot ${dotClass}"></span>
            ${label}
          </div>
        </div>
      `;

      // Click no card = seleciona / desmarca
      card.addEventListener("click", () => {
        card.classList.toggle("selected");
        updateDiscardButtonState();
      });

      container.appendChild(card);
    });

    updateDiscardButtonState();
  }

  function mapConditionToDot(code) {
    switch (code) {
      case "OTIMO":
        return "green";
      case "REPARO":
        return "yellow";
      case "DESCARTAR":
        return "red";
      default:
        return "green";
    }
  }

  function updateDiscardButtonState() {
    const qtd = container.querySelectorAll(".item.selected").length;
    discardButton.disabled = qtd === 0;
  }

  // --- Clique no botão DESCARTAR ---
  let pendingItemIds = [];
  const modal = document.getElementById("modal-confirm-discard");
  const btnConfirm = document.getElementById("btn-confirm-discard");
  const btnCancel = document.getElementById("btn-cancel-discard");

  discardButton.addEventListener("click", () => {
    const selecionados = Array.from(
      container.querySelectorAll(".item.selected"),
    );
    if (!selecionados.length) return;
    const itemIds = selecionados
      .map((el) => el.dataset.id)
      .filter((id) => id !== undefined && id !== null && id !== "")
      .map((id) => Number(id))
      .filter((n) => !Number.isNaN(n));
    if (!itemIds.length) {
      notify.error("Nenhum item selecionado com ID válido.");
      return;
    }
    pendingItemIds = itemIds;

    const msg = document.getElementById("modal-confirm-msg");
    if (msg) {
      msg.textContent =
        itemIds.length === 1
          ? "Tem certeza que deseja descartar o item selecionado?"
          : "Tem certeza que deseja descartar os itens selecionados?";
    }
    modal.style.display = "flex";
  });

  btnCancel.addEventListener("click", () => {
    modal.style.display = "none";
    pendingItemIds = [];
  });

  btnConfirm.addEventListener("click", async () => {
    if (!pendingItemIds.length) {
      modal.style.display = "none";
      return;
    }
    discardButton.disabled = true;
    discardButton.textContent = "Descartando...";
    notify.loading("Descartando itens...");
    modal.style.display = "none";
    try {
      const resp = await fetch("/api/items/discard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: user.organization_id,
          created_by: user.user_id,
          item_ids: pendingItemIds,
        }),
      });
      const result = await resp.json().catch(() => ({}));
      if (resp.ok && result.success) {
        notify.success(
          "Itens descartados e registrados no histórico com sucesso!",
        );
        await carregarItens();
      } else {
        console.error(result);
        notify.error(result.message || "Erro ao descartar itens.");
      }
    } catch (err) {
      console.error("Erro ao descartar itens:", err);
      notify.critical("Erro ao conectar ao servidor.");
    } finally {
      discardButton.textContent = "DESCARTAR";
      updateDiscardButtonState();
      pendingItemIds = [];
    }
  });
});
