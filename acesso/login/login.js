const notify = {
  _base(message, type) {
    document
      .querySelectorAll(".notification-loading")
      .forEach((n) => n.remove());

    const notification = document.createElement("div");
    notification.classList.add("notification", `notification-${type}`);
    notification.innerHTML = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add("show");
    }, 10);

    if (type !== "loading") {
      setTimeout(() => {
        notification.classList.remove("show");
        setTimeout(() => {
          notification.remove();
        }, 500);
      }, 3000);
    }
  },

  success(message) {
    this._base(message, "success");
  },
  error(message) {
    this._base(message, "error");
  },
  critical(message) {
    this._base(message, "critical");
  },
  loading(message) {
    this._base(message, "loading");
  },
};

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");

  if (!form) {
    console.error("Formulário #login-form não encontrado.");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

<<<<<<< HEAD
=======
    notify.loading("Autenticando...");

>>>>>>> f0f94dbcaa6f075cd799241e243efac845641535
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json().catch(() => ({}));

<<<<<<< HEAD
console.log("LOGIN RESULT:", result);
alert("org_type: " + result.org_type);


      if (!response.ok || !result.success) {
        alert(result.mensagem || "Falha no login.");
        return;
      }

      // 🔥 SALVANDO OS DADOS DO USUÁRIO + ORG_TYPE
=======
      // Aguarda para garantir que a notificação seja visível
      await new Promise((resolve) => setTimeout(resolve, 1500));

      document
        .querySelectorAll(".notification-loading")
        .forEach((n) => n.remove());

      if (!response.ok || !result.success) {
        notify.error(result.mensagem || "Falha no login.");
        return;
      }

>>>>>>> f0f94dbcaa6f075cd799241e243efac845641535
      const userPayload = {
        email: data.email,
        user_id: result.user_id,
        org_type: result.org_type,
        organization_id: result.organization_id,
        org_type: result.org_type, // <-- IMPORTANTE
        logged_at: new Date().toISOString(),
      };

      localStorage.setItem("sc_user", JSON.stringify(userPayload));

<<<<<<< HEAD
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
=======
      let redirectUrl = "/navigation-screens/home/home.html";

      if (result.org_type === "RECYCLER") {
        redirectUrl =
          "/navigation-screens/impact-metais/home-impact-metais/home.html";
      }

      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 1200);
    } catch (error) {
      console.error("Erro no login:", error);
      // Aguarda para garantir que a notificação seja visível
      await new Promise((resolve) => setTimeout(resolve, 1500));
      document
        .querySelectorAll(".notification-loading")
        .forEach((n) => n.remove());
      notify.error("Erro ao conectar ao servidor.");
>>>>>>> f0f94dbcaa6f075cd799241e243efac845641535
    }
  });
});
