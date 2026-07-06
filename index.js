require('dotenv').config();
const express = require("express");
const app = express();
const PORT = 9999;
const path = require("path")
const generalController = require("./controllers/general.controller");
const cors = require('cors');
const { connectDB } = require('./config/dbConnect');
const { corsOption } = require(path.join(__dirname, 'config', 'corsOptions'));
const cookiesParser = require("cookie-parser");
const isAuthenticated = require('./middlewares/isAuthenticated');



// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// Connect to Database
connectDB()
app.use(cors(corsOption));
app.use(cookiesParser())
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// General Route
app.get("/alldata", isAuthenticated, generalController.getAllData);
app.get("/last-updated", isAuthenticated, generalController.getLastUpdated);
app.get("/last-updated/username/:username", generalController.getUserLastUpdated);
app.use('/users', require('./routes/userRoutes'));
app.use('/users', require('./routes/user/projects.routes'));
app.use('/users', require('./routes/user/experience.routes'));
app.use('/users', require('./routes/user/education.routes'));
app.use('/users', require('./routes/user/certificates.routes'));
app.use('/links', require('./routes/linksRoutes'));
app.use('/contacts', require('./routes/contactsRoutes'));
app.use('/admin', require('./routes/adminRoutes'));
app.use('/api/payment', require('./routes/PaymentRoutes'));
// Serve Static Files and Handle 404
app.use("/", express.static(path.join(__dirname, "public")));
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, "./Views/index.html")) })
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