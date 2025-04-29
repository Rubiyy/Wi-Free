const { Scenes } = require('telegraf');
const { AdminMessage, Payment, User } = require('../models');
const { backKeyboard, adminMenuKeyboard, paymentVerificationKeyboard } = require('../keyboards');
const { formatDate } = require('../utils');

// Admin command handler - set message
const setMessageHandler = new Scenes.WizardScene(
  'setMessage',
  async (ctx) => {
    await ctx.reply('Please enter the message you want to set:', backKeyboard);
    ctx.wizard.state.data = {};
    return ctx.wizard.next();
  },
  async (ctx) => {
    // Check if user wants to go back
    if (ctx.message?.text === 'Back 🔙') {
      await ctx.reply('Message setting cancelled.', adminMenuKeyboard);
      return ctx.scene.leave();
    }
    
    const messageText = ctx.message?.text;
    
    if (!messageText) {
      await ctx.reply('Please enter a valid message text:', backKeyboard);
      return;
    }
    
    try {
      // Save the message to database
      const adminMessage = new AdminMessage({
        message: messageText,
        isActive: true
      });
      
      await adminMessage.save();
      
      await ctx.reply(`✅ Message has been set successfully:\n\n${messageText}`, adminMenuKeyboard);
      return ctx.scene.leave();
    } catch (error) {
      console.error('Error setting message:', error);
      await ctx.reply('❌ Error setting message. Please try again.', adminMenuKeyboard);
      return ctx.scene.leave();
    }
  }
);

// Admin handler - view pending payments
const viewPendingPaymentsHandler = async (ctx) => {
  try {
    const pendingPayments = await Payment.getPendingPayments();
    
    if (pendingPayments.length === 0) {
      return await ctx.reply('No pending payments found.', adminMenuKeyboard);
    }
    
    await ctx.reply(`Found ${pendingPayments.length} pending payment(s):`, adminMenuKeyboard);
    
    // Send each pending payment with approval/rejection buttons
    for (const payment of pendingPayments) {
      const message = 
        `🔹 Payment ID: ${payment._id}\n` +
        `🔹 User: ${payment.userId.firstName} ${payment.userId.lastName || ''} (@${payment.userId.username || 'N/A'})\n` +
        `🔹 Plan: ${payment.plan}\n` +
        `🔹 Amount: ₦${payment.amount}\n` +
        `🔹 Reference: ${payment.reference}\n` +
        `🔹 Date: ${formatDate(payment.createdAt)}`;
      
      await ctx.reply(message, paymentVerificationKeyboard(payment._id));
    }
  } catch (error) {
    console.error('Error viewing pending payments:', error);
    await ctx.reply('❌ Error fetching pending payments. Please try again.', adminMenuKeyboard);
  }
};

// Admin handler - approve payment
const approvePaymentHandler = async (ctx) => {
  try {
    const paymentId = ctx.callbackQuery.data.replace('approve_payment_', '');
    
    // Update payment status
    const payment = await Payment.approvePayment(paymentId, ctx.from.id.toString());
    
    if (!payment) {
      await ctx.answerCbQuery('Payment not found.');
      return;
    }
    
    // Get user
    const user = await User.findOne({ chatId: payment.chatId });
    
    if (!user) {
      await ctx.answerCbQuery('User not found.');
      return;
    }
    
    // Handle payment based on type
    if (payment.type === 'balance' && payment.plan === 'balance-topup') {
      // Add to user's balance
      await user.addBalance(payment.amount);
      
      // Notify admin
      await ctx.answerCbQuery('Balance topup approved successfully!');
      await ctx.editMessageText(`✅ Balance topup approved!\n\nPayment ID: ${payment._id}`);
      
      // Notify user
      await ctx.telegram.sendMessage(
        payment.chatId,
        `✅ Your payment for balance topup of ₦${payment.amount.toFixed(2)} has been approved!\n\n` +
        `Your new balance is ₦${user.balance.amount.toFixed(2)}.`
      );
    } else {
      // Handle plan subscription
      // Set plan based on payment type
      let durationDays = 1;
      if (payment.plan === '3days-unlimited') {
        durationDays = 3;
      } else if (payment.plan === '7days-unlimited') {
        durationDays = 7;
      }
      
      // Check if SMS token fee was applied
      if (payment.smsTokenEnabled && (!user.smsToken.isEnabled || !user.smsToken.phoneNumber)) {
        await ctx.answerCbQuery('User does not have SMS token enabled or phone number set.');
      }
      
      await user.setPlan(payment.plan, durationDays);
      
      // Notify admin
      await ctx.answerCbQuery('Payment approved successfully!');
      await ctx.editMessageText(`✅ Payment approved!\n\nPayment ID: ${payment._id}`);
      
      // Notify user
      await ctx.telegram.sendMessage(
        payment.chatId,
        `✅ Your payment for ${payment.plan} has been approved!\n\n` +
        `Your plan is now active until ${formatDate(user.plan.endDate)}.`
      );
    }
  } catch (error) {
    console.error('Error approving payment:', error);
    await ctx.answerCbQuery('Error approving payment.');
  }
};

// Admin handler - decline payment
const declinePaymentHandler = async (ctx) => {
  try {
    const paymentId = ctx.callbackQuery.data.replace('decline_payment_', '');
    
    // Update payment status
    const payment = await Payment.declinePayment(paymentId, ctx.from.id.toString());
    
    if (!payment) {
      await ctx.answerCbQuery('Payment not found.');
      return;
    }
    
    // Notify admin
    await ctx.answerCbQuery('Payment declined successfully!');
    await ctx.editMessageText(`❌ Payment declined!\n\nPayment ID: ${payment._id}`);
    
    // Notify user
    await ctx.telegram.sendMessage(
      payment.chatId,
      `❌ Your payment for ${payment.plan} has been declined.\n\n` +
      `Please check your payment reference and try again, or contact support.`
    );
  } catch (error) {
    console.error('Error declining payment:', error);
    await ctx.answerCbQuery('Error declining payment.');
  }
};

// Admin handler - statistics
const statisticsHandler = async (ctx) => {
  try {
    // Get various statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ 'plan.isActive': true });
    const dailyPlanUsers = await User.countDocuments({ 'plan.isActive': true, 'plan.type': '15GB-1day' });
    const threeDayPlanUsers = await User.countDocuments({ 'plan.isActive': true, 'plan.type': '3days-unlimited' });
    const weeklyPlanUsers = await User.countDocuments({ 'plan.isActive': true, 'plan.type': '7days-unlimited' });
    const pendingPayments = await Payment.countDocuments({ status: 'pending' });
    const approvedPayments = await Payment.countDocuments({ status: 'approved' });
    const smsEnabledUsers = await User.countDocuments({ 'smsToken.isEnabled': true });
    
    // Calculate revenue
    const payments = await Payment.find({ status: 'approved' });
    const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
    
    const statsMessage = 
      `📊 *Wi-FREE Bot Statistics*\n\n` +
      `👥 *Users*\n` +
      `Total Users: ${totalUsers}\n` +
      `Active Subscribers: ${activeUsers}\n` +
      `SMS Enabled Users: ${smsEnabledUsers}\n\n` +
      `📱 *Active Plans*\n` +
      `15GB Daily: ${dailyPlanUsers}\n` +
      `3-Day Unlimited: ${threeDayPlanUsers}\n` +
      `Weekly Unlimited: ${weeklyPlanUsers}\n\n` +
      `💰 *Payments*\n` +
      `Pending: ${pendingPayments}\n` +
      `Approved: ${approvedPayments}\n` +
      `Total Revenue: ₦${totalRevenue}`;
    
    await ctx.replyWithMarkdown(statsMessage, adminMenuKeyboard);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    await ctx.reply('❌ Error fetching statistics. Please try again.', adminMenuKeyboard);
  }
};

// Admin handler - SMS users
const smsUsersHandler = async (ctx) => {
  try {
    const smsUsers = await User.getUsersWithSmsEnabled();
    
    if (smsUsers.length === 0) {
      return await ctx.reply('No users with SMS token enabled found.', adminMenuKeyboard);
    }
    
    let message = `📱 *Users with SMS Tokens Enabled*\n\n`;
    message += `Found ${smsUsers.length} user(s):\n\n`;
    
    for (let i = 0; i < Math.min(smsUsers.length, 20); i++) {
      const user = smsUsers[i];
      message += `👤 *User:* ${user.firstName} ${user.lastName || ''} (@${user.username || 'N/A'})\n`;
      message += `📞 *Phone:* ${user.smsToken.phoneNumber || 'Not set'}\n`;
      message += `💰 *Balance:* ₦${user.balance.amount.toFixed(2)}\n\n`;
    }
    
    if (smsUsers.length > 20) {
      message += `... and ${smsUsers.length - 20} more users`;
    }
    
    await ctx.replyWithMarkdown(message, adminMenuKeyboard);
  } catch (error) {
    console.error('Error fetching SMS users:', error);
    await ctx.reply('❌ Error fetching users with SMS tokens enabled. Please try again.', adminMenuKeyboard);
  }
};

// Admin handler - deduct SMS fee
const deductSmsHandler = new Scenes.WizardScene(
  'deductSms',
  async (ctx) => {
    const smsUsers = await User.getUsersWithSmsEnabled();
    const eligibleUsers = smsUsers.filter(user => user.balance.amount >= 5);
    
    ctx.wizard.state.data = { 
      totalUsers: smsUsers.length,
      eligibleUsers: eligibleUsers.length
    };
    
    await ctx.reply(
      `📱 *Deduct SMS Fee*\n\n` +
      `Total users with SMS enabled: ${smsUsers.length}\n` +
      `Users with sufficient balance (₦5): ${eligibleUsers.length}\n\n` +
      `Do you want to deduct ₦5 from all eligible users?\n` +
      `Type 'confirm' to proceed or 'cancel' to abort.`,
      { parse_mode: 'Markdown', ...backKeyboard }
    );
    
    return ctx.wizard.next();
  },
  async (ctx) => {
    const response = ctx.message?.text?.toLowerCase();
    
    if (response === 'cancel' || ctx.message?.text === 'Back 🔙') {
      await ctx.reply('SMS fee deduction cancelled.', adminMenuKeyboard);
      return ctx.scene.leave();
    }
    
    if (response !== 'confirm') {
      await ctx.reply('Please type \'confirm\' to proceed or \'cancel\' to abort.', backKeyboard);
      return;
    }
    
    try {
      // Get all users with SMS enabled and sufficient balance
      const smsUsers = await User.getUsersWithSmsEnabled();
      const eligibleUsers = smsUsers.filter(user => user.balance.amount >= 5);
      
      let successCount = 0;
      let failedUsers = [];
      
      // Deduct fee from each eligible user
      for (const user of eligibleUsers) {
        try {
          await user.deductBalance(5);
          successCount++;
          
          // Notify user
          await ctx.telegram.sendMessage(
            user.chatId,
            `💸 *SMS Fee Deduction*\n\n` +
            `₦5 has been deducted from your balance for SMS token service.\n` +
            `New Balance: ₦${user.balance.amount.toFixed(2)}`,
            { parse_mode: 'Markdown' }
          );
        } catch (err) {
          console.error(`Error deducting SMS fee from user ${user.chatId}:`, err);
          failedUsers.push(user.chatId);
        }
      }
      
      await ctx.reply(
        `✅ *SMS Fee Deduction Complete*\n\n` +
        `Successfully deducted ₦5 from ${successCount} users.\n` +
        `Failed to deduct from ${failedUsers.length} users.\n\n` +
        `Total amount collected: ₦${(successCount * 5).toFixed(2)}`,
        { parse_mode: 'Markdown', ...adminMenuKeyboard }
      );
      
      return ctx.scene.leave();
    } catch (error) {
      console.error('Error deducting SMS fees:', error);
      await ctx.reply('❌ Error deducting SMS fees. Please try again later.', adminMenuKeyboard);
      return ctx.scene.leave();
    }
  }
);

// Admin handler - Users list
const usersListHandler = async (ctx) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).limit(20);
    
    if (users.length === 0) {
      return await ctx.reply('No users found.', adminMenuKeyboard);
    }
    
    let message = `👥 *Users List*\n\n` +
      `Found ${users.length} users. Showing first 20:\n\n`;
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      // Using HTML formatting instead of Markdown to avoid special character issues
      message += `${i + 1}. ${user.firstName} ${user.lastName || ''} (@${user.username || 'N/A'})\n` +
        `ID: <code>${user.chatId}</code>\n\n`;
    }
    
    message += `To view user details, use the command:\n` +
      `/user &lt;chat_id&gt;`;
    
    await ctx.reply(message, { 
      parse_mode: 'HTML',
      ...adminMenuKeyboard
    });
  } catch (error) {
    console.error('Error fetching users list:', error);
    await ctx.reply('❌ Error fetching users list. Please try again.', adminMenuKeyboard);
  }
};

// Admin handler - View user details
const userDetailsHandler = async (ctx, userId) => {
  try {
    const user = await User.findOne({ chatId: userId });
    
    if (!user) {
      return await ctx.reply(`User with ID ${userId} not found.`, adminMenuKeyboard);
    }
    
    // Get user's active plan
    let planInfo = 'No active plan';
    if (user.plan.isActive) {
      const planDetails = getPlanDetails(user.plan.type);
      planInfo = `${planDetails.name} (until ${formatDate(user.plan.endDate)})`;
    }
    
    // Get user's payment history
    const payments = await Payment.find({ chatId: userId }).sort({ createdAt: -1 }).limit(5);
    
    let paymentHistory = 'No payment history';
    if (payments.length > 0) {
      paymentHistory = payments.map(p => {
        return `${p.plan} - ₦${p.amount} - ${p.status} - ${formatDate(p.createdAt)}`;
      }).join('\n');
    }
    
    const message = 
      `👤 *User Details*\n\n` +
      `*Name:* ${user.firstName} ${user.lastName || ''}\n` +
      `*Username:* @${user.username || 'N/A'}\n` +
      `*Chat ID:* \`${user.chatId}\`\n` +
      `*Joined:* ${formatDate(user.createdAt)}\n\n` +
      
      `*Balance:* ₦${user.balance.amount.toFixed(2)}\n` +
      `*Plan:* ${planInfo}\n\n` +
      
      `*SMS Token:* ${user.smsToken.isEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
      `*Phone:* ${user.smsToken.phoneNumber || 'Not set'}\n\n` +
      
      `*Device Info:*\n` +
      `IP: ${user.deviceInfo.ip}\n` +
      `User Agent: ${user.deviceInfo.userAgent}\n\n` +
      
      `*Recent Payments:*\n${paymentHistory}\n\n` +
      
      `*Actions:*\n` +
      `- To deduct SMS fee: /deductsms ${user.chatId}\n` +
      `- To add balance: /addbalance ${user.chatId} <amount>`;
    
    await ctx.replyWithMarkdown(message, adminMenuKeyboard);
  } catch (error) {
    console.error(`Error fetching user details for ${userId}:`, error);
    await ctx.reply('❌ Error fetching user details. Please try again.', adminMenuKeyboard);
  }
};

// Admin handler - Deduct SMS fee from specific user
const deductSmsForUserHandler = async (ctx, userId) => {
  try {
    const user = await User.findOne({ chatId: userId });
    
    if (!user) {
      return await ctx.reply(`User with ID ${userId} not found.`, adminMenuKeyboard);
    }
    
    if (!user.smsToken.isEnabled) {
      return await ctx.reply(`User doesn't have SMS tokens enabled.`, adminMenuKeyboard);
    }
    
    if (user.balance.amount < 5) {
      return await ctx.reply(`User doesn't have enough balance (₦${user.balance.amount.toFixed(2)}) for SMS fee.`, adminMenuKeyboard);
    }
    
    // Deduct fee
    await user.deductBalance(5);
    
    // Notify user
    await ctx.telegram.sendMessage(
      user.chatId,
      `💸 *SMS Fee Deduction*\n\n` +
      `₦5 has been deducted from your balance for SMS token service.\n` +
      `New Balance: ₦${user.balance.amount.toFixed(2)}`,
      { parse_mode: 'Markdown' }
    );
    
    await ctx.reply(
      `✅ Successfully deducted ₦5 SMS fee from user ${user.firstName} ${user.lastName || ''}.\n` +
      `Their new balance is ₦${user.balance.amount.toFixed(2)}.`,
      adminMenuKeyboard
    );
  } catch (error) {
    console.error(`Error deducting SMS fee for user ${userId}:`, error);
    await ctx.reply('❌ Error deducting SMS fee. Please try again.', adminMenuKeyboard);
  }
};

// Admin handler - Add balance to user
const addBalanceToUserHandler = new Scenes.WizardScene(
  'addBalanceToUser',
  async (ctx) => {
    // Get user ID and amount from command
    const args = ctx.state.command.splitArgs;
    if (args.length < 2) {
      await ctx.reply('Usage: /addbalance <user_id> <amount>', adminMenuKeyboard);
      return ctx.scene.leave();
    }
    
    const userId = args[0];
    const amount = parseFloat(args[1]);
    
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('Please provide a valid amount.', adminMenuKeyboard);
      return ctx.scene.leave();
    }
    
    const user = await User.findOne({ chatId: userId });
    
    if (!user) {
      await ctx.reply(`User with ID ${userId} not found.`, adminMenuKeyboard);
      return ctx.scene.leave();
    }
    
    ctx.wizard.state.data = { userId, amount, user };
    
    await ctx.reply(
      `You are about to add ₦${amount.toFixed(2)} to the balance of user:\n\n` +
      `Name: ${user.firstName} ${user.lastName || ''}\n` +
      `Username: @${user.username || 'N/A'}\n` +
      `Current Balance: ₦${user.balance.amount.toFixed(2)}\n\n` +
      `Type 'confirm' to proceed or 'cancel' to abort.`,
      backKeyboard
    );
    
    return ctx.wizard.next();
  },
  async (ctx) => {
    const response = ctx.message?.text?.toLowerCase();
    
    if (response === 'cancel' || ctx.message?.text === 'Back 🔙') {
      await ctx.reply('Balance addition cancelled.', adminMenuKeyboard);
      return ctx.scene.leave();
    }
    
    if (response !== 'confirm') {
      await ctx.reply('Please type \'confirm\' to proceed or \'cancel\' to abort.', backKeyboard);
      return;
    }
    
    try {
      const { user, amount } = ctx.wizard.state.data;
      
      // Add to user's balance
      await user.addBalance(amount);
      
      // Notify admin
      await ctx.reply(
        `✅ Successfully added ₦${amount.toFixed(2)} to user ${user.firstName} ${user.lastName || ''}.\n` +
        `Their new balance is ₦${user.balance.amount.toFixed(2)}.`,
        adminMenuKeyboard
      );
      
      // Notify user
      await ctx.telegram.sendMessage(
        user.chatId,
        `💰 *Balance Added*\n\n` +
        `₦${amount.toFixed(2)} has been added to your balance by the admin.\n` +
        `New Balance: ₦${user.balance.amount.toFixed(2)}`,
        { parse_mode: 'Markdown' }
      );
      
      return ctx.scene.leave();
    } catch (error) {
      console.error('Error adding balance to user:', error);
      await ctx.reply('❌ Error adding balance to user. Please try again later.', adminMenuKeyboard);
      return ctx.scene.leave();
    }
  }
);

module.exports = {
  setMessageHandler,
  viewPendingPaymentsHandler,
  approvePaymentHandler,
  declinePaymentHandler,
  statisticsHandler,
  smsUsersHandler,
  deductSmsHandler,
  usersListHandler,
  userDetailsHandler,
  deductSmsForUserHandler,
  addBalanceToUserHandler
}; 