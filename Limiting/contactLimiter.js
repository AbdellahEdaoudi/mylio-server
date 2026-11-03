const rateLimit = require("express-rate-limit");

exports.contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 30, // Limit each IP to 30 message/reply actions per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    default: true,
  },
  message: {
    message: "Too many messages sent from this IP. Please try again after 15 minutes.",
  },
});
