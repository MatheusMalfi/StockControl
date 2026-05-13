(() => {
  const form       = document.querySelector(".form-recuperar");
  const senhaInput = document.getElementById("senha");
  const confirmInput = document.getElementById("confirmar_senha");

  const token = new URLSearchParams(window.location.search).get("token");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const senha     = senhaInput.value.trim();
    const confirmar = confirmInput.value.trim();

    if (!senha || !confirmar) {
      alert("Preencha ambos os campos.");
      return;
    }

    if (senha !== confirmar) {
      alert("As senhas não são iguais!");
      return;
    }

    if (senha.length < 8) {
      alert("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    try {
      const res = await fetch("/api/alterar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, senha }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        alert("Senha alterada com sucesso!");
        window.location.href = "/acesso/login/login.html";
      } else {
        alert(data.erro || data.message || "Erro ao alterar a senha. Tente novamente.");
      }
    } catch {
      alert("Não foi possível conectar ao servidor. Tente novamente.");
    }
  });
})();
