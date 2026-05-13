"use strict";
const express = require("express");
const pool    = require("../db");

const router = express.Router();

const CREATE_NOTIF = `
  CREATE TABLE IF NOT EXISTS notificacoes (
    id              VARCHAR(36)  NOT NULL PRIMARY KEY,
    organization_id INT          NOT NULL,
    titulo          VARCHAR(255) DEFAULT NULL,
    mensagem        TEXT         DEFAULT NULL,
    tipo            VARCHAR(50)  DEFAULT 'info',
    lida            TINYINT(1)   NOT NULL DEFAULT 0,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_org (organization_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const CREATE_RULES = `
  CREATE TABLE IF NOT EXISTS notif_rules (
    organization_id  INT         NOT NULL PRIMARY KEY,
    estoque_baixo    TINYINT(1)  NOT NULL DEFAULT 1,
    descarte         TINYINT(1)  NOT NULL DEFAULT 1,
    doacao_pendente  TINYINT(1)  NOT NULL DEFAULT 1,
    email            TINYINT(1)  NOT NULL DEFAULT 0,
    minimo           INT         NOT NULL DEFAULT 5,
    updated_at       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

async function ensureTables() {
  await pool.query(CREATE_NOTIF);
  await pool.query(CREATE_RULES);
}

function getOrgId(req) {
  return req.query.organization_id || req.body?.organization_id;
}

/* GET /api/notificacoes */
router.get("/", async (req, res) => {
  try {
    await ensureTables();
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ message: "organization_id é obrigatório." });
    const [notifs] = await pool.query(
      "SELECT * FROM notificacoes WHERE organization_id = ? ORDER BY created_at DESC LIMIT 200",
      [orgId],
    );
    const [rules] = await pool.query(
      "SELECT * FROM notif_rules WHERE organization_id = ? LIMIT 1",
      [orgId],
    );
    res.json({ success: true, notificacoes: notifs, rules: rules[0] || null });
  } catch (err) {
    console.error("GET /api/notificacoes:", err);
    res.status(500).json({ message: "Erro ao buscar notificações." });
  }
});

/* POST /api/notificacoes/sync — replace all notifications for org */
router.post("/sync", async (req, res) => {
  try {
    await ensureTables();
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ message: "organization_id é obrigatório." });
    const notifs = Array.isArray(req.body.notificacoes) ? req.body.notificacoes : [];

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute("DELETE FROM notificacoes WHERE organization_id = ?", [orgId]);
      for (const n of notifs) {
        const id = n.id || `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await conn.execute(
          `INSERT INTO notificacoes (id, organization_id, titulo, mensagem, tipo, lida)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, orgId, n.titulo || null, n.mensagem || null, n.tipo || "info", n.lida ? 1 : 0],
        );
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    res.json({ success: true });
  } catch (err) {
    console.error("POST /api/notificacoes/sync:", err);
    res.status(500).json({ message: "Erro ao sincronizar notificações." });
  }
});

/* PUT /api/notificacoes/rules */
router.put("/rules", async (req, res) => {
  try {
    await ensureTables();
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ message: "organization_id é obrigatório." });
    const { estoqueBaixo, descarte, doacaoPendente, email, minimo } = req.body;
    await pool.execute(
      `INSERT INTO notif_rules (organization_id, estoque_baixo, descarte, doacao_pendente, email, minimo)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         estoque_baixo = VALUES(estoque_baixo),
         descarte      = VALUES(descarte),
         doacao_pendente = VALUES(doacao_pendente),
         email         = VALUES(email),
         minimo        = VALUES(minimo)`,
      [orgId, estoqueBaixo ? 1 : 0, descarte ? 1 : 0,
       doacaoPendente ? 1 : 0, email ? 1 : 0, minimo ?? 5],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /api/notificacoes/rules:", err);
    res.status(500).json({ message: "Erro ao salvar regras." });
  }
});

module.exports = router;
