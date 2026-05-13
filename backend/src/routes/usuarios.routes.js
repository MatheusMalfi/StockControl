"use strict";
const express = require("express");
const bcrypt  = require("bcrypt");
const pool    = require("../db");

const router = express.Router();

/* POST /api/usuarios */
router.post("/", async (req, res) => {
  try {
    const { organization_id, nome, email, cargo, role, senha } = req.body;
    if (!organization_id || !email || !nome) {
      return res.status(400).json({ message: "organization_id, nome e email são obrigatórios." });
    }
    const [dup] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (dup.length) return res.status(400).json({ message: "E-mail já cadastrado." });

    const hash = senha
      ? await bcrypt.hash(senha, parseInt(process.env.BCRYPT_ROUNDS) || 10)
      : await bcrypt.hash(Math.random().toString(36), 10);

    const [result] = await pool.execute(
      `INSERT INTO users (organization_id, email, password_hash, name, role, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [organization_id, email, hash, nome, role || "OPERATOR"],
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error("POST /api/usuarios:", err);
    res.status(500).json({ message: "Erro ao criar usuário." });
  }
});

/* PUT /api/usuarios/:id */
router.put("/:id", async (req, res) => {
  try {
    const { nome, email, cargo, role, senha } = req.body;
    const updates = [];
    const params  = [];

    if (nome  !== undefined) { updates.push("name = ?");  params.push(nome); }
    if (email !== undefined) { updates.push("email = ?"); params.push(email); }
    if (role  !== undefined) { updates.push("role = ?");  params.push(role); }
    if (senha) {
      const hash = await bcrypt.hash(senha, parseInt(process.env.BCRYPT_ROUNDS) || 10);
      updates.push("password_hash = ?");
      params.push(hash);
    }

    if (!updates.length) return res.status(400).json({ message: "Nenhum campo para atualizar." });

    params.push(req.params.id);
    await pool.execute(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /api/usuarios/:id:", err);
    res.status(500).json({ message: "Erro ao atualizar usuário." });
  }
});

/* PATCH /api/usuarios/:id/status */
router.patch("/:id/status", async (req, res) => {
  try {
    const { ativo } = req.body;
    await pool.execute("UPDATE users SET is_active = ? WHERE id = ?", [ativo ? 1 : 0, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/usuarios/:id/status:", err);
    res.status(500).json({ message: "Erro ao alterar status do usuário." });
  }
});

/* DELETE /api/usuarios/:id */
router.delete("/:id", async (req, res) => {
  try {
    await pool.execute("UPDATE users SET is_active = 0 WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/usuarios/:id:", err);
    res.status(500).json({ message: "Erro ao excluir usuário." });
  }
});

module.exports = router;
