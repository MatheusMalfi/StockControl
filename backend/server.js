
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const Sequelize = require('sequelize');

const app = express();
app.use(cors());
app.use(express.json());
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
  }

  //--**Cadastro no DB**--
  try{
    const [result] = await sequelize.execute(
      'INSERT INTO ong_user (email, senha_hash, nome, cnpj, endereco, telefone, celular) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [email, hash, nome, cnpj, endereco, telefone, celular]
    );

    res.json({ok: true, id:result.insertId});
  } catch (err) {
    console.error("Erro no banco: ", err);
    res.status(500).json({erro: 'Erro no banco de dados'});
  }
});


//-----------------------------------------------------------

app.post('/api/login', async (request, response) => {
  const {email, senha} = request.body;
  try {
    const [rows] = await sequelize.query('SELECT * FROM ong_user WHERE email = ?', [email]);

    if (rows.length === 0){
      return response.status(401).json({mensagem: 'E-mail ou senha incorretos.'});
    }

    const usuario = rows[0];

    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida){
      return response.status(401).json({mensagem: 'E-mail ou senha incorretos.'});
    }

    response.status(200).json({
      success: true, 
      mensagem: 'Status 200'
    });
    
  } catch(erro){
    console.error(erro);
    response.status(500).json({mensagem: 'Erro interno no servidor'});
  }
});
//-----------------------------------------------------------

app.post('/api/passrecover', async(reqRecover, resRecover) =>{
  const{email} = reqRecover.body;
  if(!email){
    return reqRecover.status(400).json({mensagem: "E-mail obrigatório!"});
  }
})

//-----------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});