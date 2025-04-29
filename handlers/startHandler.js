const { mainMenuKeyboard, adminMenuKeyboard } = require('../keyboards');

// Start command handler
const startHandler = async (ctx) => {
  try {
    const userName = ctx.from.first_name || 'there';
    
    let welcomeMessage = `👋 Welcome to Wi-FREE, ${userName}!\n\n`;
    welcomeMessage += `I'm your internet connection assistant. You can view the daily access token or check out our subscription plans.\n\n`;
    welcomeMessage += `Use the menu below to navigate:`;
    
    // Show appropriate keyboard based on user type
    if (ctx.isAdmin) {
      await ctx.reply(welcomeMessage, mainMenuKeyboard);
      await ctx.reply('🔐 Admin menu is also available:', adminMenuKeyboard);
    } else {
      await ctx.reply(welcomeMessage, mainMenuKeyboard);
    }
  } catch (error) {
    console.error('Error in start handler:', error);
    await ctx.reply('Sorry, something went wrong. Please try again later.');
  }
};

module.exports = startHandler; 