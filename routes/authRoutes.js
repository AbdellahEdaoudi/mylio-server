const express = require("express");
const router = express.Router();
const AuthController = require("../controllers/auth.controller");
const { authLimiter } = require("../Limiting/authLimiter");

router.post("/register", authLimiter, AuthController.register);
router.post("/login", authLimiter, AuthController.login);
router.post("/refresh", AuthController.refresh);
router.post("/logout", AuthController.logout);

module.exports = router;
