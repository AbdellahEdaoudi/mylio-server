const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Contacte = require("../models/Contacte");
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

// Register
exports.register = async (req, res) => {
  try {
    const { username, password, fullname } = req.body;
    if (!username || !password || !fullname) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const cleanUsername = sanitizeUsername(username);

    if (!cleanUsername || cleanUsername.length < 3) {
      return res.status(400).json({
        message: "Username must be at least 3 characters (letters, numbers, and hyphens only)",
      });
    }

    if (RESERVED_USERNAMES.includes(cleanUsername)) {
      return res.status(400).json({ message: "This username is reserved and cannot be used" });
    }

    const existingUser = await User.findOne({
      $or: [
        { username: cleanUsername },
        { username: cleanUsername.replace(/-/g, "_") },
        { username: cleanUsername.replace(/_/g, "-") },
      ],
    });
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username: cleanUsername,
      fullname: fullname.trim().substring(0, 50),
      password: hashedPassword,
      role: "user",
    });

    await newUser.save();
    res.status(201).json({
      message: "User registered successfully",
    });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const rawUsername = String(username).toLowerCase().trim();
    const cleanUsername = sanitizeUsername(username);

    // Support both hyphenated slug and legacy underscore username
    const user = await User.findOne({
      $or: [
        { username: cleanUsername },
        { username: rawUsername },
        { username: rawUsername.replace(/-/g, "_") },
        { username: rawUsername.replace(/_/g, "-") },
      ],
    }).select("+password").lean();
    if (!user || !user.password) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    delete user.password;

    const accessToken = jwt.sign(
      { id: user._id, email: user.email, username: user.username, role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "3d" }
    );
    const refreshToken = jwt.sign(
      { id: user._id, email: user.email, username: user.username, role: user.role },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
    });

    const [contacts, payment] = await Promise.all([
      Contacte.find({ user: user._id })
        .populate("user", "fullname username email urlimage")
        .populate("messages.sender", "fullname username email urlimage role")
        .sort({ updatedAt: -1 })
        .select("-__v")
        .lean(),
      Payment.findOne({ user: user._id, status: "ACTIVE" })
        .select("-__v")
        .lean(),
    ]);

    const data = {
      user,
      contacts,
      payment,
    };

    res.status(200).json({
      message: "Login successful",
      data,
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
};

// Refresh Access Token
exports.refresh = (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ message: "No refresh token provided" });
  }
  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          message: "Refresh token expired",
        });
      }
      return res.status(401).json({
        message: "Invalid refresh token",
      });
    }
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, username: user.username, role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1d" }
    );
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
    });
    res.json({ accessToken });
  });
};

// Logout
exports.logout = (req, res) => {
  res.clearCookie("accessToken", { httpOnly: true, secure: true, sameSite: "None" });
  res.clearCookie("refreshToken", { httpOnly: true, secure: true, sameSite: "None" });
  res.json({ message: "Cookie cleared" });
};
