(() => {
  const form = document.getElementById("registerForm");
  const registerBtn = document.getElementById("registerBtn");
  const errorBanner = document.getElementById("registerError");
  const errorMsg = document.getElementById("registerErrorMsg");

  function wireToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    btn.addEventListener("click", () => {
      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      btn.classList.toggle("password-visible", !visible);
      btn.setAttribute(
        "aria-label",
        visible ? "Mostrar senha" : "Ocultar senha",
      );
    });
  }
  wireToggle("togglePwd", "adminPwd");
  wireToggle("toggleConfirmPwd", "confirmPwd");

  const cnpjInput = document.getElementById("orgCnpj");
  cnpjInput &&
    cnpjInput.addEventListener("input", () => {
      let v = cnpjInput.value.replace(/\D/g, "").slice(0, 14);
      if (v.length > 12)
        v = v.replace(
          /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
          "$1.$2.$3/$4-$5",
        );
      else if (v.length > 8)
        v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d+)$/, "$1.$2.$3/$4");
      else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})(\d+)$/, "$1.$2.$3");
      else if (v.length > 2) v = v.replace(/^(\d{2})(\d+)$/, "$1.$2");
      cnpjInput.value = v;
    });

  const phoneInput = document.getElementById("orgPhone");
  phoneInput &&
    phoneInput.addEventListener("input", () => {
      let v = phoneInput.value.replace(/\D/g, "").slice(0, 11);
      if (v.length > 10) v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
      else if (v.length > 6)
        v = v.replace(/^(\d{2})(\d{4,5})(\d*)$/, "($1) $2-$3");
      else if (v.length > 2) v = v.replace(/^(\d{2})(\d+)$/, "($1) $2");
      phoneInput.value = v;
    });

  const cepInput = document.getElementById("orgCep");
  const cepWrap = document.getElementById("cepInputWrap");
  const cepError = document.getElementById("errorCep");

  function setCepState(state) {
    cepWrap.classList.remove("is-loading", "cep-ok", "cep-err");
    if (state) cepWrap.classList.add(state);
  }

  function preencherEndereco(d) {
    document.getElementById("orgLogradouro").value = d.logradouro || "";
    document.getElementById("orgBairro").value = d.bairro || "";
    document.getElementById("orgCidade").value = d.localidade || "";
    document.getElementById("orgUf").value = d.uf || "";
  }

  function limparEndereco() {
    ["orgLogradouro", "orgBairro", "orgCidade", "orgUf"].forEach((id) => {
      document.getElementById(id).value = "";
    });
  }

  cepInput.addEventListener("input", () => {
    let v = cepInput.value.replace(/\D/g, "").slice(0, 8);
    if (v.length > 5) v = v.replace(/^(\d{5})(\d+)$/, "$1-$2");
    cepInput.value = v;
    setCepState(null);
    cepError.style.display = "none";
    if (v.replace(/\D/g, "").length < 8) limparEndereco();
  });

  cepInput.addEventListener("blur", async () => {
    const digits = cepInput.value.replace(/\D/g, "");
    if (digits.length !== 8) return;

    setCepState("is-loading");
    cepError.style.display = "none";

    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();

      if (data.erro) {
        setCepState("cep-err");
        cepError.style.display = "block";
        limparEndereco();
      } else {
        setCepState("cep-ok");
        preencherEndereco(data);
        document.getElementById("orgNum").focus();
      }
    } catch {
      setCepState("cep-err");
      cepError.textContent = "Falha ao consultar o CEP. Verifique sua conexão.";
      cepError.style.display = "block";
    }
  });

  function setError(groupId, errorId, show) {
    document.getElementById(groupId)?.classList.toggle("has-error", show);
    const errEl = document.getElementById(errorId);
    if (errEl) errEl.style.display = show ? "block" : "none";
  }

  function isGmail(v) {
    return /^[a-zA-Z0-9._%+\-]+@gmail\.com$/i.test(v.trim());
  }

  function senhaForte(v) {
    return (
      v.length >= 8 &&
      /[A-Z]/.test(v) &&
      /[0-9]/.test(v) &&
      /[^A-Za-z0-9]/.test(v)
    );
  }

  const checklist = document.getElementById("pwdChecklist");
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

  const pwdInput = document.getElementById("adminPwd");

  pwdInput.addEventListener("input", () => {
    if (checklist.style.display === "flex") {
      atualizarChecklist(pwdInput.value);
      if (senhaForte(pwdInput.value)) checklist.style.display = "none";
    }
    errorBanner.classList.remove("is-visible");
  });

  form.addEventListener("input", () =>
    errorBanner.classList.remove("is-visible"),
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const orgType =
      form.querySelector("input[name=org_type]:checked")?.value || "";
    const orgName = document.getElementById("orgName").value.trim();
    const adminName = document.getElementById("adminName").value.trim();
    const adminEmail = document.getElementById("adminEmail").value.trim();
    const pwd = pwdInput.value;
    const confirmPwd = document.getElementById("confirmPwd").value;
    const terms = document.getElementById("acceptTerms").checked;

    let valid = true;

    if (!orgType) {
      setError("groupOrgType", "errorOrgType", true);
      valid = false;
    } else {
      setError("groupOrgType", "errorOrgType", false);
    }

    if (!orgName) {
      setError("groupOrgName", "errorOrgName", true);
      valid = false;
    } else {
      setError("groupOrgName", "errorOrgName", false);
    }

    if (!adminName) {
      setError("groupAdminName", "errorAdminName", true);
      valid = false;
    } else {
      setError("groupAdminName", "errorAdminName", false);
    }

    if (!isGmail(adminEmail)) {
      setError("groupAdminEmail", "errorAdminEmail", true);
      valid = false;
    } else {
      setError("groupAdminEmail", "errorAdminEmail", false);
    }

    if (!senhaForte(pwd)) {
      setError("groupAdminPwd", "errorAdminPwd", true);
      checklist.style.display = "flex";
      atualizarChecklist(pwd);
      valid = false;
    } else {
      setError("groupAdminPwd", "errorAdminPwd", false);
    }

    if (pwd !== confirmPwd) {
      setError("groupConfirmPwd", "errorConfirmPwd", true);
      valid = false;
    } else {
      setError("groupConfirmPwd", "errorConfirmPwd", false);
    }

    if (!terms) {
      setError("groupTerms", "errorTerms", true);
      valid = false;
    } else {
      setError("groupTerms", "errorTerms", false);
    }

    if (!valid) return;

    registerBtn.classList.add("is-loading");
    registerBtn.disabled = true;
    errorBanner.classList.remove("is-visible");

    try {
      const logradouro = document.getElementById("orgLogradouro").value.trim();
      const numero = document.getElementById("orgNum").value.trim();
      const complemento = document
        .getElementById("orgComplemento")
        .value.trim();
      const bairro = document.getElementById("orgBairro").value.trim();
      const cidade = document.getElementById("orgCidade").value.trim();
      const uf = document.getElementById("orgUf").value.trim();
      const cep = document.getElementById("orgCep").value.trim();

      let addressParts = [];
      if (logradouro) {
        let line = logradouro;
        if (numero) line += ", " + numero;
        if (complemento) line += ", " + complemento;
        addressParts.push(line);
      }
      if (bairro) addressParts.push(bairro);
      if (cidade && uf) addressParts.push(cidade + " - " + uf);
      else if (cidade) addressParts.push(cidade);
      if (cep) addressParts.push(cep);

      const res = await fetch("/api/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_type: orgType,
          org_name: orgName,
          cnpj: document.getElementById("orgCnpj").value.trim() || undefined,
          phone: document.getElementById("orgPhone").value.trim() || undefined,
          address: addressParts.join(" - ") || undefined,
          name: adminName,
          email: adminEmail,
          senha: pwd,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        if (data.aguardando_verificacao) {
          // Mostra painel de verificação de e-mail
          document.getElementById("registerForm").style.display = "none";
          mostrarPainelVerificacao(data.email);
        } else {
          if (data.token) {
            sessionStorage.setItem("sc_token", data.token);
            sessionStorage.setItem("sc_user", JSON.stringify(data.user || {}));
          }
          window.location.href = "index.html";
        }
      } else {
        const msg =
          data.erro ||
          data.error ||
          data.message ||
          "Erro ao criar conta. Verifique os dados e tente novamente.";
        errorMsg.textContent = msg;
        errorBanner.classList.add("is-visible");
      }
    } catch {
      errorMsg.textContent =
        "Não foi possível conectar ao servidor. Tente novamente.";
      errorBanner.classList.add("is-visible");
    } finally {
      registerBtn.classList.remove("is-loading");
      registerBtn.disabled = false;
    }
  });

  /* ── Painel de verificação de e-mail ──────────────────────── */

  function mostrarPainelVerificacao(email) {
    const panel = document.getElementById("verifyPanel");
    panel.style.display = "block";
    document.getElementById("verifyEmailLabel").textContent = email;
    document.getElementById("verifyError").classList.remove("is-visible");
    panel.scrollIntoView({ behavior: "smooth", block: "start" });

    const digits = document.querySelectorAll(".code-digit");

    // Navegação automática entre os inputs
    digits.forEach((inp, i) => {
      inp.addEventListener("input", () => {
        inp.value = inp.value.replace(/\D/g, "").slice(0, 1);
        if (inp.value && i < digits.length - 1) digits[i + 1].focus();
      });
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !inp.value && i > 0) digits[i - 1].focus();
      });
      inp.addEventListener("paste", (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData)
          .getData("text")
          .replace(/\D/g, "");
        [...pasted.slice(0, 6)].forEach((ch, j) => {
          if (digits[j]) digits[j].value = ch;
        });
        const nextEmpty = [...digits].findIndex((d) => !d.value);
        digits[nextEmpty >= 0 ? nextEmpty : 5].focus();
      });
    });
    digits[0].focus();

    // Botão verificar
    document
      .getElementById("verifyBtn")
      .addEventListener("click", () => verificarCodigo(email));

    // Reenvio com cooldown
    iniciarReenvio(email);
  }

  async function verificarCodigo(email) {
    const digits = document.querySelectorAll(".code-digit");
    const code = [...digits].map((d) => d.value).join("");
    const errBanner = document.getElementById("verifyError");
    const errMsg = document.getElementById("verifyErrorMsg");
    const btn = document.getElementById("verifyBtn");

    errBanner.classList.remove("is-visible");

    if (code.length < 6) {
      errMsg.textContent = "Preencha todos os 6 dígitos do código.";
      errBanner.classList.add("is-visible");
      return;
    }

    btn.disabled = true;
    btn.classList.add("is-loading");

    try {
      const res = await fetch("/api/verificar-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.sucesso) {
        // Sucesso: redireciona para login com mensagem
        sessionStorage.setItem("sc_email_verified", "1");
        window.location.href = "/acesso/login/login.html?verified=1";
      } else {
        errMsg.textContent = data.mensagem || "Código inválido ou expirado.";
        errBanner.classList.add("is-visible");
        digits.forEach((d) => {
          d.value = "";
        });
        digits[0].focus();
      }
    } catch {
      errMsg.textContent = "Não foi possível conectar ao servidor.";
      errBanner.classList.add("is-visible");
    } finally {
      btn.disabled = false;
      btn.classList.remove("is-loading");
    }
  }

  function iniciarReenvio(email) {
    const btn = document.getElementById("resendBtn");
    const timer = document.getElementById("resendTimer");
    let secs = 60;

    btn.disabled = true;
    timer.textContent = ` (${secs}s)`;

    const interval = setInterval(() => {
      secs--;
      if (secs <= 0) {
        clearInterval(interval);
        btn.disabled = false;
        timer.textContent = "";
      } else {
        timer.textContent = ` (${secs}s)`;
      }
    }, 1000);

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await fetch("/api/reenviar-verificacao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
      } catch {
        /* silencia */
      }
      // Reinicia cooldown
      secs = 60;
      timer.textContent = ` (${secs}s)`;
      const iv = setInterval(() => {
        secs--;
        if (secs <= 0) {
          clearInterval(iv);
          btn.disabled = false;
          timer.textContent = "";
        } else timer.textContent = ` (${secs}s)`;
      }, 1000);
    });
  }
})();
