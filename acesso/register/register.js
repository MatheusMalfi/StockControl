const notify = {
  // Função base para criar e exibir o toast na tela
  _base(message, type) {
    // Limpa notificações 'loading' antes de mostrar outras
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

    // Remove a notificação após 3 segundos (exceto 'loading')
    if (type !== "loading") {
      setTimeout(() => {
        notification.classList.remove("show");
        setTimeout(() => {
          notification.remove();
        }, 500);
      }, 3000);
    }
  },

  // Métodos públicos
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
  const form = document.getElementById("form-cadastro");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    notify.loading("Processando o seu cadastro. Aguarde um momento...");

    const data = Object.fromEntries(new FormData(form));

    try {
      const res = await fetch("/api/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      // Remove o 'loading' antes de mostrar o resultado
      document
        .querySelectorAll(".notification-loading")
        .forEach((n) => n.remove());

      if (res.ok && json.ok) {
        notify.success("Cadastro realizado com sucesso!");

        setTimeout(() => {
          window.location.href = "/acesso/login/login.html";
        }, 1200);
      } else {
        const errorMessage = json.erro
          ? `Erro de Cadastro: ${json.erro}`
          : "Falha no cadastro. Verifique os dados e tente novamente.";

        notify.error(errorMessage);
      }
    } catch (err) {
      console.error("Erro ao conectar ao servidor:", err);
      notify.critical("Erro ao conectar ao servidor. Verifique sua conexão.");
    }
  });
});
