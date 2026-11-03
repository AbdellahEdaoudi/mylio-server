const multer = require("multer");

const fileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

// Disk storage for temporary local file operations
const diskStorage = multer.diskStorage({
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const cleanOriginalName = (file.originalname || "image.png").replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, uniqueSuffix + "-" + cleanOriginalName);
  },
});

const diskUpload = multer({
  storage: diskStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter,
});

// Memory storage for direct in-memory streaming to Cloudinary (e.g. messages & contacts)
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter,
});

// Backward-compatible exports:
// 1. const upload = require("../utils/multer");
// 2. const { memoryUpload, diskUpload } = require("../utils/multer");
diskUpload.diskUpload = diskUpload;
diskUpload.memoryUpload = memoryUpload;
diskUpload.upload = diskUpload;

module.exports = diskUpload;
