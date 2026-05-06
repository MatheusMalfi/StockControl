const express = require("express");
const bcrypt  = require("bcrypt");
const jwt     = require("jsonwebtoken");
const pool    = require("../db");

const router      = express.Router();
const JWT_SECRET  = process.env.JWT_SECRET  || "stockcontrol_secret";
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || "7d";

/* ── Validators ─────────────────────────────────────────────── */
function isGmail(email) {
  return /^[a-zA-Z0-9._%+\-]+@gmail\.com$/i.test((email || "").trim());
}

function senhaForte(pwd) {
  return (
    pwd.length >= 8 &&
    /[A-Z]/.test(pwd) &&
    /[0-9]/.test(pwd) &&
    /[^A-Za-z0-9]/.test(pwd)
  );
}

function emitirToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, org: user.organization_id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES },
  );
}

/* ── POST /api/login ─────────────────────────────────────────── */
router.post("/login", async (req, res) => {
  try {
    const email = (req.body.email || "").trim();
    const senha = req.body.senha || req.body.password || "";

    if (!email || !senha) {
      return res.status(400).json({ mensagem: "E-mail e senha são obrigatórios." });
    }

    if (!isGmail(email)) {
      return res.status(400).json({ mensagem: "Use um e-mail @gmail.com." });
    }

    if (!senhaForte(senha)) {
      return res.status(400).json({
        mensagem: "A senha deve ter mínimo 8 caracteres, letra maiúscula, número e caractere especial.",
      });
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
    const ok   = await bcrypt.compare(senha, user.password_hash);
    if (!ok) {
      return res.status(401).json({ mensagem: "E-mail ou senha incorretos." });
    }

    const token = emitirToken(user);

    res.json({
      token,
      user: {
        id:              user.id,
        email:           user.email,
        name:            user.name,
        role:            user.role,
        organization_id: user.organization_id,
        org_type:        user.org_type,
      },
    });
  } catch (err) {
    console.error("Erro no /api/login:", err);
    res.status(500).json({ mensagem: "Erro interno no servidor." });
  }
});

/* ── POST /api/cadastro ──────────────────────────────────────── */
router.post("/cadastro", async (req, res) => {
  try {
    /* Accept both naming conventions (frontend may send either) */
    const email     = (req.body.email_institucional || req.body.email || "").trim();
    const senha     = req.body.senha || req.body.password || "";
    const orgName   = (req.body.nome_empresa || req.body.org_name || "").trim();
    const orgType   = req.body.org_type || "ONG";
    const cnpj      = req.body.cnpj      || null;
    const endereco  = req.body.endereco  || req.body.address  || null;
    const telefone  = req.body.telefone  || req.body.phone    || null;
    const celular   = req.body.celular   || null;
    const adminName = req.body.name      || orgName;

    if (!email || !senha || !orgName) {
      return res.status(400).json({ erro: "Campos obrigatórios ausentes." });
    }

    if (!isGmail(email)) {
      return res.status(400).json({ erro: "Use um e-mail @gmail.com." });
    }

    if (!senhaForte(senha)) {
      return res.status(400).json({
        erro: "A senha deve ter mínimo 8 caracteres, letra maiúscula, número e caractere especial.",
      });
    }

    const [dup] = await pool.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email],
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
        [orgType, orgName, cnpj, email, telefone, celular, endereco],
      );
      organizationId = insOrg.insertId;
    }

    const hash     = await bcrypt.hash(senha, parseInt(process.env.BCRYPT_ROUNDS) || 10);
    const userRole = orgType === "ADMIN" ? "ADMIN" : "OPERATOR";

    const [insUser] = await pool.execute(
      `INSERT INTO users (organization_id, email, password_hash, name, role, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [organizationId, email, hash, adminName, userRole],
    );

    const newUser = {
      id:              insUser.insertId,
      email,
      name:            adminName,
      role:            userRole,
      organization_id: organizationId,
    };

    const token = emitirToken(newUser);

    res.status(201).json({ token, user: newUser });
  } catch (err) {
    console.error("Erro no /api/cadastro:", err);
    res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

module.exports = router;
