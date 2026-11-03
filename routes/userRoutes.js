const express = require("express");
const router = express.Router();

const UserController = require("../controllers/user.controller");

const { verifyJWT } = require("../middlewares/verifyJWT");
const upload = require("../utils/multer");

// ==========================================
// 1. Public User & Portfolio Routes
// ==========================================
router.get("/sitemap-users", UserController.getSitemapUsers);
router.get("/:username", UserController.getUserByUsername);
router.get("/metauser/:username", UserController.getUserByUsernameMeta);

// ==========================================
// 2. General Profile Updates
// ==========================================
router.put("/update/user-info", verifyJWT, UserController.UpUserInfo);
router.put("/update/user-image", verifyJWT, upload.single("urlimage"), UserController.UpUserImage);
router.put("/update/about", verifyJWT, UserController.UpUserAbout);
router.put("/update/bgcolor", verifyJWT, UserController.UpUserBgColor);
router.put("/update/languages", verifyJWT, UserController.UpUserLanguages);
router.put("/update/services", verifyJWT, UserController.UpUserServices);
router.put("/update/skills", verifyJWT, UserController.UpUserSkills);
router.put("/update/socials", verifyJWT, UserController.UpUserSocials);
router.put("/update/theme", verifyJWT, UserController.UpUserTheme);
router.put("/update/display-language", verifyJWT, UserController.UpUserDisplayLanguage);
router.put("/update/section-order", verifyJWT, UserController.UpUserSectionOrder);

// ==========================================
// 3. Projects Management
// ==========================================
router.put("/update/projects/item", verifyJWT, upload.single("image"), UserController.saveUserProjectItem);
router.put("/update/projects/order", verifyJWT, UserController.reorderUserProjects);
router.delete("/update/projects/:projectId", verifyJWT, UserController.deleteUserProject);

// ==========================================
// 4. Experience Management
// ==========================================
router.put("/update/experience/item", verifyJWT, UserController.saveUserExperienceItem);
router.put("/update/experience/order", verifyJWT, UserController.reorderUserExperience);
router.delete("/update/experience/:experienceId", verifyJWT, UserController.deleteUserExperience);

// ==========================================
// 5. Education Management
// ==========================================
router.put("/update/education/item", verifyJWT, UserController.saveUserEducationItem);
router.put("/update/education/order", verifyJWT, UserController.reorderUserEducation);
router.delete("/update/education/:educationId", verifyJWT, UserController.deleteUserEducation);

// ==========================================
// 6. Certificates Management
// ==========================================
router.put("/update/certificates/item", verifyJWT, upload.single("file"), UserController.saveUserCertificateItem);
router.put("/update/certificates/order", verifyJWT, UserController.reorderUserCertificates);
router.delete("/update/certificates/:certificateId", verifyJWT, UserController.deleteUserCertificate);

module.exports = router;
