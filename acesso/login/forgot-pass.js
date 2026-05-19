(() => {
  const form = document.getElementById("forgotForm");
  const emailInput = document.getElementById("email");
  const submitBtn = document.getElementById("submitBtn");
  const errorBanner = document.getElementById("errorBanner");
  const successBanner = document.getElementById("successBanner");
  const errorMsg = document.getElementById("errorMsg");
  const groupEmail = document.getElementById("groupEmail");
  const emailError = document.getElementById("emailError");

  function isValidEmail(email) {
    return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/i.test(
      email.trim()
    );
  }

  function setError(show) {
    groupEmail.classList.toggle("has-error", show);
    emailError.style.display = show ? "block" : "none";
  }

  function showError(message) {
    errorMsg.textContent = message;
    errorBanner.classList.add("is-visible");
    successBanner.classList.remove("is-visible");
    setTimeout(() => {
      errorBanner.classList.remove("is-visible");
    }, 5000);
  }

  function showSuccess() {
    successBanner.classList.add("is-visible");
    errorBanner.classList.remove("is-visible");
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    document.querySelector(".btn-text").style.display = isLoading
      ? "none"
      : "block";
    document.querySelector(".btn-loader").style.display = isLoading
      ? "block"
      : "none";
  }

  // Validação em tempo real do email
  emailInput.addEventListener("blur", () => {
    const email = emailInput.value.trim();
    if (email && !isValidEmail(email)) {
      setError(true);
    } else {
      setError(false);
    }
  });

  emailInput.addEventListener("input", () => {
    setError(false);
  });

  // Submit do formulário
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();

    // Validação
    if (!email) {
      setError(true);
      return;
    }

    if (!isValidEmail(email)) {
      setError(true);
      return;
    }

    setError(false);
    setLoading(true);

    try {
      const response = await fetch("/api/recuperar-senha", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.mensagem || "Erro ao enviar link de recuperação."
        );
      }

      // Sucesso
      showSuccess();
      form.reset();
      emailInput.focus();

      // Redireciona para login após 3 segundos
      setTimeout(() => {
        window.location.href = "/acesso/login/login.html";
      }, 3000);
    } catch (error) {
      console.error("Erro:", error);
      showError(
        error.message ||
          "Ocorreu um erro ao processar sua solicitação. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  });
})();
