const express = require("express");
const router = express.Router();
const ContacteController = require("../controllers/contacte.controller");
const { verifyJWT } = require("../middlewares/verifyJWT");
const { contactLimiter } = require("../Limiting/contactLimiter");
const { memoryUpload } = require("../utils/multer");

router.use(verifyJWT);

// Get logged-in user's contacts
router.get("/user-contacts", ContacteController.getUserContacts);

// Create new contact conversation
router.post("/", contactLimiter, memoryUpload.single("image"), ContacteController.createContact);

// Reply-level operations (add, edit, soft-delete)
router.post("/:id/replies", contactLimiter, memoryUpload.single("image"), ContacteController.addReply);
router.put("/:id/replies/:messageId", memoryUpload.single("image"), ContacteController.updateReply);
router.delete("/:id/replies/:messageId", ContacteController.deleteReply);

// Conversation-level delete
router.delete("/user-contact/:id", ContacteController.deleteContactById);

module.exports = router;
