import { config } from 'dotenv';
config();

// No Railway, usamos process.env para ler as variáveis da aba "Variables"
export const PORT = process.env.PORT || 3000;
export const DB_HOST = process.env.MYSQLHOST || 'localhost';
export const DB_PORT = process.env.MYSQLPORT || 3306;
export const DB_USER = process.env.MYSQLUSER || 'root';
export const DB_PASSWORD = process.env.MYSQLPASSWORD || '';
export const DB_NAME = process.env.MYSQLDATABASE || 'stockcontrol';

export const BCRYPT_ROUNDS = 10;