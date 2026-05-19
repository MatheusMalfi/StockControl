(() => {
  const form       = document.getElementById("loginForm");
  const emailInput = document.getElementById("email");
  const passInput  = document.getElementById("password");
  const loginBtn   = document.getElementById("loginBtn");
  const loginError = document.getElementById("loginError");
  const errorMsg   = document.getElementById("loginErrorMsg");
  const toggleBtn  = document.getElementById("togglePassword");

  toggleBtn.addEventListener("click", () => {
    const visible = passInput.type === "text";
    passInput.type = visible ? "password" : "text";
    toggleBtn.classList.toggle("password-visible", !visible);
    toggleBtn.setAttribute("aria-label", visible ? "Mostrar senha" : "Ocultar senha");
  });

  function setError(groupId, errorId, show) {
    document.getElementById(groupId).classList.toggle("has-error", show);
    document.getElementById(errorId).style.display = show ? "block" : "none";
  }

  function isGmail(v) {
    return /^[a-zA-Z0-9._%+\-]+@gmail\.com$/i.test(v.trim());
  }

  function senhaValida(v) {
    return v.length >= 8 && /[A-Z]/.test(v) && /[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v);
  }

  const reqEls = {
    len:     document.getElementById("req-len"),
    upper:   document.getElementById("req-upper"),
    number:  document.getElementById("req-number"),
    special: document.getElementById("req-special"),
  };

  function atualizarChecklist(v) {
    const checks = {
      len:     v.length >= 8,
      upper:   /[A-Z]/.test(v),
      number:  /[0-9]/.test(v),
      special: /[^A-Za-z0-9]/.test(v),
    };
    Object.entries(checks).forEach(([k, ok]) => {
      const el = reqEls[k];
      el.textContent = (ok ? "✓ " : "✗ ") + el.textContent.slice(2);
      el.style.color  = ok ? "#16a34a" : "#94a3b8";
    });
  }

  passInput.addEventListener("focus", () => {
    document.getElementById("pwdChecklist").style.display = "flex";
  });

  passInput.addEventListener("input", () => {
    atualizarChecklist(passInput.value);
    loginError.classList.remove("is-visible");
  });

  emailInput.addEventListener("blur", () => {
    setError("groupEmail", "emailError", !isGmail(emailInput.value));
  });

  emailInput.addEventListener("input", () => loginError.classList.remove("is-visible"));

  passInput.addEventListener("blur", () => {
    setError("groupPassword", "passwordError", passInput.value.length > 0 && !senhaValida(passInput.value));
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailVal = emailInput.value.trim();
    const passVal  = passInput.value;
    let valid = true;

    if (!isGmail(emailVal)) {
      setError("groupEmail", "emailError", true);
      valid = false;
    } else {
      setError("groupEmail", "emailError", false);
    }

    if (!senhaValida(passVal)) {
      setError("groupPassword", "passwordError", true);
      document.getElementById("pwdChecklist").style.display = "flex";
      atualizarChecklist(passVal);
      valid = false;
    } else {
      setError("groupPassword", "passwordError", false);
    }

    if (!valid) return;

    loginBtn.classList.add("is-loading");
    loginBtn.disabled = true;
    loginError.classList.remove("is-visible");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailVal, senha: passVal }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.token) {
        const storage = document.getElementById("rememberMe").checked
          ? localStorage
          : sessionStorage;
        storage.setItem("sc_token", data.token);
        storage.setItem("sc_user", JSON.stringify(data.user ?? {}));
        window.location.href = "/index.html";      } else {
        const msg = data.mensagem || data.message || data.error || "E-mail ou senha incorretos.";
        errorMsg.textContent = msg;
        loginError.classList.add("is-visible");
        passInput.value = "";
        passInput.focus();
      }
    } catch {
      errorMsg.textContent = "Não foi possível conectar ao servidor. Tente novamente.";
      loginError.classList.add("is-visible");
    } finally {
      loginBtn.classList.remove("is-loading");
      loginBtn.disabled = false;
    }
  });

  const token = localStorage.getItem("sc_token") || sessionStorage.getItem("sc_token");
  if (token) window.location.href = "/index.html";
})();
