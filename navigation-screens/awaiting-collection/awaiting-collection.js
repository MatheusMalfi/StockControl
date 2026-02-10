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

  // Adiciona funcionalidade de seleção aos itens existentes
  inicializarItens();

  function inicializarItens() {
    const items = container.querySelectorAll(".item");

    items.forEach((item) => {
      item.addEventListener("click", () => {
        // Remove seleção de todos os outros itens (permite apenas um selecionado)
        items.forEach((i) => i.classList.remove("selected"));

        // Seleciona o item clicado
        item.classList.add("selected");

        // Armazena o item atual
        currentItem = item;

        // Atualiza o estado do botão
        updateButtonState();
      });
    });

    updateButtonState();
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
    const itemName = item.querySelector("h4").textContent;
    const itemDetails = item.querySelector(".item-info p").textContent;
    const itemStatus = item.querySelector(".status").textContent.trim();
    const itemImage = item.querySelector("img").src;

    // Separa marca e modelo (formato: "MARCA - MODELO")
    const [marca, modelo] = itemDetails.split(" - ");

    // Preenche os campos do modal
    document.getElementById("modalPhoto").src = itemImage;
    document.getElementById("modalProduto").value = itemName;
    document.getElementById("modalMarca").value = marca || "";
    document.getElementById("modalModelo").value = modelo || "";
    document.getElementById("modalDescricao").value =
      "Descrição do produto aqui"; // Ajustar conforme API

    // Define o status correto
    if (itemStatus.includes("Ótimo")) {
      document.querySelector('input[value="OTIMO"]').checked = true;
    } else if (itemStatus.includes("Reparos")) {
      document.querySelector('input[value="REPARO"]').checked = true;
    } else if (itemStatus.includes("Descartado")) {
      document.querySelector('input[value="DESCARTAR"]').checked = true;
    }

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

  // Salvar alterações
  modalForm.addEventListener("submit", (e) => {
    e.preventDefault();

    if (!isEditMode) return;

    // Aqui você pode adicionar a lógica para salvar no backend
    const updatedData = {
      produto: document.getElementById("modalProduto").value,
      marca: document.getElementById("modalMarca").value,
      modelo: document.getElementById("modalModelo").value,
      descricao: document.getElementById("modalDescricao").value,
      status: document.querySelector('input[name="modalStatus"]:checked')
        ?.value,
    };

    console.log("Dados atualizados:", updatedData);

    // Notificação de sucesso
    notify.success("Alterações salvas com sucesso!");

    // Atualiza o item na lista (opcional)
    if (currentItem) {
      currentItem.querySelector("h4").textContent = updatedData.produto;
      currentItem.querySelector(".item-info p").textContent =
        `${updatedData.marca} - ${updatedData.modelo}`;
    }

    closeModal();
  });
});
