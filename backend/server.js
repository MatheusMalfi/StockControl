// server.js
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
<<<<<<< Updated upstream
const Sequelize = require('sequelize');

=======
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
>>>>>>> Stashed changes
const app = express();
const PORT = process.env.PORT || 3000;

// raiz do projeto: .../StockControl
const root = path.join(__dirname, '..');
console.log('Static root:', root);

app.use(cors());
app.use(express.json());
<<<<<<< Updated upstream
const PORT = 3306;

const sequelize = new Sequelize("sc_db", "root", "!StockControl2025", {
  host: 'localhost',
  dialect: 'mysql'
});

module.exports = sequelize; 

// tabelas Criadas:
// ong_user
 //   ->     id_user INT AUTO_INCREMENT PRIMARY KEY,
   // ->     nome VARCHAR(100) NOT NULL,
//    ->     email VARCHAR(100) NOT NULL UNIQUE,
  //  ->     senha_hash VARCHAR(255) NOT NULL,
    //->     cnpj VARCHAR(20) NOT NULL,
//    ->     telefone VARCHAR(20),
  //  ->     celular VARCHAR(20) NOT NULL,
    //->     endereco VARCHAR(255),
//    ->     criado_em DATETIME DEFAULT CURRENT_TIMESTAMP

//CREATE TABLE items_cadastrados (
//    id_item INT AUTO_INCREMENT PRIMARY KEY,
//    id_user INT,
//     nome_item VARCHAR(100) NOT NULL,
//     marca_item VARCHAR(100),
//     modelo_item VARCHAR(100),
//     descricao VARCHAR(255),
//     img_file INT,
//     status_item VARCHAR(100), -- 'Ótimo estado', 'Necessita reparo', etc.
//     criado_por INT,
//     criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
//     atualizado_em DATETIME,

// CREATE TABLE hist_discart (
// 	data_discart DATETIME DEFAULT CURRENT_TIMESTAMP,
// 	nome_item VARCHAR(100) NOT NULL,
// 	marca_item VARCHAR(100),
// 	modelo_item VARCHAR(100),
// 	img_file INT
// );



app.get('/', async (req, res) => {
  res.send("funcionando");
});

app.post('/api/cadastro', async (req, res) =>{
  const{email, senha, nome, cnpj, endereco, telefone, celular} = req.body;
  const camposUnicos = {email, nome, cnpj, endereco, telefone, celular};
  const hash = await bcrypt.hash(senha, 10);
  
  //--**Validação de Duplicata**--
  for(const [campo, valor] of Object.entries(camposUnicos)){
    const query = `SELECT * FROM ong_user WHERE ${campo} = ? LIMIT 1`;
    const [rowsDuplicata] = await sequelize.query(query, [valor]);

    if (rowsDuplicata.length > 0 ){
      return res.status(400).json({erro: `${campo} já está cadastrado`})
    }
=======
app.use(express.urlencoded({ extended: true }));

// serve TUDO que está dentro de /StockControl (inclui /acesso/login/*)
app.use(express.static(root));

// ---------- MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'stockcontrol',
  waitForConnections: true,
  connectionLimit: 10,
});

// ---------- Páginas
app.get('/', (req, res) => {
  // abre diretamente o login dentro de /acesso/login
  res.sendFile(path.join(root, 'acesso', 'login', 'login.html'));
});
app.get('/login', (req, res) => {
  res.sendFile(path.join(root, 'acesso', 'login', 'login.html'));
});
app.get('/register', (req, res) => {
  // ajuste esse caminho se seu register estiver em outra pasta
  res.sendFile(path.join(root, 'acesso', 'register', 'register.html'));
});

app.get('/healthz', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, db: rows[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
>>>>>>> Stashed changes
  }
});

<<<<<<< Updated upstream
  //--**Cadastro no DB**--
  try{
    const [result] = await sequelize.execute(
      'INSERT INTO ong_user (email, senha_hash, nome, cnpj, endereco, telefone, celular) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [email, hash, nome, cnpj, endereco, telefone, celular]
=======
// ---------- API: Cadastro
app.post('/api/cadastro', async (req, res) => {
  try {
    const {
      email_institucional, confirma_email,
      senha, confirma_senha,
      nome_empresa, cnpj, endereco, telefone, celular,
    } = req.body;

    if (!email_institucional || !senha || !nome_empresa)
      return res.status(400).json({ erro: 'Campos obrigatórios ausentes.' });
    if (email_institucional !== confirma_email)
      return res.status(400).json({ erro: 'E-mail e confirmação não conferem.' });
    if (senha !== confirma_senha)
      return res.status(400).json({ erro: 'Senha e confirmação não conferem.' });

    const [dup] = await pool.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email_institucional]
    );
    if (dup.length) return res.status(400).json({ erro: 'E-mail já cadastrado.' });

    let organizationId;
    if (cnpj) {
      const [org] = await pool.query('SELECT id FROM organizations WHERE cnpj = ? LIMIT 1', [cnpj]);
      if (org.length) organizationId = org[0].id;
    }
    if (!organizationId) {
      const [ins] = await pool.execute(
        `INSERT INTO organizations
         (org_type, name, cnpj, email, phone, mobile, address_line1)
         VALUES ('ONG', ?, ?, ?, ?, ?, ?)`,
        [nome_empresa, cnpj || null, email_institucional, telefone || null, celular || null, endereco || null]
      );
      organizationId = ins.insertId;
    }

    const hash = await bcrypt.hash(senha, 10);
    const [u] = await pool.execute(
      `INSERT INTO users
       (organization_id, email, password_hash, name, role, is_active)
       VALUES (?, ?, ?, ?, 'ADMIN', 1)`,
      [organizationId, email_institucional, hash, nome_empresa]
>>>>>>> Stashed changes
    );

    res.status(201).json({ ok: true, user_id: u.insertId, organization_id: organizationId });
  } catch (err) {
    console.error('Erro no cadastro:', err);
    res.status(500).json({ erro: 'Erro interno no servidor' });
  }
});

// ---------- API: Login
app.post('/api/login', async (req, res) => {
  try {
<<<<<<< Updated upstream
    const [rows] = await sequelize.query('SELECT * FROM ong_user WHERE email = ?', [email]);
=======
    const { email, senha } = req.body;
    if (!email || !senha)
      return res.status(400).json({ mensagem: 'E-mail e senha são obrigatórios.' });
>>>>>>> Stashed changes

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    if (!rows.length)
      return res.status(401).json({ mensagem: 'E-mail ou senha incorretos.' });

    const user = rows[0];
    const ok = await bcrypt.compare(senha, user.password_hash);
    if (!ok) return res.status(401).json({ mensagem: 'E-mail ou senha incorretos.' });

    res.json({ success: true, mensagem: 'Login OK', user_id: user.id, organization_id: user.organization_id });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ mensagem: 'Erro interno no servidor' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
