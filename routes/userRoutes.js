const express = require("express");
const router = express.Router();
const UserController = require("../controllers/user.controller");
const isAuthenticated = require('../middlewares/isAuthenticated');
const upload = require('../middlewares/multer');

// User Routes
router.get('/username/:username', UserController.getUserByUsername);
router.get('/metauser/:username', UserController.getUserByUsernameMeta);
router.post('/', isAuthenticated, UserController.createUser);
// Update User Data
router.put("/update/user-info", isAuthenticated, UserController.UpUserInfo);
router.put("/update/user-image", isAuthenticated, upload.single("urlimage"), UserController.UpUserImage);
router.put("/update/about", isAuthenticated, UserController.UpUserAbout);
router.put("/update/bgcolor", isAuthenticated, UserController.UpUserBgColor);
router.put("/update/languages", isAuthenticated, UserController.UpUserLanguages);
router.put("/update/services", isAuthenticated, UserController.UpUserServices);
router.put("/update/skills", isAuthenticated, UserController.UpUserSkills);
router.put("/update/socials", isAuthenticated, UserController.UpUserSocials);
router.put("/update/theme", isAuthenticated, UserController.UpUserTheme);
router.put("/update/display-language", isAuthenticated, UserController.UpUserDisplayLanguage);
router.put("/update/section-order", isAuthenticated, UserController.UpUserSectionOrder);
router.get('/active-usernames', UserController.getActiveUsernames);

module.exports = router;
