require("dotenv").config();
const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const cors = require("cors");
const bcrypt = require("bcrypt"); // se der erro no Windows, troque por 'bcryptjs'
const mysql = require("mysql2/promise");

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do multer para salvar imagens na pasta img-uploads
const upload = multer({ storage: multer.memoryStorage() });

// ==================== STATIC / FRONTEND ====================

// raiz do projeto: .../StockControl (um nível acima do /backend)
const root = path.join(__dirname, "..");
console.log("Static root:", root);

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

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

// ================================================
// 🔹 NOVA ROTA DE PÁGINA: HISTÓRICO DE COLETAS
// ================================================
app.get("/collection-history", (req, res) => {
  res.sendFile(
    path.join(
      root,
      "navigation-screens",
      "collection-history",
      "collection-history.html",
    ),
  );
});

// ==================== MYSQL POOL ====================
//
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "stockcontrol",
  waitForConnections: true,
  connectionLimit: 10,
});

// ========== EXCLUIR ITEM E IMAGEM ==========
app.delete("/api/items/:id", async (req, res) => {
  const itemId = req.params.id;
  try {
    // Exclui o registro do banco
    await pool.execute("DELETE FROM items WHERE id = ?", [itemId]);
    res.json({ success: true, message: "Item excluído." });
  } catch (err) {
    console.error("Erro ao excluir item:", err);
    res.status(500).json({ message: "Erro ao excluir item." });
  }
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
      org_type,
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
      [email_institucional],
    );
    if (dup.length) {
      return res.status(400).json({ erro: "E-mail já cadastrado." });
    }

    // Descobrir/ criar organização pelo CNPJ
    let organizationId;

    if (cnpj) {
      const [org] = await pool.query(
        "SELECT id FROM organizations WHERE cnpj = ? LIMIT 1",
        [cnpj],
      );
      if (org.length) {
        organizationId = org[0].id;
      }
    }

    if (!organizationId) {
      const [insOrg] = await pool.execute(
        `INSERT INTO organizations
          (org_type, name, cnpj, email, phone, mobile, address_line1)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,

        [
          org_type || "ONG",
          nome_empresa,
          cnpj || null,
          email_institucional,
          telefone || null,
          celular || null,
          endereco || null,
        ],
      );
      organizationId = insOrg.insertId;
    }

    // Cria usuário ADMIN da ONG
    const hash = await bcrypt.hash(senha, 10);
    let userRole = "OPERATOR";
    if (org_type === "ADMIN") {
      userRole = "ADMIN";
    }

    const [insUser] = await pool.execute(
      `INSERT INTO users
    (organization_id, email, password_hash, name, role, is_active)
    VALUES (?, ?, ?, ?, ?, 1)`,
      [organizationId, email_institucional, hash, nome_empresa, userRole],
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
app.post("/api/login", async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res
        .status(400)
        .json({ mensagem: "E-mail e senha são obrigatórios." });
    }

    const [rows] = await pool.query(
      `
    SELECT 
      u.*, 
      o.org_type 
    FROM users u
    JOIN organizations o ON o.id = u.organization_id
    WHERE u.email = ? LIMIT 1
    `,
      [email],
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
      org_type: user.org_type,
      user_id: user.id,
      organization_id: user.organization_id,
      role: user.role,
    });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ mensagem: "Erro interno no servidor" });
  }
});

// ========== CRIAR ITEM ==========
app.post("/api/items", upload.single("photo"), async (req, res) => {
  try {
    let photo_blob = null;
    if (req.file) {
      photo_blob = req.file.buffer;
    }

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
      created_by,
    } = req.body;

    if (!organization_id || !product_name || !condition_id) {
      return res.status(400).json({ message: "Campos obrigatórios ausentes." });
    }

    const [result] = await pool.execute(
      `INSERT INTO items 
      (organization_id, category_id, brand_id, model_id, product_name, product_brand, product_model, serial_number, description, condition_id, weight_kg, is_active, photo_blob, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        1, // is_active
        photo_blob,
        created_by || null,
      ],
    );

    res.json({ success: true, item_id: result.insertId });
  } catch (err) {
    console.error("Erro ao criar item:", err);
    res.status(500).json({ message: "Erro ao salvar item." });
  }
});

// ========== DESCARTAR ITENS ==========
app.post("/api/items/discard", async (req, res) => {
  try {
    const { organization_id, created_by, item_ids, item_id } = req.body;

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

    for (const id of ids) {
      const [prevRows] = await pool.query(
        "SELECT condition_id FROM items WHERE id = ? AND organization_id = ? LIMIT 1",
        [id, organization_id],
      );
      const prevConditionId = prevRows.length ? prevRows[0].condition_id : null;

      await pool.execute(
        `INSERT INTO disposal_history
          (item_id, organization_id, destination_type, prev_condition_id, new_condition_id, action, quantity, created_by)
          VALUES (?, ?, 'INTERNAL', ?, ?, 'MARKED_FOR_DISPOSAL', 1, ?)`,
        [
          id,
          organization_id,
          prevConditionId,
          prevConditionId, // Mantém o estado original
          created_by || null,
        ],
      );
    }

    res.json({
      success: true,
      message: "Itens descartados e registrados com sucesso.",
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

    const [recycler] = await pool.query(
      `SELECT id FROM organizations WHERE name LIKE '%Impacto Metais%' LIMIT 1`,
    );

    if (!recycler.length) {
      return res
        .status(500)
        .json({ message: "Impacto Metais não encontrada." });
    }

    const recycler_id = recycler[0].id;

    const [pedido] = await pool.execute(
      `INSERT INTO recycler_orders 
        (organization_id, recycler_id, status, created_by)
        VALUES (?, ?, 'REQUESTED', ?)`,
      [organization_id, recycler_id, created_by],
    );

    const order_id = pedido.insertId;

    for (const it of items) {
      await pool.execute(
        `INSERT INTO recycler_order_items 
          (recycler_order_id, item_id, quantity)
          VALUES (?, ?, 1)`,
        [order_id, it],
      );
    }

    res.json({ success: true, order_id });
  } catch (err) {
    console.error("Erro ao solicitar coleta:", err);
    res.status(500).json({ message: "Erro ao solicitar coleta." });
  }
});

// ========== HOME DASHBOARD ==========
app.get("/api/home", async (req, res) => {
  try {
    const organization_id = req.query.organization_id;
    if (!organization_id) {
      return res.status(400).json({ message: "organization_id faltando." });
    }

    // Todos os itens ativos da organização
    const [itens] = await pool.query(
      `
      SELECT 
        i.id,
        i.product_name,
        COALESCE(i.product_brand, b.name) AS brand,
        COALESCE(i.product_model, m.name) AS model,
        c.label_pt AS condition_label,
        c.code AS condition_code,
        i.description,
        i.created_at
      FROM items i
      LEFT JOIN brands b ON b.id = i.brand_id
      LEFT JOIN models m ON m.id = i.model_id
      JOIN conditions c ON c.id = i.condition_id
      WHERE i.organization_id = ? AND i.is_active = 1
      ORDER BY i.created_at DESC
    `,
      [organization_id],
    );

    // Itens aguardando coleta: marcados para descarte e não coletados ainda
    const [aguardandoColeta] = await pool.query(
      `
      SELECT 
        i.id
      FROM items i
      JOIN disposal_history dh ON dh.item_id = i.id AND dh.organization_id = i.organization_id AND dh.action = 'MARKED_FOR_DISPOSAL'
      WHERE i.organization_id = ?
        AND i.is_active = 1
        AND NOT EXISTS (
          SELECT 1 FROM disposal_history dh2
          WHERE dh2.item_id = i.id AND dh2.organization_id = i.organization_id AND dh2.action = 'PICKED_UP'
        )
      GROUP BY i.id
      `,
      [organization_id],
    );

    // IDs dos itens aguardando coleta
    const idsAguardando = new Set(aguardandoColeta.map((i) => i.id));

    // Itens disponíveis para descarte: não estão aguardando coleta nem já coletados
    const itensDisponiveisParaDescarte = itens.filter(
      (i) => !idsAguardando.has(i.id),
    );

    // Itens aguardando coleta: marcados para descarte e não coletados ainda

    // Itens aguardando coleta detalhados
    const [itensAguardandoColeta] = await pool.query(
      `
      SELECT 
        i.id,
        i.product_name,
        COALESCE(i.product_brand, b.name) AS brand,
        COALESCE(i.product_model, m.name) AS model,
        c.label_pt AS condition_label,
        c.code AS condition_code,
        i.description,
        i.created_at
      FROM items i
      LEFT JOIN brands b ON b.id = i.brand_id
      LEFT JOIN models m ON m.id = i.model_id
      JOIN conditions c ON c.id = i.condition_id
      JOIN disposal_history dh ON dh.item_id = i.id AND dh.organization_id = i.organization_id AND dh.action = 'MARKED_FOR_DISPOSAL'
      WHERE i.organization_id = ?
        AND i.is_active = 1
        AND NOT EXISTS (
          SELECT 1 FROM disposal_history dh2
          WHERE dh2.item_id = i.id AND dh2.organization_id = i.organization_id AND dh2.action = 'PICKED_UP'
        )
      GROUP BY i.id
      ORDER BY i.created_at DESC
      `,
      [organization_id],
    );

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
      [organization_id],
    );

    res.json({
      success: true,
      itens,
      itensDisponiveisParaDescarte,
      itensDescartar: itensAguardandoColeta,
      historico,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao carregar dados da home" });
  }
});

// ========== EDITAR ITEM EM AGUARDANDO COLETA ==========
app.put("/api/items/update", upload.single("photo"), async (req, res) => {
  try {
    const {
      item_id,
      organization_id,
      produto,
      marca,
      modelo,
      descricao,
      status,
    } = req.body;
    if (!item_id || !organization_id) {
      return res
        .status(400)
        .json({ message: "item_id e organization_id são obrigatórios." });
    }

    let photo_blob = undefined;
    if (req.file) {
      photo_blob = req.file.buffer;
    }

    const updates = [];
    const params = [];
    if (produto !== undefined) {
      updates.push("product_name = ?");
      params.push(produto);
    }
    if (marca !== undefined) {
      updates.push("product_brand = ?");
      params.push(marca);
    }
    if (modelo !== undefined) {
      updates.push("product_model = ?");
      params.push(modelo);
    }
    if (descricao !== undefined) {
      updates.push("description = ?");
      params.push(descricao);
    }
    if (status !== undefined) {
      const [cond] = await pool.query(
        "SELECT id FROM conditions WHERE code = ? LIMIT 1",
        [status],
      );
      if (!cond.length) {
        return res.status(400).json({ message: "Status inválido." });
      }
      updates.push("condition_id = ?");
      params.push(cond[0].id);
    }
    if (photo_blob !== undefined) {
      updates.push("photo_blob = ?");
      params.push(photo_blob);
    }
    if (!updates.length) {
      return res.status(400).json({ message: "Nenhum campo para atualizar." });
    }
    params.push(item_id, organization_id);
    const sql = `UPDATE items SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ? AND organization_id = ?`;
    await pool.execute(sql, params);
    res.json({ success: true });
  } catch (err) {
    console.error("Erro no /api/items/update:", err);
    res.status(500).json({ message: "Erro ao atualizar item." });
  }
});

// Rota para servir imagem direto do banco
app.get("/api/items/:id/photo", async (req, res) => {
  const itemId = req.params.id;
  try {
    const [rows] = await pool.query(
      "SELECT photo_blob FROM items WHERE id = ? LIMIT 1",
      [itemId],
    );
    if (!rows.length || !rows[0].photo_blob) {
      return res.status(404).send("Imagem não encontrada.");
    }
    res.set("Content-Type", "image/jpeg"); // ou "image/png" se for PNG
    res.send(rows[0].photo_blob);
  } catch (err) {
    res.status(500).send("Erro ao buscar imagem.");
  }
});

// ========== HISTÓRICO DE COLETAS ==========
app.get("/api/collection-history", async (req, res) => {
  try {
    const organization_id = req.query.organization_id;
    if (!organization_id) {
      return res
        .status(400)
        .json({ message: "organization_id é obrigatório." });
    }

    const [coletas] = await pool.query(
      `
      SELECT
        h.id,
        h.item_id,
        i.product_name,
        i.product_brand,
        i.product_model,
        h.quantity,
        h.weight_kg,
        h.created_at AS picked_up_at,
        org.name AS recycler_name
      FROM disposal_history h
      JOIN items i
        ON i.id = h.item_id
      LEFT JOIN organizations org
        ON org.id = h.destination_org_id
      WHERE
        h.organization_id = ?
        AND h.action = 'PICKED_UP'
      ORDER BY h.created_at DESC
      `,
      [organization_id],
    );

    res.json({
      success: true,
      coletas,
    });
  } catch (err) {
    console.error("Erro em /api/collection-history:", err);
    res.status(500).json({ message: "Erro ao carregar histórico de coletas." });
  }
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
