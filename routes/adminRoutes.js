const express = require("express");
const router = express.Router();
const AdminController = require("../controllers/admin.controller");
const { memoryUpload } = require("../utils/multer");
const { verifyJWT } = require("../middlewares/verifyJWT");
const { verifyRole } = require("../middlewares/verifyRole");

router.use(verifyJWT, verifyRole("admin"));

// App Data & Users
router.get("/appdata", AdminController.GetDataApp);
router.delete("/user/:id", AdminController.deleteUserById);

// Contacts / Replies Management
router.get("/contacts", AdminController.getAllContacts);
router.post("/contacts/:id/replies", memoryUpload.single("image"), AdminController.replyToContact);
router.put("/contacts/:id/replies/:messageId", memoryUpload.single("image"), AdminController.updateReply);
router.delete("/contacts/:id/replies/:messageId", AdminController.deleteReply);
router.delete("/contacts/:id", AdminController.deleteContactById);

// Legacy aliases (/contacte/...)
router.post("/contacte/:id/replies", memoryUpload.single("image"), AdminController.replyToContact);
router.put("/contacte/:id/replies/:messageId", memoryUpload.single("image"), AdminController.updateReply);
router.delete("/contacte/:id/replies/:messageId", AdminController.deleteReply);
router.put("/contacte/:id/reply", memoryUpload.single("image"), AdminController.replyToContact);
router.put("/contacte/:id", memoryUpload.single("image"), AdminController.replyToContact);
router.delete("/contacte/:id", AdminController.deleteContactById);

// Payments
router.post("/payment", AdminController.createPaymentManually);
router.delete("/payment/:id", AdminController.deletePaymentById);
router.put("/payment/:id", AdminController.updatePaymentStatus);

// Cloudinary
router.get("/cloudinary-images", AdminController.getCloudinaryImages);
router.delete("/cloudinary-images", AdminController.deleteCloudinaryImage);

module.exports = router;
