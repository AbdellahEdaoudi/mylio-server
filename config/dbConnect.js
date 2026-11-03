const mongoose = require("mongoose");
const dns = require("dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

exports.connectDB = async () => {
    try {
        mongoose.set('strictQuery', true);
        const mongoUri = process.env.MONGODB_ATLAS || process.env.MONGO_URL;
        if (!mongoUri) {
            throw new Error("MongoDB connection URI is missing from environment variables");
        }
        await mongoose.connect(mongoUri);
        console.log(`Connected to MongoDB Atlas`);
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
};
