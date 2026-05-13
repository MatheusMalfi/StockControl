"use strict";
const express = require("express");
const pool    = require("../db");

const router = express.Router();

function getOrgId(req) {
  return req.query.organization_id || req.body?.organization_id;
}

/* GET /api/relatorios?tipo=estoque|movimentacoes|descarte&from=YYYY-MM-DD&to=YYYY-MM-DD&cond=&cat=&movType= */
router.get("/", async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ message: "organization_id é obrigatório." });

    const { tipo, from, to, cond, cat, movType } = req.query;

    if (tipo === "movimentacoes") {
      // Requires movimentacoes table — may not exist yet, handle gracefully
      try {
        const conditions = ["organization_id = ?"];
        const params     = [orgId];
        if (from)    { conditions.push("data >= ?"); params.push(from); }
        if (to)      { conditions.push("data <= ?"); params.push(to); }
        if (movType) { conditions.push("tipo = ?");  params.push(movType); }
        const [rows] = await pool.query(
          `SELECT * FROM movimentacoes WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
          params,
        );
        return res.json({ success: true, tipo, dados: rows });
      } catch {
        return res.json({ success: true, tipo, dados: [] });
      }
    }

    if (tipo === "descarte") {
      const conditions = ["h.organization_id = ?"];
      const params     = [orgId];
      if (from) { conditions.push("DATE(h.created_at) >= ?"); params.push(from); }
      if (to)   { conditions.push("DATE(h.created_at) <= ?"); params.push(to); }
      const [rows] = await pool.query(
        `SELECT h.id, h.item_id, i.product_name, i.product_brand, i.product_model,
                h.action, h.quantity, h.created_at,
                c.label_pt AS condition_label
         FROM disposal_history h
         JOIN items i ON i.id = h.item_id
         LEFT JOIN conditions c ON c.id = h.prev_condition_id
         WHERE ${conditions.join(" AND ")}
         ORDER BY h.created_at DESC`,
        params,
      );
      return res.json({ success: true, tipo, dados: rows });
    }

    // Default: tipo === "estoque"
    const conditions = ["i.organization_id = ?", "i.is_active = 1"];
    const params     = [orgId];
    if (from) { conditions.push("DATE(i.created_at) >= ?"); params.push(from); }
    if (to)   { conditions.push("DATE(i.created_at) <= ?"); params.push(to); }
    if (cond) {
      const [condRow] = await pool.query("SELECT id FROM conditions WHERE code = ? LIMIT 1", [cond]);
      if (condRow.length) { conditions.push("i.condition_id = ?"); params.push(condRow[0].id); }
    }
    if (cat) {
      const [catRow] = await pool.query(
        "SELECT id FROM categories WHERE name = ? AND organization_id = ? LIMIT 1",
        [cat, orgId],
      );
      if (catRow.length) { conditions.push("i.category_id = ?"); params.push(catRow[0].id); }
    }

    const [rows] = await pool.query(
      `SELECT i.id, i.product_name, i.product_brand, i.product_model,
              i.serial_number, i.quantity, i.quantity_available,
              i.weight_kg, i.estimated_value, i.created_at,
              c.label_pt AS condition_label, c.code AS condition_code,
              cat.name AS category_name
       FROM items i
       JOIN conditions c ON c.id = i.condition_id
       LEFT JOIN categories cat ON cat.id = i.category_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY i.product_name ASC`,
      params,
    );
    res.json({ success: true, tipo: tipo || "estoque", dados: rows });
  } catch (err) {
    console.error("GET /api/relatorios:", err);
    res.status(500).json({ message: "Erro ao gerar relatório." });
  }
});

module.exports = router;
