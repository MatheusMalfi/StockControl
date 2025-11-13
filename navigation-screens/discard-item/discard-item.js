// navigation-screens/discard-item/discard-item.js

document.addEventListener("DOMContentLoaded", () => {
  // --- Verifica se o usuário está logado ---
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

  // Carrega itens do backend assim que a página abre
  carregarItens();

  async function carregarItens() {
    container.innerHTML = `<p style="color:#89ffdb;">Carregando itens...</p>`;

    try {
      const resp = await fetch(`/api/home?organization_id=${user.organization_id}`);
      const data = await resp.json();

      if (!resp.ok || !data.success) {
        console.error("Erro ao carregar /api/home:", data);
        container.innerHTML = `<p style="color:#ff7b72;">Erro ao carregar itens.</p>`;
        return;
      }

      // Pega itens da ONG que ainda NÃO estão com condição DESCARTAR
      const itens = (data.itens || []).filter(
        (i) => i.condition_code !== "DESCARTAR"
      );

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
      const foto = item.photo_url || "https://via.placeholder.com/80";

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
  discardButton.addEventListener("click", async () => {
    const selecionados = Array.from(
      container.querySelectorAll(".item.selected")
    );

    if (!selecionados.length) return;

    const itemIds = selecionados
      .map((el) => el.dataset.id)
      .filter((id) => id !== undefined && id !== null && id !== "")
      .map((id) => Number(id))
      .filter((n) => !Number.isNaN(n));

    if (!itemIds.length) {
      alert("Nenhum item selecionado com ID válido.");
      return;
    }

    if (!confirm("Confirmar descarte dos itens selecionados?")) {
      return;
    }

    discardButton.disabled = true;
    discardButton.textContent = "Descartando...";

    try {
      const resp = await fetch("/api/items/discard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: user.organization_id,
          created_by: user.user_id,
          item_ids: itemIds,
        }),
      });

      const result = await resp.json().catch(() => ({}));

      if (resp.ok && result.success) {
        alert("Itens descartados e registrados no histórico com sucesso!");
        // Recarrega a lista já sem os descartados
        await carregarItens();
      } else {
        console.error(result);
        alert(result.message || "Erro ao descartar itens.");
      }
    } catch (err) {
      console.error("Erro ao descartar itens:", err);
      alert("Erro ao conectar ao servidor.");
    } finally {
      discardButton.textContent = "DESCARTAR";
      updateDiscardButtonState();
    }
  });
});
