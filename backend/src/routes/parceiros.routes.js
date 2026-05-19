"use strict";
const express = require("express");
const pool = require("../db");

const router = express.Router();

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS parceiros (
    id              VARCHAR(36)  NOT NULL PRIMARY KEY,
    organization_id INT          NOT NULL,
    nome            VARCHAR(255) NOT NULL,
    tipo            VARCHAR(50)  DEFAULT NULL,
    email           VARCHAR(255) DEFAULT NULL,
    telefone        VARCHAR(50)  DEFAULT NULL,
    endereco        TEXT         DEFAULT NULL,
    cnpj            VARCHAR(20)  DEFAULT NULL,
    ativo           TINYINT(1)   NOT NULL DEFAULT 1,
    obs             TEXT         DEFAULT NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_org (organization_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

async function ensureTable() {
  await pool.query(CREATE_TABLE);
}

function getOrgId(req) {
  return req.query.organization_id || req.body?.organization_id;
}

/* GET /api/parceiros */
router.get("/", async (req, res) => {
  try {
    await ensureTable();
    const orgId = getOrgId(req);
    if (!orgId)
      return res
        .status(400)
        .json({ message: "organization_id é obrigatório." });
    const [rows] = await pool.query(
      "SELECT * FROM parceiros WHERE organization_id = ? ORDER BY nome ASC",
      [orgId],
    );
    res.json({ success: true, parceiros: rows });
  } catch (err) {
    console.error("GET /api/parceiros:", err);
    res.status(500).json({ message: "Erro ao buscar parceiros." });
  }
});

/* POST /api/parceiros */
router.post("/", async (req, res) => {
  try {
    await ensureTable();
    const orgId = getOrgId(req);
    if (!orgId)
      return res
        .status(400)
        .json({ message: "organization_id é obrigatório." });
    const { id, nome, tipo, email, telefone, endereco, cnpj, ativo, obs } =
      req.body;
    if (!nome) return res.status(400).json({ message: "nome é obrigatório." });
    const newId =
      id || `par_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await pool.execute(
      `INSERT INTO parceiros (id, organization_id, nome, tipo, email, telefone, endereco, cnpj, ativo, obs)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId,
        orgId,
        nome,
        tipo || null,
        email || null,
        telefone || null,
        endereco || null,
        cnpj || null,
        ativo !== false ? 1 : 0,
        obs || null,
      ],
    );
    res.status(201).json({ success: true, id: newId });
  } catch (err) {
    console.error("POST /api/parceiros:", err);
    res.status(500).json({ message: "Erro ao criar parceiro." });
  }
});

/* PUT /api/parceiros/:id */
router.put("/:id", async (req, res) => {
  try {
    await ensureTable();
    const { nome, tipo, email, telefone, endereco, cnpj, ativo, obs } =
      req.body;
    await pool.execute(
      `UPDATE parceiros SET nome = ?, tipo = ?, email = ?, telefone = ?, endereco = ?,
              cnpj = ?, ativo = ?, obs = ?
       WHERE id = ?`,
      [
        nome || null,
        tipo || null,
        email || null,
        telefone || null,
        endereco || null,
        cnpj || null,
        ativo !== false ? 1 : 0,
        obs || null,
        req.params.id,
      ],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /api/parceiros/:id:", err);
    res.status(500).json({ message: "Erro ao atualizar parceiro." });
  }
});

/* DELETE /api/parceiros/:id */
router.delete("/:id", async (req, res) => {
  try {
    await ensureTable();
    const orgId = getOrgId(req);
    if (!orgId)
      return res
        .status(400)
        .json({ message: "organization_id é obrigatório." });
    const [result] = await pool.execute(
      "DELETE FROM parceiros WHERE id = ? AND organization_id = ?",
      [req.params.id, orgId],
    );
    if (!result.affectedRows)
      return res.status(404).json({ message: "Parceiro não encontrado." });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/parceiros/:id:", err);
    res.status(500).json({ message: "Erro ao excluir parceiro." });
  }
});

module.exports = router;
