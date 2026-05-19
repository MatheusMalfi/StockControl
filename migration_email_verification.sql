-- ============================================================
-- Migração: Verificação de e-mail em duas etapas
-- Execute este script uma única vez no banco stockcontrol
-- ============================================================

USE stockcontrol;

-- 1. Adiciona coluna email_verified na tabela users (se não existir)
ALTER TABLE users
  ADD COLUMN email_verified TINYINT NOT NULL DEFAULT 0
  AFTER is_active;

-- 2. Marca todos os usuários existentes como verificados
--    (não queremos bloquear quem já estava cadastrado)
UPDATE users SET email_verified = 1 WHERE email_verified = 0;

-- 3. Cria tabela para armazenar os códigos de verificação
CREATE TABLE IF NOT EXISTS email_verifications (
  id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  code       CHAR(6)         NOT NULL,
  expires_at DATETIME        NOT NULL,
  used       TINYINT         NOT NULL DEFAULT 0,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ev_user_code (user_id, code),
  CONSTRAINT fk_ev_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- Índice para busca rápida por usuário + código
-- (criado junto com a tabela via KEY inline para evitar erro se já existir)
