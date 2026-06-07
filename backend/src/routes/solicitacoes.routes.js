"use strict";
const express = require("express");
const nodemailer = require("nodemailer");
const pool = require("../db");

const router = express.Router();

function createTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS solicitacoes (
    id               VARCHAR(36)  NOT NULL PRIMARY KEY,
    organization_id  BIGINT UNSIGNED NOT NULL,
    tipo             VARCHAR(50)  DEFAULT NULL,
    item             VARCHAR(255) DEFAULT NULL,
    quantidade       INT          NOT NULL DEFAULT 1,
    solicitante      VARCHAR(255) DEFAULT NULL,
    email            VARCHAR(255) DEFAULT NULL,
    status           VARCHAR(50)  NOT NULL DEFAULT 'pendente',
    prioridade       VARCHAR(50)  NOT NULL DEFAULT 'media',
    data_solicitacao DATE         DEFAULT NULL,
    data_revisao     DATE         DEFAULT NULL,
    revisor          VARCHAR(255) DEFAULT NULL,
    obs              TEXT         DEFAULT NULL,
    items            TEXT         DEFAULT NULL,
    estimated_profit_total DECIMAL(12,2) DEFAULT 0,
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_org (organization_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

async function ensureTable() {
  await pool.query(CREATE_TABLE);

  const dbName = process.env.DB_NAME || "stockcontrol";

  async function ensureColumn(columnName, alterSql) {
    const [columns] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'solicitacoes' AND COLUMN_NAME = ?",
      [dbName, columnName],
    );

    if (!columns.length) {
      await pool.query(alterSql);
    }
  }

  await ensureColumn(
    "items",
    "ALTER TABLE solicitacoes ADD COLUMN items TEXT DEFAULT NULL",
  );

  await ensureColumn(
    "estimated_profit_total",
    "ALTER TABLE solicitacoes ADD COLUMN estimated_profit_total DECIMAL(12,2) DEFAULT 0 AFTER items",
  );
}

function getOrgId(req) {
  return req.query.organization_id || req.body?.organization_id;
}

function parseNumber(value) {
  if (value == null || value === "") return NaN;
  if (typeof value === "number") return value;

  let str = String(value).trim().replace(/[^0-9,.-]/g, "");
  if (!str) return NaN;

  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");

  if (lastComma > lastDot) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else {
    str = str.replace(/,/g, "");
  }

  const n = Number(str);
  return Number.isFinite(n) ? n : NaN;
}

function calculateItemProfit(item) {
  const estimatedValue = parseNumber(
    item.estimated_value ??
      item.valor_estimado ??
      item.valor ??
      item.value ??
      item.valor_total ??
      item.total_value ??
      0,
  );

  const quantityAvailable = parseNumber(
    item.quantity_available ??
      item.disponivel ??
      item.total ??
      item.quantity_available_stock ??
      item.quantidade_estoque ??
      0,
  );

  const quantityToDiscard = parseNumber(
    item.quantidade ?? item.quantity ?? item.qtd ?? 0,
  );

  if (
    !Number.isFinite(estimatedValue) ||
    !Number.isFinite(quantityAvailable) ||
    !Number.isFinite(quantityToDiscard) ||
    quantityAvailable <= 0 ||
    quantityToDiscard <= 0
  ) {
    return 0;
  }

  return (estimatedValue / quantityAvailable) * quantityToDiscard;
}

function calculateEstimatedProfitTotal(items, fallbackValue) {
  if (Array.isArray(items) && items.length) {
    return items.reduce((sum, item) => {
      const profit = parseNumber(item.estimated_profit);
      return sum + (Number.isFinite(profit) ? profit : calculateItemProfit(item));
    }, 0);
  }

  const fallback = parseNumber(fallbackValue);
  return Number.isFinite(fallback) ? fallback : 0;
}

/* GET /api/solicitacoes */
router.get("/", async (req, res) => {
  try {
    await ensureTable();
    const orgId = getOrgId(req);
    if (!orgId)
      return res
        .status(400)
        .json({ message: "organization_id é obrigatório." });
    const [rows] = await pool.query(
      "SELECT * FROM solicitacoes WHERE organization_id = ? ORDER BY created_at DESC",
      [orgId],
    );
    res.json({ success: true, solicitacoes: rows });
  } catch (err) {
    console.error("GET /api/solicitacoes:", err);
    res.status(500).json({ message: "Erro ao buscar solicitações." });
  }
});

/* POST /api/solicitacoes */
router.post("/", async (req, res) => {
  try {
    await ensureTable();

    const orgId = getOrgId(req);
    if (!orgId) {
      return res
        .status(400)
        .json({ message: "organization_id é obrigatório." });
    }

    const {
      id,
      tipo,
      item,
      quantidade,
      solicitante,
      email,
      status,
      prioridade,
      data_solicitacao,
      obs,
      items,
      estimated_profit_total,
    } = req.body;

    const itemsPayload = items ? JSON.stringify(items) : null;
    const profitTotal = calculateEstimatedProfitTotal(
      items,
      estimated_profit_total,
    );

    if (process.env.DEBUG_SOLICITACOES && items) {
      console.debug("[solicitacoes] POST payload items:", items);
    }

    const newId =
      id || `sol_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    await pool.execute(
      `INSERT INTO solicitacoes
         (id, organization_id, tipo, item, quantidade, solicitante, email, status, prioridade, data_solicitacao, obs, items, estimated_profit_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId,
        orgId,
        tipo || null,
        item || null,
        quantidade || 1,
        solicitante || null,
        email || null,
        status || "pendente",
        prioridade || "media",
        data_solicitacao || null,
        obs || null,
        itemsPayload,
        profitTotal,
      ],
    );

    res.status(201).json({ success: true, id: newId });
  } catch (err) {
    console.error("POST /api/solicitacoes:", err);
    res.status(500).json({ message: "Erro ao criar solicitação." });
  }
});

/* PUT /api/solicitacoes/:id */
router.put("/:id", async (req, res) => {
  try {
    await ensureTable();

    const {
      tipo,
      item,
      quantidade,
      solicitante,
      email,
      status,
      prioridade,
      data_solicitacao,
      obs,
      items,
      estimated_profit_total,
    } = req.body;

    const itemsPayload = items ? JSON.stringify(items) : null;

    const profitTotal =
      items || estimated_profit_total !== undefined
        ? calculateEstimatedProfitTotal(items, estimated_profit_total)
        : null;

    if (process.env.DEBUG_SOLICITACOES && items) {
      console.debug("[solicitacoes] PUT payload items:", items);
    }

    await pool.execute(
      `UPDATE solicitacoes
       SET tipo = ?, item = ?, quantidade = ?, solicitante = ?, email = ?,
           status = COALESCE(?, status), prioridade = ?, data_solicitacao = ?, obs = ?,
           items = COALESCE(?, items), estimated_profit_total = COALESCE(?, estimated_profit_total)
       WHERE id = ?`,
      [
        tipo || null,
        item || null,
        quantidade || 1,
        solicitante || null,
        email || null,
        status !== undefined ? status : null,
        prioridade || "media",
        data_solicitacao || null,
        obs || null,
        itemsPayload,
        profitTotal,
        req.params.id,
      ],
    );

    res.json({ success: true });
  } catch (err) {
    console.error("PUT /api/solicitacoes/:id:", err);
    res.status(500).json({ message: "Erro ao atualizar solicitação." });
  }
});

/* PATCH /api/solicitacoes/:id/revisar */
router.patch("/:id/revisar", async (req, res) => {
  try {
    await ensureTable();
    const { action, revisor, status, obs } = req.body;
    const finalStatus =
      status ||
      (action === "approve" ? "aprovada" : action === "reject" ? "recusada" : "revisado");
    await pool.execute(
      `UPDATE solicitacoes
       SET status = ?, revisor = ?, data_revisao = CURDATE(), obs = CONCAT(COALESCE(obs,''), ?)
       WHERE id = ?`,
      [finalStatus, revisor || null, obs ? `\n${obs}` : "", req.params.id],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/solicitacoes/:id/revisar:", err);
    res.status(500).json({ message: "Erro ao revisar solicitação." });
  }
});

/* PATCH /api/solicitacoes/:id/status */
router.patch("/:id/status", async (req, res) => {
  try {
    await ensureTable();
    const { status } = req.body;
    if (!status)
      return res.status(400).json({ message: "status é obrigatório." });
    await pool.execute("UPDATE solicitacoes SET status = ? WHERE id = ?", [
      status,
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/solicitacoes/:id/status:", err);
    res.status(500).json({ message: "Erro ao alterar status." });
  }
});

/* PATCH /api/solicitacoes/:id/agendar-coleta */
router.patch("/:id/agendar-coleta", async (req, res) => {
  try {
    await ensureTable();
    const { data_coleta, obs } = req.body;
    if (!data_coleta) {
      return res.status(400).json({ message: "data_coleta é obrigatória." });
    }
    if (!obs || !String(obs).trim()) {
      return res.status(400).json({ message: "obs é obrigatória." });
    }

    const [[solicitacao]] = await pool.query(
      `SELECT s.id, s.status, s.obs, o.name AS org_name, o.email AS org_email
       FROM solicitacoes s
       JOIN organizations o ON o.id = s.organization_id
       WHERE s.id = ? LIMIT 1`,
      [req.params.id],
    );

    if (!solicitacao) {
      return res.status(404).json({ message: "Solicitação não encontrada." });
    }

    const statusAtual = String(solicitacao.status || "").toLowerCase();
    if (statusAtual !== "aprovada") {
      return res.status(400).json({
        message: "Apenas solicitações aprovadas podem ser agendadas.",
      });
    }

    const dataFormatada = new Date(`${data_coleta}T00:00:00`).toLocaleDateString(
      "pt-BR",
    );
    const note = [`COLETA AGENDADA PARA ${dataFormatada}`, `Obs: ${obs}`]
      .filter(Boolean)
      .join("\n");
    const mergedObs = [solicitacao.obs || "", note].filter(Boolean).join("\n");

    await pool.execute(
      `UPDATE solicitacoes
       SET status = 'coleta_agendada', data_revisao = ?, obs = ?
       WHERE id = ?`,
      [data_coleta, mergedObs, req.params.id],
    );

    if (solicitacao.org_email) {
      const transporter = createTransporter();
      if (transporter) {
        try {
          await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: solicitacao.org_email,
            subject: `Coleta agendada para pedido ${solicitacao.id}`,
            text: `Olá ${solicitacao.org_name || "responsável"},

Seu pedido ${solicitacao.id} foi agendado para coleta em ${dataFormatada}.

Observação: ${obs}

Atenciosamente,
Equipe StockControl`,
            html: `
              <div style="font-family:Inter,sans-serif;color:#111;">
                <h2>Coleta agendada</h2>
                <p>Olá <strong>${solicitacao.org_name || "responsável"}</strong>,</p>
                <p>Seu pedido <strong>${solicitacao.id}</strong> foi agendado para coleta em <strong>${dataFormatada}</strong>.</p>
                <p><strong>Observação:</strong></p>
                <p>${String(obs).replace(/\n/g, "<br />")}</p>
                <p>Obrigado,<br/>Equipe StockControl</p>
              </div>
            `,
          });
        } catch (mailErr) {
          console.error("Erro ao enviar e-mail de agendamento:", mailErr);
        }
      } else {
        console.log(
          "SMTP não configurado: e-mail de agendamento não será enviado.",
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/solicitacoes/:id/agendar-coleta:", err);
    res.status(500).json({ message: "Erro ao agendar coleta." });
  }
});

/* GET /api/solicitacoes/:id/detalhes */
router.get("/:id/detalhes", async (req, res) => {
  try {
    const solicitacaoId = req.params.id;

    const [solicRows] = await pool.query(
      `SELECT s.*, o.name AS org_name, o.email AS org_email
       FROM solicitacoes s
       JOIN organizations o ON o.id = s.organization_id
       WHERE s.id = ? LIMIT 1`,
      [solicitacaoId],
    );

    if (!solicRows.length) {
      return res.status(404).json({ message: "Solicitação não encontrada." });
    }

    const solicitacao = solicRows[0];

    let items = [];
    if (solicitacao.items) {
      if (Array.isArray(solicitacao.items)) {
        items = solicitacao.items;
      } else if (typeof solicitacao.items === "string") {
        try {
          const parsed = JSON.parse(solicitacao.items);
          if (Array.isArray(parsed)) items = parsed;
        } catch {
          items = [];
        }
      }
    }

    const normalizeItem = (item) => {
      const quantity =
        item.quantity != null
          ? parseInt(item.quantity, 10)
          : item.quantidade != null
          ? parseInt(item.quantidade, 10)
          : 1;

      return {
        id: item.id || item.item_id || solicitacao.id,
        product_name:
          item.product_name || item.nome_item || item.item || item.tipo || "Item",
        brand_name: item.brand_name || item.marca || "",
        model_name: item.model_name || item.modelo || "",
        storage_location:
          item.storage_location || item.localizacao || item.storage_location || "",
        category_name: item.category_name || item.categoria || "",
        weight_kg:
          item.weight_kg != null
            ? item.weight_kg
            : item.peso_kg != null
            ? item.peso_kg
            : null,
        quantity_available:
          item.quantity_available != null
            ? item.quantity_available
            : item.disponivel != null
            ? item.disponivel
            : item.total != null
            ? item.total
            : null,
        estimated_value:
          item.estimated_value != null
            ? item.estimated_value
            : item.valor_estimado != null
            ? item.valor_estimado
            : item.valor != null
            ? item.valor
            : item.value != null
            ? item.value
            : item.valor_total != null
            ? item.valor_total
            : item.total_value != null
            ? item.total_value
            : null,
        currency: item.currency || item.moeda || "BRL",
        estimated_profit:
          item.estimated_profit != null
            ? item.estimated_profit
            : (() => {
                const estimatedValue = parseFloat(
                  item.estimated_value ??
                    item.valor_estimado ??
                    item.valor ??
                    item.value ??
                    item.valor_total ??
                    item.total_value ??
                    0,
                );
                const quantityAvailable = parseFloat(
                  item.quantity_available ??
                    item.disponivel ??
                    item.total ??
                    item.quantity ??
                    item.quantidade ??
                    0,
                );
                const quantity = parseFloat(
                  item.quantity ?? item.quantidade ?? item.total ?? item.qtd ?? 0,
                );
                return Number.isFinite(estimatedValue) &&
                  Number.isFinite(quantityAvailable) &&
                  Number.isFinite(quantity) &&
                  quantityAvailable > 0 &&
                  quantity > 0
                  ? (estimatedValue / quantityAvailable) * quantity
                  : null;
              })(),
        estimated_profit_currency:
          item.estimated_profit_currency || item.currency || item.moeda || "BRL",
        quantity: Number.isNaN(quantity) ? 1 : quantity,
        description: item.description || item.obs || item.descricao || "",
      };
    };

    if (!items.length) {
      const itemDescription = solicitacao.item || solicitacao.tipo || "Solicitação";
      items = [
        {
          id: solicitacao.id,
          product_name: itemDescription,
          brand_name: "",
          model_name: "",
          storage_location: "",
          category_name: "",
          weight_kg: null,
          estimated_value: null,
          currency: "BRL",
          quantity: solicitacao.quantidade || 1,
          description: solicitacao.obs || "",
        },
      ];
    } else {
      items = items.map(normalizeItem);
    }

    if (process.env.DEBUG_SOLICITACOES) {
      console.debug("[solicitacoes] GET detalhes items:", items);
    }

    res.json({
      success: true,
      solicitacao,
      items,
    });
  } catch (err) {
    console.error("GET /api/solicitacoes/:id/detalhes:", err);
    res
      .status(500)
      .json({ message: "Erro ao buscar detalhes da solicitação." });
  }
});

/* DELETE /api/solicitacoes/:id */
router.delete("/:id", async (req, res) => {
  try {
    await ensureTable();
    await pool.execute("DELETE FROM solicitacoes WHERE id = ?", [
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/solicitacoes/:id:", err);
    res.status(500).json({ message: "Erro ao excluir solicitação." });
  }
});

module.exports = router;
