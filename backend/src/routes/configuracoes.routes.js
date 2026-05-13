"use strict";
const express = require("express");
const bcrypt  = require("bcrypt");
const pool    = require("../db");

const router = express.Router();

const CREATE_PREFS = `
  CREATE TABLE IF NOT EXISTS user_preferences (
    organization_id  INT         NOT NULL PRIMARY KEY,
    tema             VARCHAR(20) NOT NULL DEFAULT 'claro',
    idioma           VARCHAR(20) NOT NULL DEFAULT 'pt-BR',
    paginacao        INT         NOT NULL DEFAULT 20,
    formato_data     VARCHAR(20) NOT NULL DEFAULT 'DD/MM/AAAA',
    updated_at       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

async function ensurePrefsTable() {
  await pool.query(CREATE_PREFS);
}

function getOrgId(req) {
  return req.query.organization_id || req.body?.organization_id;
}

/* GET /api/configuracoes */
router.get("/", async (req, res) => {
  try {
    await ensurePrefsTable();
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ message: "organization_id é obrigatório." });

    const [[org]]   = await pool.query(
      "SELECT id, name AS nome, email, phone AS telefone, address_line1 AS endereco, cnpj FROM organizations WHERE id = ? LIMIT 1",
      [orgId],
    );
    const [usuarios] = await pool.query(
      "SELECT id, name AS nome, email, role, is_active AS ativo, created_at AS criadoEm FROM users WHERE organization_id = ? AND is_active = 1",
      [orgId],
    );
    const [prefs]    = await pool.query(
      "SELECT tema, idioma, paginacao, formato_data AS formatoData FROM user_preferences WHERE organization_id = ? LIMIT 1",
      [orgId],
    );

    res.json({
      success:      true,
      organizacao:  org   || null,
      usuarios,
      preferencias: prefs[0] || null,
    });
  } catch (err) {
    console.error("GET /api/configuracoes:", err);
    res.status(500).json({ message: "Erro ao carregar configurações." });
  }
});

/* PUT /api/configuracoes/perfil */
router.put("/perfil", async (req, res) => {
  try {
    const { organization_id, user_id, nome, email } = req.body;
    const orgId = organization_id || getOrgId(req);
    if (!orgId && !user_id) return res.status(400).json({ message: "user_id ou organization_id é obrigatório." });

    if (user_id) {
      await pool.execute("UPDATE users SET name = ?, email = ? WHERE id = ?", [nome, email, user_id]);
    } else {
      // update first user in org as fallback
      await pool.execute(
        "UPDATE users SET name = ?, email = ? WHERE organization_id = ? ORDER BY id ASC LIMIT 1",
        [nome, email, orgId],
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /api/configuracoes/perfil:", err);
    res.status(500).json({ message: "Erro ao atualizar perfil." });
  }
});

/* PUT /api/configuracoes/organizacao */
router.put("/organizacao", async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ message: "organization_id é obrigatório." });
    const { nome, email, telefone, endereco, cnpj } = req.body;
    await pool.execute(
      "UPDATE organizations SET name = ?, email = ?, phone = ?, address_line1 = ?, cnpj = ? WHERE id = ?",
      [nome || null, email || null, telefone || null, endereco || null, cnpj || null, orgId],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /api/configuracoes/organizacao:", err);
    res.status(500).json({ message: "Erro ao atualizar organização." });
  }
});

/* PUT /api/configuracoes/preferencias */
router.put("/preferencias", async (req, res) => {
  try {
    await ensurePrefsTable();
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ message: "organization_id é obrigatório." });
    const { tema, idioma, paginacao, formatoData } = req.body;
    await pool.execute(
      `INSERT INTO user_preferences (organization_id, tema, idioma, paginacao, formato_data)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         tema = VALUES(tema), idioma = VALUES(idioma),
         paginacao = VALUES(paginacao), formato_data = VALUES(formato_data)`,
      [orgId, tema || "claro", idioma || "pt-BR", paginacao || 20, formatoData || "DD/MM/AAAA"],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /api/configuracoes/preferencias:", err);
    res.status(500).json({ message: "Erro ao salvar preferências." });
  }
});

/* PUT /api/configuracoes/notificacoes — delegates to notif_rules via same table */
router.put("/notificacoes", async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ message: "organization_id é obrigatório." });
    const { estoqueBaixo, descarte, doacaoPendente, email, minimo } = req.body;

    // Ensure notif_rules table exists (created by notificacoes route)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notif_rules (
        organization_id  INT         NOT NULL PRIMARY KEY,
        estoque_baixo    TINYINT(1)  NOT NULL DEFAULT 1,
        descarte         TINYINT(1)  NOT NULL DEFAULT 1,
        doacao_pendente  TINYINT(1)  NOT NULL DEFAULT 1,
        email            TINYINT(1)  NOT NULL DEFAULT 0,
        minimo           INT         NOT NULL DEFAULT 5,
        updated_at       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.execute(
      `INSERT INTO notif_rules (organization_id, estoque_baixo, descarte, doacao_pendente, email, minimo)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         estoque_baixo = VALUES(estoque_baixo), descarte = VALUES(descarte),
         doacao_pendente = VALUES(doacao_pendente), email = VALUES(email), minimo = VALUES(minimo)`,
      [orgId, estoqueBaixo ? 1 : 0, descarte ? 1 : 0,
       doacaoPendente ? 1 : 0, email ? 1 : 0, minimo ?? 5],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /api/configuracoes/notificacoes:", err);
    res.status(500).json({ message: "Erro ao salvar preferências de notificação." });
  }
});

module.exports = router;
