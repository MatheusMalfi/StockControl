const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const app = express();
const PORT = 3000;

const projectRoot = path.join(__dirname, "..");

app.use(express.static(projectRoot));
app.use("/acesso", express.static(path.join(projectRoot, "acesso")));

app.use(bodyParser.urlencoded({ extended: true }));

// ROTA ADICIONADA: Redireciona a raiz (/) para a rota /login
app.get("/", (req, res) => {
  res.redirect("/login");
});

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
                window.location.href = "/recover"; 
            </script>
        `);
  }

  console.log(
    `SUCESSO (SIMULADO): Email de recuperação enviado para ${email}.`
  );

  res.send(`
            <script>
                alert("Sucesso! Verifique a caixa de entrada do seu e-mail para continuar a recuperação.");
                window.location.href = "/login";
            </script>
        `);
});

app.get("/login", (req, res) => {
  const filePath = path.join(projectRoot, "acesso", "login", "login.html");

  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).send("Página de Login não encontrada.");
    }
  });
});

app.get("/register", (req, res) => {
  const filePath = path.join(
    projectRoot,
    "acesso",
    "register",
    "register.html"
  );

  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).send("Página de Registro não encontrada.");
    }
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}/login`);
  // A mensagem de acesso agora aponta para a raiz, que redireciona para /login
  console.log(`Acesse o Login (raiz) em: http://localhost:${PORT}/login`);
});
