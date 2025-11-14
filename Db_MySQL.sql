-- StockControl (E-waste inventory & disposal) - MySQL 8.x
-- Safe to run in MySQL Workbench. Ajuste engine/charset se precisar.

-- 1) Create database
CREATE DATABASE IF NOT EXISTS stockcontrol
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE stockcontrol;

-- 2) Organizations (ONGs, recicladoras, etc.)
CREATE TABLE organizations (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  org_type        ENUM('ONG','RECYCLER','OTHER') NOT NULL DEFAULT 'ONG',
  name            VARCHAR(150) NOT NULL,
  cnpj            VARCHAR(18) UNIQUE,                 -- 00.000.000/0000-00
  email           VARCHAR(150),
  phone           VARCHAR(30),
  mobile          VARCHAR(30),
  address_line1   VARCHAR(200),
  address_line2   VARCHAR(200),
  city            VARCHAR(120),
  state           VARCHAR(60),
  postal_code     VARCHAR(20),
  notes           TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3) Users (auth básico, atrelado à organização/ONG)
CREATE TABLE users (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  email           VARCHAR(150) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  name            VARCHAR(120),
  role            ENUM('ADMIN','OPERATOR','VIEWER') NOT NULL DEFAULT 'OPERATOR',
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 4) Tabelas de referência (catálogo)
CREATE TABLE categories (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE brands (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE models (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  brand_id    INT UNSIGNED NOT NULL,
  name        VARCHAR(120) NOT NULL,
  UNIQUE KEY uk_brand_model (brand_id, name),
  CONSTRAINT fk_models_brand FOREIGN KEY (brand_id) REFERENCES brands(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 5) Condições/Status (verde/amarelo/vermelho)
CREATE TABLE conditions (
  id        TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code      ENUM('OTIMO','REPARO','DESCARTAR') NOT NULL UNIQUE,
  label_pt  VARCHAR(60) NOT NULL,
  color_hex CHAR(7) NOT NULL DEFAULT '#FFFFFF'
) ENGINE=InnoDB;

-- 6) Itens de estoque
CREATE TABLE items (
  id               BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  organization_id  BIGINT UNSIGNED NOT NULL,            -- quem é dono (ONG)
  category_id      INT UNSIGNED,
  brand_id         INT UNSIGNED,
  model_id         INT UNSIGNED,
  product_name     VARCHAR(150) NOT NULL,               -- ex.: Notebook, Gabinete
  product_brand    VARCHAR(120),                        -- captura rápida redundante
  product_model    VARCHAR(120),
  serial_number    VARCHAR(120),
  description      TEXT,
  condition_id     TINYINT UNSIGNED NOT NULL,           -- FK conditions
  weight_kg        DECIMAL(10,3),                       -- opcional, p/ pedidos
  photo_url        VARCHAR(500),                        -- URL/armazenamento externo
  is_active        TINYINT(1) NOT NULL DEFAULT 1,       -- soft delete
  created_by       BIGINT UNSIGNED,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_items_org       FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_items_category  FOREIGN KEY (category_id)  REFERENCES categories(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_items_brand     FOREIGN KEY (brand_id)     REFERENCES brands(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_items_model     FOREIGN KEY (model_id)     REFERENCES models(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_items_condition FOREIGN KEY (condition_id) REFERENCES conditions(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 7) Histórico de descarte (ONG e recicladora)
CREATE TABLE disposal_history (
  id                 BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  item_id            BIGINT UNSIGNED NOT NULL,
  organization_id    BIGINT UNSIGNED NOT NULL,       -- ONG que descartou
  destination_type   ENUM('INTERNAL','RECYCLER') NOT NULL,
  destination_org_id BIGINT UNSIGNED,                -- quando destino = recicladora
  prev_condition_id  TINYINT UNSIGNED,
  new_condition_id   TINYINT UNSIGNED,
  action             ENUM('MARKED_FOR_DISPOSAL','REQUESTED_PICKUP','PICKED_UP','CANCELLED') NOT NULL,
  quantity           INT UNSIGNED NOT NULL DEFAULT 1,
  weight_kg          DECIMAL(10,3),
  document_number    VARCHAR(100),                   -- protocolo/romaneio/nota
  notes              TEXT,
  created_by         BIGINT UNSIGNED,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_disph_item   FOREIGN KEY (item_id) REFERENCES items(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_disph_org    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_disph_dest   FOREIGN KEY (destination_org_id) REFERENCES organizations(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_disph_prev   FOREIGN KEY (prev_condition_id) REFERENCES conditions(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_disph_new    FOREIGN KEY (new_condition_id) REFERENCES conditions(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- 8) Pedidos para recicladoras (ex.: Impacto Metais)
CREATE TABLE recycler_orders (
  id                 BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  organization_id    BIGINT UNSIGNED NOT NULL,     -- ONG que solicita
  recycler_id        BIGINT UNSIGNED NOT NULL,     -- parceira (Impacto Metais)
  status             ENUM('DRAFT','REQUESTED','SCHEDULED','PICKED_UP','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  scheduled_at       DATETIME,
  picked_up_at       DATETIME,
  total_weight_kg    DECIMAL(12,3),
  notes              TEXT,
  created_by         BIGINT UNSIGNED,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ro_org      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_ro_recycler FOREIGN KEY (recycler_id)    REFERENCES organizations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE recycler_order_items (
  id                 BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  recycler_order_id  BIGINT UNSIGNED NOT NULL,
  item_id            BIGINT UNSIGNED,            -- vincula itens específicos (opcional)
  category_id        INT UNSIGNED,               -- ou agrupa por categoria (opcional)
  description        VARCHAR(200),
  quantity           INT UNSIGNED NOT NULL DEFAULT 1,
  weight_kg          DECIMAL(10,3),
  CONSTRAINT fk_roi_order   FOREIGN KEY (recycler_order_id) REFERENCES recycler_orders(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_roi_item    FOREIGN KEY (item_id) REFERENCES items(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_roi_cat     FOREIGN KEY (category_id) REFERENCES categories(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- 9) View útil para listagens no front
CREATE OR REPLACE VIEW v_items_summary AS
SELECT
  i.id,
  i.product_name,
  COALESCE(i.product_brand, b.name) AS brand,
  COALESCE(i.product_model, m.name) AS model,
  c.label_pt AS condition_label,
  c.code     AS condition_code,
  i.photo_url,
  i.description,
  i.created_at
FROM items i
LEFT JOIN brands b   ON b.id = i.brand_id
LEFT JOIN models m   ON m.id = i.model_id
JOIN conditions c    ON c.id = i.condition_id;

-- 10) Seeds iniciais (condições, categorias e Impacto Metais)
INSERT INTO conditions (code, label_pt, color_hex) VALUES
  ('OTIMO',     'Ótimo Estado de Uso', '#2ECC71'),
  ('REPARO',    'Necessita de Reparos', '#F1C40F'),
  ('DESCARTAR', 'Necessita ser Descartado', '#E74C3C')
ON DUPLICATE KEY UPDATE label_pt=VALUES(label_pt), color_hex=VALUES(color_hex);

INSERT INTO categories (name) VALUES
  ('Notebook'),
  ('Gabinete'),
  ('Monitor'),
  ('Periféricos'),
  ('Outros')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Parceira: Impacto Metais (edite os dados reais)
INSERT INTO organizations (org_type, name, cnpj, email, phone, mobile, address_line1, city, state, postal_code, notes)
VALUES
  ('RECYCLER', 'Impacto Metais', '00.000.000/0000-00', 'contato@impactometais.com.br', '(11) 0000-0000', '(11) 90000-0000',
   'Rua Exemplo, 123', 'São Paulo', 'SP', '00000-000', 'Coletora/parceira para descarte de resíduos eletrônicos')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ONG exemplo para testes (opcional)
INSERT INTO organizations (org_type, name, cnpj, email)
VALUES ('ONG','Sua ONG', '11.111.111/0001-11', 'contato@suaong.org')
ON DUPLICATE KEY UPDATE name = VALUES(name);
