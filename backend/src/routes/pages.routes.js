const express = require("express");
const path = require("path");

const router = express.Router();
const root = path.join(__dirname, "..", "..", "..");

router.get("/", (req, res) => {
  res.sendFile(path.join(root, "acesso", "login", "login.html"));
});

router.get("/register", (req, res) => {
  res.sendFile(path.join(root, "acesso", "register", "register.html"));
});

router.get("/collection-history", (req, res) => {
  res.sendFile(
    path.join(root, "navigation-screens", "collection-history", "collection-history.html"),
  );
});

module.exports = router;
