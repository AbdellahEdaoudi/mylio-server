const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fullname: String,
  email: { type: String, unique: true, required: true },
  username: {type:String,unique:true,sparse:true},
  phoneNumber: String,
  country: String,
  category: String,
  urlimage: String,
  displayEmail: String,
  bgcolorp: String,
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
    default: ["services", "experience", "skills", "projects", "education", "certificates", "languages"]
  },
  theme: Number,
  displayLanguage: {
    type: String,
    default: "en",
  },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
