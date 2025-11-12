// ==================== IMPORTS ====================
require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcrypt');           // se der erro no Windows, troque por 'bcryptjs'
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== STATIC / FRONTEND ====================

// raiz do projeto: .../StockControl (um nível acima do /backend)
const root = path.join(__dirname, '..');
console.log('Static root:', root);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve todos os arquivos estáticos da pasta StockControl (HTML, CSS, JS, imagens…)
app.use(express.static(root));

// Rota inicial -> abre o login.html
app.get('/', (req, res) => {
  res.sendFile(path.join(root, 'acesso', 'login', 'login.html'));
});

// (Opcional) rota direta pro cadastro
app.get('/register', (req, res) => {
  res.sendFile(path.join(root, 'acesso', 'register', 'register.html'));
});

// ==================== MYSQL POOL ====================

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'stockcontrol',
  waitForConnections: true,
  connectionLimit: 10,
});

// ==================== HEALTHCHECK ====================

app.get('/healthz', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, db: rows[0].ok === 1 });
  } catch (err) {
    console.error('Erro no /healthz:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ==================== CADASTRO ====================
//
// Usa as tabelas: organizations, users (do seu script SQL).
// Espera o body:
// {
//   email_institucional, confirma_email,
//   senha, confirma_senha,
//   nome_empresa, cnpj, endereco, telefone, celular
// }

app.post('/api/cadastro', async (req, res) => {
  try {
    const {
      email_institucional, confirma_email,
      senha, confirma_senha,
      nome_empresa, cnpj, endereco, telefone, celular,
    } = req.body;

    if (!email_institucional || !senha || !nome_empresa) {
      return res.status(400).json({ erro: 'Campos obrigatórios ausentes.' });
    }

    if (email_institucional !== confirma_email) {
      return res.status(400).json({ erro: 'E-mail e confirmação não conferem.' });
    }

    if (senha !== confirma_senha) {
      return res.status(400).json({ erro: 'Senha e confirmação não conferem.' });
    }

    // E-mail já usado?
    const [dup] = await pool.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email_institucional]
    );
    if (dup.length) {
      return res.status(400).json({ erro: 'E-mail já cadastrado.' });
    }

    // Descobrir/ criar organização pelo CNPJ
    let organizationId;

    if (cnpj) {
      const [org] = await pool.query(
        'SELECT id FROM organizations WHERE cnpj = ? LIMIT 1',
        [cnpj]
      );
      if (org.length) {
        organizationId = org[0].id;
      }
    }

    if (!organizationId) {
      const [insOrg] = await pool.execute(
        `INSERT INTO organizations
         (org_type, name, cnpj, email, phone, mobile, address_line1)
         VALUES ('ONG', ?, ?, ?, ?, ?, ?)`,
        [
          nome_empresa,
          cnpj || null,
          email_institucional,
          telefone || null,
          celular || null,
          endereco || null,
        ]
      );
      organizationId = insOrg.insertId;
    }

    // Cria usuário ADMIN da ONG
    const hash = await bcrypt.hash(senha, 10);
    const [insUser] = await pool.execute(
      `INSERT INTO users
       (organization_id, email, password_hash, name, role, is_active)
       VALUES (?, ?, ?, ?, 'ADMIN', 1)`,
      [organizationId, email_institucional, hash, nome_empresa]
    );

    res.status(201).json({
      ok: true,
      user_id: insUser.insertId,
      organization_id: organizationId,
    });
  } catch (err) {
    console.error('Erro no cadastro:', err);
    res.status(500).json({ erro: 'Erro interno no servidor' });
  }
});

// ==================== LOGIN ====================
//
// Espera body:
// { email, senha }

app.post('/api/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ mensagem: 'E-mail e senha são obrigatórios.' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    if (!rows.length) {
      return res.status(401).json({ mensagem: 'E-mail ou senha incorretos.' });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(senha, user.password_hash);

    if (!ok) {
      return res.status(401).json({ mensagem: 'E-mail ou senha incorretos.' });
    }

    res.json({
      success: true,
      mensagem: 'Login OK',
      user_id: user.id,
      organization_id: user.organization_id,
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ mensagem: 'Erro interno no servidor' });
  }
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
