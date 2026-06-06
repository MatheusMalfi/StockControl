-- ============================================================
-- StockControl — Setup completo (MySQL 8.x)
-- Execute este arquivo uma única vez para criar o banco do zero.
-- ============================================================

CREATE DATABASE IF NOT EXISTS stockcontrol
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE stockcontrol;

-- ============================================================
-- TABELAS DE REFERÊNCIA
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
  id            BIGINT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
  org_type      ENUM('ONG','RECYCLER','OTHER') NOT NULL DEFAULT 'ONG',
  name          VARCHAR(150)     NOT NULL,
  cnpj          VARCHAR(18)      UNIQUE,
  email         VARCHAR(150)     DEFAULT NULL,
  phone         VARCHAR(30)      DEFAULT NULL,
  mobile        VARCHAR(30)      DEFAULT NULL,
  address_line1 VARCHAR(200)     DEFAULT NULL,
  address_line2 VARCHAR(200)     DEFAULT NULL,
  city          VARCHAR(120)     DEFAULT NULL,
  state         VARCHAR(60)      DEFAULT NULL,
  postal_code   VARCHAR(20)      DEFAULT NULL,
  notes         TEXT             DEFAULT NULL,
  created_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id              BIGINT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED  NOT NULL,
  email           VARCHAR(150)     NOT NULL UNIQUE,
  password_hash   VARCHAR(255)     NOT NULL,
  name            VARCHAR(120)     DEFAULT NULL,
  role            ENUM('ADMIN','OPERATOR','VIEWER') NOT NULL DEFAULT 'OPERATOR',
  is_active       TINYINT       NOT NULL DEFAULT 1,
  created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id   INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80)  NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS brands (
  id   INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS models (
  id       INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  brand_id INT UNSIGNED NOT NULL,
  name     VARCHAR(120) NOT NULL,
  UNIQUE KEY uk_brand_model (brand_id, name),
  CONSTRAINT fk_models_brand FOREIGN KEY (brand_id) REFERENCES brands(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS conditions (
  id        TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code      ENUM('OTIMO','REPARO','DESCARTAR') NOT NULL UNIQUE,
  label_pt  VARCHAR(60) NOT NULL,
  color_hex CHAR(7)     NOT NULL DEFAULT '#FFFFFF'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS storage_locations (
  id              INT UNSIGNED    PRIMARY KEY AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(120)    NOT NULL,
  description     TEXT            DEFAULT NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sl_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tags (
  id        INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name      VARCHAR(80)  NOT NULL UNIQUE,
  color_hex CHAR(7)      NOT NULL DEFAULT '#CCCCCC'
) ENGINE=InnoDB;

-- ============================================================
-- ITENS DE ESTOQUE
-- ============================================================

CREATE TABLE IF NOT EXISTS items (
  id                  BIGINT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
  organization_id     BIGINT UNSIGNED  NOT NULL,
  category_id         INT UNSIGNED     DEFAULT NULL,
  brand_id            INT UNSIGNED     DEFAULT NULL,
  model_id            INT UNSIGNED     DEFAULT NULL,
  storage_location_id INT UNSIGNED     DEFAULT NULL,
  product_name        VARCHAR(150)     NOT NULL,
  product_brand       VARCHAR(120)     DEFAULT NULL,
  product_model       VARCHAR(120)     DEFAULT NULL,
  serial_number       VARCHAR(120)     DEFAULT NULL,
  description         TEXT             DEFAULT NULL,
  condition_id        TINYINT UNSIGNED NOT NULL,
  quantity            INT UNSIGNED     NOT NULL DEFAULT 1,
  quantity_available  INT UNSIGNED     NOT NULL DEFAULT 1,
  weight_kg           DECIMAL(10,3)    DEFAULT NULL,
  estimated_value     DECIMAL(12,2)    DEFAULT NULL,
  currency            CHAR(3)          NOT NULL DEFAULT 'BRL',
  photo_url           VARCHAR(500)     DEFAULT NULL,
  photo_blob          LONGBLOB         DEFAULT NULL,
  qr_code_token       CHAR(36)         UNIQUE,
  is_active           TINYINT       NOT NULL DEFAULT 1,
  deactivated_at      DATETIME         DEFAULT NULL,
  deactivated_by      BIGINT UNSIGNED  DEFAULT NULL,
  deactivation_reason VARCHAR(255)     DEFAULT NULL,
  created_by          BIGINT UNSIGNED  DEFAULT NULL,
  created_at          TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_items_org            FOREIGN KEY (organization_id)     REFERENCES organizations(id)     ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_items_category       FOREIGN KEY (category_id)         REFERENCES categories(id)        ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_items_brand          FOREIGN KEY (brand_id)            REFERENCES brands(id)            ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_items_model          FOREIGN KEY (model_id)            REFERENCES models(id)            ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_items_condition      FOREIGN KEY (condition_id)        REFERENCES conditions(id)        ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_items_storage_loc    FOREIGN KEY (storage_location_id) REFERENCES storage_locations(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_items_deactivated_by FOREIGN KEY (deactivated_by)      REFERENCES users(id)             ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_quantity_available  CHECK (quantity_available >= 0),
  CONSTRAINT chk_quantity_positive   CHECK (quantity >= 0),
  CONSTRAINT chk_quantity_coherence  CHECK (quantity_available <= quantity),
  INDEX idx_items_qr (qr_code_token)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS item_photos (
  id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  item_id    BIGINT UNSIGNED NOT NULL,
  photo_url  VARCHAR(500)    NOT NULL,
  is_cover   TINYINT      NOT NULL DEFAULT 0,
  sort_order INT UNSIGNED    NOT NULL DEFAULT 0,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ip_item FOREIGN KEY (item_id) REFERENCES items(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_ip_item (item_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS item_tags (
  item_id BIGINT UNSIGNED NOT NULL,
  tag_id  INT UNSIGNED    NOT NULL,
  PRIMARY KEY (item_id, tag_id),
  CONSTRAINT fk_it_item FOREIGN KEY (item_id) REFERENCES items(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_it_tag  FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS item_condition_history (
  id             BIGINT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
  item_id        BIGINT UNSIGNED  NOT NULL,
  prev_condition TINYINT UNSIGNED DEFAULT NULL,
  new_condition  TINYINT UNSIGNED NOT NULL,
  changed_by     BIGINT UNSIGNED  DEFAULT NULL,
  notes          VARCHAR(255)     DEFAULT NULL,
  changed_at     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ich_item FOREIGN KEY (item_id)        REFERENCES items(id)      ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_ich_prev FOREIGN KEY (prev_condition) REFERENCES conditions(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_ich_new  FOREIGN KEY (new_condition)  REFERENCES conditions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_ich_user FOREIGN KEY (changed_by)     REFERENCES users(id)      ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_ich_item (item_id),
  INDEX idx_ich_date (changed_at)
) ENGINE=InnoDB;

-- ============================================================
-- ESTOQUE
-- ============================================================

CREATE TABLE IF NOT EXISTS stock_movements (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  item_id         BIGINT UNSIGNED NOT NULL,
  movement_type   ENUM('ENTRADA','SAIDA','AJUSTE') NOT NULL,
  quantity        INT             NOT NULL,
  quantity_before INT UNSIGNED    NOT NULL,
  quantity_after  INT UNSIGNED    NOT NULL,
  reference_type  VARCHAR(50)     DEFAULT NULL,
  reference_id    BIGINT UNSIGNED DEFAULT NULL,
  notes           TEXT            DEFAULT NULL,
  created_by      BIGINT UNSIGNED DEFAULT NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sm_org  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_sm_item FOREIGN KEY (item_id)         REFERENCES items(id)         ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_sm_user FOREIGN KEY (created_by)      REFERENCES users(id)         ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_sm_item (item_id),
  INDEX idx_sm_org  (organization_id)
) ENGINE=InnoDB;

-- ============================================================
-- DOADORES E DOAÇÕES
-- ============================================================

CREATE TABLE IF NOT EXISTS donors (
  id              BIGINT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED  NOT NULL,
  name            VARCHAR(150)     NOT NULL,
  donor_type      ENUM('PESSOA_FISICA','PESSOA_JURIDICA','ANONIMO') NOT NULL DEFAULT 'PESSOA_FISICA',
  email           VARCHAR(150)     DEFAULT NULL,
  phone           VARCHAR(30)      DEFAULT NULL,
  document        VARCHAR(30)      DEFAULT NULL,
  notes           TEXT             DEFAULT NULL,
  created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_donors_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS donations (
  id              BIGINT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED  NOT NULL,
  donor_id        BIGINT UNSIGNED  DEFAULT NULL,
  donated_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  document_number VARCHAR(100)     DEFAULT NULL,
  total_items     INT UNSIGNED     NOT NULL DEFAULT 0,
  total_weight_kg DECIMAL(12,3)    DEFAULT NULL,
  notes           TEXT             DEFAULT NULL,
  status          ENUM('RASCUNHO','PENDENTE','CONFIRMADA','CANCELADA') NOT NULL DEFAULT 'RASCUNHO',
  confirmed_at    DATETIME         DEFAULT NULL,
  confirmed_by    BIGINT UNSIGNED  DEFAULT NULL,
  cancelled_at    DATETIME         DEFAULT NULL,
  cancelled_by    BIGINT UNSIGNED  DEFAULT NULL,
  cancel_reason   VARCHAR(255)     DEFAULT NULL,
  created_by      BIGINT UNSIGNED  DEFAULT NULL,
  created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dn_org                 FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_dn_donor               FOREIGN KEY (donor_id)        REFERENCES donors(id)        ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_donations_confirmed_by FOREIGN KEY (confirmed_by)    REFERENCES users(id)         ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_donations_cancelled_by FOREIGN KEY (cancelled_by)    REFERENCES users(id)         ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_donations_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS donation_items (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  donation_id BIGINT UNSIGNED NOT NULL,
  item_id     BIGINT UNSIGNED DEFAULT NULL,
  quantity    INT UNSIGNED    NOT NULL DEFAULT 1,
  weight_kg   DECIMAL(10,3)   DEFAULT NULL,
  notes       TEXT            DEFAULT NULL,
  CONSTRAINT fk_di_donation FOREIGN KEY (donation_id) REFERENCES donations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_di_item     FOREIGN KEY (item_id)     REFERENCES items(id)     ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_di_donation (donation_id),
  INDEX idx_di_item     (item_id)
) ENGINE=InnoDB;

-- ============================================================
-- DESCARTE E PEDIDOS RECICLADORAS
-- ============================================================

CREATE TABLE IF NOT EXISTS disposal_history (
  id                 BIGINT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
  item_id            BIGINT UNSIGNED  NOT NULL,
  organization_id    BIGINT UNSIGNED  NOT NULL,
  destination_type   ENUM('INTERNAL','RECYCLER') NOT NULL,
  destination_org_id BIGINT UNSIGNED  DEFAULT NULL,
  prev_condition_id  TINYINT UNSIGNED DEFAULT NULL,
  new_condition_id   TINYINT UNSIGNED DEFAULT NULL,
  action             ENUM('MARKED_FOR_DISPOSAL','REQUESTED_PICKUP','PICKED_UP','CANCELLED') NOT NULL,
  quantity           INT UNSIGNED     NOT NULL DEFAULT 1,
  weight_kg          DECIMAL(10,3)    DEFAULT NULL,
  document_number    VARCHAR(100)     DEFAULT NULL,
  notes              TEXT             DEFAULT NULL,
  created_by         BIGINT UNSIGNED  DEFAULT NULL,
  created_at         TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_disph_item FOREIGN KEY (item_id)            REFERENCES items(id)         ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_disph_org  FOREIGN KEY (organization_id)    REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_disph_dest FOREIGN KEY (destination_org_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_disph_prev FOREIGN KEY (prev_condition_id)  REFERENCES conditions(id)   ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_disph_new  FOREIGN KEY (new_condition_id)   REFERENCES conditions(id)   ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS recycler_orders (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  recycler_id     BIGINT UNSIGNED NOT NULL,
  status          ENUM('DRAFT','REQUESTED','SCHEDULED','PICKED_UP','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  scheduled_at    DATETIME        DEFAULT NULL,
  picked_up_at    DATETIME        DEFAULT NULL,
  total_weight_kg DECIMAL(12,3)   DEFAULT NULL,
  notes           TEXT            DEFAULT NULL,
  created_by      BIGINT UNSIGNED DEFAULT NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ro_org      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_ro_recycler FOREIGN KEY (recycler_id)     REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS recycler_order_items (
  id                BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  recycler_order_id BIGINT UNSIGNED NOT NULL,
  item_id           BIGINT UNSIGNED DEFAULT NULL,
  category_id       INT UNSIGNED    DEFAULT NULL,
  description       VARCHAR(200)    DEFAULT NULL,
  quantity          INT UNSIGNED    NOT NULL DEFAULT 1,
  weight_kg         DECIMAL(10,3)   DEFAULT NULL,
  CONSTRAINT fk_roi_order FOREIGN KEY (recycler_order_id) REFERENCES recycler_orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_roi_item  FOREIGN KEY (item_id)           REFERENCES items(id)           ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_roi_cat   FOREIGN KEY (category_id)       REFERENCES categories(id)      ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS solicitacoes (
  id               VARCHAR(36)     NOT NULL PRIMARY KEY,
  organization_id  BIGINT UNSIGNED NOT NULL,
  tipo             VARCHAR(50)     DEFAULT NULL,
  item             VARCHAR(255)    DEFAULT NULL,
  quantidade       INT             NOT NULL DEFAULT 1,
  solicitante      VARCHAR(255)    DEFAULT NULL,
  email            VARCHAR(255)    DEFAULT NULL,
  status           VARCHAR(50)     NOT NULL DEFAULT 'pendente',
  prioridade       VARCHAR(50)     NOT NULL DEFAULT 'media',
  data_solicitacao DATE            DEFAULT NULL,
  data_revisao     DATE            DEFAULT NULL,
  revisor          VARCHAR(255)    DEFAULT NULL,
  obs              TEXT            DEFAULT NULL,
  created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_solicitacoes_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_solicitacoes_org (organization_id),
  INDEX idx_solicitacoes_status (status),
  INDEX idx_solicitacoes_data_revisao (data_revisao)
) ENGINE=InnoDB;

-- ============================================================
-- AUDITORIA, NOTIFICAÇÕES E CONFIGURAÇÕES
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED DEFAULT NULL,
  user_id         BIGINT UNSIGNED DEFAULT NULL,
  action          VARCHAR(50)     NOT NULL,
  table_name      VARCHAR(100)    NOT NULL,
  record_id       BIGINT UNSIGNED DEFAULT NULL,
  old_values      JSON            DEFAULT NULL,
  new_values      JSON            DEFAULT NULL,
  ip_address      VARCHAR(45)     DEFAULT NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  user_id         BIGINT UNSIGNED DEFAULT NULL,
  notif_type      VARCHAR(50)     NOT NULL,
  title           VARCHAR(200)    NOT NULL,
  body            TEXT            DEFAULT NULL,
  reference_type  VARCHAR(50)     DEFAULT NULL,
  reference_id    BIGINT UNSIGNED DEFAULT NULL,
  read_at         DATETIME        DEFAULT NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_org  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id)         REFERENCES users(id)         ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_notif_org  (organization_id),
  INDEX idx_notif_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_permissions (
  id         INT UNSIGNED    PRIMARY KEY AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  module     ENUM('ITEMS','DONATIONS','DISPOSAL','REPORTS','USERS','SETTINGS','STOCK','PARTNERS') NOT NULL,
  can_view   TINYINT NOT NULL DEFAULT 0,
  can_create TINYINT NOT NULL DEFAULT 0,
  can_edit   TINYINT NOT NULL DEFAULT 0,
  can_delete TINYINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_up_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE KEY uk_user_module (user_id, module),
  INDEX idx_up_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS collection_goals (
  id              INT UNSIGNED    PRIMARY KEY AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  period_start    DATE            NOT NULL,
  period_end      DATE            NOT NULL,
  goal_items      INT UNSIGNED    DEFAULT NULL,
  goal_weight_kg  DECIMAL(12,3)   DEFAULT NULL,
  goal_value      DECIMAL(12,2)   DEFAULT NULL,
  notes           VARCHAR(255)    DEFAULT NULL,
  created_by      BIGINT UNSIGNED DEFAULT NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_goal_period CHECK (period_end >= period_start),
  CONSTRAINT fk_cg_org  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_cg_user FOREIGN KEY (created_by)      REFERENCES users(id)         ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_cg_org    (organization_id),
  INDEX idx_cg_period (period_start, period_end)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS organization_settings (
  id                    INT UNSIGNED    PRIMARY KEY AUTO_INCREMENT,
  organization_id       BIGINT UNSIGNED NOT NULL UNIQUE,
  notify_low_stock      TINYINT      NOT NULL DEFAULT 1,
  low_stock_threshold   INT UNSIGNED             DEFAULT 5,
  notify_new_donation   TINYINT      NOT NULL DEFAULT 1,
  notify_pickup         TINYINT      NOT NULL DEFAULT 1,
  report_email          VARCHAR(150)             DEFAULT NULL,
  auto_report_day       TINYINT UNSIGNED         DEFAULT NULL,
  auto_report_format    ENUM('CSV','XLSX','PDF') DEFAULT 'PDF',
  logo_url              VARCHAR(500)             DEFAULT NULL,
  primary_color_hex     CHAR(7)         NOT NULL DEFAULT '#2ECC71',
  require_photo_on_item TINYINT      NOT NULL DEFAULT 0,
  allow_anonymous_donor TINYINT      NOT NULL DEFAULT 1,
  require_serial_number TINYINT      NOT NULL DEFAULT 0,
  auto_stock_movement   TINYINT      NOT NULL DEFAULT 1,
  updated_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_os_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TRIGGERS
-- ============================================================

DELIMITER $$

DROP TRIGGER IF EXISTS trg_items_qr_code$$
CREATE TRIGGER trg_items_qr_code
BEFORE INSERT ON items
FOR EACH ROW
BEGIN
  IF NEW.qr_code_token IS NULL THEN
    SET NEW.qr_code_token = UUID();
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_items_quantity_update$$
CREATE TRIGGER trg_items_quantity_update
AFTER UPDATE ON items
FOR EACH ROW
BEGIN
  IF OLD.quantity_available <> NEW.quantity_available THEN
    INSERT INTO stock_movements (
      organization_id, item_id, movement_type, quantity,
      quantity_before, quantity_after, reference_type, notes, created_at
    ) VALUES (
      NEW.organization_id,
      NEW.id,
      CASE
        WHEN NEW.quantity_available > OLD.quantity_available THEN 'ENTRADA'
        WHEN NEW.quantity_available < OLD.quantity_available THEN 'SAIDA'
        ELSE 'AJUSTE'
      END,
      NEW.quantity_available - OLD.quantity_available,
      OLD.quantity_available,
      NEW.quantity_available,
      'items',
      'Atualização automática via trigger',
      NOW()
    );
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_items_condition_history$$
CREATE TRIGGER trg_items_condition_history
AFTER UPDATE ON items
FOR EACH ROW
BEGIN
  IF OLD.condition_id <> NEW.condition_id THEN
    INSERT INTO item_condition_history (
      item_id, prev_condition, new_condition, changed_by, notes, changed_at
    ) VALUES (
      NEW.id, OLD.condition_id, NEW.condition_id,
      NEW.created_by, 'Alteração automática via trigger', NOW()
    );
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_audit_no_delete$$
CREATE TRIGGER trg_audit_no_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'audit_logs é imutável: DELETE não permitido';
END$$

DROP TRIGGER IF EXISTS trg_audit_no_update$$
CREATE TRIGGER trg_audit_no_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'audit_logs é imutável: UPDATE não permitido';
END$$

DROP TRIGGER IF EXISTS trg_donation_items_insert$$
CREATE TRIGGER trg_donation_items_insert
AFTER INSERT ON donation_items
FOR EACH ROW
BEGIN
  UPDATE donations
  SET
    total_items     = (SELECT COALESCE(SUM(quantity), 0)  FROM donation_items WHERE donation_id = NEW.donation_id),
    total_weight_kg = (SELECT COALESCE(SUM(weight_kg), 0) FROM donation_items WHERE donation_id = NEW.donation_id)
  WHERE id = NEW.donation_id;
END$$

DROP TRIGGER IF EXISTS trg_donation_items_update$$
CREATE TRIGGER trg_donation_items_update
AFTER UPDATE ON donation_items
FOR EACH ROW
BEGIN
  UPDATE donations
  SET
    total_items     = (SELECT COALESCE(SUM(quantity), 0)  FROM donation_items WHERE donation_id = NEW.donation_id),
    total_weight_kg = (SELECT COALESCE(SUM(weight_kg), 0) FROM donation_items WHERE donation_id = NEW.donation_id)
  WHERE id = NEW.donation_id;
END$$

DROP TRIGGER IF EXISTS trg_donation_items_delete$$
CREATE TRIGGER trg_donation_items_delete
AFTER DELETE ON donation_items
FOR EACH ROW
BEGIN
  UPDATE donations
  SET
    total_items     = (SELECT COALESCE(SUM(quantity), 0)  FROM donation_items WHERE donation_id = OLD.donation_id),
    total_weight_kg = (SELECT COALESCE(SUM(weight_kg), 0) FROM donation_items WHERE donation_id = OLD.donation_id)
  WHERE id = OLD.donation_id;
END$$

DROP TRIGGER IF EXISTS trg_low_stock_notification$$
CREATE TRIGGER trg_low_stock_notification
AFTER UPDATE ON items
FOR EACH ROW
BEGIN
  DECLARE v_threshold INT UNSIGNED DEFAULT 5;
  SELECT COALESCE(low_stock_threshold, 5)
  INTO   v_threshold
  FROM   organization_settings
  WHERE  organization_id = NEW.organization_id
  LIMIT  1;
  IF NEW.quantity_available <= v_threshold
     AND OLD.quantity_available > v_threshold
     AND NEW.is_active = 1
  THEN
    INSERT INTO notifications (
      organization_id, user_id, notif_type, title, body, reference_type, reference_id
    ) VALUES (
      NEW.organization_id,
      NULL,
      'ESTOQUE_BAIXO',
      CONCAT('Estoque baixo: ', NEW.product_name),
      CONCAT('O item "', NEW.product_name, '" possui apenas ', NEW.quantity_available, ' unidade(s) disponível(is) no estoque.'),
      'items',
      NEW.id
    );
  END IF;
END$$

DELIMITER ;

-- ============================================================
-- VIEWS
-- ============================================================

CREATE OR REPLACE VIEW v_items_summary AS
SELECT
  i.id,
  i.organization_id,
  org.name                                                                                        AS organization_name,
  i.product_name,
  b.name                                                                                          AS brand,
  m.name                                                                                          AS model,
  cat.name                                                                                        AS category,
  cond.label_pt                                                                                   AS condition_label,
  cond.code                                                                                       AS condition_code,
  cond.color_hex                                                                                  AS condition_color,
  i.quantity,
  i.quantity_available,
  i.weight_kg,
  i.estimated_value,
  i.currency,
  i.serial_number,
  i.qr_code_token,
  (SELECT p.photo_url FROM item_photos p WHERE p.item_id = i.id ORDER BY p.is_cover DESC, p.sort_order ASC, p.id ASC LIMIT 1) AS cover_photo_url,
  (SELECT COUNT(*) FROM item_photos p WHERE p.item_id = i.id)                                    AS photo_count,
  sl.name                                                                                         AS storage_location,
  (SELECT d.name FROM donation_items di JOIN donations dn ON dn.id = di.donation_id JOIN donors d ON d.id = dn.donor_id WHERE di.item_id = i.id ORDER BY dn.donated_at ASC LIMIT 1) AS first_donor_name,
  (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', t.id, 'name', t.name, 'color', t.color_hex)) FROM item_tags it JOIN tags t ON t.id = it.tag_id WHERE it.item_id = i.id) AS tags,
  i.is_active,
  i.deactivated_at,
  i.deactivation_reason,
  i.created_at,
  i.updated_at
FROM      items             i
JOIN      organizations     org  ON org.id  = i.organization_id
LEFT JOIN brands            b    ON b.id    = i.brand_id
LEFT JOIN models            m    ON m.id    = i.model_id
LEFT JOIN categories        cat  ON cat.id  = i.category_id
JOIN      conditions        cond ON cond.id = i.condition_id
LEFT JOIN storage_locations sl   ON sl.id   = i.storage_location_id;

CREATE OR REPLACE VIEW v_stock_movements AS
SELECT
  sm.id,
  sm.organization_id,
  org.name        AS organization_name,
  sm.item_id,
  i.product_name,
  b.name          AS brand,
  m.name          AS model,
  cat.name        AS category,
  i.estimated_value,
  i.currency,
  sm.movement_type,
  sm.quantity,
  sm.quantity_before,
  sm.quantity_after,
  sm.reference_type,
  sm.reference_id,
  sm.notes,
  u.name          AS created_by_name,
  sm.created_at
FROM      stock_movements sm
JOIN      organizations   org ON org.id = sm.organization_id
JOIN      items           i   ON i.id   = sm.item_id
LEFT JOIN brands          b   ON b.id   = i.brand_id
LEFT JOIN models          m   ON m.id   = i.model_id
LEFT JOIN categories      cat ON cat.id = i.category_id
LEFT JOIN users           u   ON u.id   = sm.created_by
ORDER BY  sm.created_at DESC;

CREATE OR REPLACE VIEW v_ong_dashboard AS
SELECT
  i.organization_id,
  org.name                                          AS organization_name,
  cat.name                                          AS category,
  cond.code                                         AS condition_code,
  cond.label_pt                                     AS condition_label,
  cond.color_hex                                    AS condition_color,
  COUNT(i.id)                                       AS total_items,
  SUM(i.quantity)                                   AS total_quantity,
  SUM(i.quantity_available)                         AS total_available,
  COALESCE(SUM(i.weight_kg * i.quantity),       0)  AS total_weight_kg,
  COALESCE(SUM(i.estimated_value * i.quantity), 0)  AS total_estimated_value
FROM      items        i
JOIN      organizations org  ON org.id  = i.organization_id
JOIN      conditions    cond ON cond.id = i.condition_id
LEFT JOIN categories    cat  ON cat.id  = i.category_id
WHERE     i.is_active = 1
GROUP BY  i.organization_id, org.name, cat.name, cond.code, cond.label_pt, cond.color_hex;

CREATE OR REPLACE VIEW v_donations_summary AS
SELECT
  dn.id                                                     AS donation_id,
  dn.organization_id,
  org.name                                                  AS organization_name,
  dn.donor_id,
  d.name                                                    AS donor_name,
  d.donor_type,
  dn.status,
  dn.donated_at,
  dn.document_number,
  COUNT(di.id)                                              AS total_lines,
  COALESCE(SUM(di.quantity),  0)                            AS total_items,
  COALESCE(SUM(di.weight_kg), 0)                            AS total_weight_kg,
  COALESCE(SUM(i.estimated_value * di.quantity), 0)         AS total_estimated_value,
  u_create.name                                             AS created_by_name,
  u_confirm.name                                            AS confirmed_by_name,
  dn.confirmed_at,
  dn.created_at
FROM      donations      dn
JOIN      organizations  org       ON org.id       = dn.organization_id
LEFT JOIN donors         d         ON d.id         = dn.donor_id
LEFT JOIN donation_items di        ON di.donation_id = dn.id
LEFT JOIN items          i         ON i.id         = di.item_id
LEFT JOIN users          u_create  ON u_create.id  = dn.created_by
LEFT JOIN users          u_confirm ON u_confirm.id = dn.confirmed_by
GROUP BY  dn.id, dn.organization_id, org.name, dn.donor_id, d.name, d.donor_type,
          dn.status, dn.donated_at, dn.document_number,
          u_create.name, u_confirm.name, dn.confirmed_at, dn.created_at
ORDER BY  dn.donated_at DESC;

CREATE OR REPLACE VIEW v_user_permissions_full AS
SELECT
  u.id                          AS user_id,
  u.name                        AS user_name,
  u.email,
  u.role,
  u.organization_id,
  org.name                      AS organization_name,
  up.module,
  COALESCE(up.can_view,   0)    AS can_view,
  COALESCE(up.can_create, 0)    AS can_create,
  COALESCE(up.can_edit,   0)    AS can_edit,
  COALESCE(up.can_delete, 0)    AS can_delete
FROM      users            u
JOIN      organizations    org ON org.id   = u.organization_id
LEFT JOIN user_permissions up  ON up.user_id = u.id
WHERE     u.is_active = 1
ORDER BY  u.organization_id, u.name, up.module;

CREATE OR REPLACE VIEW v_audit_logs AS
SELECT
  al.id,
  al.organization_id,
  org.name       AS organization_name,
  al.user_id,
  u.name         AS user_name,
  u.email        AS user_email,
  al.action,
  al.table_name,
  al.record_id,
  al.old_values,
  al.new_values,
  al.ip_address,
  al.created_at
FROM      audit_logs   al
LEFT JOIN organizations org ON org.id = al.organization_id
LEFT JOIN users         u   ON u.id   = al.user_id
ORDER BY  al.created_at DESC;

-- ============================================================
-- SEEDS
-- ============================================================

INSERT INTO conditions (code, label_pt, color_hex) VALUES
  ('OTIMO',     'Ótimo Estado de Uso',        '#2ECC71'),
  ('REPARO',    'Necessita de Reparos',        '#F1C40F'),
  ('DESCARTAR', 'Necessita ser Descartado',    '#E74C3C')
AS new_row
ON DUPLICATE KEY UPDATE label_pt = new_row.label_pt, color_hex = new_row.color_hex;

INSERT INTO categories (name) VALUES
  ('Notebook'), ('Gabinete'), ('Monitor'), ('Periféricos'), ('Outros')
AS new_row
ON DUPLICATE KEY UPDATE name = new_row.name;

--SET SQL_SAFE_UPDATES = 0;

--UPDATE users SET email_verified = 1 WHERE email_verified = 0;

--CREATE TABLE IF NOT EXISTS email_verifications (
--  id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  --user_id    BIGINT UNSIGNED NOT NULL,
  --code       CHAR(6)         NOT NULL,
  --expires_at DATETIME        NOT NULL,
  --used       TINYINT         NOT NULL DEFAULT 0,
  --created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  --KEY idx_ev_user_code (user_id, code),
  --CONSTRAINT fk_ev_user FOREIGN KEY (user_id) REFERENCES users(id)
    --ON UPDATE CASCADE ON DELETE CASCADE
--) ENGINE=InnoDB;