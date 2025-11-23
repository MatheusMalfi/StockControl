document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  // const msg = document.getElementById("msg"); // LINHA REMOVIDA/COMENTADA

  if (!form) {
    console.error("Formulário #login-form não encontrado.");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // msg.textContent = "";           // LINHA REMOVIDA/COMENTADA
    // msg.style.color = "#f97316";    // LINHA REMOVIDA/COMENTADA

    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        // msg.style.color = "red";    // LINHA REMOVIDA/COMENTADA
        // msg.textContent = result.mensagem || "Falha no login."; // LINHA REMOVIDA/COMENTADA

        // Você pode adicionar aqui um alerta simples para o erro:
        alert(result.mensagem || "Falha no login.");
        return;
      }

      // Guarda dados básicos do usuário
      const userPayload = {
        email: data.email,
        user_id: result.user_id,
        org_type: result.org_type,
        organization_id: result.organization_id,
        logged_at: new Date().toISOString(),
      };
      localStorage.setItem("sc_user", JSON.stringify(userPayload));

      // Default: Home ONG
      let redirectUrl = "/navigation-screens/home/home.html";

      if (result.org_type === "RECYCLER") {
        // Redireciona para a Home da Impact Metais
        redirectUrl =
          "/navigation-screens/impact-metais/home-impact-metais/home.html";
      }
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 1200);
    } catch (error) {
      console.error("Erro no login:", error);
    }
  });
});
