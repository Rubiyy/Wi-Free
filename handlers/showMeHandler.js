const { AdminMessage } = require('../models');
const { formatDate } = require('../utils');
const moment = require('moment');

// Show me command handler
const showMeHandler = async (ctx) => {
  try {
    const user = ctx.user;
    
    // Check if user can use the "show me" function
    if (!user.canUseShowMe()) {
      const lastUsed = moment(user.showMeUsage.lastUsed);
      const nextAvailable = lastUsed.add(24, 'hours');
      const timeLeft = moment.duration(nextAvailable.diff(moment()));
      
      const hours = Math.floor(timeLeft.asHours());
      const minutes = Math.floor(timeLeft.asMinutes()) % 60;
      
      return await ctx.reply(
        `⏳ You've already used the "Show Me" feature in the last 24 hours.\n\n` +
        `You can use it again in ${hours} hours and ${minutes} minutes.\n\n` +
        `Want unlimited access? Check out our subscription plans with the "Buy Plan 💰" button!`
      );
    }
    
    // Get active message from database
    const adminMessage = await AdminMessage.getActiveMessage();
    
    if (!adminMessage) {
      return await ctx.reply('No message has been set by the admin yet.');
    }
    
    // Record usage
    await user.recordShowMeUsage();
    
    // Format message with time
    const formattedMessage = 
      `📬 Here's today's message:\n\n` +
      `${adminMessage.message}\n\n` +
      `Last updated: ${formatDate(adminMessage.updatedAt)}`;
    
    await ctx.reply(formattedMessage);
    
    // If user doesn't have an active plan, remind them about the 24-hour limit
    if (!user.plan.isActive) {
      await ctx.reply(
        `📝 Note: You can use the "Show Me" command once every 24 hours.\n\n` +
        `For unlimited access, check out our subscription plans with the "Buy Plan 💰" button!`
      );
    }
  } catch (error) {
    console.error('Error in show me handler:', error);
    await ctx.reply('Sorry, something went wrong. Please try again later.');
  }
};

module.exports = showMeHandler; 