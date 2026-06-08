const express = require("express");
const pool = require("../db");

const router = express.Router();

// GET /api/recycler/ongs/solicitacoes
// Lista todas as ONGs cadastradas e a quantidade de solicitações de coleta feitas por cada uma
router.get("/ongs/solicitacoes", async (req, res) => {
  try {
    const [ongs] = await pool.query(
      `SELECT o.id, o.name,
              COALESCE(s.request_count, 0) AS request_count,
              COALESCE(p.approved_count, 0) AS approved_count
       FROM organizations o
       LEFT JOIN (
         SELECT organization_id, COUNT(*) AS request_count
         FROM solicitacoes
         WHERE status IN ('pendente', 'aprovada')
         GROUP BY organization_id
       ) s ON s.organization_id = o.id
       LEFT JOIN (
         SELECT organization_id, COUNT(*) AS approved_count
         FROM solicitacoes
         WHERE status = 'concluida'
         GROUP BY organization_id
       ) p ON p.organization_id = o.id
       WHERE o.org_type = 'ONG'
        AND TRIM(LOWER(o.name)) <> 'sua ong'
       ORDER BY o.name`,
    );

    res.json({ success: true, ongs });
  } catch (err) {
    console.error("Erro em GET /api/recycler/ongs/solicitacoes:", err);
    res.status(500).json({ message: "Erro ao carregar lista de ONGs." });
  }
});

// GET /api/recycler/ongs
// Lista as ONGs que possuem pedidos com status REQUESTED
router.get("/ongs", async (req, res) => {
  try {
    const [ongs] = await pool.query(
      `SELECT o.id, o.name, COUNT(DISTINCT ro.id) AS pending_orders,
              COUNT(DISTINCT roi.item_id) AS pending_items
       FROM organizations o
       JOIN recycler_orders ro ON ro.organization_id = o.id AND ro.status = 'REQUESTED'
       JOIN recycler_order_items roi ON roi.recycler_order_id = ro.id
       GROUP BY o.id, o.name
       ORDER BY o.name`,
    );

    res.json({ success: true, ongs });
  } catch (err) {
    console.error("Erro em GET /api/recycler/ongs:", err);
    res.status(500).json({ message: "Erro ao carregar lista de ONGs." });
  }
});

// GET /api/recycler/orders?org_id=X
// Lista pedidos de uma ONG específica (ou todos se não informado)
router.get("/orders", async (req, res) => {
  try {
    const { org_id, status } = req.query;

    let sql = `
      SELECT ro.id, ro.status, ro.created_at,
             o.name AS org_name,
             COUNT(roi.item_id) AS item_count
      FROM recycler_orders ro
      JOIN organizations o ON o.id = ro.organization_id
      LEFT JOIN recycler_order_items roi ON roi.recycler_order_id = ro.id
      WHERE 1=1`;
    const params = [];

    if (org_id) {
      sql += " AND ro.organization_id = ?";
      params.push(org_id);
    }
    if (status) {
      sql += " AND ro.status = ?";
      params.push(status);
    }

    sql += " GROUP BY ro.id ORDER BY ro.created_at DESC";

    const [orders] = await pool.query(sql, params);
    res.json({ success: true, orders });
  } catch (err) {
    console.error("Erro em GET /api/recycler/orders:", err);
    res.status(500).json({ message: "Erro ao carregar pedidos." });
  }
});

// GET /api/recycler/orders/:id
// Detalhes de um pedido específico com os itens
router.get("/orders/:id", async (req, res) => {
  try {
    const orderId = req.params.id;

    const [orderRows] = await pool.query(
      `SELECT ro.id, ro.status, ro.created_at,
              o.id AS org_id, o.name AS org_name,
              o.email AS org_email, o.phone AS org_phone, o.address_line1 AS org_address
       FROM recycler_orders ro
       JOIN organizations o ON o.id = ro.organization_id
       WHERE ro.id = ? LIMIT 1`,
      [orderId],
    );

    if (!orderRows.length) {
      return res.status(404).json({ message: "Pedido não encontrado." });
    }

    const [items] = await pool.query(
      `SELECT i.id, i.product_name,
              COALESCE(i.product_brand, b.name) AS brand,
              COALESCE(i.product_model, m.name) AS model,
              c.label_pt AS condition_label, c.code AS condition_code,
              i.description, i.weight_kg, roi.quantity
       FROM recycler_order_items roi
       JOIN items i ON i.id = roi.item_id
       LEFT JOIN brands b ON b.id = i.brand_id
       LEFT JOIN models m ON m.id = i.model_id
       JOIN conditions c ON c.id = i.condition_id
       WHERE roi.recycler_order_id = ?`,
      [orderId],
    );

    res.json({ success: true, order: { ...orderRows[0], items } });
  } catch (err) {
    console.error("Erro em GET /api/recycler/orders/:id:", err);
    res.status(500).json({ message: "Erro ao carregar detalhes do pedido." });
  }
});

// GET /api/recycler/collections/history
// Retorna todas as solicitações com status 'concluida'
router.get("/collections/history", async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10);
    const [rows] = await pool.query(
      `SELECT s.id, s.status, COALESCE(s.data_revisao, s.created_at) AS scheduled_date, o.name AS org_name
       FROM solicitacoes s
       JOIN organizations o ON o.id = s.organization_id
       WHERE s.status = 'concluida'
       ${year ? "AND YEAR(COALESCE(s.data_revisao, s.created_at)) = ?" : ""}
       ORDER BY COALESCE(s.data_revisao, s.created_at) DESC`,
      year ? [year] : [],
    );
    res.json({ success: true, history: rows });
  } catch (err) {
    console.error("Erro em GET /api/recycler/collections/history:", err);
    res.status(500).json({ message: "Erro ao buscar histórico." });
  }
});

// POST /api/recycler/orders/:id/confirm
// Confirma a coleta: atualiza o pedido e registra no disposal_history
router.post("/orders/:id/confirm", async (req, res) => {
  try {
    const orderId = req.params.id;
    const { recycler_user_id } = req.body;

    const [orderRows] = await pool.query(
      `SELECT ro.id, ro.organization_id, ro.recycler_id, ro.status
       FROM recycler_orders ro
       WHERE ro.id = ? LIMIT 1`,
      [orderId],
    );

    if (!orderRows.length) {
      return res.status(404).json({ message: "Pedido não encontrado." });
    }

    if (orderRows[0].status !== "REQUESTED") {
      return res
        .status(400)
        .json({ message: "Pedido não está em status REQUESTED." });
    }

    const { organization_id, recycler_id } = orderRows[0];

    const [items] = await pool.query(
      "SELECT item_id, quantity FROM recycler_order_items WHERE recycler_order_id = ?",
      [orderId],
    );

    await pool.execute(
      "UPDATE recycler_orders SET status = 'PICKED_UP' WHERE id = ?",
      [orderId],
    );

    for (const it of items) {
      const [prevRows] = await pool.query(
        "SELECT condition_id FROM items WHERE id = ? LIMIT 1",
        [it.item_id],
      );
      const prevConditionId = prevRows.length ? prevRows[0].condition_id : null;

      await pool.execute(
        `INSERT INTO disposal_history
          (item_id, organization_id, destination_org_id, destination_type,
           prev_condition_id, new_condition_id, action, quantity, created_by)
         VALUES (?, ?, ?, 'RECYCLER', ?, ?, 'PICKED_UP', ?, ?)`,
        [
          it.item_id,
          organization_id,
          recycler_id,
          prevConditionId,
          prevConditionId,
          it.quantity,
          recycler_user_id || null,
        ],
      );

      await pool.execute(
        "UPDATE items SET is_active = 0, deactivated_at = NOW() WHERE id = ?",
        [it.item_id],
      );
    }

    res.json({ success: true, message: "Coleta confirmada com sucesso." });
  } catch (err) {
    console.error("Erro em POST /api/recycler/orders/:id/confirm:", err);
    res.status(500).json({ message: "Erro ao confirmar coleta." });
  }
});

module.exports = router;
