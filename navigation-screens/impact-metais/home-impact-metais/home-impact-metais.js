// Torna os cards das ONGs clicáveis e redireciona para a tela de detalhes dos pedidos
// Passa o nome da ONG como parâmetro na URL

document.addEventListener("DOMContentLoaded", () => {
  const entityCards = document.querySelectorAll(".entity-card");

  entityCards.forEach((card) => {
    card.style.cursor = "pointer";
    card.addEventListener("click", () => {
      const entityName = card.querySelector(".entity-name").textContent.trim();
      // Redireciona para a tela de detalhes, passando a ONG na query string

      // Redireciona para a tela de detalhes, passando a ONG na query string
      window.location.href = `/navigation-screens/impact-metais/details-request-impact-metais/details-request.html?ong=${encodeURIComponent(entityName)}`;
    });
  });
});
