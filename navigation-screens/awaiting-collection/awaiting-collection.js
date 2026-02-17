// navigation-screens/awaiting-collection/awaiting-collection.js

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
};

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("itemsContainer");
  const actionButton = document.querySelector(".btn-action button");
  const modal = document.getElementById("itemModal");
  const closeModalBtn = document.getElementById("closeModal");
  const cancelBtn = document.getElementById("cancelBtn");
  const editBtn = document.getElementById("editBtn");
  const saveBtn = document.getElementById("saveBtn");
  const modalForm = document.getElementById("modalForm");
  const photoUploadBtn = document.getElementById("photoUploadBtn");
  const photoInput = document.getElementById("photoInput");

  let currentItem = null;
  let isEditMode = false;

  if (!container || !actionButton || !modal) {
    console.error("Elementos da tela de aguardando coleta não encontrados.");
    return;
  }

  const rawUser = localStorage.getItem("sc_user");
  if (!rawUser) {
    window.location.href = "/acesso/login/login.html";
    return;
  }

  const user = JSON.parse(rawUser);
  const placeholderImage = "https://via.placeholder.com/120x120?text=Item";

  // Controla o upload de foto
  photoUploadBtn.addEventListener("click", () => {
    photoInput.click();
  });

  photoInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        document.getElementById("modalPhoto").src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  loadItems();

  async function loadItems() {
    try {
      container.innerHTML =
        '<p class="empty-state">Carregando itens aguardando coleta...</p>';

      const resp = await fetch(
        `/api/home?organization_id=${user.organization_id}`,
      );
      const data = await resp.json();

      if (!resp.ok || !data.success) {
        throw new Error(data.message || "Falha ao carregar itens");
      }

      renderItems(data.itensDescartar || []);
    } catch (error) {
      console.error("Erro ao carregar itens aguardando coleta:", error);
      container.innerHTML =
        '<p class="empty-state">Não foi possível carregar os itens agora.</p>';
      actionButton.disabled = true;
    }
  }

  function renderItems(lista) {
    container.innerHTML = "";

    if (!lista.length) {
      container.innerHTML =
        '<p class="empty-state">Nenhum item aguardando coleta.</p>';
      currentItem = null;
      updateButtonState();
      return;
    }

    const fragment = document.createDocumentFragment();

    lista.forEach((item) => {
      const brand = item.brand || "";
      const model = item.model || "";
      const brandModel = [brand, model].filter(Boolean).join(" - ");

      const itemDiv = document.createElement("div");
      itemDiv.classList.add("item");
      itemDiv.dataset.itemId = item.id || "";
      itemDiv.dataset.product = item.product_name || "";
      itemDiv.dataset.brand = brand;
      itemDiv.dataset.model = model;
      itemDiv.dataset.description = item.description || "";
      itemDiv.dataset.photo = item.photo_url || placeholderImage;
      itemDiv.dataset.statusCode = item.condition_code || "";
      itemDiv.dataset.statusLabel = item.condition_label || "";

      itemDiv.innerHTML = `
        <img src="${item.photo_url || placeholderImage}" alt="${
          item.product_name || "Item"
        }" />
        <div class="item-info">
          <h4>${item.product_name || "Sem nome"}</h4>
          <p>${brandModel || "Sem marca/modelo"}</p>
          <div class="status">
            <span class="dot ${mapStatusColor(item.condition_code)}"></span>
            ${item.condition_label || ""}
          </div>
        </div>
      `;

      fragment.appendChild(itemDiv);
    });

    container.appendChild(fragment);
    inicializarItens();
  }

  function mapStatusColor(code) {
    if (code === "OTIMO") return "green";
    if (code === "REPARO") return "yellow";
    if (code === "DESCARTAR") return "red";
    return "";
  }

  function inicializarItens() {
    container.querySelectorAll(".item").forEach((item) => {
      item.addEventListener("click", () => {
        container
          .querySelectorAll(".item")
          .forEach((i) => i.classList.remove("selected"));
        item.classList.add("selected");
        currentItem = item;
        updateButtonState();
      });
    });
  }

  function updateButtonState() {
    const selectedItems = container.querySelectorAll(".item.selected");
    actionButton.disabled = selectedItems.length === 0;
  }

  // Abre o modal ao clicar em VISUALIZAR
  actionButton.addEventListener("click", () => {
    const selectedItem = container.querySelector(".item.selected");

    if (selectedItem) {
      openModal(selectedItem);
    }
  });

  // Função para abrir o modal com os dados do item
  function openModal(item) {
    // Pega os dados do item
    const itemName =
      item.dataset.product || item.querySelector("h4").textContent;
    const marca = item.dataset.brand || "";
    const modelo = item.dataset.model || "";
    const itemImage = item.dataset.photo || item.querySelector("img").src;
    const itemDescription = item.dataset.description || "";
    const statusCode = item.dataset.statusCode || "";

    // Preenche os campos do modal
    document.getElementById("modalPhoto").src = itemImage;
    document.getElementById("modalProduto").value = itemName;
    document.getElementById("modalMarca").value = marca || "";
    document.getElementById("modalModelo").value = modelo || "";
    document.getElementById("modalDescricao").value = itemDescription;

    document.querySelectorAll('input[name="modalStatus"]').forEach((radio) => {
      radio.checked = radio.value === statusCode;
    });

    // Reseta o modo de edição
    setEditMode(false);

    // Mostra o modal
    modal.classList.add("show");
  }

  // Fecha o modal
  function closeModal() {
    modal.classList.remove("show");
    setEditMode(false);
  }

  closeModalBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);

  // Fecha o modal ao clicar fora dele
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Alterna o modo de edição
  editBtn.addEventListener("click", () => {
    setEditMode(!isEditMode);
  });

  // Função para ativar/desativar o modo de edição
  function setEditMode(enabled) {
    isEditMode = enabled;

    const inputs = modalForm.querySelectorAll("input[type='text'], textarea");
    const radioInputs = modalForm.querySelectorAll("input[type='radio']");

    if (enabled) {
      // Ativa edição
      inputs.forEach((input) => (input.readOnly = false));
      radioInputs.forEach((radio) => (radio.disabled = false));
      editBtn.classList.add("editing");
      saveBtn.style.display = "inline-block";
      cancelBtn.textContent = "Cancelar";
      photoUploadBtn.classList.add("show");
    } else {
      // Desativa edição
      inputs.forEach((input) => (input.readOnly = true));
      radioInputs.forEach((radio) => (radio.disabled = true));
      editBtn.classList.remove("editing");
      saveBtn.style.display = "none";
      cancelBtn.textContent = "Fechar";
      photoUploadBtn.classList.remove("show");
    }
  }

  // Salvar edições
  modalForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!isEditMode) return;

    if (!currentItem) {
      notify.error("Nenhum item selecionado.");
      return;
    }

    const item_id = currentItem.dataset.itemId;
    const organization_id = user.organization_id;
    const produto = document.getElementById("modalProduto").value;
    const marca = document.getElementById("modalMarca").value;
    const modelo = document.getElementById("modalModelo").value;
    const descricao = document.getElementById("modalDescricao").value;
    const status = document.querySelector(
      'input[name="modalStatus"]:checked',
    )?.value;

    // Monta FormData para enviar arquivo e dados
    const formData = new FormData();
    formData.append("item_id", item_id);
    formData.append("organization_id", organization_id);
    formData.append("produto", produto);
    formData.append("marca", marca);
    formData.append("modelo", modelo);
    formData.append("descricao", descricao);
    formData.append("status", status);

    // Se uma nova foto foi selecionada, envia o arquivo
    const file = photoInput.files[0];
    if (file) {
      formData.append("photo", file);
    }

    try {
      const resp = await fetch("/api/items/update", {
        method: "PUT",
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.message || "Falha ao atualizar item");
      }
      notify.success("Edições salvas com sucesso!");
      closeModal();
      // Atualiza a lista de itens dinamicamente
      loadItems();
    } catch (err) {
      notify.error("Erro ao salvar edições: " + err.message);
    }
  });
});
