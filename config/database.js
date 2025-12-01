const mongoose = require('mongoose');
require('dotenv').config();

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/flash_tans';

const connectWithRetry = async (retries = 10, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(mongoURI);
      console.log('MongoDB connected successfully');
      return;
    } catch (error) {
      console.error(`MongoDB connection attempt ${i + 1} failed:`, error.message);
      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error('Failed to connect to MongoDB after multiple attempts. Exiting.');
  process.exit(1);
};

const initDatabase = async () => {
  await connectWithRetry();
};

module.exports = { initDatabase };

