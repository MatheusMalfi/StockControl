// register-item.js

document.addEventListener("DOMContentLoaded", () => {
  // Seleciona todos os elementos necessários
  const form = document.getElementById("formItem");
  const fileInput = document.getElementById("fileInput");
  const preview = document.getElementById("preview");
  const fotoTexto = document.getElementById("foto-texto");

  const produtoInput = document.getElementById("produto");
  const marcaInput = document.getElementById("marca");
  const modeloInput = document.getElementById("modelo");
  const statusInputs = document.querySelectorAll("input[name='status']");
  const btnRegister = document.getElementById("btnRegister");
  const statusLabels = document.querySelectorAll(
    ".green-btn, .yellow-btn, .red-btn" // Seleciona todos os labels dos status
  );

  // --- FUNÇÃO DE VALIDAÇÃO ---
  function checkFormValidity() {
    // Verifica campos de texto e arquivo (required)
    const isTextValid =
      produtoInput.value.trim() !== "" &&
      marcaInput.value.trim() !== "" &&
      modeloInput.value.trim() !== "" &&
      fileInput.files.length > 0;

    // Verifica se algum status radio button está checado
    const isStatusChecked = Array.from(statusInputs).some(
      (input) => input.checked
    );

    // Habilita o botão se TODOS os campos obrigatórios estiverem preenchidos
    btnRegister.disabled = !(isTextValid && isStatusChecked);
  }

  // --- OUVINTES DE EVENTOS ---

  // Monitora os inputs de texto e status
  form.addEventListener("input", checkFormValidity);

  // 🌟 LÓGICA PARA MANTER O ESTADO ATIVO DO BOTÃO DE STATUS APÓS O CLIQUE 🌟
  statusInputs.forEach((input) => {
    // O evento 'change' é acionado quando um radio button é selecionado
    input.addEventListener("change", () => {
      // 1. Remove a classe 'active' de TODOS os botões visuais (labels)
      statusLabels.forEach((label) => label.classList.remove("active"));

      // 2. Encontra o label que corresponde ao input checado (usando o 'for' do label e o 'id' do input)
      const targetLabel = document.querySelector(`label[for="${input.id}"]`);

      // 3. Adiciona a classe 'active' apenas no botão clicado
      if (targetLabel) {
        targetLabel.classList.add("active");
      }

      checkFormValidity();
    });
  });
  // FIM DA LÓGICA DE ESTADO ATIVO

  // Lógica para pré-visualização da foto
  fileInput.addEventListener("change", function () {
    const file = this.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        preview.src = e.target.result;
        preview.style.display = "block";
        fotoTexto.style.display = "none";
        checkFormValidity(); // Chama a validação após carregar a imagem
      };
      reader.readAsDataURL(file);
    } else {
      preview.style.display = "none";
      fotoTexto.style.display = "block";
      checkFormValidity(); // Chama a validação se a imagem for removida
    }
  });

  // --- LÓGICA DE SUBMISSÃO ---
  const lista = document.getElementById("registeredItems");

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    // Se o botão estiver desabilitado, não faz nada
    if (btnRegister.disabled) return;

    // Coleta dos dados
    const produto = produtoInput.value;
    const marca = marcaInput.value;
    const modelo = modeloInput.value;
    const descricao = document.getElementById("descricao").value;
    const imagem = preview.src;

    const statusSelecionado = document.querySelector(
      "input[name='status']:checked"
    ).value;

    // Criação do HTML do novo item
    let statusHtml = "";
    if (statusSelecionado === "otimo") {
      statusHtml = `<div class="status-text"><span class="dot green"></span> Ótimo Estado de Uso</div>`;
    } else if (statusSelecionado === "reparos") {
      statusHtml = `<div class="status-text"><span class="dot yellow"></span> Necessita de Reparos</div>`;
    } else {
      statusHtml = `<div class="status-text"><span class="dot red"></span> Necessita ser Descartado</div>`;
    }

    const item = document.createElement("div");
    item.classList.add("item-card");

    item.innerHTML = `
            <img src="${imagem}" alt="${produto}">
            <div class="item-info">
              <h4>${produto}</h4>
              <p>${marca} - ${modelo}</p>
              ${statusHtml}
            </div>
          `;

    lista.appendChild(item);

    // Resetar o formulário e o estado do botão
    form.reset();
    preview.style.display = "none";
    fotoTexto.style.display = "block";

    // NOVO: Remove a classe 'active' de todos os botões visuais ao resetar o formulário
    statusLabels.forEach((label) => label.classList.remove("active"));

    checkFormValidity(); // Desabilita o botão após o reset
  });

  // Garante que o botão está desabilitado ao carregar a página
  checkFormValidity();
});
