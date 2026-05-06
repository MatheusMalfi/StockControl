const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "stockcontrol_secret_change_in_production";

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token ausente." });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido ou expirado." });
  }
}

module.exports = { requireAuth };
