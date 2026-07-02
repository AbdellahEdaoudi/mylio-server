require('dotenv').config();
const mongoose = require('mongoose');
const Payment = require('./models/Payment');
const User = require('./models/User');

async function Script() {
  const email = "abdellahedaoudi800@gmail.com";
  try {
    await mongoose.connect(process.env.MONGODB_ATLAS);
    console.log('Connected to MongoDB');
    const userData = {
      username: "abdellah-edaoudi",
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
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

Script();