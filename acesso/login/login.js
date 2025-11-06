const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const app = express();
const PORT = 3000;
const projectRoot = path.join(__dirname, "..");

app.use(express.static(projectRoot));
app.use("/acesso", express.static(path.join(projectRoot, "acesso")));
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/recover", (req, res) => {
  const filePath = path.join(
    projectRoot,
    "acesso",
    "recover-password",
    "recover-password.html"
  );

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Erro ao servir recover-password.html:", err.message);
      res
        .status(404)
        .send("Página de Recuperação não encontrada no caminho esperado.");
    }
  });
});

app.post("/recover-password", (req, res) => {
  const { email, "confirm-email": confirmEmail } = req.body;

  if (email !== confirmEmail) {
    console.log("ERRO: Os e-mails não coincidem.");
    return res.status(400).send(`
            <script>
                alert("Erro: Os e-mails digitados não coincidem!");
                window.location.href = "/recover"; // Redireciona para a rota GET
            </script>
        `);
  }
  console.log(
    `SUCESSO (SIMULADO): Email de recuperação enviado para ${email}.`
  );

  res.send(`
        <script>
            alert("Sucesso! Verifique a caixa de entrada do seu e-mail para continuar a recuperação.");
            window.location.href = "/login"; // Redireciona para uma rota de login
        </script>
    `);
});

app.get("/login", (req, res) => {
  const filePath = path.resolve(projectRoot, "acesso", "login", "login.html");

  console.log(`Tentando servir arquivo em: ${filePath}`);

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error(`ERRO REAL DO SISTEMA: ${err.message}`);
      res.status(404).send("Página de Login não encontrada.");
    }
  });
});

app.post("/login", (req, res) => {
  // Os dados do formulário estão em req.body
  const { email, senha } = req.body;

  // --- Lógica de Validação e Autenticação (A FAZER) ---
  console.log(`Tentativa de Login: E-mail: ${email}, Senha: ${senha}`);

  if (email === "teste@uscs.com" && senha === "123") {
    // SUCESSO DE LOGIN (Apenas um teste SIMULADO)
    console.log("Login OK!");
    // Você deve redirecionar para a página principal do sistema aqui
    res.send(`
        <script>
            alert("Login Efetuado com Sucesso! Bem-vindo.");
            window.location.href = "/"; // Ou para a página principal
        </script>
    `);
  } else {
    // ERRO DE LOGIN
    console.log("Login Falhou!");
    res.status(401).send(`
        <script>
            alert("Erro: E-mail ou senha incorretos.");
            window.location.href = "/login"; // Redireciona de volta para o login
        </script>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(
    `Acesse a recuperação de senha em: http://localhost:${PORT}/recover`
  );
});
