// navigation-screens/home/home.js
document.addEventListener("DOMContentLoaded", () => {
  // 1. Verifica se existe usuário logado
  const rawUser = localStorage.getItem("sc_user");

  if (!rawUser) {
    // Se não tiver nada no localStorage, volta pro login
    window.location.href = "/acesso/login/login.html";
    return;
  }

  let user;
  try {
    user = JSON.parse(rawUser);
  } catch (e) {
    console.warn("Dados de usuário corrompidos, limpando storage.", e);
    localStorage.removeItem("sc_user");
    window.location.href = "/acesso/login/login.html";
    return;
  }

  // 2. (Opcional) Mostra um texto com o usuário / ONG no header
  const header = document.querySelector(".header");
  if (header) {
    const info = document.createElement("p");
    info.className = "user-info";
    info.textContent = `Usuário: ${user.email} | ONG ID: ${user.organization_id}`;
    header.appendChild(info);
  }

  // 3. Botão de logout (se você quiser criar um mais tarde)
  // Você pode, por exemplo, criar um <button id="btn-logout">Sair</button> no header
  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("sc_user");
      window.location.href = "/acesso/login/login.html";
    });
  }

  // 4. Aqui no futuro você pode popular os cards com dados reais da API.
  // Por enquanto a tela usa os itens estáticos do HTML, então deixo só o esqueleto:

  /*
  carregarDashboard(user.organization_id);
  */
});

/*
// Exemplo de função para, no futuro, buscar dados reais do backend:
async function carregarDashboard(organizationId) {
  try {
    const resp = await fetch(`/api/dashboard?organization_id=${organizationId}`);
    if (!resp.ok) return;

    const data = await resp.json();
    // data pode ter algo como:
    // { cadastrados: [...], aguardandoColeta: [...], historico: [...] }
    // Aí você substituiria o conteúdo dos cards com esses dados.
  } catch (err) {
    console.error("Erro ao carregar dashboard:", err);
  }
}
*/
