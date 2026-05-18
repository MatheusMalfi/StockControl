const express = require("express");
const multer = require("multer");
const pool = require("../db");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/items?organization_id=X&search=&condition=&category=&sort=product_name:asc&page=1&limit=20
router.get("/", async (req, res) => {
  try {
    const { organization_id, search, condition, category, sort, page, limit } = req.query;
    if (!organization_id) {
      return res.status(400).json({ message: "organization_id é obrigatório." });
    }

    const conditions = ["i.organization_id = ?", "i.is_active = 1"];
    const params     = [organization_id];

    if (search)    { conditions.push("i.product_name LIKE ?"); params.push(`%${search}%`); }
    if (condition) { conditions.push("c.code = ?");            params.push(condition); }
    if (category)  { conditions.push("cat.id = ?");            params.push(category); }

    const SORT_COLS = {
      product_name:    "i.product_name",
      created_at:      "i.created_at",
      quantity:        "i.quantity",
      estimated_value: "i.estimated_value",
    };
    const [sortCol, sortDir] = (sort || "product_name:asc").split(":");
    const orderBy = `${SORT_COLS[sortCol] || "i.product_name"} ${sortDir === "desc" ? "DESC" : "ASC"}`;

    const pageNum  = Math.max(1, parseInt(page)  || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset   = (pageNum - 1) * pageSize;

    const whereClause = conditions.join(" AND ");

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM items i
       LEFT JOIN conditions c  ON c.id  = i.condition_id
       LEFT JOIN categories cat ON cat.id = i.category_id
       WHERE ${whereClause}`,
      params,
    );

    const [items] = await pool.query(
      `SELECT i.id, i.product_name, i.product_brand, i.product_model,
              i.serial_number, i.description, i.quantity, i.quantity_available,
              i.weight_kg, i.estimated_value, i.is_active, i.created_at,
              c.label_pt AS condition_label, c.code AS condition_code,
              cat.name AS category_name
       FROM items i
       LEFT JOIN conditions c  ON c.id  = i.condition_id
       LEFT JOIN categories cat ON cat.id = i.category_id
       WHERE ${whereClause}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );

    res.json({ success: true, items, total, page: pageNum, limit: pageSize });
  } catch (err) {
    console.error("Erro em GET /api/items:", err);
    res.status(500).json({ message: "Erro ao buscar itens." });
  }
});

// POST /api/items
router.post("/", upload.single("photo"), async (req, res) => {
  try {
    const photo_blob = req.file ? req.file.buffer : null;

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

    let resolvedConditionId = condition_id;
    if (!resolvedConditionId && req.body.condition_code) {
      const [cond] = await pool.query(
        "SELECT id FROM conditions WHERE code = ? LIMIT 1",
        [req.body.condition_code],
      );
      if (cond.length) resolvedConditionId = cond[0].id;
    }

    let resolvedCategoryId = category_id;
    if (!resolvedCategoryId && req.body.category_name) {
      const [cat] = await pool.query(
        "SELECT id FROM categories WHERE name = ? LIMIT 1",
        [req.body.category_name],
      );
      if (cat.length) resolvedCategoryId = cat[0].id;
    }

    if (!organization_id || !product_name || !resolvedConditionId) {
      return res.status(400).json({ message: "Campos obrigatórios ausentes." });
    }

    const [result] = await pool.execute(
      `INSERT INTO items
        (organization_id, category_id, brand_id, model_id, product_name, product_brand,
         product_model, serial_number, description, condition_id, weight_kg, is_active,
         photo_blob, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        organization_id,
        resolvedCategoryId || null,
        brand_id || null,
        model_id || null,
        product_name,
        product_brand || null,
        product_model || null,
        serial_number || null,
        description || null,
        resolvedConditionId,
        weight_kg || null,
        photo_blob,
        created_by || null,
      ],
    );

    res.status(201).json({ success: true, item_id: result.insertId });
  } catch (err) {
    console.error("Erro em POST /api/items:", err);
    res.status(500).json({ message: "Erro ao salvar item." });
  }
});

// POST /api/items/discard
router.post("/discard", async (req, res) => {
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
          (item_id, organization_id, destination_type, prev_condition_id,
           new_condition_id, action, quantity, created_by)
         VALUES (?, ?, 'INTERNAL', ?, ?, 'MARKED_FOR_DISPOSAL', 1, ?)`,
        [id, organization_id, prevConditionId, prevConditionId, created_by || null],
      );
    }

    res.json({ success: true, message: "Itens descartados e registrados com sucesso." });
  } catch (err) {
    console.error("Erro em POST /api/items/discard:", err);
    res.status(500).json({ message: "Erro ao descartar itens." });
  }
});

// GET /api/items/:id
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT i.id, i.product_name, i.product_brand, i.product_model,
              i.serial_number, i.description, i.quantity, i.quantity_available,
              i.weight_kg, i.estimated_value, i.is_active, i.created_at,
              COALESCE(i.product_brand, b.name) AS brand,
              COALESCE(i.product_model, m.name) AS model,
              c.label_pt AS condition_label, c.code AS condition_code,
              cat.name AS category_name
       FROM items i
       LEFT JOIN brands b ON b.id = i.brand_id
       LEFT JOIN models m ON m.id = i.model_id
       JOIN conditions c ON c.id = i.condition_id
       LEFT JOIN categories cat ON cat.id = i.category_id
       WHERE i.id = ? LIMIT 1`,
      [req.params.id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Item não encontrado." });
    }

    res.json({ success: true, item: rows[0] });
  } catch (err) {
    console.error("Erro em GET /api/items/:id:", err);
    res.status(500).json({ message: "Erro ao buscar item." });
  }
});

// GET /api/items/:id/photo
router.get("/:id/photo", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT photo_blob FROM items WHERE id = ? LIMIT 1",
      [req.params.id],
    );

    if (!rows.length || !rows[0].photo_blob) {
      return res.status(404).send("Imagem não encontrada.");
    }

    res.set("Content-Type", "image/jpeg");
    res.send(rows[0].photo_blob);
  } catch (err) {
    console.error("Erro em GET /api/items/:id/photo:", err);
    res.status(500).send("Erro ao buscar imagem.");
  }
});

// PUT /api/items/:id
router.put("/:id", upload.single("photo"), async (req, res) => {
  try {
    const { id } = req.params;
    const { organization_id, produto, marca, modelo, descricao, status } = req.body;

    if (!organization_id) {
      return res.status(400).json({ message: "organization_id é obrigatório." });
    }

    const photo_blob = req.file ? req.file.buffer : undefined;

    const updates = [];
    const params = [];

    if (produto    !== undefined) { updates.push("product_name = ?");  params.push(produto); }
    if (marca      !== undefined) { updates.push("product_brand = ?"); params.push(marca); }
    if (modelo     !== undefined) { updates.push("product_model = ?"); params.push(modelo); }
    if (descricao  !== undefined) { updates.push("description = ?");   params.push(descricao); }

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

    params.push(id, organization_id);
    await pool.execute(
      `UPDATE items SET ${updates.join(", ")}, updated_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      params,
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Erro em PUT /api/items/:id:", err);
    res.status(500).json({ message: "Erro ao atualizar item." });
  }
});

// DELETE /api/items/:id
router.delete("/:id", async (req, res) => {
  try {
    await pool.execute("DELETE FROM items WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Item excluído." });
  } catch (err) {
    console.error("Erro em DELETE /api/items/:id:", err);
    res.status(500).json({ message: "Erro ao excluir item." });
  }
});

module.exports = router;
