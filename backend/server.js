// ==================== IMPORTS ====================
require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcrypt"); // se der erro no Windows, troque por 'bcryptjs'
const mysql = require("mysql2/promise");

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== STATIC / FRONTEND ====================

// raiz do projeto: .../StockControl (um nível acima do /backend)
const root = path.join(__dirname, "..");
console.log("Static root:", root);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve todos os arquivos estáticos da pasta StockControl (HTML, CSS, JS, imagens…)
app.use(express.static(root));

// Rota inicial -> abre o login.html
app.get("/", (req, res) => {
  res.sendFile(path.join(root, "acesso", "login", "login.html"));
});

// (Opcional) rota direta pro cadastro
app.get("/register", (req, res) => {
  res.sendFile(path.join(root, "acesso", "register", "register.html"));
});

// ==================== MYSQL POOL ====================
//
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3000),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "stockcontrol",
  waitForConnections: true,
  connectionLimit: 10,
});

// ==================== HEALTHCHECK ====================

app.get("/healthz", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({ ok: true, db: rows[0].ok === 1 });
  } catch (err) {
    console.error("Erro no /healthz:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ==================== CADASTRO ====================
//
// Usa as tabelas: organizations, users (do seu script SQL).
// Espera o body:
// {
//   email_institucional, confirma_email,
//   senha, confirma_senha,
//   nome_empresa, cnpj, endereco, telefone, celular
// }

app.post("/api/cadastro", async (req, res) => {
  try {
    const {
      email_institucional,
      confirma_email,
      senha,
      confirma_senha,
      nome_empresa,
      cnpj,
      endereco,
      telefone,
      celular,
    } = req.body;

    if (!email_institucional || !senha || !nome_empresa) {
      return res.status(400).json({ erro: "Campos obrigatórios ausentes." });
    }

    if (email_institucional !== confirma_email) {
      return res
        .status(400)
        .json({ erro: "E-mail e confirmação não conferem." });
    }

    if (senha !== confirma_senha) {
      return res
        .status(400)
        .json({ erro: "Senha e confirmação não conferem." });
    }

    // E-mail já usado?
    const [dup] = await pool.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email_institucional]
    );
    if (dup.length) {
      return res.status(400).json({ erro: "E-mail já cadastrado." });
    }

    // Descobrir/ criar organização pelo CNPJ
    let organizationId;

    if (cnpj) {
      const [org] = await pool.query(
        "SELECT id FROM organizations WHERE cnpj = ? LIMIT 1",
        [cnpj]
      );
      if (org.length) {
        organizationId = org[0].id;
      }
    }

    if (!organizationId) {
      const [insOrg] = await pool.execute(
        `INSERT INTO organizations
         (org_type, name, cnpj, email, phone, mobile, address_line1)
         VALUES ('ONG', ?, ?, ?, ?, ?, ?)`,
        [
          nome_empresa,
          cnpj || null,
          email_institucional,
          telefone || null,
          celular || null,
          endereco || null,
        ]
      );
      organizationId = insOrg.insertId;
    }

    // Cria usuário ADMIN da ONG
    const hash = await bcrypt.hash(senha, 10);
    const [insUser] = await pool.execute(
      `INSERT INTO users
       (organization_id, email, password_hash, name, role, is_active)
       VALUES (?, ?, ?, ?, 'ADMIN', 1)`,
      [organizationId, email_institucional, hash, nome_empresa]
    );

    res.status(201).json({
      ok: true,
      user_id: insUser.insertId,
      organization_id: organizationId,
    });
  } catch (err) {
    console.error("Erro no cadastro:", err);
    res.status(500).json({ erro: "Erro interno no servidor" });
  }
});

// ==================== LOGIN ====================
//
// Espera body:
// { email, senha }

app.post("/api/login", async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res
        .status(400)
        .json({ mensagem: "E-mail e senha são obrigatórios." });
    }

    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (!rows.length) {
      return res.status(401).json({ mensagem: "E-mail ou senha incorretos." });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(senha, user.password_hash);

    if (!ok) {
      return res.status(401).json({ mensagem: "E-mail ou senha incorretos." });
    }

    res.json({
      success: true,
      mensagem: "Login OK",
      user_id: user.id,
      organization_id: user.organization_id,
    });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ mensagem: "Erro interno no servidor" });
  }
});

// ========== CRIAR ITEM ==========
app.post("/api/items", async (req, res) => {
  try {
    const {
      organization_id,
      category_id,
      brand_id,
      model_id,
      product_name,
      product_brand,
      product_model,
      serial_number,
      description,
      condition_id,
      weight_kg,
      photo_url,
      created_by,
    } = req.body;

    if (!organization_id || !product_name || !condition_id) {
      return res.status(400).json({ message: "Campos obrigatórios ausentes." });
    }

    const [result] = await pool.execute(
      `INSERT INTO items 
      (organization_id, category_id, brand_id, model_id, product_name, product_brand, product_model, serial_number, description, condition_id, weight_kg, photo_url, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        organization_id,
        category_id || null,
        brand_id || null,
        model_id || null,
        product_name,
        product_brand || null,
        product_model || null,
        serial_number || null,
        description || null,
        condition_id,
        weight_kg || null,
        photo_url || null,
        created_by || null,
      ]
    );

    res.json({ success: true, item_id: result.insertId });
  } catch (err) {
    console.error("Erro ao criar item:", err);
    res.status(500).json({ message: "Erro ao salvar item." });
  }
});

// ========== MARCAR ITEM PARA DESCARTE ==========
// ========== DESCARTAR ITENS ==========
app.post("/api/items/discard", async (req, res) => {
  try {
    const { organization_id, created_by, item_ids, item_id } = req.body;

    // Normaliza: aceita item_ids (array) ou item_id (único)
    let idsRaw = [];
    if (Array.isArray(item_ids)) {
      idsRaw = item_ids;
    } else if (item_id !== undefined && item_id !== null) {
      idsRaw = [item_id];
    }

    const ids = idsRaw.map((v) => Number(v)).filter((n) => !Number.isNaN(n));

    if (!organization_id || ids.length === 0) {
      return res.status(400).json({ message: "Campos obrigatórios faltando." });
    }

    // Pega o ID da condição DESCARTAR
    const [condRows] = await pool.query(
      "SELECT id FROM conditions WHERE code = 'DESCARTAR' LIMIT 1"
    );
    if (!condRows.length) {
      return res
        .status(500)
        .json({ message: "Condição DESCARTAR não encontrada." });
    }
    const newConditionId = condRows[0].id;

    for (const id of ids) {
      // Descobre condição anterior
      const [prevRows] = await pool.query(
        "SELECT condition_id FROM items WHERE id = ? AND organization_id = ? LIMIT 1",
        [id, organization_id]
      );
      const prevConditionId = prevRows.length ? prevRows[0].condition_id : null;

      // Atualiza o item para DESCARTAR
      await pool.execute(
        "UPDATE items SET condition_id = ? WHERE id = ? AND organization_id = ?",
        [newConditionId, id, organization_id]
      );

      // Registra no histórico
      await pool.execute(
        `INSERT INTO disposal_history
         (item_id, organization_id, destination_type, prev_condition_id, new_condition_id, action, quantity, created_by)
         VALUES (?, ?, 'INTERNAL', ?, ?, 'MARKED_FOR_DISPOSAL', 1, ?)`,
        [
          id,
          organization_id,
          prevConditionId,
          newConditionId,
          created_by || null,
        ]
      );
    }

    res.json({
      success: true,
      message: "Itens descartados registrados com sucesso.",
    });
  } catch (err) {
    console.error("Erro em /api/items/discard:", err);
    res.status(500).json({ message: "Erro ao descartar itens." });
  }
});

// ========== SOLICITAR COLETA P/ IMPACTO METAIS ==========
app.post("/api/disposal/request", async (req, res) => {
  try {
    const { organization_id, created_by, items } = req.body;

    if (!organization_id || !items || !items.length) {
      return res.status(400).json({ message: "Dados insuficientes." });
    }

    // pegar recicladora automaticamente
    const [recycler] = await pool.query(
      `SELECT id FROM organizations WHERE name LIKE '%Impacto Metais%' LIMIT 1`
    );

    if (!recycler.length) {
      return res
        .status(500)
        .json({ message: "Impacto Metais não encontrada." });
    }

    const recycler_id = recycler[0].id;

    // cria pedido
    const [pedido] = await pool.execute(
      `INSERT INTO recycler_orders 
       (organization_id, recycler_id, status, created_by)
       VALUES (?, ?, 'REQUESTED', ?)`,
      [organization_id, recycler_id, created_by]
    );

    const order_id = pedido.insertId;

    // adiciona itens ao pedido
    for (const it of items) {
      await pool.execute(
        `INSERT INTO recycler_order_items 
         (recycler_order_id, item_id, quantity)
         VALUES (?, ?, 1)`,
        [order_id, it]
      );
    }

    res.json({ success: true, order_id });
  } catch (err) {
    console.error("Erro ao solicitar coleta:", err);
    res.status(500).json({ message: "Erro ao solicitar coleta." });
  }
});
// ========== HOME DASHBOARD ==========
// Retorna itens cadastrados, itens para descarte e históricos
app.get("/api/home", async (req, res) => {
  try {
    const organization_id = req.query.organization_id;
    if (!organization_id) {
      return res.status(400).json({ message: "organization_id faltando." });
    }

    // --- ITENS CADASTRADOS ---
    const [itens] = await pool.query(
      `
      SELECT 
        i.id,
        i.product_name,
        COALESCE(i.product_brand, b.name) AS brand,
        COALESCE(i.product_model, m.name) AS model,
        c.label_pt AS condition_label,
        c.code AS condition_code,
        i.photo_url,
        i.description,
        i.created_at
      FROM items i
      LEFT JOIN brands b ON b.id = i.brand_id
      LEFT JOIN models m ON m.id = i.model_id
      JOIN conditions c ON c.id = i.condition_id
      WHERE i.organization_id = ? AND i.is_active = 1
      ORDER BY i.created_at DESC
    `,
      [organization_id]
    );

    // --- ITENS PARA COLETA (DESCARTAR) ---
    const itensDescartar = itens.filter(
      (i) => i.condition_code === "DESCARTAR"
    );

    // --- HISTÓRICO DE DESCARTE ---
    const [historico] = await pool.query(
      `
      SELECT 
        h.id,
        h.item_id,
        i.product_name,
        i.product_brand,
        i.product_model,
        CASE
   WHEN h.action = 'MARKED_FOR_DISPOSAL' THEN 'Descarte'
   WHEN h.action = 'REQUESTED_PICKUP' THEN 'Coleta Solicitada'
   WHEN h.action = 'PICKED_UP' THEN 'Coletado'
   ELSE REPLACE(h.action, '_', ' ')       
   END AS action_label,
        h.created_at
      FROM disposal_history h
      JOIN items i ON i.id = h.item_id
      WHERE h.organization_id = ?
      ORDER BY h.created_at DESC
      LIMIT 50
    `,
      [organization_id]
    );

    res.json({
      success: true,
      itens,
      itensDescartar,
      historico,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao carregar dados da home" });
  }
});

// ========== DESCARTAR ITEM (marca como DESCARTAR e registra histórico) ==========
app.post("/api/items/discard", async (req, res) => {
  try {
    const { item_id, organization_id, created_by } = req.body;

    if (!item_id || !organization_id) {
      return res
        .status(400)
        .json({ message: "item_id e organization_id são obrigatórios." });
    }

    // pega condição anterior
    const [rows] = await pool.query(
      `SELECT condition_id FROM items WHERE id = ? AND organization_id = ? LIMIT 1`,
      [item_id, organization_id]
    );
    if (!rows.length) {
      return res
        .status(404)
        .json({ message: "Item não encontrado para esta organização." });
    }
    const prevConditionId = rows[0].condition_id;

    // pega id da condição DESCARTAR
    const [cond] = await pool.query(
      `SELECT id FROM conditions WHERE code = 'DESCARTAR' LIMIT 1`
    );
    if (!cond.length) {
      return res.status(500).json({
        message: "Condição DESCARTAR não encontrada na tabela conditions.",
      });
    }
    const newConditionId = cond[0].id;

    // atualiza item para condição DESCARTAR
    await pool.execute(
      `UPDATE items
       SET condition_id = ?, updated_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [newConditionId, item_id, organization_id]
    );

    // registra histórico na disposal_history
    await pool.execute(
      `INSERT INTO disposal_history
         (item_id, organization_id, destination_type, prev_condition_id, new_condition_id, action, quantity, created_by)
       VALUES
         (?,       ?,              'INTERNAL',       ?,                 ?,                'MARKED_FOR_DISPOSAL', 1, ?)`,
      [
        item_id,
        organization_id,
        prevConditionId,
        newConditionId,
        created_by || null,
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Erro no /api/items/discard:", err);
    res.status(500).json({ message: "Erro ao descartar item." });
  }
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
