document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const msg = document.getElementById("msg");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        msg.style.color = "lime";
        msg.textContent = "Login bem-sucedido! Redirecionando...";
        setTimeout(() => (window.location.href = "/home.html"), 1500);
      } else {
        msg.style.color = "red";
        msg.textContent = result.mensagem || "Falha no login.";
      }
    } catch (error) {
      console.error(error);
      msg.style.color = "red";
      msg.textContent = "Erro ao conectar ao servidor.";
    }
  });
});
