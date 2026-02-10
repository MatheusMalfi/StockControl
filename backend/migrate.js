// Script para importar o banco de dados no Railway
require("dotenv").config();
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

async function migrate() {
  console.log("Iniciando migração do banco de dados");

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
  });

  try {
    const sqlFile = path.join(__dirname, "..", "Db_MySQL.sql");
    const sql = fs.readFileSync(sqlFile, "utf8");
    const normalizedSql = sql.replace(
      /\bCREATE TABLE\s+/gi,
      "CREATE TABLE IF NOT EXISTS ",
    );

    console.log("Executando SQL");
    await connection.query(normalizedSql);
    console.log("Banco de dados criado com sucesso!");
  } catch (error) {
    console.error("Erro ao criar banco:", error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
