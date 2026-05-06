document.addEventListener("DOMContentLoaded", async () => {
  const rawUser = localStorage.getItem("sc_user");
  if (!rawUser) {
    return (window.location.href = "/acesso/login/login.html");
  }

  const user = JSON.parse(rawUser);

  if (user.org_type !== "RECYCLER" && user.role !== "ADMIN") {
    return (window.location.href = "/navigation-screens/home/home.html");
  }

  await carregarONGs();

  async function carregarONGs() {
    const lista = document.querySelector(".entities-list");
    if (!lista) return;

    lista.innerHTML = "<p style='color:#89ffdb;padding:1rem;'>Carregando ONGs...</p>";

    try {
      const resp = await fetch("/api/recycler/ongs");
      const data = await resp.json();

      if (!resp.ok || !data.success) {
        lista.innerHTML = "<p style='color:#ff7b72;padding:1rem;'>Erro ao carregar ONGs.</p>";
        return;
      }

      if (!data.ongs.length) {
        lista.innerHTML = "<p style='color:#9ca3af;padding:1rem;'>Nenhuma ONG com pedidos pendentes.</p>";
        return;
      }

      lista.innerHTML = "";

      data.ongs.forEach((ong) => {
        const card = document.createElement("div");
        card.className = "entity-card";
        card.style.cursor = "pointer";
        card.innerHTML = `
          <div class="entity-info">
            <div class="entity-logo">
              <span class="emoji-logo">🏢</span>
            </div>
            <span class="entity-name">${ong.name}</span>
          </div>
          <span class="entity-count">${ong.pending_items}</span>
        `;
        card.addEventListener("click", () => {
          window.location.href =
            `/navigation-screens/impact-metais/details-request-impact-metais/details-request.html?org_id=${ong.id}&ong=${encodeURIComponent(ong.name)}`;
        });
        lista.appendChild(card);
      });
    } catch (err) {
      console.error("Erro ao carregar ONGs:", err);
      lista.innerHTML = "<p style='color:#ff7b72;padding:1rem;'>Erro de conexão.</p>";
    }
  }
});
