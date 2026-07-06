// controller/general.controller.js
const User = require("../models/User");
const Links = require("../models/Links");
const Contacte = require("../models/Contacte");
const Payment = require("../models/Payment");

exports.getAllData = async (req, res) => {
  try {
    const email = req.user?.email;

    const finduser = await User.findOne({ email });
    if (!finduser) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    const [users, links, contacts, payment] = await Promise.all([
      User.findOne({ email })
        .select("-updatedAt -createdAt -__v")
        .lean(),

      Links.find({ useremail: email })
        .select("-createdAt -updatedAt -__v")
        .lean(),

      Contacte.find({ email })
        .select("-updatedAt -__v")
        .lean(),

      Payment.findOne({ useremail: email, status: "ACTIVE" })
        .select("-createdAt -updatedAt -__v")
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      users,
      links,
      contacts,
      payment
    });
  } catch (error) {
    console.error("Error in getAllData:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getLastUpdated = async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const [user, links, contacts, payment] = await Promise.all([
      User.findOne({ email }).select("updatedAt").lean(),
      Links.findOne({ useremail: email }).sort({ updatedAt: -1 }).select("updatedAt").lean(),
      Contacte.findOne({ email }).sort({ updatedAt: -1 }).select("updatedAt").lean(),
      Payment.findOne({ useremail: email }).sort({ updatedAt: -1 }).select("updatedAt").lean(),
    ]);

    const dates = [
      user?.updatedAt,
      links?.updatedAt,
      contacts?.updatedAt,
      payment?.updatedAt
    ].filter(Boolean).map(d => new Date(d).getTime());

    const lastUpdated = dates.length > 0 ? Math.max(...dates) : null;

    res.status(200).json({
      success: true,
      lastUpdated
    });
  } catch (error) {
    console.error("Error in getLastUpdated:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getUserLastUpdated = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).select("email updatedAt").lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    const email = user.email;

    const [links, payment] = await Promise.all([
      Links.findOne({ useremail: email }).sort({ updatedAt: -1 }).select("updatedAt").lean(),
      Payment.findOne({ useremail: email }).sort({ updatedAt: -1 }).select("updatedAt").lean(),
    ]);

    const dates = [
      user?.updatedAt,
      links?.updatedAt,
      payment?.updatedAt
    ].filter(Boolean).map(d => new Date(d).getTime());

    const lastUpdated = dates.length > 0 ? Math.max(...dates) : null;

    res.status(200).json({
      success: true,
      lastUpdated
    });
  } catch (error) {
    console.error("Error in getUserLastUpdated:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

