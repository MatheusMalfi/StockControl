(() => {
  const form         = document.getElementById("recover-form");
  const emailInput   = document.querySelector("input[name='email']");
  const confirmInput = document.querySelector("input[name='confirm-email']");
  const submitBtn    = form.querySelector("button[type='submit']");

  function showError(input, msg) {
    let errEl = input.nextElementSibling;
    if (!errEl || !errEl.classList.contains("form-error")) {
      errEl = document.createElement("span");
      errEl.className = "form-error";
      errEl.style.cssText = "color:#ef4444;font-size:0.8125rem;margin-top:4px;display:block";
      input.after(errEl);
    }
    errEl.textContent = msg;
    input.style.borderColor = "#ef4444";
  }

  function clearError(input) {
    const errEl = input.nextElementSibling;
    if (errEl?.classList.contains("form-error")) errEl.textContent = "";
    input.style.borderColor = "";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email   = emailInput.value.trim();
    const confirm = confirmInput.value.trim();
    let valid = true;

    if (!email) {
      showError(emailInput, "Informe seu e-mail.");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError(emailInput, "Informe um e-mail válido.");
      valid = false;
    } else {
      clearError(emailInput);
    }

    if (!confirm) {
      showError(confirmInput, "Confirme seu e-mail.");
      valid = false;
    } else if (email !== confirm) {
      showError(confirmInput, "Os e-mails não são iguais.");
      valid = false;
    } else {
      clearError(confirmInput);
    }

    if (!valid) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "ENVIANDO...";

    try {
      const res = await fetch("/api/recuperar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        form.innerHTML = `
          <p style="text-align:center;color:#16a34a;font-weight:600;">
            E-mail de recuperação enviado!<br>
            <small style="color:#64748b;font-weight:400;">Verifique sua caixa de entrada.</small>
          </p>`;
      } else {
        const msg = data.erro || data.message || "Erro ao enviar. Tente novamente.";
        showError(emailInput, msg);
        submitBtn.disabled = false;
        submitBtn.textContent = "ENVIAR";
      }
    } catch {
      showError(emailInput, "Não foi possível conectar ao servidor.");
      submitBtn.disabled = false;
      submitBtn.textContent = "ENVIAR";
    }
  });
})();
