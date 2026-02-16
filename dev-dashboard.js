// Controle dos botões da tela de escolha DEV
document.addEventListener("DOMContentLoaded", function () {
  // Verifica se é ADMIN
  const rawUser = localStorage.getItem("sc_user");
  if (!rawUser) {
    window.location.href = "/acesso/login/login.html";
    return;
  }
  const user = JSON.parse(rawUser);
  if (user.role !== "ADMIN") {
    window.location.href = "/navigation-screens/home/home.html";
    return;
  }

  document.getElementById("btn-ong").onclick = function () {
    window.location.href = "/navigation-screens/home/home.html";
  };
  document.getElementById("btn-im").onclick = function () {
    window.location.href =
      "/navigation-screens/impact-metais/home-impact-metais/home.html";
  };
  document.getElementById("btn-logout").onclick = function () {
    localStorage.removeItem("sc_user");
    window.location.href = "/acesso/login/login.html";
  };
});
