-- ============================================================
-- StockControl - MIGRATION V3: Todas as Melhorias
-- MySQL 8.x | Execute APÓS as migrations V1 e V2
-- ============================================================

USE stockcontrol;

-- ============================================================
-- BLOCO 1: CHECK CONSTRAINTS — Integridade do estoque
-- ============================================================

ALTER TABLE items
  ADD CONSTRAINT chk_quantity_available
    CHECK (quantity_available >= 0),
  ADD CONSTRAINT chk_quantity_positive
    CHECK (quantity >= 0),
  ADD CONSTRAINT chk_quantity_coherence
    CHECK (quantity_available <= quantity);

-- ============================================================
-- BLOCO 2: SOFT DELETE COMPLETO EM items
-- ============================================================

ALTER TABLE items
  ADD COLUMN deactivated_at      DATETIME       DEFAULT NULL
    COMMENT 'Quando o item foi desativado'
    AFTER is_active,
  ADD COLUMN deactivated_by      BIGINT UNSIGNED DEFAULT NULL
    COMMENT 'Usuário que desativou o item'
    AFTER deactivated_at,
  ADD COLUMN deactivation_reason VARCHAR(255)    DEFAULT NULL
    COMMENT 'Motivo da desativação'
    AFTER deactivated_by,
  ADD CONSTRAINT fk_items_deactivated_by
    FOREIGN KEY (deactivated_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

-- ============================================================
-- BLOCO 3: VALOR ESTIMADO E QR CODE EM items
-- ============================================================

ALTER TABLE items
  ADD COLUMN estimated_value DECIMAL(12,2) DEFAULT NULL
    COMMENT 'Valor de mercado estimado do item'
    AFTER weight_kg,
  ADD COLUMN currency        CHAR(3)       NOT NULL DEFAULT 'BRL'
    COMMENT 'Moeda do valor estimado'
    AFTER estimated_value,
  ADD COLUMN qr_code_token   CHAR(36)      UNIQUE
    COMMENT 'Token único para geração de QR Code / etiqueta física'
    AFTER deactivation_reason;

-- QR Code index
CREATE INDEX idx_items_qr ON items (qr_code_token);

-- Popular qr_code_token nos itens já existentes
UPDATE items
SET qr_code_token = UUID()
WHERE qr_code_token IS NULL;

-- ============================================================
-- BLOCO 4: STATUS E FLUXO NAS DOAÇÕES
-- ============================================================

ALTER TABLE donations
  ADD COLUMN status        ENUM(
                             'RASCUNHO',
                             'PENDENTE',
                             'CONFIRMADA',
                             'CANCELADA'
                           ) NOT NULL DEFAULT 'RASCUNHO'
    COMMENT 'Fluxo de vida da doação'
    AFTER notes,
  ADD COLUMN confirmed_at  DATETIME        DEFAULT NULL
    COMMENT 'Quando a doação foi confirmada'
    AFTER status,
  ADD COLUMN confirmed_by  BIGINT UNSIGNED DEFAULT NULL
    COMMENT 'Usuário que confirmou a doação'
    AFTER confirmed_at,
  ADD COLUMN cancelled_at  DATETIME        DEFAULT NULL
    COMMENT 'Quando a doação foi cancelada'
    AFTER confirmed_by,
  ADD COLUMN cancelled_by  BIGINT UNSIGNED DEFAULT NULL
    COMMENT 'Usuário que cancelou a doação'
    AFTER cancelled_at,
  ADD COLUMN cancel_reason VARCHAR(255)    DEFAULT NULL
    COMMENT 'Motivo do cancelamento'
    AFTER cancelled_by,
  ADD CONSTRAINT fk_donations_confirmed_by
    FOREIGN KEY (confirmed_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  ADD CONSTRAINT fk_donations_cancelled_by
    FOREIGN KEY (cancelled_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

-- Index para filtrar por status
CREATE INDEX idx_donations_status ON donations (status);

-- ============================================================
-- BLOCO 5: NOVAS TABELAS
-- ============================================================

-- 5.1) user_permissions — Permissões granulares por módulo
CREATE TABLE user_permissions (
  id         INT UNSIGNED    PRIMARY KEY AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  module     ENUM(
               'ITEMS',
               'DONATIONS',
               'DISPOSAL',
               'REPORTS',
               'USERS',
               'SETTINGS',
               'STOCK',
               'PARTNERS'
             ) NOT NULL,
  can_view   TINYINT(1) NOT NULL DEFAULT 0,
  can_create TINYINT(1) NOT NULL DEFAULT 0,
  can_edit   TINYINT(1) NOT NULL DEFAULT 0,
  can_delete TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP
               ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_up_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE KEY uk_user_module (user_id, module),
  INDEX idx_up_user (user_id)
) ENGINE=InnoDB COMMENT='Permissões granulares por módulo e usuário';

-- 5.2) item_condition_history — Histórico de condição do item
CREATE TABLE item_condition_history (
  id             BIGINT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
  item_id        BIGINT UNSIGNED  NOT NULL,
  prev_condition TINYINT UNSIGNED DEFAULT NULL
    COMMENT 'Condição anterior (NULL se é o primeiro registro)',
  new_condition  TINYINT UNSIGNED NOT NULL
    COMMENT 'Nova condição aplicada',
  changed_by     BIGINT UNSIGNED  DEFAULT NULL,
  notes          VARCHAR(255)     DEFAULT NULL,
  changed_at     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ich_item FOREIGN KEY (item_id)
    REFERENCES items(id)      ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_ich_prev FOREIGN KEY (prev_condition)
    REFERENCES conditions(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_ich_new  FOREIGN KEY (new_condition)
    REFERENCES conditions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_ich_user FOREIGN KEY (changed_by)
    REFERENCES users(id)      ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_ich_item (item_id),
  INDEX idx_ich_date (changed_at)
) ENGINE=InnoDB COMMENT='Histórico completo de mudanças de condição por item';

-- 5.3) collection_goals — Metas de coleta por período
CREATE TABLE collection_goals (
  id              INT UNSIGNED    PRIMARY KEY AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  period_start    DATE            NOT NULL,
  period_end      DATE            NOT NULL,
  goal_items      INT UNSIGNED    DEFAULT NULL
    COMMENT 'Meta em quantidade de itens',
  goal_weight_kg  DECIMAL(12,3)   DEFAULT NULL
    COMMENT 'Meta em peso (kg)',
  goal_value      DECIMAL(12,2)   DEFAULT NULL
    COMMENT 'Meta em valor estimado (R$)',
  notes           VARCHAR(255)    DEFAULT NULL,
  created_by      BIGINT UNSIGNED DEFAULT NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_goal_period
    CHECK (period_end >= period_start),
  CONSTRAINT fk_cg_org  FOREIGN KEY (organization_id)
    REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_cg_user FOREIGN KEY (created_by)
    REFERENCES users(id)         ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_cg_org    (organization_id),
  INDEX idx_cg_period (period_start, period_end)
) ENGINE=InnoDB COMMENT='Metas de coleta por período para o dashboard';

-- 5.4) organization_settings — Configurações por organização
CREATE TABLE organization_settings (
  id                     INT UNSIGNED    PRIMARY KEY AUTO_INCREMENT,
  organization_id        BIGINT UNSIGNED NOT NULL UNIQUE,
  -- Notificações
  notify_low_stock       TINYINT(1)      NOT NULL DEFAULT 1,
  low_stock_threshold    INT UNSIGNED             DEFAULT 5
    COMMENT 'Alerta quando quantity_available <= este valor',
  notify_new_donation    TINYINT(1)      NOT NULL DEFAULT 1,
  notify_pickup          TINYINT(1)      NOT NULL DEFAULT 1,
  -- Relatórios automáticos
  report_email           VARCHAR(150)             DEFAULT NULL
    COMMENT 'E-mail para envio de relatórios automáticos',
  auto_report_day        TINYINT UNSIGNED         DEFAULT NULL
    COMMENT 'Dia do mês para envio automático (1-28)',
  auto_report_format     ENUM('CSV','XLSX','PDF') DEFAULT 'PDF',
  -- Aparência
  logo_url               VARCHAR(500)             DEFAULT NULL,
  primary_color_hex      CHAR(7)         NOT NULL DEFAULT '#2ECC71',
  -- Comportamento
  require_photo_on_item  TINYINT(1)      NOT NULL DEFAULT 0
    COMMENT 'Bloqueia criação de item sem foto',
  allow_anonymous_donor  TINYINT(1)      NOT NULL DEFAULT 1
    COMMENT 'Permite doação sem vínculo a um doador',
  require_serial_number  TINYINT(1)      NOT NULL DEFAULT 0
    COMMENT 'Exige número de série ao cadastrar item',
  -- Estoque
  auto_stock_movement    TINYINT(1)      NOT NULL DEFAULT 1
    COMMENT 'Gera stock_movements automaticamente via trigger',
  updated_at             TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                           ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_os_org FOREIGN KEY (organization_id)
    REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Configurações específicas por organização';

-- ============================================================
-- BLOCO 6: TRIGGERS
-- ============================================================

-- 6.1) Gera stock_movement automaticamente ao alterar quantidade
DELIMITER $$

CREATE TRIGGER trg_items_quantity_update
AFTER UPDATE ON items
FOR EACH ROW
BEGIN
  IF OLD.quantity_available <> NEW.quantity_available THEN
    INSERT INTO stock_movements (
      organization_id,
      item_id,
      movement_type,
      quantity,
      quantity_before,
      quantity_after,
      reference_type,
      notes,
      created_at
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

-- 6.2) Registra histórico ao mudar condição do item
CREATE TRIGGER trg_items_condition_history
AFTER UPDATE ON items
FOR EACH ROW
BEGIN
  IF OLD.condition_id <> NEW.condition_id THEN
    INSERT INTO item_condition_history (
      item_id,
      prev_condition,
      new_condition,
      changed_by,
      notes,
      changed_at
    ) VALUES (
      NEW.id,
      OLD.condition_id,
      NEW.condition_id,
      NEW.created_by,
      'Alteração automática via trigger',
      NOW()
    );
  END IF;
END$$

-- 6.3) Gera QR Code token automático ao inserir novo item
CREATE TRIGGER trg_items_qr_code
BEFORE INSERT ON items
FOR EACH ROW
BEGIN
  IF NEW.qr_code_token IS NULL THEN
    SET NEW.qr_code_token = UUID();
  END IF;
END$$

-- 6.4) audit_logs imutável — bloqueia DELETE
CREATE TRIGGER trg_audit_no_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'audit_logs é imutável: DELETE não permitido';
END$$

-- 6.5) audit_logs imutável — bloqueia UPDATE
CREATE TRIGGER trg_audit_no_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'audit_logs é imutável: UPDATE não permitido';
END$$

-- 6.6) Atualiza total_items e total_weight_kg na doação
--      ao inserir item na donation_items
CREATE TRIGGER trg_donation_items_insert
AFTER INSERT ON donation_items
FOR EACH ROW
BEGIN
  UPDATE donations
  SET
    total_items     = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM   donation_items
      WHERE  donation_id = NEW.donation_id
    ),
    total_weight_kg = (
      SELECT COALESCE(SUM(weight_kg), 0)
      FROM   donation_items
      WHERE  donation_id = NEW.donation_id
    )
  WHERE id = NEW.donation_id;
END$$

-- 6.7) Atualiza totais da doação ao atualizar donation_items
CREATE TRIGGER trg_donation_items_update
AFTER UPDATE ON donation_items
FOR EACH ROW
BEGIN
  UPDATE donations
  SET
    total_items     = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM   donation_items
      WHERE  donation_id = NEW.donation_id
    ),
    total_weight_kg = (
      SELECT COALESCE(SUM(weight_kg), 0)
      FROM   donation_items
      WHERE  donation_id = NEW.donation_id
    )
  WHERE id = NEW.donation_id;
END$$

-- 6.8) Atualiza totais da doação ao deletar donation_items
CREATE TRIGGER trg_donation_items_delete
AFTER DELETE ON donation_items
FOR EACH ROW
BEGIN
  UPDATE donations
  SET
    total_items     = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM   donation_items
      WHERE  donation_id = OLD.donation_id
    ),
    total_weight_kg = (
      SELECT COALESCE(SUM(weight_kg), 0)
      FROM   donation_items
      WHERE  donation_id = OLD.donation_id
    )
  WHERE id = OLD.donation_id;
END$$

-- 6.9) Dispara notificação quando estoque fica baixo
CREATE TRIGGER trg_low_stock_notification
AFTER UPDATE ON items
FOR EACH ROW
BEGIN
  DECLARE v_threshold INT UNSIGNED DEFAULT 5;

  -- Busca o threshold configurado para a organização
  SELECT COALESCE(low_stock_threshold, 5)
  INTO   v_threshold
  FROM   organization_settings
  WHERE  organization_id = NEW.organization_id
  LIMIT  1;

  -- Só notifica se cruzou o threshold (de cima pra baixo)
  IF NEW.quantity_available <= v_threshold
     AND OLD.quantity_available > v_threshold
     AND NEW.is_active = 1
  THEN
    INSERT INTO notifications (
      organization_id,
      user_id,
      notif_type,
      title,
      body,
      reference_type,
      reference_id
    ) VALUES (
      NEW.organization_id,
      NULL, -- para todos da organização
      'ESTOQUE_BAIXO',
      CONCAT('Estoque baixo: ', NEW.product_name),
      CONCAT(
        'O item "', NEW.product_name,
        '" possui apenas ', NEW.quantity_available,
        ' unidade(s) disponível(is) no estoque.'
      ),
      'items',
      NEW.id
    );
  END IF;
END$$

DELIMITER ;

-- ============================================================
-- BLOCO 7: VIEWS ATUALIZADAS
-- ============================================================

-- 7.1) v_items_summary — Agora inclui valor estimado,
--      QR code, localização e tags
CREATE OR REPLACE VIEW v_items_summary AS
SELECT
  i.id,
  i.organization_id,
  org.name                          AS organization_name,
  i.product_name,
  b.name                            AS brand,
  m.name                            AS model,
  cat.name                          AS category,
  cond.label_pt                     AS condition_label,
  cond.code                         AS condition_code,
  cond.color_hex                    AS condition_color,
  i.quantity,
  i.quantity_available,
  i.weight_kg,
  i.estimated_value,
  i.currency,
  i.serial_number,
  i.qr_code_token,
  -- Foto de capa
  (
    SELECT p.photo_url
    FROM   item_photos p
    WHERE  p.item_id = i.id
    ORDER  BY p.is_cover DESC, p.sort_order ASC, p.id ASC
    LIMIT  1
  )                                 AS cover_photo_url,
  -- Quantidade de fotos
  (
    SELECT COUNT(*)
    FROM   item_photos p
    WHERE  p.item_id = i.id
  )                                 AS photo_count,
  -- Localização física
  sl.name                           AS storage_location,
  -- Primeiro doador vinculado
  (
    SELECT d.name
    FROM   donation_items di
    JOIN   donations      dn ON dn.id = di.donation_id
    JOIN   donors         d  ON d.id  = dn.donor_id
    WHERE  di.item_id = i.id
    ORDER  BY dn.donated_at ASC
    LIMIT  1
  )                                 AS first_donor_name,
  -- Tags como JSON array
  (
    SELECT JSON_ARRAYAGG(
             JSON_OBJECT('id', t.id, 'name', t.name, 'color', t.color_hex)
           )
    FROM   item_tags it
    JOIN   tags      t ON t.id = it.tag_id
    WHERE  it.item_id = i.id
  )                                 AS tags,
  i.is_active,
  i.deactivated_at,
  i.deactivation_reason,
  i.created_at,
  i.updated_at
FROM       items             i
JOIN       organizations     org  ON org.id  = i.organization_id
LEFT JOIN  brands            b    ON b.id    = i.brand_id
LEFT JOIN  models            m    ON m.id    = i.model_id
LEFT JOIN  categories        cat  ON cat.id  = i.category_id
JOIN       conditions        cond ON cond.id = i.condition_id
LEFT JOIN  storage_locations sl   ON sl.id   = i.storage_location_id;

-- 7.2) v_stock_movements — Agora inclui valor estimado do item
CREATE OR REPLACE VIEW v_stock_movements AS
SELECT
  sm.id,
  sm.organization_id,
  org.name                          AS organization_name,
  sm.item_id,
  i.product_name,
  b.name                            AS brand,
  m.name                            AS model,
  cat.name                          AS category,
  i.estimated_value,
  i.currency,
  sm.movement_type,
  sm.quantity,
  sm.quantity_before,
  sm.quantity_after,
  sm.reference_type,
  sm.reference_id,
  sm.notes,
  u.name                            AS created_by_name,
  sm.created_at
FROM       stock_movements  sm
JOIN       organizations    org ON org.id = sm.organization_id
JOIN       items            i   ON i.id   = sm.item_id
LEFT JOIN  brands           b   ON b.id   = i.brand_id
LEFT JOIN  models           m   ON m.id   = i.model_id
LEFT JOIN  categories       cat ON cat.id = i.category_id
LEFT JOIN  users            u   ON u.id   = sm.created_by
ORDER BY   sm.created_at DESC;

-- 7.3) v_ong_dashboard — Agora inclui valor estimado total
CREATE OR REPLACE VIEW v_ong_dashboard AS
SELECT
  i.organization_id,
  org.name                                        AS organization_name,
  cat.name                                        AS category,
  cond.code                                       AS condition_code,
  cond.label_pt                                   AS condition_label,
  cond.color_hex                                  AS condition_color,
  COUNT(i.id)                                     AS total_items,
  SUM(i.quantity)                                 AS total_quantity,
  SUM(i.quantity_available)                       AS total_available,
  COALESCE(SUM(i.weight_kg * i.quantity),    0)   AS total_weight_kg,
  COALESCE(SUM(i.estimated_value * i.quantity), 0) AS total_estimated_value
FROM       items         i
JOIN       organizations org  ON org.id  = i.organization_id
JOIN       conditions    cond ON cond.id = i.condition_id
LEFT JOIN  categories    cat  ON cat.id  = i.category_id
WHERE      i.is_active = 1
GROUP BY
  i.organization_id, org.name,
  cat.name,
  cond.code, cond.label_pt, cond.color_hex;

-- 7.4) v_donations_summary — Agora inclui status e valor total
CREATE OR REPLACE VIEW v_donations_summary AS
SELECT
  dn.id                                         AS donation_id,
  dn.organization_id,
  org.name                                      AS organization_name,
  dn.donor_id,
  d.name                                        AS donor_name,
  d.donor_type,
  dn.status,
  dn.donated_at,
  dn.document_number,
  COUNT(di.id)                                  AS total_lines,
  COALESCE(SUM(di.quantity),   0)               AS total_items,
  COALESCE(SUM(di.weight_kg),  0)               AS total_weight_kg,
  -- Valor estimado total dos itens doados
  COALESCE(
    SUM(i.estimated_value * di.quantity), 0
  )                                             AS total_estimated_value,
  u_create.name                                 AS created_by_name,
  u_confirm.name                                AS confirmed_by_name,
  dn.confirmed_at,
  dn.created_at
FROM       donations       dn
JOIN       organizations   org      ON org.id      = dn.organization_id
LEFT JOIN  donors          d        ON d.id        = dn.donor_id
LEFT JOIN  donation_items  di       ON di.donation_id = dn.id
LEFT JOIN  items           i        ON i.id        = di.item_id
LEFT JOIN  users           u_create  ON u_create.id = dn.created_by
LEFT JOIN  users           u_confirm ON u_confirm.id = dn.confirmed_by
GROUP BY
  dn.id, dn.organization_id, org.name,
  dn.donor_id, d.name, d.donor_type,
  dn.status, dn.donated_at, dn.document_number,
  u_create.name, u_confirm.name,
  dn.confirmed_at, dn.created_at
ORDER BY   dn.donated_at DESC;

-- 7.5) v_collection_goals_progress — Progresso das metas
CREATE OR REPLACE VIEW v_collection_goals_progress AS
SELECT
  cg.id                                         AS goal_id,
  cg.organization_id,
  org.name                                      AS organization_name,
  cg.period_start,
  cg.period_end,
  cg.goal_items,
  cg.goal_weight_kg,
  cg.goal_value,
  -- Itens coletados no período
  COALESCE(
    (
      SELECT SUM(di.quantity)
      FROM   donation_items di
      JOIN   donations      dn ON dn.id = di.donation_id
      WHERE  dn.organization_id = cg.organization_id
        AND  dn.status          = 'CONFIRMADA'
        AND  DATE(dn.donated_at) BETWEEN cg.period_start AND cg.period_end
    ), 0
  )                                             AS collected_items,
  -- Peso coletado no período
  COALESCE(
    (
      SELECT SUM(di.weight_kg)
      FROM   donation_items di
      JOIN   donations      dn ON dn.id = di.donation_id
      WHERE  dn.organization_id = cg.organization_id
        AND  dn.status          = 'CONFIRMADA'
        AND  DATE(dn.donated_at) BETWEEN cg.period_start AND cg.period_end
    ), 0
  )                                             AS collected_weight_kg,
  -- Valor estimado coletado no período
  COALESCE(
    (
      SELECT SUM(i.estimated_value * di.quantity)
      FROM   donation_items di
      JOIN   donations      dn ON dn.id = di.donation_id
      JOIN   items          i  ON i.id  = di.item_id
      WHERE  dn.organization_id = cg.organization_id
        AND  dn.status          = 'CONFIRMADA'
        AND  DATE(dn.donated_at) BETWEEN cg.period_start AND cg.period_end
    ), 0
  )                                             AS collected_value,
  -- % de progresso (itens)
  CASE
    WHEN cg.goal_items IS NULL OR cg.goal_items = 0 THEN NULL
    ELSE ROUND(
      (
        SELECT COALESCE(SUM(di.quantity), 0)
        FROM   donation_items di
        JOIN   donations      dn ON dn.id = di.donation_id
        WHERE  dn.organization_id = cg.organization_id
          AND  dn.status          = 'CONFIRMADA'
          AND  DATE(dn.donated_at) BETWEEN cg.period_start AND cg.period_end
      ) * 100.0 / cg.goal_items, 2)
  END                                           AS progress_items_pct,
  -- % de progresso (peso)
  CASE
    WHEN cg.goal_weight_kg IS NULL OR cg.goal_weight_kg = 0 THEN NULL
    ELSE ROUND(
      (
        SELECT COALESCE(SUM(di.weight_kg), 0)
        FROM   donation_items di
        JOIN   donations      dn ON dn.id = di.donation_id
        WHERE  dn.organization_id = cg.organization_id
          AND  dn.status          = 'CONFIRMADA'
          AND  DATE(dn.donated_at) BETWEEN cg.period_start AND cg.period_end
      ) * 100.0 / cg.goal_weight_kg, 2)
  END                                           AS progress_weight_pct,
  cg.notes,
  cg.created_at
FROM       collection_goals cg
JOIN       organizations    org ON org.id = cg.organization_id
ORDER BY   cg.period_start DESC;

-- 7.6) v_user_permissions_full — Permissões completas por usuário
CREATE OR REPLACE VIEW v_user_permissions_full AS
SELECT
  u.id                              AS user_id,
  u.name                            AS user_name,
  u.email,
  u.role,
  u.organization_id,
  org.name                          AS organization_name,
  up.module,
  COALESCE(up.can_view,   0)        AS can_view,
  COALESCE(up.can_create, 0)        AS can_create,
  COALESCE(up.can_edit,   0)        AS can_edit,
  COALESCE(up.can_delete, 0)        AS can_delete
FROM       users              u
JOIN       organizations      org ON org.id  = u.organization_id
LEFT JOIN  user_permissions   up  ON up.user_id = u.id
WHERE      u.is_active = 1
ORDER BY   u.organization_id, u.name, up.module;

-- 7.7) v_audit_logs — Log de auditoria com nomes legíveis
CREATE OR REPLACE VIEW v_audit_logs AS
SELECT
  al.id,
  al.organization_id,
  org.name                          AS organization_name,
  al.user_id,
  u.name                            AS user_name,
  u.email                           AS user_email,
  al.action,
  al.table_name,
  al.record_id,
  al.old_values,
  al.new_values,
  al.ip_address,
  al.created_at
FROM       audit_logs    al
LEFT JOIN  organizations org ON org.id = al.organization_id
LEFT JOIN  users         u   ON u.id   = al.user_id
ORDER BY   al.created_at DESC;

-- ============================================================
-- BLOCO 8: SEEDS — Configurações e permissões padrão
-- ============================================================

-- 8.1) Settings padrão para todas as organizações existentes
INSERT INTO organization_settings (
  organization_id,
  notify_low_stock,
  low_stock_threshold,
  notify_new_donation,
  notify_pickup,
  auto_report_format,
  primary_color_hex,
  require_photo_on_item,
  allow_anonymous_donor,
  require_serial_number,
  auto_stock_movement
)
SELECT
  id,
  1,    -- notify_low_stock
  5,    -- low_stock_threshold
  1,    -- notify_new_donation
  1,    -- notify_pickup
  'PDF',-- auto_report_format
  '#2ECC71', -- primary_color_hex
  0,    -- require_photo_on_item
  1,    -- allow_anonymous_donor
  0,    -- require_serial_number
  1     -- auto_stock_movement
FROM organizations
ON DUPLICATE KEY UPDATE
  notify_low_stock    = VALUES(notify_low_stock),
  auto_stock_movement = VALUES(auto_stock_movement);

-- 8.2) Permissões padrão para ADMIN (acesso total)
INSERT INTO user_permissions (
  user_id, module,
  can_view, can_create, can_edit, can_delete
)
SELECT
  u.id,
  m.module,
  1, 1, 1, 1
FROM users u
JOIN (
  SELECT 'ITEMS'     AS module UNION ALL
  SELECT 'DONATIONS'           UNION ALL
  SELECT 'DISPOSAL'            UNION ALL
  SELECT 'REPORTS'             UNION ALL
  SELECT 'USERS'               UNION ALL
  SELECT 'SETTINGS'            UNION ALL
  SELECT 'STOCK'               UNION ALL
  SELECT 'PARTNERS'
) m ON 1=1
WHERE u.role = 'ADMIN'
ON DUPLICATE KEY UPDATE
  can_view   = 1,
  can_create = 1,
  can_edit   = 1,
  can_delete = 1;

-- 8.3) Permissões padrão para OPERATOR
INSERT INTO user_permissions (
  user_id, module,
  can_view, can_create, can_edit, can_delete
)
SELECT
  u.id,
  m.module,
  m.can_view,
  m.can_create,
  m.can_edit,
  m.can_delete
FROM users u
JOIN (
  SELECT 'ITEMS'     AS module, 1 AS can_view, 1 AS can_create, 1 AS can_edit, 0 AS can_delete UNION ALL
  SELECT 'DONATIONS',           1,             1,              1,             0                UNION ALL
  SELECT 'DISPOSAL',            1,             1,              1,             0                UNION ALL
  SELECT 'REPORTS',             1,             1,              0,             0                UNION ALL
  SELECT 'USERS',               0,             0,              0,             0                UNION ALL
  SELECT 'SETTINGS',            0,             0,              0,             0                UNION ALL
  SELECT 'STOCK',               1,             1,              1,             0                UNION ALL
  SELECT 'PARTNERS',            1,             0,              0,             0
) m ON 1=1
WHERE u.role = 'OPERATOR'
ON DUPLICATE KEY UPDATE
  can_view   = VALUES(can_view),
  can_create = VALUES(can_create),
  can_edit   = VALUES(can_edit),
  can_delete = VALUES(can_delete);

-- 8.4) Permissões padrão para VIEWER (somente leitura)
INSERT INTO user_permissions (
  user_id, module,
  can_view, can_create, can_edit, can_delete
)
SELECT
  u.id,
  m.module,
  1, 0, 0, 0
FROM users u
JOIN (
  SELECT 'ITEMS'     AS module UNION ALL
  SELECT 'DONATIONS'           UNION ALL
  SELECT 'DISPOSAL'            UNION ALL
  SELECT 'REPORTS'             UNION ALL
  SELECT 'STOCK'               UNION ALL
  SELECT 'PARTNERS'
) m ON 1=1
WHERE u.role = 'VIEWER'
ON DUPLICATE KEY UPDATE
  can_view   = 1,
  can_create = 0,
  can_edit   = 0,
  can_delete = 0;

-- 8.5) Meta de exemplo para a ONG principal
INSERT INTO collection_goals (
  organization_id,
  period_start,
  period_end,
  goal_items,
  goal_weight_kg,
  goal_value,
  notes
)
SELECT
  o.id,
  DATE_FORMAT(NOW(), '%Y-%m-01'),
  LAST_DAY(NOW()),
  100,
  500.000,
  10000.00,
  'Meta mensal inicial de exemplo'
FROM organizations o
WHERE o.org_type = 'ONG'
  AND o.name     = 'Sua ONG'
LIMIT 1
ON DUPLICATE KEY UPDATE notes = VALUES(notes);
