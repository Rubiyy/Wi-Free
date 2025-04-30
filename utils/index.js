const moment = require('moment');
const { User } = require('../models');

// Get device information from Telegram message
const getDeviceInfo = (ctx) => {
  const forwardedFor = ctx.message?.from?.forwardedFor || '';
  const userAgent = ctx.message?.from?.userAgent || '';
  
  return {
    ip: forwardedFor.split(',')[0]?.trim() || 'unknown',
    userAgent: userAgent || 'unknown',
    fingerprint: `${ctx.from.id}_${forwardedFor}_${userAgent}`.replace(/\s+/g, '')
  };
};

// Format date
const formatDate = (date) => {
  return moment(date).format('MMMM D, YYYY h:mm A');
};

// Get or create user
const getOrCreateUser = async (ctx) => {
  const chatId = ctx.from.id.toString();
  let user = await User.findOne({ chatId });
  
  if (!user) {
    user = new User({
      chatId,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      deviceInfo: getDeviceInfo(ctx)
    });
    await user.save();
  }
  
  // Update device info if changed
  const deviceInfo = getDeviceInfo(ctx);
  if (
    user.deviceInfo.ip !== deviceInfo.ip ||
    user.deviceInfo.userAgent !== deviceInfo.userAgent
  ) {
    user.deviceInfo = deviceInfo;
    await user.save();
  }
  
  // Check if plan is expired
  await user.checkPlanExpiration();
  
  return user;
};

// Check if user is admin
const isAdmin = (ctx) => {
  const adminChatId = process.env.ADMIN_CHAT_ID;
  return ctx.from.id.toString() === adminChatId;
};

// Get plan details
const getPlanDetails = (planType) => {
  const plans = {
    '15GB-1day': {
      name: '15GB Daily Surf',
      description: 'Stay connected all day without breaking the bank!',
      data: '15GB',
      duration: '1 Day',
      speed: '20Mbps',
      usage: 'Stream, download, and scroll all day',
      dependency: 'EEDC server dependency',
      price: 'N200 / day',
      durationDays: 1,
      amount: 200
    },
    '3days-unlimited': {
      name: '3 Days - Unlimited',
      description: 'Great for short-term heavy use',
      data: 'Unlimited',
      duration: '3 Days',
      speed: '40Mbps',
      usage: 'Stream, download, and scroll all day',
      dependency: 'EEDC server dependency',
      price: 'N500 / 3 days',
      durationDays: 3,
      amount: 500
    },
    '7days-unlimited': {
      name: 'Weekly - Unlimited',
      description: '7 days of freedom—stream, work, play!',
      data: 'Unlimited',
      duration: '7 Days',
      speed: '60Mbps',
      usage: 'Stream, download, and scroll all day',
      dependency: 'EEDC server dependency',
      price: 'N1000 / week',
      durationDays: 7,
      amount: 1000
    }
  };
  
  return plans[planType] || null;
};

module.exports = {
  getDeviceInfo,
  formatDate,
  getOrCreateUser,
  isAdmin,
  getPlanDetails
}; 