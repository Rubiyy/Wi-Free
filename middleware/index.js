const { getOrCreateUser, isAdmin } = require('../utils');

// Middleware to track users
const trackUserMiddleware = async (ctx, next) => {
  try {
    // Skip if not a message or callback query
    if (!ctx.message && !ctx.callbackQuery) {
      return next();
    }
    
    // Get or create user in database
    ctx.user = await getOrCreateUser(ctx);
    
    // Add isAdmin flag to context
    ctx.isAdmin = isAdmin(ctx);
    
    return next();
  } catch (error) {
    console.error('Error in tracking user middleware:', error);
    return next();
  }
};

// Middleware to log bot interactions
const loggerMiddleware = (ctx, next) => {
  const now = new Date();
  const userInfo = ctx.from ? 
    `${ctx.from.first_name} (ID: ${ctx.from.id})` : 
    'Unknown user';
    
  const messageType = ctx.updateType || 'unknown';
  const messageContent = ctx.message?.text || 
    ctx.callbackQuery?.data || 
    'No content';
    
  console.log(`[${now.toISOString()}] ${userInfo} - ${messageType}: ${messageContent}`);
  
  return next();
};

module.exports = {
  trackUserMiddleware,
  loggerMiddleware
}; 