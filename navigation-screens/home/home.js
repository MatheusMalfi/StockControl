document.addEventListener("DOMContentLoaded", () => {
  const rawUser = localStorage.getItem("sc_user");
  if (!rawUser) return (window.location.href = "/acesso/login/login.html");

  const user = JSON.parse(rawUser);

  const listaCadastrados = document.querySelector(".registered-items .scrollable-content");
  const listaAguardando = document.querySelector(".awaiting-collection .scrollable-content");
  const listaHistorico = document.querySelector(".discard-history .scrollable-content");

  carregarDashboard();

  async function carregarDashboard() {
    const resp = await fetch(`/api/home?organization_id=${user.organization_id}`);
    const data = await resp.json();

    if (!resp.ok || !data.success) {
      console.error("Erro ao carregar home:", data);
      return;
    }

    renderizarCadastrados(data.itens);
    renderizarAguardando(data.itensDescartar);
    renderizarHistorico(data.historico);
  }

  // --- ITENS CADASTRADOS ---
  function renderizarCadastrados(lista) {
    listaCadastrados.innerHTML = "";

    lista.forEach(item => {
      const div = document.createElement("div");
      div.classList.add("item");

      div.innerHTML = `
        <img src="${item.photo_url || 'https://via.placeholder.com/80'}" class="item-image" />
        <div class="info">
          <h3>${item.product_name}</h3>
          <p>${item.brand || ""} - ${item.model || ""}</p>
          <span class="status-tag ${mapTag(item.condition_code)}">
            ${item.condition_label}
          </span>
        </div>
      `;

      listaCadastrados.appendChild(div);
    });
  }

  // --- ITENS PARA COLETA ---
  function renderizarAguardando(lista) {
    listaAguardando.innerHTML = "";

    lista.forEach(item => {
      const div = document.createElement("div");
      div.classList.add("item");

      div.innerHTML = `
        <img src="${item.photo_url || 'https://via.placeholder.com/80'}" class="item-image" />
        <div class="info">
          <h3>${item.product_name}</h3>
          <p>${item.brand || ""} - ${item.model || ""}</p>
        </div>
      `;
      listaAguardando.appendChild(div);
    });
  }

  // --- HISTÓRICO DE DESCARTE ---
  function renderizarHistorico(lista) {
    listaHistorico.innerHTML = "";

    lista.forEach(h => {
      const div = document.createElement("div");
      div.classList.add("item");

      div.innerHTML = `
        <img src="https://via.placeholder.com/80/555" class="item-image" />
        <div class="info">
          <h3>${h.product_name}</h3>
          <p>${h.product_brand || ""} - ${h.product_model || ""}</p>
          <small>Ação: ${h.action}</small><br>
          <small>Data: ${new Date(h.created_at).toLocaleString("pt-BR")}</small>
        </div>
      `;
      listaHistorico.appendChild(div);
    });
  }

  // --- MAPEIA COR DAS TAGS ---
  function mapTag(cond) {
    if (cond === "OTIMO") return "status-green";
    if (cond === "REPARO") return "status-orange";
    if (cond === "DESCARTAR") return "status-red";
    return "";
  }
});
