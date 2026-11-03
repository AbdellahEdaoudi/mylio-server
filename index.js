require('dotenv').config();
const express = require("express");
const app = express();
const path = require("path");
const cors = require('cors');
const cookieParser = require("cookie-parser");
const { connectDB } = require('./config/dbConnect');
const { corsOption } = require(path.join(__dirname, 'config', 'corsOptions'));

const PORT = process.env.PORT || 9999;

// Security: Disable X-Powered-By header to prevent server fingerprinting
app.disable("x-powered-by");

// Enable trust proxy for reverse proxies (Vercel, Render, Heroku, Nginx, Cloudflare)
app.set("trust proxy", 1);

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Connect to Database
connectDB();

// Global Middlewares
app.use(cors(corsOption));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Serve Static Files
app.use("/", express.static(path.join(__dirname, "public")));

// Application Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/contacts', require('./routes/contactsRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/payment', require('./routes/PaymentRoutes'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, "Views", "index.html"));
});

// 404 Route Handler
app.all("*", (req, res) => {
  res.status(404);
  if (req.accepts("html")) {
    res.sendFile(path.join(__dirname, "Views", "404.html"));
  } else if (req.accepts("json")) {
    res.json({ message: "404 Not Found" });
  } else {
    res.type("txt").send("404 Not Found");
  }
});

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err.message || err);
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || "An unexpected error occurred",
  });
});

// Start the server (listening after all middlewares and routes are registered)
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
