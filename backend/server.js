const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

process.chdir(__dirname);

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, ".env"),
];
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const express = require("express");
const cors = require("cors");

const authRoutes = require("./src/routes/auth.routes");
const categoriesRoutes = require("./src/routes/categories.routes");
const itemsRoutes = require("./src/routes/items.routes");
const homeRoutes = require("./src/routes/home.routes");
const disposalRoutes = require("./src/routes/disposal.routes");
const recyclerRoutes = require("./src/routes/recycler.routes");
const pagesRoutes = require("./src/routes/pages.routes");
const movimentacoesRoutes = require("./src/routes/movimentacoes.routes");
const solicitacoesRoutes = require("./src/routes/solicitacoes.routes");
const parceirosRoutes = require("./src/routes/parceiros.routes");
const notificacoesRoutes = require("./src/routes/notificacoes.routes");
const relatoriosRoutes = require("./src/routes/relatorios.routes");
const configuracoesRoutes = require("./src/routes/configuracoes.routes");
const usuariosRoutes = require("./src/routes/usuarios.routes");
const pool = require("./src/db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Serve arquivos estáticos do projeto (HTML, CSS, JS, imagens)
// sem responder "/" automaticamente com index.html.
app.use(express.static(path.join(__dirname, ".."), { index: false }));

// Rotas da API
app.use("/api", authRoutes); // POST /api/login, /cadastro, /recuperar-senha, /alterar-senha, GET /users/me
app.use("/api", categoriesRoutes); // GET /api/categories
app.use("/api/items", itemsRoutes); // CRUD /api/items + POST /api/items/discard
app.use("/api/home", homeRoutes); // GET /api/home
app.use("/api", disposalRoutes); // POST /api/disposal/request, GET /api/collection-history
app.use("/api/recycler", recyclerRoutes); // Rotas do Impacto Metais
app.use("/api/movimentacoes", movimentacoesRoutes); // CRUD /api/movimentacoes
app.use("/api/solicitacoes", solicitacoesRoutes); // CRUD /api/solicitacoes + /revisar, /status
app.use("/api/parceiros", parceirosRoutes); // CRUD /api/parceiros
app.use("/api/notificacoes", notificacoesRoutes); // GET, POST /sync, PUT /rules
app.use("/api/relatorios", relatoriosRoutes); // GET /api/relatorios
app.use("/api/configuracoes", configuracoesRoutes); // GET, PUT /perfil, /organizacao, /preferencias, /notificacoes
app.use("/api/usuarios", usuariosRoutes); // POST, PUT /:id, DELETE /:id

// Healthcheck
app.get("/healthz", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({ ok: true, db: rows[0].ok === 1 });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Páginas HTML (deve ficar após as rotas da API)
app.use("/", pagesRoutes);

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
