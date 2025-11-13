// acesso/login/login.js
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const msg = document.getElementById("msg");

  if (!form) {
    console.error("Formulário #login-form não encontrado.");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    msg.textContent = "";
    msg.style.color = "#f97316";

    const formData = new FormData(form);
    const data = Object.fromEntries(formData); // { email: "...", senha: "..." }

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        msg.style.color = "red";
        msg.textContent = result.mensagem || "Falha no login.";
        return;
      }

      // Guarda dados básicos do usuário para a home
      const userPayload = {
        email: data.email,
        user_id: result.user_id,
        organization_id: result.organization_id,
        logged_at: new Date().toISOString(),
      };
      localStorage.setItem("sc_user", JSON.stringify(userPayload));

      msg.style.color = "limegreen";
      msg.textContent = "Login bem-sucedido! Redirecionando...";

      // redireciona pra home
      setTimeout(() => {
        window.location.href = "/navigation-screens/home/home.html";
      }, 1200);
    } catch (error) {
      console.error("Erro no login:", error);
      msg.style.color = "red";
      msg.textContent = "Erro ao conectar ao servidor.";
    }
  });
});
