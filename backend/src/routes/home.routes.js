const express = require("express");
const pool = require("../db");

const router = express.Router();

// GET /api/home?organization_id=X
router.get("/", async (req, res) => {
  try {
    const { organization_id } = req.query;
    if (!organization_id) {
      return res.status(400).json({ message: "organization_id é obrigatório." });
    }

    const [itens] = await pool.query(
      `SELECT i.id, i.product_name,
              COALESCE(i.product_brand, b.name) AS brand,
              COALESCE(i.product_model, m.name) AS model,
              c.label_pt AS condition_label, c.code AS condition_code,
              i.description, i.created_at
       FROM items i
       LEFT JOIN brands b ON b.id = i.brand_id
       LEFT JOIN models m ON m.id = i.model_id
       JOIN conditions c ON c.id = i.condition_id
       WHERE i.organization_id = ? AND i.is_active = 1
       ORDER BY i.created_at DESC`,
      [organization_id],
    );

    const [aguardandoColeta] = await pool.query(
      `SELECT DISTINCT i.id
       FROM items i
       JOIN disposal_history dh
         ON dh.item_id = i.id AND dh.organization_id = i.organization_id
         AND dh.action = 'MARKED_FOR_DISPOSAL'
       WHERE i.organization_id = ?
         AND i.is_active = 1
         AND NOT EXISTS (
           SELECT 1 FROM disposal_history dh2
           WHERE dh2.item_id = i.id
             AND dh2.organization_id = i.organization_id
             AND dh2.action = 'PICKED_UP'
         )`,
      [organization_id],
    );

    const idsAguardando = new Set(aguardandoColeta.map((i) => i.id));
    const itensDisponiveisParaDescarte = itens.filter((i) => !idsAguardando.has(i.id));

    const [itensAguardandoColeta] = await pool.query(
      `SELECT i.id, i.product_name,
              COALESCE(i.product_brand, b.name) AS brand,
              COALESCE(i.product_model, m.name) AS model,
              c.label_pt AS condition_label, c.code AS condition_code,
              i.description, i.created_at
       FROM items i
       LEFT JOIN brands b ON b.id = i.brand_id
       LEFT JOIN models m ON m.id = i.model_id
       JOIN conditions c ON c.id = i.condition_id
       JOIN disposal_history dh
         ON dh.item_id = i.id AND dh.organization_id = i.organization_id
         AND dh.action = 'MARKED_FOR_DISPOSAL'
       WHERE i.organization_id = ?
         AND i.is_active = 1
         AND NOT EXISTS (
           SELECT 1 FROM disposal_history dh2
           WHERE dh2.item_id = i.id
             AND dh2.organization_id = i.organization_id
             AND dh2.action = 'PICKED_UP'
         )
       GROUP BY i.id
       ORDER BY i.created_at DESC`,
      [organization_id],
    );

    const [historico] = await pool.query(
      `SELECT h.id, h.item_id, i.product_name, i.product_brand, i.product_model,
              CASE
                WHEN h.action = 'MARKED_FOR_DISPOSAL' THEN 'Descarte'
                WHEN h.action = 'REQUESTED_PICKUP'   THEN 'Coleta Solicitada'
                WHEN h.action = 'PICKED_UP'          THEN 'Coletado'
                ELSE REPLACE(h.action, '_', ' ')
              END AS action_label,
              h.created_at
       FROM disposal_history h
       JOIN items i ON i.id = h.item_id
       WHERE h.organization_id = ?
       ORDER BY h.created_at DESC
       LIMIT 50`,
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
    console.error("Erro em GET /api/home:", err);
    res.status(500).json({ message: "Erro ao carregar dados da home." });
  }
});

module.exports = router;
