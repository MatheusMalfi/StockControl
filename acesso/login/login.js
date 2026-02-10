document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");

  if (!form) {
    console.error("Formulário #login-form não encontrado.");
    return;
  }

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

      const result = await response.json().catch(() => ({}));

console.log("LOGIN RESULT:", result);
alert("org_type: " + result.org_type);


      if (!response.ok || !result.success) {
        alert(result.mensagem || "Falha no login.");
        return;
      }

      // 🔥 SALVANDO OS DADOS DO USUÁRIO + ORG_TYPE
      const userPayload = {
        email: data.email,
        user_id: result.user_id,
        organization_id: result.organization_id,
        org_type: result.org_type, // <-- IMPORTANTE
        logged_at: new Date().toISOString(),
      };

      localStorage.setItem("sc_user", JSON.stringify(userPayload));

      // 🔥 REDIRECIONAMENTO BASEADO NO org_type
      setTimeout(() => {
        if (result.org_type === "ONG") {
          window.location.href = "/navigation-screens/home/home.html";
        } 
        else if (result.org_type === "RECYCLER") {
          window.location.href =
            "/navigation-screens/impact-metais/home-impact-metais/home.html";
        } 
        else {
          // fallback
          window.location.href = "/navigation-screens/home/home.html";
        }
      }, 800);

    } catch (error) {
      console.error("Erro no login:", error);
      alert("Erro ao conectar ao servidor.");
    }
  });
});
