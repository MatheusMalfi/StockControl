"use strict";
const express = require("express");
const pool    = require("../db");

const router = express.Router();

/* GET /api/categories */
router.get("/categories", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name FROM categories ORDER BY name ASC",
    );
    res.json({ success: true, categories: rows });
  } catch (err) {
    console.error("GET /api/categories:", err);
    res.status(500).json({ message: "Erro ao buscar categorias." });
  }
});

module.exports = router;
