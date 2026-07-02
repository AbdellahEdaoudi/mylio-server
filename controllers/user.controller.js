const User = require('../models/User');
const Links = require('../models/Links');
const cloudinary = require("../utils/cloudinary");
const sanitizeHtml = require('sanitize-html');
const sanitizeObjectStrings = require('../utils/sanitizeObject');
const Payment = require('../models/Payment');
const { sendEmail, welcomeTemplate } = require('../utils/emailService');

const capitalizeWords = (str) => {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\s+/g, ' ');
};

const processImageUpload = async (file) => {
  if (file.size > 200 * 1024) {
    const fs = require('fs');
    fs.unlinkSync(file.path);
    const err = new Error("Image size must not exceed 200KB");
    err.status = 400;
    throw err;
  }

  const up = await cloudinary.uploader.upload(file.path, {
    folder: "User_Images"
  });

  return up.secure_url;
};

// Helper to delete an image from Cloudinary
const deleteCloudinaryImage = async (urlimage) => {
  if (!urlimage || urlimage.includes('dgmlr4uuim5swutkp6a8')) return; // skip default image
  try {
    const urlParts = urlimage.split('/');
    const versionIndex = urlParts.findIndex(part => part.startsWith('v') && !isNaN(part.substring(1)));
    if (versionIndex !== -1) {
      const publicIdWithExt = urlParts.slice(versionIndex + 1).join('/');
      const publicId = publicIdWithExt.split('.')[0];
      await cloudinary.uploader.destroy(publicId);
    } else {
      const publicId = urlimage.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (err) {
    console.error("Error deleting image from Cloudinary:", err);
  }
};

// Create user
exports.createUser = async (req, res) => {
  if (!req.user?.email) {
    return res.status(403).json({ message: "Forbidden" });
  }
  const existingUser = await User.findOne({ email: req.user?.email }).select("-__v").lean();
  if (existingUser) {
    return res.status(200).json({
      message: "User already exists",
      user: existingUser,
    });
  }
  const userData = {
    fullname: req.user?.fullname,
    email: req.user?.email,
    urlimage: "https://res.cloudinary.com/dssrnghtr/image/upload/v1761258566/dgmlr4uuim5swutkp6a8.png",
    bgcolorp: "#1f2937",
    username: req.user?.email
      ?.split("@")[0]
      .replace(/[.\s/]/g, "")
      .toLowerCase()
      .substring(0, 30),
    theme: 1,
  };
  if (userData.username) {
    let finalUsername = userData.username;
    let counter = 1;
    while (await User.exists({ username: finalUsername })) {
      finalUsername = `${userData.username}${counter}`;
      counter++;
    }
    userData.username = finalUsername;
  }

  try {
    const newUser = await User.create(userData);
    try {
      const emailContent = welcomeTemplate(newUser.username || newUser.fullname);
      await sendEmail(newUser.email, "Welcome to DGT Portfolio!", emailContent);
    } catch (emailError) {
      console.error("Error sending welcome email:", emailError);
    }

    return res.status(201).json(newUser);
  } catch (error) {
    console.error("Error creating user:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

// Update user info
exports.UpUserInfo = async (req, res) => {
  const { email } = req.user;

  try {
    const allowedFields = ["fullname", "username", "phoneNumber", "country", "category", "displayEmail"];
    const userData = {};
    allowedFields.forEach((f) => {
      if (req.body[f]) {
        userData[f] = req.body[f].trim().substring(0, 100);
      }
    });
    sanitizeObjectStrings(userData);
    if (userData.fullname) {
      userData.fullname = userData.fullname.substring(0, 50);
    }
    if (userData.username) {
      userData.username = userData.username.replace(/[.\s/]/g, "")
        .toLowerCase()
        .substring(0, 30);
      const existingUser = await User.exists({
        username: userData.username,
        email: { $ne: email }
      });
      if (existingUser)
        return res.status(400).json({ error: "Username already exists" });
      }

    const updatedUser = await User.findOneAndUpdate(
      { email },
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
  const { email } = req.user;
  
  try {
    let urlimage;
    let oldImageUrlToDelete = null;
    const currentUser = await User.findOne({ email }).select("urlimage").lean();
    
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

    const updatedUser = await User.findOneAndUpdate(
      { email },
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
  const { email } = req.user;
  try {
    let { about } = req.body;

    if (typeof about === "string") {
      about = sanitizeHtml(about.trim()).substring(0, 500);
    } else {
      return res.status(400).json({ error: "Invalid 'about' field" });
    }

    const updatedUser = await User.findOneAndUpdate(
      { email },
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
  const { email } = req.user;

  try {
    let { bgcolorp } = req.body;

    if (typeof bgcolorp === "string") {
      bgcolorp = sanitizeHtml(bgcolorp.trim()).substring(0, 50);
    } else {
      return res.status(400).json({ error: "Invalid 'bgcolorp' field" });
    }
    const updatedUser = await User.findOneAndUpdate(
      { email },
      { $set: { bgcolorp } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating bgcolorp:", error);
    res.status(500).json({ error: error.message });
  }
};
exports.UpUserLanguages = async (req, res) => {
  const { email } = req.user;

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
    languages = languages.map(lang => {
      if (typeof lang === "string") {
        return lang.trim().substring(0, 50);
      }
      return "";
    }).filter(lang => lang);
    sanitizeObjectStrings(languages);

    const updatedUser = await User.findOneAndUpdate(
      { email },
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
  const { email } = req.user;

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
    services = services.map(serv => {
      if (typeof serv === "string") {
        return serv.trim().substring(0, 150);
      }
      return "";
    }).filter(serv => serv);
    sanitizeObjectStrings(services);

    const updatedUser = await User.findOneAndUpdate(
      { email },
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
  const { email } = req.user;

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
    skills = skills.map(skil => {
      if (typeof skil === "string") {
        return skil.trim().substring(0, 130);
      }
      return "";
    }).filter(skil => skil);
    sanitizeObjectStrings(skills);

    const updatedUser = await User.findOneAndUpdate(
      { email },
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
  const { email } = req.user;

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

    const updatedUser = await User.findOneAndUpdate(
      { email },
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
  const { email } = req.user;

  try {
    let { theme } = req.body;

    if (theme === undefined || typeof theme !== "number") {
      return res.status(400).json({ error: "'theme' must be a number" });
    }
    theme = String(theme).trim().substring(0, 20);
    const updatedUser = await User.findOneAndUpdate(
      { email },
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
  const { email } = req.user;

  try {
    let { displayLanguage } = req.body;

    if (!displayLanguage || typeof displayLanguage !== "string") {
      return res.status(400).json({ error: "'displayLanguage' must be a string" });
    }

    const updatedUser = await User.findOneAndUpdate(
      { email },
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
  const { email } = req.user;

  try {
    let { sectionOrder } = req.body;

    if (!sectionOrder || !Array.isArray(sectionOrder)) {
      return res.status(400).json({ error: "'sectionOrder' must be an array" });
    }

    // Validate that items are strings (and maybe specific allowed values if needed)
    sectionOrder = sectionOrder.filter(item => typeof item === 'string');

    const updatedUser = await User.findOneAndUpdate(
      { email },
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

// Get user by username
exports.getUserByUsername = async (req, res) => {
  const { username } = req.params;
  const user = await User.findOne({ username }).select("-__v").lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
  const createdAt = new Date(user.createdAt);
  const thirtyDaysLater = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const now = new Date();
  const isWithin30Days = thirtyDaysLater > now;

  if (isWithin30Days) {
    const links = await Links.find({ useremail: user.email }).select("namelink link").lean();
    return res.status(200).json({
      status: 200,
      user,
      links,
    });
  }
  const payment = await Payment.findOne({ useremail: user.email, status: "ACTIVE" }).lean();
  if (!payment) {
    return res.status(404).json({ message: "No payment found for this user", email: user.email });
  }
  if (payment.status !== "ACTIVE") {
    return res.status(403).json({ message: "Your payment is not active. Please complete payment." });
  }
  const links = await Links.find({ useremail: user.email }).select("namelink link").lean();
  res.status(200).json({
    status: 200,
    user,
    links,
  });
};
// Get user by custom domain
exports.getUserByCustomDomain = async (req, res) => {
  const { customDomain } = req.params;
  const user = await User.findOne({ customDomainVerified: true, customDomain }).select("-__v").lean();
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  const createdAt = new Date(user.createdAt);
  const thirtyDaysLater = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const now = new Date();
  const isWithin30Days = thirtyDaysLater > now;

  if (isWithin30Days) {
    const links = await Links.find({ useremail: user.email }).select("namelink link").lean();
    return res.status(200).json({
      status: 200,
      user,
      links,
    });
  }
  const payment = await Payment.findOne({ useremail: user.email, status: "ACTIVE" }).lean();
  if (!payment) {
    return res.status(404).json({ message: "No payment found for this user", email: user.email });
  }
  if (payment.status !== "ACTIVE") {
    return res.status(403).json({ message: "Your payment is not active. Please complete payment." });
  }
  const links = await Links.find({ useremail: user.email }).select("namelink link").lean();
  res.status(200).json({
    status: 200,
    user,
    links,
  });
};
// Get user metadata by username
exports.getUserByUsernameMeta = async (req, res) => {
  const { username } = req.params;
  try {
    const user = await User.findOne({ username })
      .select("fullname username urlimage category displayLanguage").lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get user metadata by custom domain
exports.getUserByCustomDomainMeta = async (req, res) => {
  const { customDomain } = req.params;
  try {
    const user = await User.findOne({ customDomainVerified: true, customDomain })
    .select("fullname username urlimage category displayLanguage").lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all usernames for sitemap (including custom domains)
exports.getActiveUsernames = async (req, res) => {
  try {
    // Get all users that have a username
    const allUsers = await User.find({
      username: { $exists: true, $ne: "" }
    })
      .select("username customDomain customDomainVerified")
      .lean();

    // Extract usernames and custom domains
    const usernames = allUsers.map(user => user.username);
    const customDomains = allUsers
      .filter(user => user.customDomain && user.customDomainVerified)
      .map(user => ({
        username: user.username,
        customDomain: user.customDomain
      }));

    res.json({ usernames, customDomains });
  } catch (error) {
    console.error("Error fetching usernames:", error);
    res.status(500).json({ error: error.message });
  }
};
