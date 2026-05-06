require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");

const authRoutes     = require("./src/routes/auth.routes");
const itemsRoutes    = require("./src/routes/items.routes");
const homeRoutes     = require("./src/routes/home.routes");
const disposalRoutes = require("./src/routes/disposal.routes");
const recyclerRoutes = require("./src/routes/recycler.routes");
const pagesRoutes    = require("./src/routes/pages.routes");
const pool           = require("./src/db");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Serve arquivos estáticos do projeto (HTML, CSS, JS, imagens)
app.use(express.static(path.join(__dirname, "..")));

// Rotas da API
app.use("/api",          authRoutes);       // POST /api/login, POST /api/cadastro
app.use("/api/items",    itemsRoutes);      // CRUD /api/items + POST /api/items/discard
app.use("/api/home",     homeRoutes);       // GET /api/home
app.use("/api",          disposalRoutes);   // POST /api/disposal/request, GET /api/collection-history
app.use("/api/recycler", recyclerRoutes);   // Rotas do Impacto Metais

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
