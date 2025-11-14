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
  const msg = document.getElementById("msg");
  const lista = document.getElementById("registeredItems");
  const statusLabels = document.querySelectorAll(
    ".green-btn, .yellow-btn, .red-btn" // Seleciona todos os labels dos status
  );

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
    ).value;

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

    // Limpa mensagem
    if (msg) {
      msg.textContent = "";
      msg.style.color = "#fff";
    }

    try {
      const resp = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await resp.json().catch(() => ({}));
    item.innerHTML = `
            <img src="${imagem}" alt="${produto}">
            <div class="item-info">
              <h4>${produto}</h4>
              <p>${marca} - ${modelo}</p>
              ${statusHtml}
            </div>
          `;

      if (resp.ok && result.success) {
        if (msg) {
          msg.textContent = "Item cadastrado com sucesso!";
          msg.style.color = "lime";
        }

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
        preview.style.display = "none";
        fotoTexto.style.display = "block";
        checkFormValidity();
      } else {
        if (msg) {
          msg.textContent = result.message || "Erro ao cadastrar item.";
          msg.style.color = "red";
        }
      }
    } catch (error) {
      console.error("Erro na conexão:", error);
      if (msg) {
        msg.textContent = "Erro ao conectar ao servidor.";
        msg.style.color = "red";
      }
    }
  });

  // Garante que o botão começa desabilitado
  checkFormValidity();
})
