const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); 
// Importe seu objeto de conexão do Sequelize aqui:
// const sequelize = require('./caminho/para/sua/conexao/sequelize'); 

// 🚨 IMPORTANTE: Mantenha esta chave secreta em uma variável de ambiente (process.env)!
const JWT_SECRET = process.env.JWT_SECRET || 'SUA_CHAVE_SECRETA_MUITO_FORTE_AQUI'; 

// Se você estiver usando um arquivo de rotas separado:
// const router = express.Router(); 
// module.exports = router; 
// Se estiver no app.js, use 'app.post' diretamente.

// A rota deve ser '/api/login' conforme você definiu anteriormente.
app.post('/api/login', async (request, response) => {
    // Desestrutura os dados do corpo da requisição
    const { email, senha } = request.body; 

    // Validação básica para garantir que ambos os campos foram enviados
    if (!email || !senha) {
        return response.status(400).json({ mensagem: 'Email e senha são obrigatórios.' });
    }

    try {
        // 1. BUSCAR O USUÁRIO NO BANCO DE DADOS
        const [rows] = await sequelize.query('SELECT * FROM ong_user WHERE email = ?', {
            replacements: [email],
            type: sequelize.QueryTypes.SELECT // Garante que retorne objetos JSON
        });

        // Verifica se o usuário foi encontrado
        if (rows.length === 0) {
            // Mensagem genérica por segurança (não diz se foi email ou senha)
            return response.status(401).json({ mensagem: 'E-mail ou senha incorretos.' });
        }

        const usuario = rows[0];

        // 2. COMPARAÇÃO DA SENHA
        // Compara a senha (texto puro) com o hash criptografado salvo em 'usuario.senha_hash'
        const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
        
        if (!senhaValida) {
            // Mensagem genérica por segurança
            return response.status(401).json({ mensagem: 'E-mail ou senha incorretos.' });
        }

        // 3. LOGIN BEM-SUCEDIDO: GERAÇÃO DO TOKEN JWT
        // Cria um payload com informações não sensíveis para identificar o usuário
        const tokenPayload = {
            id: usuario.id, 
            email: usuario.email,
            // Adicione outras informações úteis (ex: nome, cargo)
        };

        const token = jwt.sign(
            tokenPayload, 
            JWT_SECRET, 
            { expiresIn: '1h' } // Token expira em 1 hora
        );

        // 4. ENVIA RESPOSTA DE SUCESSO
        response.status(200).json({
            success: true, 
            mensagem: 'Login bem-sucedido!',
            token: token, // O frontend salva e usa este token
            user: {
                id: usuario.id,
                email: usuario.email,
                // Adicione outros dados que o frontend precisa
            }
        });
        
    } catch (erro) {
        console.error('Erro de servidor durante o login:', erro);
        response.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }
});