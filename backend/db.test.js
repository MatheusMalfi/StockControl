require("dotenv").config();
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");

let pool;

beforeAll(async () => {
  pool = mysql.createPool({
    host:     process.env.DB_HOST     || "localhost",
    port:     Number(process.env.DB_PORT || 3306),
    user:     process.env.DB_USER     || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME     || "stockcontrol",
    waitForConnections: true,
    connectionLimit: 5,
  });
});

afterAll(async () => {
  await pool.end();
});

// ============================================================
// 1. CONEXÃO
// ============================================================

describe("Conexão com o banco", () => {
  test("conecta e responde SELECT 1", async () => {
    const [rows] = await pool.query("SELECT 1 AS ok");
    expect(rows[0].ok).toBe(1);
  });

  test("banco de dados correto está selecionado", async () => {
    const [rows] = await pool.query("SELECT DATABASE() AS db");
    expect(rows[0].db).toBe("stockcontrol");
  });
});

// ============================================================
// 2. SCHEMA — tabelas existem
// ============================================================

describe("Schema — tabelas obrigatórias existem", () => {
  const tabelas = [
    "organizations",
    "users",
    "categories",
    "brands",
    "models",
    "conditions",
    "items",
    "item_photos",
    "item_tags",
    "item_condition_history",
    "stock_movements",
    "donors",
    "donations",
    "donation_items",
    "disposal_history",
    "recycler_orders",
    "recycler_order_items",
    "audit_logs",
    "notifications",
    "user_permissions",
    "collection_goals",
    "organization_settings",
    "storage_locations",
    "tags",
  ];

  test.each(tabelas)('tabela "%s" existe', async (tabela) => {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = ?`,
      [tabela],
    );
    expect(rows[0].cnt).toBe(1);
  });
});

// ============================================================
// 3. SCHEMA — colunas críticas da tabela items
// ============================================================

describe("Schema — colunas críticas da tabela items", () => {
  const colunas = [
    "id", "organization_id", "product_name", "condition_id",
    "quantity", "quantity_available", "qr_code_token",
    "is_active", "deactivated_at", "deactivated_by",
    "estimated_value", "currency", "photo_blob",
  ];

  test.each(colunas)('coluna items.%s existe', async (coluna) => {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'items' AND column_name = ?`,
      [coluna],
    );
    expect(rows[0].cnt).toBe(1);
  });
});

// ============================================================
// 4. SEEDS — dados iniciais estão presentes
// ============================================================

describe("Seeds — dados iniciais", () => {
  test("3 condições cadastradas (OTIMO, REPARO, DESCARTAR)", async () => {
    const [rows] = await pool.query("SELECT code FROM conditions ORDER BY id");
    const codes = rows.map((r) => r.code);
    expect(codes).toEqual(expect.arrayContaining(["OTIMO", "REPARO", "DESCARTAR"]));
    expect(codes).toHaveLength(3);
  });

  test("categorias padrão existem", async () => {
    const [rows] = await pool.query("SELECT name FROM categories");
    const names = rows.map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining(["Notebook", "Gabinete", "Monitor", "Periféricos", "Outros"]),
    );
  });

  test("organização Impacto Metais existe como RECYCLER", async () => {
    const [rows] = await pool.query(
      "SELECT org_type FROM organizations WHERE name = 'Impacto Metais' LIMIT 1",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].org_type).toBe("RECYCLER");
  });

  test("ONG de exemplo existe", async () => {
    const [rows] = await pool.query(
      "SELECT id FROM organizations WHERE org_type = 'ONG' LIMIT 1",
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// 5. TRIGGERS — existem no banco
// ============================================================

describe("Triggers existem", () => {
  const triggers = [
    "trg_items_qr_code",
    "trg_items_quantity_update",
    "trg_items_condition_history",
    "trg_audit_no_delete",
    "trg_audit_no_update",
    "trg_donation_items_insert",
    "trg_donation_items_update",
    "trg_donation_items_delete",
    "trg_low_stock_notification",
  ];

  test.each(triggers)('trigger "%s" existe', async (trigger) => {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.triggers
       WHERE trigger_schema = DATABASE() AND trigger_name = ?`,
      [trigger],
    );
    expect(rows[0].cnt).toBe(1);
  });
});

// ============================================================
// 6. VIEWS — existem no banco
// ============================================================

describe("Views existem", () => {
  const views = [
    "v_items_summary",
    "v_stock_movements",
    "v_ong_dashboard",
    "v_donations_summary",
    "v_user_permissions_full",
    "v_audit_logs",
  ];

  test.each(views)('view "%s" existe', async (view) => {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.views
       WHERE table_schema = DATABASE() AND table_name = ?`,
      [view],
    );
    expect(rows[0].cnt).toBe(1);
  });
});

// ============================================================
// 7. FLUXO DE CADASTRO E LOGIN
// ============================================================

describe("Fluxo de cadastro e login", () => {
  const testEmail = `test_${Date.now()}@stockcontrol.test`;
  const testSenha = "SenhaTest@123";
  let orgId;
  let userId;

  test("cria organização de teste", async () => {
    const [res] = await pool.execute(
      `INSERT INTO organizations (org_type, name, email) VALUES ('ONG', 'Org Teste Jest', ?)`,
      [testEmail],
    );
    orgId = res.insertId;
    expect(orgId).toBeGreaterThan(0);
  });

  test("cria usuário com senha hasheada", async () => {
    const hash = await bcrypt.hash(testSenha, 10);
    const [res] = await pool.execute(
      `INSERT INTO users (organization_id, email, password_hash, name, role, is_active)
       VALUES (?, ?, ?, 'Usuário Teste', 'OPERATOR', 1)`,
      [orgId, testEmail, hash],
    );
    userId = res.insertId;
    expect(userId).toBeGreaterThan(0);
  });

  test("usuário criado existe no banco", async () => {
    const [rows] = await pool.query(
      "SELECT id, email, role FROM users WHERE id = ?",
      [userId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe(testEmail);
    expect(rows[0].role).toBe("OPERATOR");
  });

  test("senha armazenada não é texto puro", async () => {
    const [rows] = await pool.query(
      "SELECT password_hash FROM users WHERE id = ?",
      [userId],
    );
    expect(rows[0].password_hash).not.toBe(testSenha);
    expect(rows[0].password_hash.startsWith("$2")).toBe(true);
  });

  test("senha correta valida com bcrypt", async () => {
    const [rows] = await pool.query(
      "SELECT password_hash FROM users WHERE id = ?",
      [userId],
    );
    const ok = await bcrypt.compare(testSenha, rows[0].password_hash);
    expect(ok).toBe(true);
  });

  test("senha errada é rejeitada pelo bcrypt", async () => {
    const [rows] = await pool.query(
      "SELECT password_hash FROM users WHERE id = ?",
      [userId],
    );
    const ok = await bcrypt.compare("senhaErrada123", rows[0].password_hash);
    expect(ok).toBe(false);
  });

  test("e-mail duplicado viola UNIQUE constraint", async () => {
    const hash = await bcrypt.hash(testSenha, 10);
    await expect(
      pool.execute(
        `INSERT INTO users (organization_id, email, password_hash, name, role, is_active)
         VALUES (?, ?, ?, 'Duplicado', 'OPERATOR', 1)`,
        [orgId, testEmail, hash],
      ),
    ).rejects.toThrow();
  });

  // Limpeza: remove dados de teste
  afterAll(async () => {
    if (userId) await pool.execute("DELETE FROM users WHERE id = ?", [userId]);
    if (orgId)  await pool.execute("DELETE FROM organizations WHERE id = ?", [orgId]);
  });
});

// ============================================================
// 8. INTEGRIDADE — foreign keys e constraints
// ============================================================

describe("Integridade — constraints", () => {
  test("inserir item com organization_id inexistente falha (FK)", async () => {
    await expect(
      pool.execute(
        `INSERT INTO items (organization_id, product_name, condition_id)
         VALUES (999999, 'Item Inválido', 1)`,
      ),
    ).rejects.toThrow();
  });

  test("inserir usuário com organization_id inexistente falha (FK)", async () => {
    await expect(
      pool.execute(
        `INSERT INTO users (organization_id, email, password_hash, role, is_active)
         VALUES (999999, 'fk@test.com', 'hash', 'OPERATOR', 1)`,
      ),
    ).rejects.toThrow();
  });

  test("QR code token gerado automaticamente ao inserir item", async () => {
    // Busca uma organização e condição existente para o teste
    const [orgs]  = await pool.query("SELECT id FROM organizations LIMIT 1");
    const [conds] = await pool.query("SELECT id FROM conditions LIMIT 1");

    if (!orgs.length || !conds.length) return;

    const [res] = await pool.execute(
      `INSERT INTO items (organization_id, product_name, condition_id)
       VALUES (?, 'Item QR Test', ?)`,
      [orgs[0].id, conds[0].id],
    );
    const itemId = res.insertId;

    const [rows] = await pool.query(
      "SELECT qr_code_token FROM items WHERE id = ?",
      [itemId],
    );
    expect(rows[0].qr_code_token).not.toBeNull();
    expect(rows[0].qr_code_token).toHaveLength(36); // UUID format

    await pool.execute("DELETE FROM items WHERE id = ?", [itemId]);
  });
});
