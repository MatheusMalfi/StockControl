"use strict";
const express = require("express");
const pool    = require("../db");

const router = express.Router();

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS movimentacoes (
    id            VARCHAR(36)  NOT NULL PRIMARY KEY,
    organization_id INT        NOT NULL,
    tipo          VARCHAR(20)  NOT NULL DEFAULT 'entrada',
    produto       VARCHAR(255) DEFAULT NULL,
    quantidade    INT          NOT NULL DEFAULT 1,
    responsavel   VARCHAR(255) DEFAULT NULL,
    destino       VARCHAR(255) DEFAULT NULL,
    origem        VARCHAR(255) DEFAULT NULL,
    data          DATE         DEFAULT NULL,
    obs           TEXT         DEFAULT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_org (organization_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

async function ensureTable() {
  await pool.query(CREATE_TABLE);
}

function getOrgId(req) {
  return req.query.organization_id || req.body?.organization_id;
}

/* GET /api/movimentacoes */
router.get("/", async (req, res) => {
  try {
    await ensureTable();
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ message: "organization_id é obrigatório." });
    const [rows] = await pool.query(
      "SELECT * FROM movimentacoes WHERE organization_id = ? ORDER BY created_at DESC",
      [orgId],
    );
    res.json({ success: true, movimentacoes: rows });
  } catch (err) {
    console.error("GET /api/movimentacoes:", err);
    res.status(500).json({ message: "Erro ao buscar movimentações." });
  }
});

/* POST /api/movimentacoes */
router.post("/", async (req, res) => {
  try {
    await ensureTable();
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ message: "organization_id é obrigatório." });
    const { id, tipo, produto, quantidade, responsavel, destino, origem, data, obs } = req.body;
    const newId = id || `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await pool.execute(
      `INSERT INTO movimentacoes (id, organization_id, tipo, produto, quantidade, responsavel, destino, origem, data, obs)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, orgId, tipo || "entrada", produto || null, quantidade || 1,
       responsavel || null, destino || null, origem || null, data || null, obs || null],
    );
    res.status(201).json({ success: true, id: newId });
  } catch (err) {
    console.error("POST /api/movimentacoes:", err);
    res.status(500).json({ message: "Erro ao criar movimentação." });
  }
});

/* DELETE /api/movimentacoes/:id */
router.delete("/:id", async (req, res) => {
  try {
    await ensureTable();
    await pool.execute("DELETE FROM movimentacoes WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/movimentacoes/:id:", err);
    res.status(500).json({ message: "Erro ao excluir movimentação." });
  }
});

module.exports = router;
