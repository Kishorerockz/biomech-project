const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/biomech";
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    console.log(`✅  MongoDB connected → ${mongoose.connection.host}`);
  } catch (err) {
    console.warn("⚠️  MongoDB connection failed (running in memory/no-DB mode):", err.message);
  }
}

module.exports = connectDB;

