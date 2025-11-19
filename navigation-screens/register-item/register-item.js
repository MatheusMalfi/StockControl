// navigation-screens/register-item/register-item.js

document.addEventListener("DOMContentLoaded", () => {
  // ---- Verifica usuário logado (mesmo esquema do login/home) ----
  const rawUser = localStorage.getItem("sc_user");
  if (!rawUser) {
    window.location.href = "/acesso/login/login.html";
    return;
  }
  const user = JSON.parse(rawUser);

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
  // const msg = document.getElementById("msg"); // REMOVIDO: vamos usar 'notificationArea'
  const lista = document.getElementById("registeredItems");
  const statusLabels = document.querySelectorAll(
    ".green-btn, .yellow-btn, .red-btn" // Seleciona todos os labels dos status
  );

  // 🔔 SELECIONA O ELEMENTO DE NOTIFICAÇÃO
  const notificationArea = document.getElementById("notification-area");

  // --- FUNÇÃO PARA EXIBIR NOTIFICAÇÕES (NOVO) ---
  /**
   * Exibe uma notificação pop-up.
   * @param {string} message - A mensagem a ser exibida.
   * @param {'success'|'error'|'loading'|'critical'} type - O tipo de notificação.
   * @param {number} duration - Duração em ms antes de fechar (exceto loading).
   */
  function showNotification(message, type, duration = 3000) {
    if (!notificationArea) return;

    // Limpa classes anteriores e define a nova
    notificationArea.className = "notification";
    notificationArea.textContent = message;
    notificationArea.classList.add(`notification-${type}`);

    // Força o re-render (para garantir que a animação show funcione)
    void notificationArea.offsetWidth;

    // Exibe a notificação
    notificationArea.classList.add("show");

    // Fecha a notificação após 'duration' (a menos que seja 'loading')
    if (type !== "loading") {
      setTimeout(() => {
        notificationArea.classList.remove("show");
      }, duration);
    }
  }
  // --- FIM DA FUNÇÃO DE NOTIFICAÇÃO ---

  // --- FUNÇÃO DE VALIDAÇÃO ---
  function checkFormValidity() {
    const isTextValid =
      produtoInput.value.trim() !== "" &&
      marcaInput.value.trim() !== "" &&
      modeloInput.value.trim() !== "" &&
      fileInput.files.length > 0;

    const isStatusChecked = Array.from(statusInputs).some(
      (input) => input.checked
    );

    btnRegister.disabled = !(isTextValid && isStatusChecked);
  }

  // Monitora inputs
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
        checkFormValidity();
      };
      reader.readAsDataURL(file);
    } else {
      preview.style.display = "none";
      fotoTexto.style.display = "block";
      checkFormValidity();
    }
  });

  // ---- Mapeia o status escolhido para condition_id no banco ----
  // Ajuste se na sua tabela "conditions" os IDs forem diferentes
  function mapStatusToConditionId(status) {
    switch (status) {
      case "otimo":
        return 1; // OTIMO
      case "reparos":
        return 2; // REPARO
      case "descartar":
        return 3; // DESCARTAR
      default:
        return 1;
    }
  }

  // --- SUBMISSÃO: agora envia para o backend /api/items ---
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (btnRegister.disabled) return;

    const produto = produtoInput.value;
    const marca = marcaInput.value;
    const modelo = modeloInput.value;
    const descricao = document.getElementById("descricao").value;
    const imagem = preview.src; // data URL (por enquanto, só exibimos na tela)

    const statusSelecionado = document.querySelector(
      "input[name='status']:checked"
    )?.value; // Usado optional chaining (?) caso status não esteja checado

    if (!statusSelecionado) {
      console.error("Status não selecionado.");
      return;
    }

    const condition_id = mapStatusToConditionId(statusSelecionado);

    // Monta o payload para o backend
    const payload = {
      organization_id: user.organization_id,
      product_name: produto,
      product_brand: marca,
      product_model: modelo,
      description: descricao,
      condition_id,
      // por enquanto não vamos salvar a imagem no banco (photo_url = null)
      photo_url: null,
      created_by: user.user_id,
    };

    // 💬 Exibe notificação de Carregamento/Loading (dura até o try/catch terminar)
    showNotification("Cadastrando item...", "loading", 0);

    try {
      const resp = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await resp.json().catch(() => ({}));

      if (resp.ok && result.success) {
        // 🟢 SUCESSO
        showNotification("Item cadastrado com sucesso!", "success");

        // Criação do card para mostrar na tela (visual)
        let statusHtml = "";
        if (statusSelecionado === "otimo") {
          statusHtml = `<div class="status-text"><span class="dot green"></span> Ótimo Estado de Uso</div>`;
        } else if (statusSelecionado === "reparos") {
          statusHtml = `<div class="status-text"><span class="dot yellow"></span> Necessita de Reparos</div>`;
        } else {
          statusHtml = `<div class="status-text"><span class="dot red"></span> Necessita ser Descartado</div>`;
        }

        if (lista) {
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
        }

        // Resetar o formulário
        form.reset();
        statusLabels.forEach((label) => label.classList.remove("active"));
        preview.style.display = "none";
        fotoTexto.style.display = "block";
        checkFormValidity();
      } else {
        // 🔴 ERRO NO BACKEND (Ex: 400 Bad Request, falha de validação)
        showNotification(
          result.message || "Erro ao cadastrar item. Detalhes: " + resp.status,
          "error"
        );
      }
    } catch (error) {
      console.error("Erro na conexão:", error);
      // 🛑 ERRO DE CONEXÃO (Ex: Servidor Offline)
      showNotification(
        "Erro ao conectar ao servidor. Tente novamente.",
        "critical"
      );
    }

    // Oculta o loading se ainda estiver ativo (geralmente não será necessário, mas garante)
    if (notificationArea.classList.contains("notification-loading")) {
      notificationArea.classList.remove("show");
    }
  });

  // Garante que o botão começa desabilitado
  checkFormValidity();
});
