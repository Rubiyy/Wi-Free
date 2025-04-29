const { Scenes } = require('telegraf');
const { User, Payment } = require('../models');
const { formatDate } = require('../utils');
const { mainMenuKeyboard, backKeyboard } = require('../keyboards');

// Balance handler - Show user balance
const myBalanceHandler = async (ctx) => {
  try {
    const user = ctx.user;
    
    const balanceMessage = 
      `💰 *Your Balance*\n\n` +
      `Current Balance: ₦${user.balance.amount.toFixed(2)}\n` +
      `Last Updated: ${formatDate(user.balance.lastUpdated)}\n\n` +
      `SMS Token: ${user.smsToken.isEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
      `${user.smsToken.phoneNumber ? `Phone Number: ${user.smsToken.phoneNumber}` : ''}\n\n` +
      `Use your balance to subscribe to plans or receive SMS tokens.`;
    
    await ctx.replyWithMarkdown(balanceMessage);
  } catch (error) {
    console.error('Error in balance handler:', error);
    await ctx.reply('Sorry, something went wrong. Please try again later.');
  }
};

// Add balance handler - Wizard scene
const addBalanceHandler = new Scenes.WizardScene(
  'addBalance',
  async (ctx) => {
    try {
      // Get user from context or find it directly
      const chatId = ctx.from.id.toString();
      const user = ctx.user || await User.findOne({ chatId });
      
      if (!user) {
        // Create user if not found
        const newUser = new User({
          chatId,
          username: ctx.from.username,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name
        });
        await newUser.save();
        ctx.user = newUser;
      }
      
      await ctx.reply(
        `💰 *Add Balance*\n\n` +
        `Please enter the amount you want to add to your balance (minimum ₦50):`,
        { parse_mode: 'Markdown', ...backKeyboard }
      );
      ctx.wizard.state.data = {};
      return ctx.wizard.next();
    } catch (error) {
      console.error('Error starting add balance process:', error);
      await ctx.reply('❌ Error processing your request. Please try again later.', mainMenuKeyboard);
      return ctx.scene.leave();
    }
  },
  async (ctx) => {
    try {
      // Get user from context or find it directly
      const chatId = ctx.from.id.toString();
      const user = ctx.user || await User.findOne({ chatId });
      
      if (!user) {
        await ctx.reply(
          '❌ Error retrieving your profile. Please try again by typing /start.',
          mainMenuKeyboard
        );
        return ctx.scene.leave();
      }
      
      // Check if user wants to go back
      if (ctx.message?.text === 'Back 🔙') {
        await ctx.reply('Balance topup cancelled.', mainMenuKeyboard);
        return ctx.scene.leave();
      }
      
      const amountText = ctx.message?.text;
      const amount = parseFloat(amountText);
      
      if (isNaN(amount) || amount < 50) {
        await ctx.reply('Please enter a valid amount (minimum ₦50):', backKeyboard);
        return;
      }
      
      ctx.wizard.state.data.amount = amount;
      
      await ctx.reply(
        `💳 *Payment Details*\n\n` +
        `You are about to add ₦${amount.toFixed(2)} to your balance.\n\n` +
        `Please make payment to the account below and then provide your payment reference:\n\n` +
        `*Bank Name:* Palmpay Bank\n` +
        `*Account Number:* 9113692963\n` +
        `*Account Name:* Mr Nicholas\n\n` +
        `After making the payment, please enter your payment reference below:`,
        { parse_mode: 'Markdown', ...backKeyboard }
      );
      
      return ctx.wizard.next();
    } catch (error) {
      console.error('Error processing balance amount:', error);
      await ctx.reply('❌ Error processing your amount. Please try again later.', mainMenuKeyboard);
      return ctx.scene.leave();
    }
  },
  async (ctx) => {
    try {
      // Get user from context or find it directly
      const chatId = ctx.from.id.toString();
      const user = ctx.user || await User.findOne({ chatId });
      
      if (!user) {
        await ctx.reply(
          '❌ Error retrieving your profile. Please try again by typing /start.',
          mainMenuKeyboard
        );
        return ctx.scene.leave();
      }
      
      // Check if user wants to go back
      if (ctx.message?.text === 'Back 🔙') {
        await ctx.reply('Balance topup cancelled.', mainMenuKeyboard);
        return ctx.scene.leave();
      }
      
      const reference = ctx.message?.text;
      
      if (!reference) {
        await ctx.reply('Please enter a valid payment reference:', backKeyboard);
        return;
      }
      
      try {
        // Check if reference already exists
        const existingPayment = await Payment.findByReference(reference);
        const amount = ctx.wizard.state.data.amount;
        
        if (existingPayment) {
          if (existingPayment.status === 'approved') {
            // Reference exists and is already approved, automatically update balance
            // Update user balance
            user.balance.amount += amount;
            user.balance.lastUpdated = new Date();
            await user.save();
            
            await ctx.reply(
              `✅ *Payment Auto-Approved*\n\n` +
              `Your payment reference *${reference}* has been verified and approved.\n\n` +
              `Amount: ₦${amount.toFixed(2)}\n` +
              `New Balance: ₦${user.balance.amount.toFixed(2)}`,
              { parse_mode: 'Markdown', ...mainMenuKeyboard }
            );
            
            return ctx.scene.leave();
          } else {
            await ctx.reply(
              `❌ This payment reference has already been used.\n\n` +
              `Status: ${existingPayment.status}\n\n` +
              `Please enter a different reference:`,
              backKeyboard
            );
            return;
          }
        } else {
          // If the payment doesn't exist, first check for any pre-approved references
          // This handles references that were added by admin for auto-approval
          const preApprovedPayment = await Payment.findOne({ 
            reference, 
            status: 'approved',
            userId: null // Pre-approved payments by admin have null userId
          });
          
          if (preApprovedPayment) {
            // We found a pre-approved reference, automatically approve this deposit
            // Update pre-approved payment with user info
            preApprovedPayment.userId = user._id;
            preApprovedPayment.chatId = user.chatId;
            preApprovedPayment.type = 'balance';
            preApprovedPayment.plan = 'balance-topup';
            await preApprovedPayment.save();
            
            // Update user balance
            user.balance.amount += amount;
            user.balance.lastUpdated = new Date();
            await user.save();
            
            await ctx.reply(
              `✅ *Payment Auto-Approved*\n\n` +
              `Your payment reference *${reference}* has been verified and approved.\n\n` +
              `Amount: ₦${amount.toFixed(2)}\n` +
              `New Balance: ₦${user.balance.amount.toFixed(2)}`,
              { parse_mode: 'Markdown', ...mainMenuKeyboard }
            );
            
            return ctx.scene.leave();
          }
        }
        
        // If not auto-approved, create a new pending payment
        const payment = new Payment({
          userId: user._id,
          chatId: user.chatId,
          reference,
          type: 'balance',
          plan: 'balance-topup',
          amount,
          status: 'pending'
        });
        
        await payment.save();
        
        await ctx.reply(
          `✅ *Payment Reference Submitted*\n\n` +
          `Your payment reference *${reference}* has been submitted for balance topup of ₦${amount.toFixed(2)}.\n\n` +
          `Your balance will be updated once the payment is verified by our agent. You will receive a notification when your topup is processed.`,
          { parse_mode: 'Markdown', ...mainMenuKeyboard }
        );
        
        // Notify admin
        try {
          // Try to use the notifyAdmin function if available
          if (ctx.notifyAdmin) {
            await ctx.notifyAdmin(
              `💰 *New Balance Top-up Submission* 💰\n\n` +
              `*User:* ${user.firstName} ${user.lastName || ''} (@${user.username || 'N/A'})\n` +
              `*Amount:* ₦${amount.toFixed(2)}\n` +
              `*Reference:* ${reference}\n\n` +
              `Use /approve ${payment._id} to approve this top-up.`
            );
          } else {
            // Fallback to direct message
            await ctx.telegram.sendMessage(
              process.env.ADMIN_CHAT_ID,
              `💰 New Balance Top-up Submission 💰\n\n` +
              `User: ${user.firstName} ${user.lastName || ''} (@${user.username || 'N/A'})\n` +
              `Amount: ₦${amount.toFixed(2)}\n` +
              `Reference: ${reference}`,
              { parse_mode: 'Markdown' }
            );
          }
        } catch (error) {
          console.error('Error notifying admin about balance top-up:', error);
        }
        
        return ctx.scene.leave();
      } catch (error) {
        console.error('Error submitting balance topup payment:', error);
        await ctx.reply('❌ Error processing your payment. Please try again later.', mainMenuKeyboard);
        return ctx.scene.leave();
      }
    } catch (error) {
      console.error('Error processing payment reference:', error);
      await ctx.reply('❌ Error processing your payment. Please try again later.', mainMenuKeyboard);
      return ctx.scene.leave();
    }
  }
);

// SMS Token Settings handler - Simplified Wizard scene
const smsTokenSettingsHandler = new Scenes.WizardScene(
  'smsTokenSettings',
  async (ctx) => {
    try {
      // Get user from context or find it directly
      const chatId = ctx.from.id.toString();
      const user = ctx.user || await User.findOne({ chatId });
      
      if (!user) {
        // Create user if not found
        const newUser = new User({
          chatId,
          username: ctx.from.username,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name
        });
        await newUser.save();
        ctx.user = newUser;
      }
      
      const currentStatus = user.smsToken.isEnabled
        ? `currently enabled for phone number: ${user.smsToken.phoneNumber || 'Not set'}`
        : 'currently disabled';
      
      await ctx.reply(
        `📱 *SMS Token Settings*\n\n` +
        `SMS Tokens are ${currentStatus}.\n\n` +
        `What would you like to do?\n\n` +
        `1️⃣ Enable SMS Tokens\n` +
        `2️⃣ Disable SMS Tokens\n` +
        `3️⃣ Cancel`,
        { parse_mode: 'Markdown' }
      );
      
      ctx.wizard.state.data = {};
      return ctx.wizard.next();
    } catch (error) {
      console.error('Error in SMS token settings start:', error);
      await ctx.reply('❌ Error accessing SMS settings. Please try again later.', mainMenuKeyboard);
      return ctx.scene.leave();
    }
  },
  async (ctx) => {
    try {
      // Get user from context or find it directly
      const chatId = ctx.from.id.toString();
      const user = ctx.user || await User.findOne({ chatId });
      
      if (!user) {
        await ctx.reply(
          '❌ Error retrieving your profile. Please try again by typing /start.',
          mainMenuKeyboard
        );
        return ctx.scene.leave();
      }
      
      const option = ctx.message?.text;
      
      if (option === '1' || option === '1️⃣ Enable SMS Tokens') {
        ctx.wizard.state.data.action = 'enable';
        await ctx.reply(
          `📱 Please enter your phone number to receive SMS tokens:`,
          backKeyboard
        );
        return ctx.wizard.next();
      } else if (option === '2' || option === '2️⃣ Disable SMS Tokens') {
        try {
          user.smsToken.isEnabled = false;
          await user.save();
          await ctx.reply(
            `✅ SMS Tokens have been disabled for your account.\n\nYou will no longer receive SMS notifications.`,
            mainMenuKeyboard
          );
          return ctx.scene.leave();
        } catch (error) {
          console.error('Error disabling SMS tokens:', error);
          await ctx.reply('❌ Error updating your settings. Please try again later.', mainMenuKeyboard);
          return ctx.scene.leave();
        }
      } else if (option === '3' || option === '3️⃣ Cancel' || option === 'Back 🔙') {
        await ctx.reply('SMS Token settings cancelled.', mainMenuKeyboard);
        return ctx.scene.leave();
      } else {
        await ctx.reply('Please select a valid option (1-3).');
        return;
      }
    } catch (error) {
      console.error('Error in SMS token settings option selection:', error);
      await ctx.reply('❌ Error processing your selection. Please try again later.', mainMenuKeyboard);
      return ctx.scene.leave();
    }
  },
  async (ctx) => {
    try {
      // Get response
      const phoneNumber = ctx.message?.text;
      
      if (!phoneNumber) {
        await ctx.reply('Please enter a valid phone number:', backKeyboard);
        return;
      }
      
      if (phoneNumber === 'Back 🔙') {
        await ctx.reply('SMS token setup cancelled.', mainMenuKeyboard);
        return ctx.scene.leave();
      }
      
      // Validate phone number - only accept numbers
      if (!/^\d+$/.test(phoneNumber)) {
        await ctx.reply(
          `❌ Invalid phone number format. Please enter digits only.\n` +
          `For example: 08012345678`,
          backKeyboard
        );
        return;
      }
      
      // Get user if not available in context
      const chatId = ctx.from.id.toString();
      const user = ctx.user || await User.findOne({ chatId });
      
      if (!user) {
        await ctx.reply('❌ Error: User not found. Please try again later.', mainMenuKeyboard);
        return ctx.scene.leave();
      }
      
      // Update user's SMS token settings directly
      user.smsToken = {
        isEnabled: true,
        phoneNumber: phoneNumber
      };
      await user.save();
      
      // Confirm settings update
      await ctx.reply(
        `✅ SMS token enabled! Your phone number has been set to: ${phoneNumber}\n\n` +
        `You will now be able to receive SMS tokens when requested.`,
        mainMenuKeyboard
      );
      
      return ctx.scene.leave();
    } catch (error) {
      console.error('Error in SMS token settings phone number step:', error);
      await ctx.reply('An error occurred. Please try again later.', mainMenuKeyboard);
      return ctx.scene.leave();
    }
  }
);

// Export handlers
module.exports = {
  myBalanceHandler,
  addBalanceHandler,
  smsTokenSettingsHandler
}; 