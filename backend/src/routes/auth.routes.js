const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");

const router = express.Router();

// POST /api/login
router.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ mensagem: "E-mail e senha são obrigatórios." });
    }

    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.password_hash, u.organization_id,
              u.is_active, o.org_type
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       WHERE u.email = ? LIMIT 1`,
      [email],
    );

    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ mensagem: "E-mail ou senha incorretos." });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(senha, user.password_hash);
    if (!ok) {
      return res.status(401).json({ mensagem: "E-mail ou senha incorretos." });
    }

    res.json({
      success: true,
      mensagem: "Login OK",
      org_type: user.org_type,
      user_id: user.id,
      organization_id: user.organization_id,
      role: user.role,
    });
  } catch (err) {
    console.error("Erro no /api/login:", err);
    res.status(500).json({ mensagem: "Erro interno no servidor." });
  }
});

// POST /api/cadastro
router.post("/cadastro", async (req, res) => {
  try {
    const {
      email_institucional,
      confirma_email,
      senha,
      confirma_senha,
      nome_empresa,
      cnpj,
      endereco,
      telefone,
      celular,
      org_type,
    } = req.body;

    if (!email_institucional || !senha || !nome_empresa) {
      return res.status(400).json({ erro: "Campos obrigatórios ausentes." });
    }

    if (email_institucional !== confirma_email) {
      return res.status(400).json({ erro: "E-mail e confirmação não conferem." });
    }

    if (senha !== confirma_senha) {
      return res.status(400).json({ erro: "Senha e confirmação não conferem." });
    }

    const [dup] = await pool.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email_institucional],
    );
    if (dup.length) {
      return res.status(400).json({ erro: "E-mail já cadastrado." });
    }

    let organizationId;

    if (cnpj) {
      const [org] = await pool.query(
        "SELECT id FROM organizations WHERE cnpj = ? LIMIT 1",
        [cnpj],
      );
      if (org.length) organizationId = org[0].id;
    }

    if (!organizationId) {
      const [insOrg] = await pool.execute(
        `INSERT INTO organizations
          (org_type, name, cnpj, email, phone, mobile, address_line1)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          org_type || "ONG",
          nome_empresa,
          cnpj || null,
          email_institucional,
          telefone || null,
          celular || null,
          endereco || null,
        ],
      );
      organizationId = insOrg.insertId;
    }

    const hash = await bcrypt.hash(senha, parseInt(process.env.BCRYPT_ROUNDS) || 10);
    const userRole = org_type === "ADMIN" ? "ADMIN" : "OPERATOR";

    const [insUser] = await pool.execute(
      `INSERT INTO users (organization_id, email, password_hash, name, role, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [organizationId, email_institucional, hash, nome_empresa, userRole],
    );

    res.status(201).json({
      ok: true,
      user_id: insUser.insertId,
      organization_id: organizationId,
    });
  } catch (err) {
    console.error("Erro no /api/cadastro:", err);
    res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

module.exports = router;
