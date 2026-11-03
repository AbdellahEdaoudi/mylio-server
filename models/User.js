const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fullname: {
    type: String,
    required: [true, "Full name is required"],
    trim: true,
    maxlength: [50, "Full name cannot exceed 50 characters"],
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [100, "Email cannot exceed 100 characters"],
    default: "",
  },
  username: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
    lowercase: true,
    index: true,
    maxlength: [30, "Username cannot exceed 30 characters"],
  },
  password: {
    type: String,
    trim: true,
    select: false,
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
    index: true,
  },
  phoneNumber: String,
  location: String,
  category: String,
  urlimage: {
    type: String,
    default: "https://res.cloudinary.com/dssrnghtr/image/upload/v1761258566/dgmlr4uuim5swutkp6a8.png",
  },
  bgcolor: {
    type: String,
    default: "#1f2937",
  },
  about: String,
  languages: [String],
  services: [String],
  skills: [String],
  education: [
    {
      school: String,
      degree: String,
      field: String,
      startYear: String,
      endYear: String,
    },
  ],
  experience: [
    {
      company: String,
      role: String,
      description: String,
      startDate: String,
      endDate: String,
    },
  ],
  projects: [
    {
      title: String,
      description: String,
      link: String,
      image: String,
      technologies: [String],
      startDate: String,
      endDate: String,
    },
  ],
  certificates: [
    {
      title: String,
      description: String,
      cfimage: String,
    },
  ],
  socials: {
    github: String,
    linkedin: String,
    facebook: String,
    instagram: String,
    twitter: String,
    youtube: String,
    telegram: String,
    snapchat: String,
    whatsapp: String,
    tiktok: String,
    reddit: String,
    twitch: String,
  },
  sectionOrder: {
    type: [String],
    default: ["services", "experience", "skills", "projects", "education", "certificates", "languages"],
  },
  theme: {
    type: Number,
    default: 1,
  },
  displayLanguage: {
    type: String,
    default: "en",
  },
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
