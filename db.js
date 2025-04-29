const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Set up database cleanup for expired plans
    setupDatabaseCleanup();
    
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

// Function to clean up expired plans
const setupDatabaseCleanup = () => {
  const User = require('./models/user');
  
  // Run cleanup every hour
  setInterval(async () => {
    try {
      console.log('Running database cleanup...');
      
      // Get date 12 hours ago
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - 12);
      
      // Find all users with expired plans
      const users = await User.find({
        'plan.isActive': true,
        'plan.endDate': { $lt: cutoffDate }
      });
      
      // Update each user's plan to inactive
      for (const user of users) {
        user.plan.isActive = false;
        await user.save();
        console.log(`Deactivated expired plan for user: ${user.chatId}`);
      }
      
      // Reset usedToday flag at midnight
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() < 10) { // Run close to midnight
        await User.updateMany({}, { 'showMeUsage.usedToday': false });
        console.log('Reset usedToday flag for all users');
      }
      
      console.log('Database cleanup completed');
    } catch (error) {
      console.error(`Error during database cleanup: ${error.message}`);
    }
  }, 60 * 60 * 1000); // Run every hour
};

module.exports = connectDB; 