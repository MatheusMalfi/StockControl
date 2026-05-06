const express = require("express");
const pool = require("../db");

const router = express.Router();

// POST /api/disposal/request
// Solicita coleta para o Impacto Metais
router.post("/disposal/request", async (req, res) => {
  try {
    const { organization_id, created_by, items } = req.body;

    if (!organization_id || !items || !items.length) {
      return res.status(400).json({ message: "Dados insuficientes." });
    }

    const [recycler] = await pool.query(
      "SELECT id FROM organizations WHERE name LIKE '%Impacto Metais%' LIMIT 1",
    );

    if (!recycler.length) {
      return res.status(500).json({ message: "Impacto Metais não encontrada." });
    }

    const recycler_id = recycler[0].id;

    const [pedido] = await pool.execute(
      `INSERT INTO recycler_orders (organization_id, recycler_id, status, created_by)
       VALUES (?, ?, 'REQUESTED', ?)`,
      [organization_id, recycler_id, created_by || null],
    );

    const order_id = pedido.insertId;

    for (const it of items) {
      await pool.execute(
        `INSERT INTO recycler_order_items (recycler_order_id, item_id, quantity)
         VALUES (?, ?, 1)`,
        [order_id, it],
      );
    }

    res.json({ success: true, order_id });
  } catch (err) {
    console.error("Erro em POST /api/disposal/request:", err);
    res.status(500).json({ message: "Erro ao solicitar coleta." });
  }
});

// GET /api/collection-history?organization_id=X
router.get("/collection-history", async (req, res) => {
  try {
    const { organization_id } = req.query;
    if (!organization_id) {
      return res.status(400).json({ message: "organization_id é obrigatório." });
    }

    const [coletas] = await pool.query(
      `SELECT h.id, h.item_id, i.product_name, i.product_brand, i.product_model,
              h.quantity, h.weight_kg,
              h.created_at AS picked_up_at,
              org.name AS recycler_name
       FROM disposal_history h
       JOIN items i ON i.id = h.item_id
       LEFT JOIN organizations org ON org.id = h.destination_org_id
       WHERE h.organization_id = ? AND h.action = 'PICKED_UP'
       ORDER BY h.created_at DESC`,
      [organization_id],
    );

    res.json({ success: true, coletas });
  } catch (err) {
    console.error("Erro em GET /api/collection-history:", err);
    res.status(500).json({ message: "Erro ao carregar histórico de coletas." });
  }
});

module.exports = router;
