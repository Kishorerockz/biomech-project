const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/biomech";
  try {
    await mongoose.connect(uri);
    console.log(`✅  MongoDB connected → ${mongoose.connection.host}`);
  } catch (err) {
    console.error("❌  MongoDB connection error:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
