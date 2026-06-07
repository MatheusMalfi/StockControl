(() => {
  const form = document.getElementById("changeForm");
  const passwordInput = document.getElementById("password");
  const passwordConfirmInput = document.getElementById("passwordConfirm");
  const submitBtn = document.getElementById("submitBtn");
  const errorBanner = document.getElementById("errorBanner");
  const successBanner = document.getElementById("successBanner");
  const errorMsg = document.getElementById("errorMsg");
  const togglePassword = document.getElementById("togglePassword");
  const togglePasswordConfirm = document.getElementById("togglePasswordConfirm");
  const groupPassword = document.getElementById("groupPassword");
  const groupPasswordConfirm = document.getElementById("groupPasswordConfirm");
  const passwordError = document.getElementById("passwordError");
  const passwordConfirmError = document.getElementById("passwordConfirmError");

  // Get token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  if (!token) {
    errorMsg.textContent = "Token inválido ou expirado. Solicite um novo link.";
    errorBanner.classList.add("is-visible");
    form.style.display = "none";
    return;
  }

  // Password strength validation
  function senhaValida(senha) {
    return (
      senha.length >= 8 &&
      /[A-Z]/.test(senha) &&
      /[0-9]/.test(senha) &&
      /[^A-Za-z0-9]/.test(senha)
    );
  }

  // Toggle password visibility
  function setupPasswordToggle(toggleBtn, input) {
    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const isVisible = input.type === "text";
      input.type = isVisible ? "password" : "text";
      toggleBtn.classList.toggle("password-visible", !isVisible);
      toggleBtn.setAttribute(
        "aria-label",
        isVisible ? "Mostrar senha" : "Ocultar senha"
      );
    });
  }

  setupPasswordToggle(togglePassword, passwordInput);
  setupPasswordToggle(togglePasswordConfirm, passwordConfirmInput);

  // Real-time validation
  function validatePassword() {
    const isValid = senhaValida(passwordInput.value);
    groupPassword.classList.toggle("has-error", !isValid && passwordInput.value);
    passwordError.style.display =
      !isValid && passwordInput.value ? "block" : "none";
    return isValid;
  }

  function validatePasswordConfirm() {
    const matches = passwordInput.value === passwordConfirmInput.value;
    const bothFilled = passwordInput.value && passwordConfirmInput.value;
    groupPasswordConfirm.classList.toggle(
      "has-error",
      !matches && bothFilled
    );
    passwordConfirmError.style.display =
      !matches && bothFilled ? "block" : "none";
    return matches || !bothFilled;
  }

  passwordInput.addEventListener("blur", validatePassword);
  passwordInput.addEventListener("input", () => {
    validatePassword();
    validatePasswordConfirm();
  });

  passwordConfirmInput.addEventListener("blur", validatePasswordConfirm);
  passwordConfirmInput.addEventListener("input", validatePasswordConfirm);

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

  // Form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const password = passwordInput.value;
    const passwordConfirm = passwordConfirmInput.value;

    // Validate
    if (!password || !passwordConfirm) {
      showError("Preencha todos os campos.");
      return;
    }

    if (!senhaValida(password)) {
      showError(
        "A senha deve ter mínimo 8 caracteres, letra maiúscula, número e caractere especial."
      );
      return;
    }

    if (password !== passwordConfirm) {
      showError("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/alterar-senha", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          novaSenha: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.mensagem || "Erro ao redefinir senha.");
      }

      showSuccess();
      form.style.display = "none";

      // Redirect to login after 2 seconds
      setTimeout(() => {
        window.location.href = "/acesso/login/login.html";
      }, 2000);
    } catch (error) {
      console.error("Erro:", error);
      showError(error.message || "Erro ao redefinir senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  });
})();
