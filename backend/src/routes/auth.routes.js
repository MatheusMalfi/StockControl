const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const pool = require("../db");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "stockcontrol_secret";
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || "7d";

/* ── E-mail helper ──────────────────────────────────────────── */
function createTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function gerarCodigo() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function enviarCodigoVerificacao(email, nome, code) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[verificação-email] Código para ${email}: ${code}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: "Confirme seu e-mail",
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8fafc;border-radius:12px;">
        <h2 style="color:#1e3a5f;margin:0 0 8px">Bem-vindo ao StockControl!</h2>
        <p style="color:#475569;margin:0 0 24px">Olá, <strong>${nome}</strong>. Use o código abaixo para confirmar seu e-mail:</p>
        <div style="background:#fff;border:2px solid #1d4ed8;border-radius:8px;padding:20px 32px;text-align:center;margin:0 0 24px">
          <span style="font-size:2.5rem;font-weight:700;letter-spacing:12px;color:#1d4ed8">${code}</span>
        </div>
        <p style="color:#94a3b8;font-size:0.85rem;margin:0">Este código expira em <strong>15 minutos</strong>. Se você não criou uma conta, ignore este e-mail.</p>
      </div>`,
  });
}

/* ── Validators ─────────────────────────────────────────────── */
function isValidEmail(email) {
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/i.test(
    (email || "").trim(),
  );
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
    {
      id: user.id,
      email: user.email,
      role: user.role,
      org: user.organization_id,
    },
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
      return res
        .status(400)
        .json({ mensagem: "E-mail e senha são obrigatórios." });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ mensagem: "Informe um e-mail válido." });
    }

    if (!senhaForte(senha)) {
      return res.status(400).json({
        mensagem:
          "A senha deve ter mínimo 8 caracteres, letra maiúscula, número e caractere especial.",
      });
    }

    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.password_hash, u.organization_id,
              u.is_active, u.email_verified, o.org_type
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       WHERE u.email = ? LIMIT 1`,
      [email],
    );

    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ mensagem: "E-mail ou senha incorretos." });
    }

    if (!rows[0].email_verified) {
      return res.status(403).json({
        mensagem:
          "E-mail não verificado. Verifique sua caixa de entrada e confirme o código.",
        email_nao_verificado: true,
        email,
      });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(senha, user.password_hash);
    if (!ok) {
      return res.status(401).json({ mensagem: "E-mail ou senha incorretos." });
    }

    const token = emitirToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization_id: user.organization_id,
        org_type: user.org_type,
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
    const email = (req.body.email_institucional || req.body.email || "").trim();
    const senha = req.body.senha || req.body.password || "";
    const orgName = (req.body.nome_empresa || req.body.org_name || "").trim();
    const orgType = req.body.org_type || "ONG";
    const cnpj = req.body.cnpj || null;
    const endereco = req.body.endereco || req.body.address || null;
    const telefone = req.body.telefone || req.body.phone || null;
    const celular = req.body.celular || null;
    const adminName = req.body.name || orgName;

    if (!email || !senha || !orgName) {
      return res.status(400).json({ erro: "Campos obrigatórios ausentes." });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ erro: "Informe um e-mail válido." });
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

    const hash = await bcrypt.hash(
      senha,
      parseInt(process.env.BCRYPT_ROUNDS) || 10,
    );
    const userRole = "ADMIN";

    const [insUser] = await pool.execute(
      `INSERT INTO users (organization_id, email, password_hash, name, role, is_active, email_verified)
       VALUES (?, ?, ?, ?, ?, 1, 0)`,
      [organizationId, email, hash, adminName, userRole],
    );

    const userId = insUser.insertId;

    // Gera e persiste código de verificação (expira em 15 min)
    const code = gerarCodigo();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    await pool.execute(
      `INSERT INTO email_verifications (user_id, code, expires_at) VALUES (?, ?, ?)`,
      [userId, code, expiresAt],
    );

    try {
      await enviarCodigoVerificacao(email, adminName, code);
    } catch (mailErr) {
      console.error("Erro ao enviar e-mail de verificação:", mailErr);
    }

    res.status(201).json({
      aguardando_verificacao: true,
      email,
      mensagem:
        "Conta criada. Verifique seu e-mail e informe o código de 6 dígitos.",
    });
  } catch (err) {
    console.error("Erro no /api/cadastro:", err);
    res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

/* ── POST /api/verificar-email ───────────────────────────────── */
router.post("/verificar-email", async (req, res) => {
  try {
    const email = (req.body.email || "").trim();
    const code = (req.body.code || "").trim();

    if (!email || !code) {
      return res
        .status(400)
        .json({ mensagem: "E-mail e código são obrigatórios." });
    }

    const [users] = await pool.query(
      "SELECT id, email_verified FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    if (!users.length) {
      return res.status(400).json({ mensagem: "Código inválido ou expirado." });
    }

    const user = users[0];

    if (user.email_verified) {
      return res.json({ sucesso: true, ja_verificado: true });
    }

    const [rows] = await pool.query(
      `SELECT id FROM email_verifications
       WHERE user_id = ? AND code = ? AND used = 0 AND expires_at > NOW()
       LIMIT 1`,
      [user.id, code],
    );

    if (!rows.length) {
      return res.status(400).json({ mensagem: "Código inválido ou expirado." });
    }

    // Marca como usado e ativa o e-mail
    await pool.execute("UPDATE email_verifications SET used = 1 WHERE id = ?", [
      rows[0].id,
    ]);
    await pool.execute("UPDATE users SET email_verified = 1 WHERE id = ?", [
      user.id,
    ]);

    res.json({ sucesso: true });
  } catch (err) {
    console.error("Erro no /api/verificar-email:", err);
    res.status(500).json({ mensagem: "Erro interno no servidor." });
  }
});

/* ── POST /api/reenviar-verificacao ─────────────────────────── */
router.post("/reenviar-verificacao", async (req, res) => {
  try {
    const email = (req.body.email || "").trim();
    if (!email)
      return res.status(400).json({ mensagem: "E-mail é obrigatório." });

    const [users] = await pool.query(
      "SELECT id, name, email_verified FROM users WHERE email = ? LIMIT 1",
      [email],
    );

    // Responde sempre com sucesso para não expor se o e-mail existe
    if (!users.length || users[0].email_verified) {
      return res.json({ sucesso: true });
    }

    const user = users[0];

    // Invalida códigos anteriores não utilizados
    await pool.execute(
      "UPDATE email_verifications SET used = 1 WHERE user_id = ? AND used = 0",
      [user.id],
    );

    const code = gerarCodigo();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    await pool.execute(
      "INSERT INTO email_verifications (user_id, code, expires_at) VALUES (?, ?, ?)",
      [user.id, code, expiresAt],
    );

    try {
      await enviarCodigoVerificacao(email, user.name || email, code);
    } catch (mailErr) {
      console.error("Erro ao reenviar verificação:", mailErr);
    }

    res.json({ sucesso: true });
  } catch (err) {
    console.error("Erro no /api/reenviar-verificacao:", err);
    res.status(500).json({ mensagem: "Erro interno no servidor." });
  }
});

/* ── POST /api/recuperar-senha ───────────────────────────────── */
router.post("/recuperar-senha", async (req, res) => {
  try {
    const email = (req.body.email || "").trim();
    if (!email)
      return res.status(400).json({ mensagem: "E-mail é obrigatório." });

    const [rows] = await pool.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    // Always respond success to avoid email enumeration
    if (!rows.length) return res.json({ sucesso: true });

    const token = jwt.sign({ id: rows[0].id, purpose: "reset" }, JWT_SECRET, {
      expiresIn: "1h",
    });
    const resetUrl = `${process.env.APP_URL || "http://localhost:3000"}/acesso/change-password/change-password.html?token=${token}`;

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: "Recuperação de senha — StockControl",
        html: `<p>Clique no link abaixo para redefinir sua senha (válido por 1 hora):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
      });
    } else {
      console.log(`[recuperar-senha] Reset link for ${email}: ${resetUrl}`);
    }
    res.json({ sucesso: true });
  } catch (err) {
    console.error("Erro no /api/recuperar-senha:", err);
    res.status(500).json({ mensagem: "Erro interno no servidor." });
  }
});

/* ── POST /api/alterar-senha ─────────────────────────────────── */
router.post("/alterar-senha", async (req, res) => {
  try {
    const { token, novaSenha } = req.body;
    if (!token || !novaSenha) {
      return res
        .status(400)
        .json({ mensagem: "Token e nova senha são obrigatórios." });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(400).json({ mensagem: "Token inválido ou expirado." });
    }

    if (payload.purpose !== "reset") {
      return res.status(400).json({ mensagem: "Token inválido." });
    }

    if (!senhaForte(novaSenha)) {
      return res.status(400).json({
        mensagem:
          "A senha deve ter mínimo 8 caracteres, letra maiúscula, número e caractere especial.",
      });
    }

    const hash = await bcrypt.hash(
      novaSenha,
      parseInt(process.env.BCRYPT_ROUNDS) || 10,
    );
    await pool.execute("UPDATE users SET password_hash = ? WHERE id = ?", [
      hash,
      payload.id,
    ]);
    res.json({ sucesso: true });
  } catch (err) {
    console.error("Erro no /api/alterar-senha:", err);
    res.status(500).json({ mensagem: "Erro interno no servidor." });
  }
});

/* ── GET /api/users/me ───────────────────────────────────────── */
router.get("/users/me", async (req, res) => {
  try {
    const token = (req.headers.authorization || "")
      .replace("Bearer ", "")
      .trim();
    if (!token) return res.status(401).json({ mensagem: "Token ausente." });
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ mensagem: "Token inválido." });
    }
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.organization_id, o.org_type
       FROM users u JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = ? AND u.is_active = 1 LIMIT 1`,
      [payload.id],
    );
    if (!rows.length)
      return res.status(404).json({ mensagem: "Usuário não encontrado." });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error("GET /api/users/me:", err);
    res.status(500).json({ mensagem: "Erro interno." });
  }
});

/* ── POST /api/change-password ───────────────────────────────── */
router.post("/change-password", async (req, res) => {
  try {
    const token = (req.headers.authorization || "")
      .replace("Bearer ", "")
      .trim();
    if (!token) return res.status(401).json({ mensagem: "Token ausente." });
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ mensagem: "Token inválido." });
    }

    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual || !novaSenha) {
      return res
        .status(400)
        .json({ mensagem: "Campos obrigatórios ausentes." });
    }
    if (!senhaForte(novaSenha)) {
      return res.status(400).json({
        mensagem:
          "A nova senha deve ter mínimo 8 caracteres, letra maiúscula, número e caractere especial.",
      });
    }

    const [rows] = await pool.query(
      "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
      [payload.id],
    );
    if (!rows.length)
      return res.status(404).json({ mensagem: "Usuário não encontrado." });

    const ok = await bcrypt.compare(senhaAtual, rows[0].password_hash);
    if (!ok)
      return res.status(400).json({ mensagem: "Senha atual incorreta." });

    const hash = await bcrypt.hash(
      novaSenha,
      parseInt(process.env.BCRYPT_ROUNDS) || 10,
    );
    await pool.execute("UPDATE users SET password_hash = ? WHERE id = ?", [
      hash,
      payload.id,
    ]);
    res.json({ sucesso: true });
  } catch (err) {
    console.error("POST /api/change-password:", err);
    res.status(500).json({ mensagem: "Erro interno." });
  }
});

module.exports = router;
