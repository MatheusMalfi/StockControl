const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const app = express();
const PORT = 3000;

// O __dirname aponta para a pasta atual (onde está login.js), que é 'acesso/login'
// O projectRoot (path.join(__dirname, "..")) aponta para a pasta 'acesso'
const acessoRoot = path.join(__dirname, "..");
const projectRoot = path.join(__dirname, "..", ".."); // Sobe dois níveis para a raiz do projeto

// Middleware para servir a pasta raiz
app.use(express.static(projectRoot));
// Middleware para servir os arquivos dentro de acesso (como CSS/JS)
app.use("/acesso", express.static(acessoRoot));
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/recover", (req, res) => {
  // O arquivo recover-password.html está dentro de `acesso/recover-password`
  const filePath = path.join(
    acessoRoot,
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
  // ✅ CORRIGIDO: O login.html está na pasta atual do __dirname.
  const filePath = path.resolve(__dirname, "login.html");

  console.log(`Tentando servir arquivo em: ${filePath}`);

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error(`ERRO REAL DO SISTEMA: ${err.message}`);
      res.status(404).send("Página de Login não encontrada.");
    }
  });
});

app.post("/login", (req, res) => {
  const { email, senha } = req.body;
  console.log(`Tentativa de Login: E-mail: ${email}, Senha: ${senha}`);

  if (email === "matheus.teste@gmail.com" && senha === "123456789") {
    console.log("Login OK! Redirecionando para /home...");
    res.redirect("/home");
  } else {
    console.log("Login Falhou!");
    res.status(401).send(`
  <script>
   alert("Erro: E-mail ou senha incorretos.");
   window.location.href = "/login"; // Redireciona de volta para o login
  </script>
 `);
  }
});

app.get("/home", (req, res) => {
  // ✅ CORRIGIDO: Agora usamos o projectRoot (raiz do projeto) + o caminho relativo
  const filePath = path.resolve(
    projectRoot,
    "navigation-screens",
    "home",
    "home.html"
  );

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error(`ERRO: Página Home não encontrada: ${err.message}`);
      res
        .status(404)
        .send("Página Home não encontrada. Verifique o caminho no servidor.");
    }
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}/login`);
});
