const User = require("../models/User");
const cloudinary = require("../utils/cloudinary");
const sanitizeObjectStrings = require("../utils/sanitizeObject");
const Payment = require("../models/Payment");

const sanitizeUsername = (val) => {
  if (!val) return "";
  return String(val)
    .toLowerCase()
    .trim()
    .replace(/[_.\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 30);
};

const RESERVED_USERNAMES = [
  "mylio",
  "localhost",
  "www",
  "api",
  "admin",
  "support",
  "auth",
  "login",
  "register",
  "update-profile",
  "payment",
  "success",
];

const processImageUpload = async (file) => {
  const fs = require("fs");
  if (file.size > 200 * 1024) {
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    const err = new Error("Image size must not exceed 200KB");
    err.status = 400;
    throw err;
  }

  try {
    const up = await cloudinary.uploader.upload(file.path, {
      folder: "User_Images",
    });
    return up.secure_url;
  } finally {
    if (file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (e) {
        console.error("Failed to delete temp file:", e);
      }
    }
  }
};

// Helper to extract Cloudinary public_id from a URL
const getCloudinaryPublicId = (url) => {
  if (!url || typeof url !== "string" || !url.includes("cloudinary.com")) return null;
  // Skip default avatar image
  if (url.includes("dgmlr4uuim5swutkp6a8")) return null;
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split("/");
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx === -1) return null;
    const fileParts = parts.slice(uploadIdx + 1);
    const versionIdx = fileParts.findIndex((p) => /^v\d+$/.test(p));
    if (versionIdx !== -1) {
      return fileParts.slice(versionIdx + 1).join("/").replace(/\.[^/.]+$/, "");
    }
    return fileParts.join("/").replace(/\.[^/.]+$/, "");
  } catch (err) {
    console.error("Error parsing Cloudinary URL:", err);
    return null;
  }
};

// Helper to delete an image from Cloudinary
const deleteCloudinaryImage = async (urlimage) => {
  const publicId = getCloudinaryPublicId(urlimage);
  if (!publicId) return;
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`Cloudinary image deleted: ${publicId}`, result);
  } catch (err) {
    console.error("Error deleting image from Cloudinary:", err);
  }
};

// Update user info (including optional display email)
exports.UpUserInfo = async (req, res) => {
  try {
    const allowedFields = ["fullname", "username", "email", "phoneNumber", "location", "category"];
    const userData = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) {
        userData[f] = String(req.body[f]).trim().substring(0, 100);
      }
    });

    // Optional display email (can be empty string or valid email)
    if (userData.email !== undefined) {
      const cleanEmail = userData.email.toLowerCase();
      if (cleanEmail !== "") {
        const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/;
        if (!emailRegex.test(cleanEmail)) {
          return res.status(400).json({ error: "Please provide a valid email address or leave it empty" });
        }
        userData.email = cleanEmail;
      } else {
        userData.email = "";
      }
    }

    sanitizeObjectStrings(userData);
    if (userData.fullname) {
      userData.fullname = userData.fullname.substring(0, 50);
    }
    if (userData.username) {
      userData.username = sanitizeUsername(userData.username);

      if (!userData.username || userData.username.length < 3) {
        return res.status(400).json({
          error: "Username must be at least 3 characters (letters, numbers, and hyphens only)",
        });
      }

      if (RESERVED_USERNAMES.includes(userData.username)) {
        return res.status(400).json({ error: "This username is reserved and cannot be used" });
      }

      const existingUser = await User.exists({
        $or: [
          { username: userData.username },
          { username: userData.username.replace(/-/g, "_") },
        ],
        _id: { $ne: req.user.id },
      });
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: userData },
      { new: true }
    );
    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    res.json(updatedUser);
  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.UpUserImage = async (req, res) => {
  try {
    let urlimage;
    let oldImageUrlToDelete = null;
    const currentUser = await User.findById(req.user.id).select("urlimage").lean();

    if (!req.file) {
      urlimage = "https://res.cloudinary.com/dssrnghtr/image/upload/v1761258566/dgmlr4uuim5swutkp6a8.png";
      if (currentUser?.urlimage && currentUser.urlimage !== urlimage) {
        oldImageUrlToDelete = currentUser.urlimage;
      }
    } else {
      urlimage = await processImageUpload(req.file);
      if (currentUser?.urlimage && currentUser.urlimage !== urlimage) {
        oldImageUrlToDelete = currentUser.urlimage;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { urlimage } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (oldImageUrlToDelete) {
      await deleteCloudinaryImage(oldImageUrlToDelete);
    }

    res.json(updatedUser);
  } catch (err) {
    console.error("Update Image Error:", err);
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.UpUserAbout = async (req, res) => {
  try {
    let { about } = req.body;

    if (typeof about !== "string") {
      return res.status(400).json({ error: "Invalid 'about' field" });
    }
    about = sanitizeObjectStrings({ about }).about.substring(0, 500);

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { about } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating about:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.UpUserBgColor = async (req, res) => {
  try {
    let { bgcolor } = req.body;

    if (typeof bgcolor !== "string") {
      return res.status(400).json({ error: "Invalid 'bgcolor' field" });
    }
    bgcolor = bgcolor.trim().substring(0, 50);

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { bgcolor } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating bgcolor:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.UpUserLanguages = async (req, res) => {
  try {
    let { languages } = req.body;
    if (typeof languages === "string") {
      try {
        languages = JSON.parse(languages);
      } catch {
        return res.status(400).json({ error: "Invalid 'languages' format" });
      }
    }

    if (!Array.isArray(languages)) {
      return res.status(400).json({ error: "'languages' must be an array" });
    }
    if (languages.length > 10) {
      return res.status(400).json({ error: "Maximum 10 languages allowed" });
    }
    languages = languages
      .map((lang) => (typeof lang === "string" ? lang.trim().substring(0, 50) : ""))
      .filter((lang) => lang);
    sanitizeObjectStrings(languages);

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { languages } },
      { new: true }
    );

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating languages:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.UpUserServices = async (req, res) => {
  try {
    let { services } = req.body;

    if (typeof services === "string") {
      try {
        services = JSON.parse(services);
      } catch {
        return res.status(400).json({ error: "Invalid 'services' format" });
      }
    }

    if (!Array.isArray(services)) {
      return res.status(400).json({ error: "'services' must be an array" });
    }
    if (services.length > 10) {
      return res.status(400).json({ error: "Maximum 10 services allowed" });
    }
    services = services
      .map((serv) => (typeof serv === "string" ? serv.trim().substring(0, 150) : ""))
      .filter((serv) => serv);
    sanitizeObjectStrings(services);

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { services } },
      { new: true }
    );

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating services:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.UpUserSkills = async (req, res) => {
  try {
    let { skills } = req.body;

    if (typeof skills === "string") {
      try {
        skills = JSON.parse(skills);
      } catch {
        return res.status(400).json({ error: "Invalid 'skills' format" });
      }
    }

    if (!Array.isArray(skills)) {
      return res.status(400).json({ error: "'skills' must be an array" });
    }
    if (skills.length > 10) {
      return res.status(400).json({ error: "Maximum 10 skills allowed" });
    }
    skills = skills
      .map((skil) => (typeof skil === "string" ? skil.trim().substring(0, 130) : ""))
      .filter((skil) => skil);
    sanitizeObjectStrings(skills);

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { skills } },
      { new: true }
    );

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating skills:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.UpUserSocials = async (req, res) => {
  try {
    const { socials } = req.body;

    if (!socials || typeof socials !== "object")
      return res.status(400).json({ error: "'socials' must be an object" });

    const sanitizedSocials = {};
    for (const key in socials) {
      if (typeof socials[key] === "string") {
        sanitizedSocials[key] = socials[key].trim().substring(0, 500);
      }
    }
    sanitizeObjectStrings(sanitizedSocials);

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { socials: sanitizedSocials } },
      { new: true }
    );

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating socials:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.UpUserTheme = async (req, res) => {
  try {
    let { theme } = req.body;

    if (theme === undefined || typeof theme !== "number") {
      return res.status(400).json({ error: "'theme' must be a number" });
    }
    theme = String(theme).trim().substring(0, 20);
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { theme } },
      { new: true }
    );

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating theme:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.UpUserDisplayLanguage = async (req, res) => {
  try {
    let { displayLanguage } = req.body;

    if (!displayLanguage || typeof displayLanguage !== "string") {
      return res.status(400).json({ error: "'displayLanguage' must be a string" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { displayLanguage } },
      { new: true }
    );

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating display language:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.UpUserSectionOrder = async (req, res) => {
  try {
    let { sectionOrder } = req.body;

    if (!sectionOrder || !Array.isArray(sectionOrder)) {
      return res.status(400).json({ error: "'sectionOrder' must be an array" });
    }

    sectionOrder = sectionOrder.filter((item) => typeof item === "string");

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { sectionOrder } },
      { new: true }
    );

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating section order:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get all usernames for sitemap
exports.getSitemapUsers = async (req, res) => {
  try {
    const users = await User.find({
      username: { $exists: true, $nin: RESERVED_USERNAMES },
    })
      .select("username updatedAt createdAt")
      .lean();

    return res.status(200).json({
      success: true,
      users: users
        .filter((u) => u.username && !RESERVED_USERNAMES.includes(u.username.toLowerCase()))
        .map((u) => ({
          username: u.username.toLowerCase().trim(),
          lastModified: u.updatedAt || u.createdAt || new Date(),
        })),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Get user by username (supports lightweight lastUpdated check and hyphen/underscore aliases)
exports.getUserByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const clientUpdatedAt = req.query.lastUpdated || req.body?.lastUpdated;
    const cleanUsername = String(username || "").toLowerCase().trim();
    const cleanSlug = sanitizeUsername(username);

    const userbyusername = await User.findOne({
      $or: [
        { username: cleanUsername },
        { username: cleanSlug },
        { username: cleanUsername.replace(/-/g, "_") },
        { username: cleanUsername.replace(/_/g, "-") },
      ],
    })
      .select("_id username email createdAt updatedAt")
      .lean();

    if (!userbyusername) {
      return res.status(404).json({ message: "User not found" });
    }

    const createdAt = new Date(userbyusername.createdAt);
    const thirtyDaysLater = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const now = new Date();
    const isWithin30Days = thirtyDaysLater > now;

    if (!isWithin30Days) {
      const payment = await Payment.findOne({
        user: userbyusername._id,
        status: "ACTIVE",
      }).lean();
      if (!payment) {
        return res.status(404).json({
          message: "No payment found for this user",
          username: userbyusername.username,
        });
      }
      if (payment.status !== "ACTIVE") {
        return res.status(403).json({
          message: "Your payment is not active. Please complete payment.",
          username: userbyusername.username,
        });
      }
    }

    if (clientUpdatedAt && userbyusername.updatedAt) {
      const clientTime = new Date(clientUpdatedAt).getTime();
      const serverTime = new Date(userbyusername.updatedAt).getTime();
      if (!isNaN(clientTime) && clientTime >= serverTime) {
        return res.json({ status: 200, updated: false, message: "No updates" });
      }
    }

    const user = await User.findById(userbyusername._id).select("-__v").lean();

    return res.status(200).json({
      status: 200,
      updated: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Get user metadata by username
exports.getUserByUsernameMeta = async (req, res) => {
  try {
    const cleanUsername = String(req.params.username || "").toLowerCase().trim();
    const cleanSlug = sanitizeUsername(req.params.username);

    const user = await User.findOne({
      $or: [
        { username: cleanUsername },
        { username: cleanSlug },
        { username: cleanUsername.replace(/-/g, "_") },
        { username: cleanUsername.replace(/_/g, "-") },
      ],
    })
      .select("fullname username urlimage category displayLanguage")
      .lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      status: 200,
      user,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 3. Projects Management
// ==========================================
exports.saveUserProjectItem = async (req, res) => {
  const userId = req.user.id;
  const item = req.body;

  try {
    let imageUrl = item.image ? item.image.trim().substring(0, 1000) : "";
    let oldImageUrl = null;

    if (req.file) {
      if (req.file.size > 200 * 1024) {
        const fs = require("fs");
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "Image size must not exceed 200KB" });
      }
      const uploaded = await cloudinary.uploader.upload(req.file.path, {
        folder: "Project_Images",
      });
      imageUrl = uploaded.secure_url;
      try {
        const fs = require("fs");
        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (e) {
        console.error("Failed to delete temp file:", e);
      }

      if (item._id) {
        const user = await User.findOne({ _id: userId, "projects._id": item._id });
        const oldProject = user?.projects?.find((p) => p._id.toString() === item._id);
        if (oldProject?.image) {
          oldImageUrl = oldProject.image;
        }
      }
    }

    const rawTechs = item["technologies[]"] || item.technologies;
    const techs = Array.isArray(rawTechs)
      ? rawTechs
          .map((t) => (typeof t === "string" ? t.trim().substring(0, 20) : ""))
          .filter((t) => t)
      : typeof rawTechs === "string" && rawTechs
      ? [rawTechs.trim().substring(0, 20)]
      : [];

    const projectObj = sanitizeObjectStrings({
      title: item.title ? item.title.trim().substring(0, 100) : "",
      description: item.description ? item.description.trim().substring(0, 2000) : "",
      link: item.link ? item.link.trim().substring(0, 1000) : "",
      image: imageUrl,
      technologies: techs,
      startDate: item.startDate ? item.startDate.trim().substring(0, 20) : "",
      endDate: item.endDate ? item.endDate.trim().substring(0, 20) : "",
    });

    if (item._id) {
      projectObj._id = item._id;
      const updatedUser = await User.findOneAndUpdate(
        { _id: userId, "projects._id": item._id },
        { $set: { "projects.$": projectObj } },
        { new: true }
      );
      if (!updatedUser) return res.status(404).json({ message: "User or Project not found" });

      if (oldImageUrl) {
        await deleteCloudinaryImage(oldImageUrl);
      }

      res.json(updatedUser);
    } else {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (user.projects && user.projects.length >= 10) {
        return res.status(400).json({ error: "Maximum limit of 10 projects reached" });
      }

      user.projects.push(projectObj);
      await user.save();
      res.json(user);
    }
  } catch (error) {
    console.error("Error saving project item:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteUserProject = async (req, res) => {
  const userId = req.user.id;
  const { projectId } = req.params;

  try {
    const mongoose = require("mongoose");
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const userBefore = await User.findOne({
      _id: userId,
      "projects._id": new mongoose.Types.ObjectId(projectId),
    });
    const projectToDelete = userBefore?.projects?.find((p) => p._id.toString() === projectId);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $pull: { projects: { _id: new mongoose.Types.ObjectId(projectId) } } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found or project not found" });
    }

    if (projectToDelete?.image) {
      await deleteCloudinaryImage(projectToDelete.image);
    }

    res.json(updatedUser);
  } catch (error) {
    console.error("CRITICAL Error deleting project:", error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
};

exports.reorderUserProjects = async (req, res) => {
  const userId = req.user.id;
  const { projects } = req.body;

  try {
    if (!Array.isArray(projects)) {
      return res.status(400).json({ error: "Projects must be an array" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const orderMap = new Map();
    projects.forEach((p, index) => {
      if (p._id) orderMap.set(p._id.toString(), index);
    });

    user.projects.sort((a, b) => {
      const indexA = orderMap.has(a._id.toString()) ? orderMap.get(a._id.toString()) : 9999;
      const indexB = orderMap.has(b._id.toString()) ? orderMap.get(b._id.toString()) : 9999;
      return indexA - indexB;
    });

    await user.save();
    res.json(user);
  } catch (error) {
    console.error("Error reordering projects:", error);
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 4. Experience Management
// ==========================================
exports.saveUserExperienceItem = async (req, res) => {
  const userId = req.user.id;
  const item = req.body;

  try {
    const experienceObj = sanitizeObjectStrings({
      company: item.company ? item.company.trim().substring(0, 100) : "",
      role: item.role ? item.role.trim().substring(0, 100) : "",
      description: item.description ? item.description.trim().substring(0, 2000) : "",
      startDate: item.startDate ? item.startDate.trim().substring(0, 20) : "",
      endDate: item.endDate ? item.endDate.trim().substring(0, 20) : "",
    });

    if (item._id) {
      experienceObj._id = item._id;
      const updatedUser = await User.findOneAndUpdate(
        { _id: userId, "experience._id": item._id },
        { $set: { "experience.$": experienceObj } },
        { new: true }
      );
      if (!updatedUser) return res.status(404).json({ message: "User or Experience not found" });
      res.json(updatedUser);
    } else {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (user.experience && user.experience.length >= 10) {
        return res.status(400).json({ error: "Maximum limit of 10 experience items reached" });
      }

      user.experience.push(experienceObj);
      await user.save();
      res.json(user);
    }
  } catch (error) {
    console.error("Error saving experience item:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteUserExperience = async (req, res) => {
  const userId = req.user.id;
  const { experienceId } = req.params;

  try {
    const mongoose = require("mongoose");
    if (!mongoose.Types.ObjectId.isValid(experienceId)) {
      return res.status(400).json({ message: "Invalid experience ID" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $pull: { experience: { _id: new mongoose.Types.ObjectId(experienceId) } } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found or experience not found" });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error("Error deleting experience:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.reorderUserExperience = async (req, res) => {
  const userId = req.user.id;
  const { experience } = req.body;

  try {
    if (!Array.isArray(experience)) {
      return res.status(400).json({ error: "Experience must be an array" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const orderMap = new Map();
    experience.forEach((e, index) => {
      if (e._id) orderMap.set(e._id.toString(), index);
    });

    user.experience.sort((a, b) => {
      const indexA = orderMap.has(a._id.toString()) ? orderMap.get(a._id.toString()) : 9999;
      const indexB = orderMap.has(b._id.toString()) ? orderMap.get(b._id.toString()) : 9999;
      return indexA - indexB;
    });

    await user.save();
    res.json(user);
  } catch (error) {
    console.error("Error reordering experience:", error);
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 5. Education Management
// ==========================================
exports.saveUserEducationItem = async (req, res) => {
  const userId = req.user.id;
  const item = req.body;

  try {
    const educationObj = sanitizeObjectStrings({
      school: item.school ? item.school.trim().substring(0, 100) : "",
      degree: item.degree ? item.degree.trim().substring(0, 100) : "",
      field: item.field ? item.field.trim().substring(0, 100) : "",
      startYear: item.startYear ? item.startYear.trim().substring(0, 20) : "",
      endYear: item.endYear ? item.endYear.trim().substring(0, 20) : "",
    });

    if (item._id) {
      educationObj._id = item._id;
      const updatedUser = await User.findOneAndUpdate(
        { _id: userId, "education._id": item._id },
        { $set: { "education.$": educationObj } },
        { new: true }
      );
      if (!updatedUser) return res.status(404).json({ message: "User or Education item not found" });
      res.json(updatedUser);
    } else {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (user.education && user.education.length >= 10) {
        return res.status(400).json({ error: "Maximum limit of 10 education items reached" });
      }

      user.education.push(educationObj);
      await user.save();
      res.json(user);
    }
  } catch (error) {
    console.error("Error saving education item:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteUserEducation = async (req, res) => {
  const userId = req.user.id;
  const { educationId } = req.params;

  try {
    const mongoose = require("mongoose");
    if (!mongoose.Types.ObjectId.isValid(educationId)) {
      return res.status(400).json({ message: "Invalid education ID" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $pull: { education: { _id: new mongoose.Types.ObjectId(educationId) } } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found or education item not found" });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error("Error deleting education:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.reorderUserEducation = async (req, res) => {
  const userId = req.user.id;
  const { education } = req.body;

  try {
    if (!Array.isArray(education)) {
      return res.status(400).json({ error: "Education must be an array" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const orderMap = new Map();
    education.forEach((e, index) => {
      if (e._id) orderMap.set(e._id.toString(), index);
    });

    user.education.sort((a, b) => {
      const indexA = orderMap.has(a._id.toString()) ? orderMap.get(a._id.toString()) : 9999;
      const indexB = orderMap.has(b._id.toString()) ? orderMap.get(b._id.toString()) : 9999;
      return indexA - indexB;
    });

    await user.save();
    res.json(user);
  } catch (error) {
    console.error("Error reordering education:", error);
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 6. Certificates Management
// ==========================================
exports.saveUserCertificateItem = async (req, res) => {
  const userId = req.user.id;
  const item = req.body;

  try {
    let imageUrl = item.cfimage ? item.cfimage.trim().substring(0, 1000) : "";
    let oldImageUrlToDelete = null;

    if (req.file) {
      if (req.file.size > 2 * 1024 * 1024) {
        const fs = require("fs");
        try { fs.unlinkSync(req.file.path); } catch (e) {}
        return res.status(400).json({ error: "File size exceeds 2MB" });
      }

      const uploaded = await cloudinary.uploader.upload(req.file.path, {
        folder: "certificates",
      });
      imageUrl = uploaded.secure_url;

      const fs = require("fs");
      try {
        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (e) {}
    }

    const certObj = sanitizeObjectStrings({
      title: item.title ? item.title.trim().substring(0, 100) : "",
      description: item.description ? item.description.trim().substring(0, 200) : "",
      cfimage: imageUrl,
    });

    if (item._id) {
      certObj._id = item._id;

      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const oldCert = user.certificates.id(item._id);

      if (oldCert && oldCert.cfimage && oldCert.cfimage !== certObj.cfimage) {
        oldImageUrlToDelete = oldCert.cfimage;
      }

      const updatedUser = await User.findOneAndUpdate(
        { _id: userId, "certificates._id": item._id },
        { $set: { "certificates.$": certObj } },
        { new: true }
      );

      if (!updatedUser) return res.status(404).json({ message: "User or Certificate not found" });

      if (oldImageUrlToDelete) {
        await deleteCloudinaryImage(oldImageUrlToDelete);
      }

      return res.json(updatedUser);
    } else {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (user.certificates && user.certificates.length >= 10) {
        return res.status(400).json({ error: "Maximum limit of 10 certificates reached" });
      }

      user.certificates.push(certObj);
      await user.save();
      return res.json(user);
    }
  } catch (error) {
    if (req.file && req.file.path) {
      const fs = require("fs");
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    console.error("Error saving certificate item:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.deleteUserCertificate = async (req, res) => {
  const userId = req.user.id;
  const { certificateId } = req.params;

  try {
    const mongoose = require("mongoose");
    if (!mongoose.Types.ObjectId.isValid(certificateId)) {
      return res.status(400).json({ message: "Invalid certificate ID" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const certificate = user.certificates.id(certificateId);
    if (certificate?.cfimage) {
      await deleteCloudinaryImage(certificate.cfimage);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $pull: { certificates: { _id: new mongoose.Types.ObjectId(certificateId) } } },
      { new: true }
    );

    res.json(updatedUser);
  } catch (error) {
    console.error("Error deleting certificate:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.reorderUserCertificates = async (req, res) => {
  const userId = req.user.id;
  const { certificates } = req.body;

  try {
    if (!Array.isArray(certificates)) {
      return res.status(400).json({ error: "Certificates must be an array" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const orderMap = new Map();
    certificates.forEach((c, index) => {
      if (c._id) orderMap.set(c._id.toString(), index);
    });

    user.certificates.sort((a, b) => {
      const indexA = orderMap.has(a._id.toString()) ? orderMap.get(a._id.toString()) : 9999;
      const indexB = orderMap.has(b._id.toString()) ? orderMap.get(b._id.toString()) : 9999;
      return indexA - indexB;
    });

    await user.save();
    res.json(user);
  } catch (error) {
    console.error("Error reordering certificates:", error);
    res.status(500).json({ error: error.message });
  }
};
