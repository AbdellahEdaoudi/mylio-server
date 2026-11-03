const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const fs = require("fs");

const mongoose = require("mongoose");
const User = require("./models/User");

async function seedAdam() {
  try {
    const mongoUri = process.env.MONGODB_ATLAS || process.env.MONGO_URL;
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    const rawData = fs.readFileSync(path.join(__dirname, "../front/public/adam.json"), "utf8");
    const adam = JSON.parse(rawData);

    // Clean MongoDB BSON format artifacts from JSON
    const cleanSubdocs = (arr) => {
      if (!Array.isArray(arr)) return [];
      return arr.map(item => {
        const copy = { ...item };
        delete copy._id;
        delete copy.__v;
        return copy;
      });
    };

    const userData = {
      fullname: adam.fullname || "Adam Carter",
      email: adam.email || "adam.carter.dev@gmail.com",
      username: (adam.username || "adam-carter").toLowerCase(),
      phoneNumber: adam.phoneNumber || "",
      location: adam.location || "Canada",
      category: adam.category || "Software Developer",
      urlimage: adam.urlimage || "https://res.cloudinary.com/dvq120lcn/image/upload/v1725826386/opwxdb0gip8jirbae5ff.jpg",
      about: adam.about || "",
      bgcolor: adam.bgcolor || "#050f15",
      theme: adam.theme || 1,
      displayLanguage: adam.displayLanguage || "en",
      languages: adam.languages || [],
      services: adam.services || [],
      skills: adam.skills || [],
      education: cleanSubdocs(adam.education),
      experience: cleanSubdocs(adam.experience),
      projects: cleanSubdocs(adam.projects),
      certificates: cleanSubdocs(adam.certificates),
      socials: adam.socials || {},
      sectionOrder: adam.sectionOrder || ["services", "experience", "skills", "projects", "education", "certificates", "languages"],
      role: "user"
    };

    const existingUser = await User.findOne({ username: userData.username });
    if (existingUser) {
      await User.updateOne({ username: userData.username }, { $set: userData });
      console.log(`Updated existing user: ${userData.username}`);
    } else {
      await User.create(userData);
      console.log(`Created new user: ${userData.username}`);
    }

    const verify = await User.findOne({ username: userData.username }).lean();
    console.log("Verification succeeded for user:", {
      _id: verify._id,
      username: verify.username,
      fullname: verify.fullname,
      location: verify.location,
      category: verify.category,
      projectsCount: verify.projects?.length,
      experienceCount: verify.experience?.length
    });

  } catch (err) {
    console.error("Error seeding Adam Carter:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

seedAdam();
