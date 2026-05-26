"use strict";
const express = require("express");
const pool = require("../db");

const router = express.Router();

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS solicitacoes (
    id               VARCHAR(36)  NOT NULL PRIMARY KEY,
    organization_id  INT          NOT NULL,
    tipo             VARCHAR(50)  DEFAULT NULL,
    item             VARCHAR(255) DEFAULT NULL,
    quantidade       INT          NOT NULL DEFAULT 1,
    solicitante      VARCHAR(255) DEFAULT NULL,
    email            VARCHAR(255) DEFAULT NULL,
    status           VARCHAR(50)  NOT NULL DEFAULT 'pendente',
    prioridade       VARCHAR(50)  NOT NULL DEFAULT 'media',
    data_solicitacao DATE         DEFAULT NULL,
    data_revisao     DATE         DEFAULT NULL,
    revisor          VARCHAR(255) DEFAULT NULL,
    obs              TEXT         DEFAULT NULL,
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_org (organization_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

async function ensureTable() {
  await pool.query(CREATE_TABLE);
}

function getOrgId(req) {
  return req.query.organization_id || req.body?.organization_id;
}

/* GET /api/solicitacoes */
router.get("/", async (req, res) => {
  try {
    await ensureTable();
    const orgId = getOrgId(req);
    if (!orgId)
      return res
        .status(400)
        .json({ message: "organization_id é obrigatório." });
    const [rows] = await pool.query(
      "SELECT * FROM solicitacoes WHERE organization_id = ? ORDER BY created_at DESC",
      [orgId],
    );
    res.json({ success: true, solicitacoes: rows });
  } catch (err) {
    console.error("GET /api/solicitacoes:", err);
    res.status(500).json({ message: "Erro ao buscar solicitações." });
  }
});

/* POST /api/solicitacoes */
router.post("/", async (req, res) => {
  try {
    await ensureTable();
    const orgId = getOrgId(req);
    if (!orgId)
      return res
        .status(400)
        .json({ message: "organization_id é obrigatório." });
    const {
      id,
      tipo,
      item,
      quantidade,
      solicitante,
      email,
      status,
      prioridade,
      data_solicitacao,
      obs,
    } = req.body;
    const newId =
      id || `sol_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await pool.execute(
      `INSERT INTO solicitacoes
         (id, organization_id, tipo, item, quantidade, solicitante, email, status, prioridade, data_solicitacao, obs)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId,
        orgId,
        tipo || null,
        item || null,
        quantidade || 1,
        solicitante || null,
        email || null,
        status || "pendente",
        prioridade || "media",
        data_solicitacao || null,
        obs || null,
      ],
    );
    res.status(201).json({ success: true, id: newId });
  } catch (err) {
    console.error("POST /api/solicitacoes:", err);
    res.status(500).json({ message: "Erro ao criar solicitação." });
  }
});

/* PUT /api/solicitacoes/:id */
router.put("/:id", async (req, res) => {
  try {
    await ensureTable();
    const {
      tipo,
      item,
      quantidade,
      solicitante,
      email,
      status,
      prioridade,
      data_solicitacao,
      obs,
    } = req.body;
    await pool.execute(
      `UPDATE solicitacoes
       SET tipo = ?, item = ?, quantidade = ?, solicitante = ?, email = ?,
           status = COALESCE(?, status), prioridade = ?, data_solicitacao = ?, obs = ?
       WHERE id = ?`,
      [
        tipo || null,
        item || null,
        quantidade || 1,
        solicitante || null,
        email || null,
        status !== undefined ? status : null,
        prioridade || "media",
        data_solicitacao || null,
        obs || null,
        req.params.id,
      ],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /api/solicitacoes/:id:", err);
    res.status(500).json({ message: "Erro ao atualizar solicitação." });
  }
});

/* PATCH /api/solicitacoes/:id/revisar */
router.patch("/:id/revisar", async (req, res) => {
  try {
    await ensureTable();
    const { action, revisor, status, obs } = req.body;
    const finalStatus =
      status ||
      (action === "approve" ? "aprovada" : action === "reject" ? "recusada" : "revisado");
    await pool.execute(
      `UPDATE solicitacoes
       SET status = ?, revisor = ?, data_revisao = CURDATE(), obs = CONCAT(COALESCE(obs,''), ?)
       WHERE id = ?`,
      [
        finalStatus,
        revisor || null,
        obs ? `\n${obs}` : "",
        req.params.id,
      ],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/solicitacoes/:id/revisar:", err);
    res.status(500).json({ message: "Erro ao revisar solicitação." });
  }
});

/* PATCH /api/solicitacoes/:id/status */
router.patch("/:id/status", async (req, res) => {
  try {
    await ensureTable();
    const { status } = req.body;
    if (!status)
      return res.status(400).json({ message: "status é obrigatório." });
    await pool.execute("UPDATE solicitacoes SET status = ? WHERE id = ?", [
      status,
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/solicitacoes/:id/status:", err);
    res.status(500).json({ message: "Erro ao alterar status." });
  }
});

/* DELETE /api/solicitacoes/:id */
router.delete("/:id", async (req, res) => {
  try {
    await ensureTable();
    await pool.execute("DELETE FROM solicitacoes WHERE id = ?", [
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/solicitacoes/:id:", err);
    res.status(500).json({ message: "Erro ao excluir solicitação." });
  }
});

module.exports = router;
