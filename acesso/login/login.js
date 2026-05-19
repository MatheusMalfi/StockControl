(() => {
  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("email");
  const passInput = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");
  const loginError = document.getElementById("loginError");
  const errorMsg = document.getElementById("loginErrorMsg");
  const toggleBtn = document.getElementById("togglePassword");

  // Exibe banner de sucesso se veio da verificação de e-mail
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("verified") === "1") {
    const banner = document.createElement("div");
    banner.style.cssText =
      "background:#f0fdf4;border:1px solid #86efac;color:#166534;border-radius:8px;padding:12px 16px;" +
      "display:flex;align-items:center;gap:10px;margin-bottom:16px;font-size:0.9375rem;";
    banner.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
      "<span>E-mail verificado com sucesso! Faça login para continuar.</span>";
    form.insertAdjacentElement("beforebegin", banner);
    // Remove o parâmetro da URL sem recarregar a página
    history.replaceState(null, "", window.location.pathname);
  }

  toggleBtn.addEventListener("click", () => {
    const visible = passInput.type === "text";
    passInput.type = visible ? "password" : "text";
    toggleBtn.classList.toggle("password-visible", !visible);
    toggleBtn.setAttribute(
      "aria-label",
      visible ? "Mostrar senha" : "Ocultar senha",
    );
  });

  function setError(groupId, errorId, show) {
    document.getElementById(groupId).classList.toggle("has-error", show);
    document.getElementById(errorId).style.display = show ? "block" : "none";
  }

  function isGmail(v) {
    return /^[a-zA-Z0-9._%+\-]+@gmail\.com$/i.test(v.trim());
  }

  function senhaValida(v) {
    return (
      v.length >= 8 &&
      /[A-Z]/.test(v) &&
      /[0-9]/.test(v) &&
      /[^A-Za-z0-9]/.test(v)
    );
  }

  const reqEls = {
    len: document.getElementById("req-len"),
    upper: document.getElementById("req-upper"),
    number: document.getElementById("req-number"),
    special: document.getElementById("req-special"),
  };

  function atualizarChecklist(v) {
    const checks = {
      len: v.length >= 8,
      upper: /[A-Z]/.test(v),
      number: /[0-9]/.test(v),
      special: /[^A-Za-z0-9]/.test(v),
    };
    Object.entries(checks).forEach(([k, ok]) => {
      const el = reqEls[k];
      el.textContent = (ok ? "✓ " : "✗ ") + el.textContent.slice(2);
      el.style.color = ok ? "#16a34a" : "#94a3b8";
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

  emailInput.addEventListener("input", () =>
    loginError.classList.remove("is-visible"),
  );

  passInput.addEventListener("blur", () => {
    setError(
      "groupPassword",
      "passwordError",
      passInput.value.length > 0 && !senhaValida(passInput.value),
    );
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailVal = emailInput.value.trim();
    const passVal = passInput.value;
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

        // Record login session in access log (always in localStorage)
        try {
          const ua = navigator.userAgent;
          let dispositivo = "Navegador Web";
          if (/android/i.test(ua)) dispositivo = "Android";
          else if (/iphone|ipad/i.test(ua)) dispositivo = "iPhone/iPad";
          else if (/windows/i.test(ua)) dispositivo = "Windows";
          else if (/macintosh/i.test(ua)) dispositivo = "Mac";
          else if (/linux/i.test(ua)) dispositivo = "Linux";
          const prev = JSON.parse(localStorage.getItem("log_acessos") || "[]");
          const log = Array.isArray(prev) ? prev : [];
          log.forEach((e) => {
            if (e.atual) {
              e.atual = false;
              e.fim = new Date().toISOString();
            }
          });
          log.unshift({
            dispositivo,
            ip: "—",
            atual: true,
            inicio: new Date().toISOString(),
            fim: null,
          });
          localStorage.setItem("log_acessos", JSON.stringify(log.slice(0, 20)));
        } catch {}

        window.location.href = "/index.html";
      } else {
        if (res.status === 403 && data.email_nao_verificado) {
          // Mostra mensagem especial com link para reenviar o código
          errorMsg.innerHTML =
            `E-mail não verificado. ` +
            `<a href="#" id="loginResendLink" style="color:inherit;font-weight:600;text-decoration:underline;">Reenviar código</a>`;
          loginError.classList.add("is-visible");

          document
            .getElementById("loginResendLink")
            .addEventListener("click", async (ev) => {
              ev.preventDefault();
              try {
                await fetch("/api/reenviar-verificacao", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: data.email || emailVal }),
                });
              } catch {
                /* silencia */
              }
              errorMsg.textContent = "Código reenviado! Verifique seu e-mail.";
              loginError.style.background = "#f0fdf4";
              loginError.style.borderColor = "#86efac";
              loginError.style.color = "#166534";
            });
        } else {
          const msg =
            data.mensagem ||
            data.message ||
            data.error ||
            "E-mail ou senha incorretos.";
          errorMsg.textContent = msg;
          loginError.classList.add("is-visible");
        }
        passInput.value = "";
        passInput.focus();
      }
    } catch {
      errorMsg.textContent =
        "Não foi possível conectar ao servidor. Tente novamente.";
      loginError.classList.add("is-visible");
    } finally {
      loginBtn.classList.remove("is-loading");
      loginBtn.disabled = false;
    }
  });

  const token =
    localStorage.getItem("sc_token") || sessionStorage.getItem("sc_token");
  if (token) window.location.href = "/index.html";
})();
