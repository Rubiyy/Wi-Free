require('dotenv').config();
const { Telegraf, Scenes, session } = require('telegraf');
const connectDB = require('./db');
const {
  trackUserMiddleware,
  loggerMiddleware
} = require('./middleware');
const {
  startHandler,
  showMeHandler,
  myPlanHandler,
  buyPlanHandler,
  planDetailsHandler,
  paymentInfoHandler,
  submitReferenceHandler,
  cancelPaymentHandler,
  payWithBalanceHandler,
  enableSmsHandler,
  skipSmsHandler,
  bankPaymentHandler,
  processBankPaymentWithSms,
  processSmsSetup,
  processSmsSetupForBankPayment,
  helpHandler,
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
  addBalanceToUserHandler,
  myBalanceHandler,
  addBalanceHandler,
  smsTokenSettingsHandler
} = require('./handlers');
const {
  mainMenuKeyboard,
  adminMenuKeyboard,
  balanceKeyboard
} = require('./keyboards');
const mongoose = require('mongoose');

// Initialize bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// Connect to database
connectDB()
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });

// Set up session and scene management
const stage = new Scenes.Stage([
  setMessageHandler,
  submitReferenceHandler,
  addBalanceHandler,
  smsTokenSettingsHandler,
  deductSmsHandler,
  addBalanceToUserHandler
]);

// Command interpreter middleware
const commandParserMiddleware = (ctx, next) => {
  if (ctx.message && ctx.message.text && ctx.message.text.startsWith('/')) {
    const text = ctx.message.text;
    const match = text.match(/^\/([^\s]+)\s?(.+)?/);
    if (match) {
      const command = match[1];
      const args = match[2] ? match[2].split(/\s+/) : [];
      ctx.state.command = {
        command,
        args,
        splitArgs: args
      };
    }
  }
  return next();
};

// Add middleware for sending admin notifications
const adminNotificationMiddleware = async (ctx, next) => {
  // Save the original ctx.reply method
  const originalReply = ctx.reply;
  
  // Create a function to send notifications to admin
  ctx.notifyAdmin = async (message) => {
    try {
      await ctx.telegram.sendMessage(
        process.env.ADMIN_CHAT_ID,
        message,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Error sending admin notification:', error);
    }
  };
  
  // Call the next middleware
  await next();
};

// Middleware
bot.use(session());
bot.use(stage.middleware());
bot.use(trackUserMiddleware);
bot.use(loggerMiddleware);
bot.use(commandParserMiddleware);
bot.use(adminNotificationMiddleware);

// Process SMS setup text messages
bot.use(async (ctx, next) => {
  if (ctx.message && ctx.message.text) {
    // Try process SMS setup for plan purchase
    const processed = await processSmsSetup(ctx);
    if (processed) return;
    
    // Try process SMS setup for bank payment
    const processedBank = await processSmsSetupForBankPayment(ctx);
    if (processedBank) return;
    
    // Try process bank payment reference after SMS setup
    const processedBankReference = await processBankPaymentWithSms(ctx);
    if (processedBankReference) return;
  }
  return next();
});

// Start command
bot.start(startHandler);
bot.command('start', startHandler);

// Main menu commands
bot.hears('Show Me 🔎', showMeHandler);
bot.hears('My Plan 📊', myPlanHandler);
bot.hears('Buy Plan 💲', buyPlanHandler);
bot.hears('My Balance 💰', (ctx) => {
  myBalanceHandler(ctx);
  setTimeout(() => {
    ctx.reply('Select an option to manage your balance:', balanceKeyboard);
  }, 500); // Small delay to ensure messages appear in the right order
});
bot.hears('Help ℹ️', helpHandler);

// Balance related commands
bot.hears('Add Balance 💰', (ctx) => {
  ctx.reply('💡 Guide: Add funds to your account by providing payment details and reference.\n\nYou can use your balance to pay for plans and SMS services.');
  setTimeout(() => {
    ctx.scene.enter('addBalance');
  }, 1000);
});

bot.hears('SMS Token Settings 📱', (ctx) => {
  ctx.reply('💡 Guide: Enable or disable SMS notifications and set your phone number for receiving messages.');
  setTimeout(() => {
    ctx.scene.enter('smsTokenSettings');
  }, 1000);
});

// Plan related commands - update to handle price display in button text
bot.hears(/15GB-1day \(₦(.*)\)/, ctx => planDetailsHandler(ctx, '15GB-1day'));
bot.hears(/3days-unlimited \(₦(.*)\)/, ctx => planDetailsHandler(ctx, '3days-unlimited'));
bot.hears(/7days-unlimited \(₦(.*)\)/, ctx => planDetailsHandler(ctx, '7days-unlimited'));
bot.hears('Pay Now 💳', paymentInfoHandler);

// Payment method options
bot.hears('Pay with Balance 💼', (ctx) => {
  ctx.reply('💡 Guide: Using your account balance to purchase this plan. Make sure you have sufficient funds.');
  setTimeout(() => {
    payWithBalanceHandler(ctx);
  }, 500);
});

// SMS token options
bot.hears('Enable SMS (+₦5) ✅', enableSmsHandler);
bot.hears('Skip SMS ❌', skipSmsHandler);

// Payment submission
bot.action(/submit_reference_(.+)/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
  } catch (error) {
    // Ignore callback query timeout errors
    console.log('Callback query error (ignoring):', error.message);
  }
  
  // Make sure user is loaded
  if (!ctx.user) {
    const chatId = ctx.from.id.toString();
    const user = await User.findOne({ chatId });
    
    if (user) {
      ctx.user = user;
    } else {
      // Create new user if not found
      const newUser = new User({
        chatId,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name
      });
      await newUser.save();
      ctx.user = newUser;
    }
  }
  
  ctx.scene.enter('submitReference');
});

// Handle the specific reference submission callback
bot.action('submit_reference', async (ctx) => {
  try {
    await ctx.answerCbQuery();
  } catch (error) {
    // Ignore callback query timeout errors
    console.log('Callback query error (ignoring):', error.message);
  }
  
  // Make sure user is loaded
  if (!ctx.user) {
    const chatId = ctx.from.id.toString();
    const user = await User.findOne({ chatId });
    
    if (user) {
      ctx.user = user;
    } else {
      // Create new user if not found
      const newUser = new User({
        chatId,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name
      });
      await newUser.save();
      ctx.user = newUser;
    }
  }
  
  ctx.scene.enter('submitReference');
});

bot.action('cancel_payment', async (ctx) => {
  try {
    await ctx.answerCbQuery();
  } catch (error) {
    // Ignore callback query timeout errors
    console.log('Callback query error (ignoring):', error.message);
  }
  
  await ctx.reply('Payment cancelled.', mainMenuKeyboard);
});

// Admin commands
bot.hears('Set Message 📝', ctx => {
  if (ctx.isAdmin) {
    return ctx.scene.enter('setMessage');
  }
  return ctx.reply('You do not have permission to use this command.');
});

bot.hears('View Pending Payments 💲', ctx => {
  if (ctx.isAdmin) {
    return viewPendingPaymentsHandler(ctx);
  }
  return ctx.reply('You do not have permission to use this command.');
});

bot.hears('Statistics 📈', ctx => {
  if (ctx.isAdmin) {
    return statisticsHandler(ctx);
  }
  return ctx.reply('You do not have permission to use this command.');
});

bot.hears('SMS Users 📱', ctx => {
  if (ctx.isAdmin) {
    return smsUsersHandler(ctx);
  }
  return ctx.reply('You do not have permission to use this command.');
});

bot.hears('Deduct SMS Fee 💸', ctx => {
  if (ctx.isAdmin) {
    return ctx.scene.enter('deductSms');
  }
  return ctx.reply('You do not have permission to use this command.');
});

bot.hears('View Users 👥', ctx => {
  if (ctx.isAdmin) {
    return usersListHandler(ctx);
  }
  return ctx.reply('You do not have permission to use this command.');
});

bot.hears('Back to User Menu 👤', ctx => {
  return ctx.reply('Switched to user menu.', mainMenuKeyboard);
});

// Add handler for Admin Help button
bot.hears('Admin Help 📋', ctx => {
  if (ctx.isAdmin) {
    return ctx.replyWithMarkdown(`
*Admin Commands*

\`/addreference <reference> <amount>\` - Add a pre-approved payment reference
Example: \`/addreference TX123456 500\`

\`/setsmsfee <amount>\` - Set the SMS token fee
Example: \`/setsmsfee 10\`

\`/smsfee\` - View and update current SMS fee with buttons

\`/approve <id>\` - Approve a pending payment
\`/decline <id>\` - Decline a pending payment

\`/pending\` - View all pending payments
\`/topups\` - View all approved balance topups

\`/msg actives <message>\` - Send to users with active plans
\`/msg all <message>\` - Send to all users

\`/users\` - View list of users
\`/user <chat_id>\` - View user details
\`/deductsms <chat_id>\` - Deduct SMS fee from specific user
\`/addbalance <chat_id> <amount>\` - Add balance to user

\`/broadcast <message>\` - Send message to all users
`, adminMenuKeyboard);
  }
  return ctx.reply('You do not have permission to use this command.');
});

// Admin custom commands
bot.command('users', ctx => {
  if (ctx.isAdmin) {
    return usersListHandler(ctx);
  }
  return ctx.reply('You do not have permission to use this command.');
});

bot.command('user', ctx => {
  if (ctx.isAdmin) {
    const userId = ctx.state.command.args[0];
    if (!userId) {
      return ctx.reply('Usage: /user <chat_id>', adminMenuKeyboard);
    }
    return userDetailsHandler(ctx, userId);
  }
  return ctx.reply('You do not have permission to use this command.');
});

bot.command('deductsms', ctx => {
  if (ctx.isAdmin) {
    const userId = ctx.state.command.args[0];
    if (!userId) {
      return ctx.reply('Usage: /deductsms <chat_id>', adminMenuKeyboard);
    }
    return deductSmsForUserHandler(ctx, userId);
  }
  return ctx.reply('You do not have permission to use this command.');
});

bot.command('addbalance', ctx => {
  if (ctx.isAdmin) {
    return ctx.scene.enter('addBalanceToUser');
  }
  return ctx.reply('You do not have permission to use this command.');
});

// New SMS fee configuration command
bot.command('setsmsfee', ctx => {
  if (ctx.isAdmin) {
    const fee = ctx.state.command.args[0];
    if (!fee) {
      return ctx.reply('Usage: /setsmsfee <amount>\nExample: /setsmsfee 5', adminMenuKeyboard);
    }
    // Import the setSmsFeeHandler function from planHandler
    const { setSmsFeeHandler } = require('./handlers/planHandler');
    return setSmsFeeHandler(ctx, fee);
  }
  return ctx.reply('You do not have permission to use this command.');
});

// New admin help command
bot.command('adminhelp', ctx => {
  if (ctx.isAdmin) {
    const adminHelpMessage = `
*Admin Commands*

\`/addreference <reference> <amount>\` - Add a pre-approved payment reference
Example: \`/addreference TX123456 500\`

\`/setsmsfee <amount>\` - Set the SMS token fee
Example: \`/setsmsfee 10\`

\`/smsfee\` - View and update current SMS fee with buttons

\`/approve <id>\` - Approve a pending payment
\`/decline <id>\` - Decline a pending payment

\`/pending\` - View all pending payments
\`/topups\` - View all approved balance topups

\`/msg actives <message>\` - Send to users with active plans
\`/msg all <message>\` - Send to all users

\`/users\` - View list of users
\`/user <chat_id>\` - View user details
\`/deductsms <chat_id>\` - Deduct SMS fee from specific user
\`/addbalance <chat_id> <amount>\` - Add balance to user

\`/broadcast <message>\` - Send message to all users
`;
    return ctx.replyWithMarkdown(adminHelpMessage);
  } else {
    return ctx.reply('You do not have permission to use this command.');
  }
});

// Fix the /addreference command to handle errors better
bot.command('addreference', ctx => {
  if (ctx.isAdmin) {
    const args = ctx.state.command.args;
    if (args.length < 2) {
      return ctx.reply('Usage: /addreference <reference> <amount>\nExample: /addreference TX123456 500', adminMenuKeyboard);
    }
    
    const reference = args[0];
    const amount = parseFloat(args[1]);
    
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply('Please provide a valid amount.', adminMenuKeyboard);
    }
    
    try {
      const { Payment } = require('./models');
      // Check if reference already exists
      Payment.findByReference(reference)
        .then(existingPayment => {
          if (existingPayment) {
            return ctx.reply(`❌ Reference ${reference} already exists in the database.`, adminMenuKeyboard);
          }
          
      // Create pre-approved payment record
      const payment = new Payment({
        reference,
        amount,
        status: 'approved',
        approvedBy: ctx.from.id.toString(),
        type: 'admin-added',
            plan: 'balance-topup',
            userId: new mongoose.Types.ObjectId('000000000000000000000000'),
            chatId: '0'
      });
      
          return payment.save()
            .then(() => {
        ctx.reply(`✅ Reference ${reference} added to approved payments database for ₦${amount}.`, adminMenuKeyboard);
            })
            .catch(err => {
        console.error('Error saving pre-approved reference:', err);
              ctx.reply(`❌ Error adding reference to database: ${err.message}`, adminMenuKeyboard);
            });
        })
        .catch(err => {
          console.error('Error checking reference:', err);
          ctx.reply(`❌ Error checking reference: ${err.message}`, adminMenuKeyboard);
      });
    } catch (error) {
      console.error('Error in add reference command:', error);
      ctx.reply(`❌ Error processing command: ${error.message}`, adminMenuKeyboard);
    }
  } else {
    return ctx.reply('You do not have permission to use this command.');
  }
});

// Fix the SMS fee button handling
bot.action(/sms_fee_(\d+)/, (ctx) => {
  if (ctx.isAdmin) {
    const { handleSmsFeeButton } = require('./handlers/planHandler');
    return handleSmsFeeButton(ctx);
  } else {
    return ctx.answerCbQuery('You do not have permission to perform this action.');
  }
});

// Admin payment approval/rejection
bot.action(/approve_payment_(.+)/, async (ctx) => {
  if (ctx.isAdmin) {
    try {
      await ctx.answerCbQuery();
    } catch (error) {
      // Ignore callback query timeout errors
      console.log('Callback query error (ignoring):', error.message);
    }
    return approvePaymentHandler(ctx);
  }
  try {
    await ctx.answerCbQuery('You do not have permission to perform this action.');
  } catch (error) {
    console.log('Callback query error (ignoring):', error.message);
  }
});

bot.action(/decline_payment_(.+)/, async (ctx) => {
  if (ctx.isAdmin) {
    try {
      await ctx.answerCbQuery();
    } catch (error) {
      // Ignore callback query timeout errors
      console.log('Callback query error (ignoring):', error.message);
    }
    return declinePaymentHandler(ctx);
  }
  try {
    await ctx.answerCbQuery('You do not have permission to perform this action.');
  } catch (error) {
    console.log('Callback query error (ignoring):', error.message);
  }
});

// Back button
bot.hears('Back 🔙', ctx => {
  return ctx.reply('Main menu:', mainMenuKeyboard);
});

// Error handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply('An error occurred. Please try again later.');
});

// Start bot
bot.launch()
  .then(() => {
    console.log('Wi-FREE Bot is running!');
    console.log('Bot hosting information:');
    console.log('- When your PC powers off, the bot will go offline.');
    console.log('- To keep the bot running 24/7, you should host it on a server.');
    console.log('- Options for hosting include: Heroku, DigitalOcean, AWS, etc.');
    console.log('- Your MongoDB is hosted online, so your data is safe.');
  })
  .catch(err => {
    console.error('Error starting bot:', err);
    if (err.code === 'ENOTFOUND' && err.message.includes('api.telegram.org')) {
      console.error('Network error: Cannot reach Telegram API. Please check your internet connection.');
      console.error('The bot will automatically retry when internet connectivity is restored.');
    }
  });

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Reference command - shortcut to submit payment reference
bot.command('reference', (ctx) => {
  if (ctx.isAdmin) {
  ctx.reply('You can submit your payment reference using this command.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Submit Payment Reference", callback_data: "submit_reference" }]
      ]
    }
  });
  } else {
    ctx.reply('You do not have permission to use this command.');
  }
});

// New SMS fee configuration buttons
bot.action(/sms_fee_\d+/, async (ctx) => {
  if (ctx.isAdmin) {
    try {
      // Import the handleSmsFeeButton function from planHandler
      const { handleSmsFeeButton } = require('./handlers/planHandler');
      return handleSmsFeeButton(ctx);
    } catch (error) {
      console.log('Error handling SMS fee button:', error.message);
      try {
        await ctx.answerCbQuery('An error occurred while updating the SMS fee.');
      } catch (cbError) {
        console.log('Callback query error (ignoring):', cbError.message);
      }
    }
  } else {
    try {
      await ctx.answerCbQuery('You do not have permission to perform this action.');
    } catch (error) {
      console.log('Callback query error (ignoring):', error.message);
    }
  }
});

// Add an admin command to show SMS fee info
bot.command('smsfee', ctx => {
  if (ctx.isAdmin) {
    const { getSmsFee } = require('./handlers/planHandler');
    const currentFee = getSmsFee();
    
    // Create inline keyboard for admin to easily adjust
    const smsFeeKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "₦2", callback_data: "sms_fee_2" },
            { text: "₦5", callback_data: "sms_fee_5" },
            { text: "₦10", callback_data: "sms_fee_10" }
          ],
          [
            { text: "₦15", callback_data: "sms_fee_15" },
            { text: "₦20", callback_data: "sms_fee_20" },
            { text: "₦25", callback_data: "sms_fee_25" }
          ]
        ]
      }
    };
    
    return ctx.reply(
      `📱 *SMS Fee Configuration*\n\n` +
      `Current SMS fee: ₦${currentFee}\n\n` +
      `To update, select a value below or use command:\n` +
      `/setsmsfee <amount>`,
      { parse_mode: 'Markdown', ...smsFeeKeyboard }
    );
  }
  return ctx.reply('You do not have permission to use this command.');
});

// Fix the /broadcast command to send message to all users
bot.command('broadcast', async (ctx) => {
  if (ctx.isAdmin) {
    const message = ctx.message.text.replace(/^\/broadcast\s+/, '');
    if (!message) {
      return ctx.reply('Usage: /broadcast <message>', adminMenuKeyboard);
    }
    
    try {
      const { User } = require('./models');
      const users = await User.find({});
      
      if (users.length === 0) {
        return ctx.reply('No users found to broadcast message to.', adminMenuKeyboard);
      }
      
      let sentCount = 0;
      let failedCount = 0;
      
      // Show progress message
      await ctx.reply(`Broadcasting message to ${users.length} users...`);
      
      for (const user of users) {
        try {
          await ctx.telegram.sendMessage(
            user.chatId,
            `📢 *Announcement*\n\n${message}`,
            { parse_mode: 'Markdown' }
          );
          sentCount++;
        } catch (error) {
          console.error(`Error sending broadcast to user ${user.chatId}:`, error);
          failedCount++;
        }
      }
      
      await ctx.reply(
        `✅ Broadcast complete!\n\nSent to: ${sentCount} users\nFailed: ${failedCount} users`,
        adminMenuKeyboard
      );
    } catch (error) {
      console.error('Error broadcasting message:', error);
      ctx.reply(`❌ Error broadcasting message: ${error.message}`, adminMenuKeyboard);
    }
  } else {
    return ctx.reply('You do not have permission to use this command.');
  }
});

// Add command to message only active subscribers
bot.command('msg', async (ctx) => {
  if (ctx.isAdmin) {
    const text = ctx.message.text;
    const match = text.match(/^\/msg\s+(\w+)\s+(.+)$/s);
    
    if (!match) {
      return ctx.reply(
        'Usage:\n/msg actives <message> - Send to users with active plans\n/msg all <message> - Send to all users',
        adminMenuKeyboard
      );
    }
    
    const target = match[1].toLowerCase();
    const message = match[2];
    
    try {
      const { User } = require('./models');
      let users = [];
      
      if (target === 'actives') {
        users = await User.find({ 'plan.isActive': true });
        await ctx.reply(`Sending message to ${users.length} users with active plans...`);
      } else if (target === 'all') {
        users = await User.find({});
        await ctx.reply(`Sending message to all ${users.length} users...`);
      } else {
        return ctx.reply(
          'Invalid target. Use:\n/msg actives <message> - Send to users with active plans\n/msg all <message> - Send to all users',
          adminMenuKeyboard
        );
      }
      
      if (users.length === 0) {
        return ctx.reply('No users found matching the criteria.', adminMenuKeyboard);
      }
      
      let sentCount = 0;
      let failedCount = 0;
      
      for (const user of users) {
        try {
          await ctx.telegram.sendMessage(
            user.chatId,
            `📢 *Message from Admin*\n\n${message}`,
            { parse_mode: 'Markdown' }
          );
          sentCount++;
        } catch (error) {
          console.error(`Error sending message to user ${user.chatId}:`, error);
          failedCount++;
        }
      }
      
      await ctx.reply(
        `✅ Message sent!\n\nDelivered to: ${sentCount} users\nFailed: ${failedCount} users`,
        adminMenuKeyboard
      );
    } catch (error) {
      console.error('Error sending targeted message:', error);
      ctx.reply(`❌ Error sending message: ${error.message}`, adminMenuKeyboard);
    }
  } else {
    return ctx.reply('You do not have permission to use this command.');
  }
});

// Add command to quickly approve payments
bot.command('approve', async (ctx) => {
  if (ctx.isAdmin) {
    const paymentId = ctx.state.command.args[0];
    if (!paymentId) {
      return ctx.reply('Usage: /approve <payment_id>', adminMenuKeyboard);
    }
    
    try {
      const { Payment, User } = require('./models');
      const payment = await Payment.findById(paymentId);
      
      if (!payment) {
        return ctx.reply(`❌ Payment with ID ${paymentId} not found.`, adminMenuKeyboard);
      }
      
      if (payment.status === 'approved') {
        return ctx.reply(`⚠️ Payment with ID ${paymentId} is already approved.`, adminMenuKeyboard);
      }
      
      // Update payment status
      payment.status = 'approved';
      payment.approvedBy = ctx.from.id.toString();
      payment.approvedAt = new Date();
      await payment.save();
      
      // Find the user
      const user = await User.findOne({ _id: payment.user });
      
      if (!user) {
        return ctx.reply(`❌ User associated with payment ID ${paymentId} not found.`, adminMenuKeyboard);
      }
      
      // Handle payment based on type
      if (payment.type === 'balance' || payment.plan === 'balance-topup') {
        // Add to user's balance
        await user.addBalance(payment.amount);
        
        // Notify admin
        await ctx.reply(`✅ Balance topup approved!\nUser: ${user.firstName} ${user.lastName || ''}\nAmount: ₦${payment.amount}\nReference: ${payment.reference}`, adminMenuKeyboard);
        
        // Notify user
        await ctx.telegram.sendMessage(
          user.chatId,
          `✅ Your payment for balance topup of ₦${payment.amount.toFixed(2)} has been approved!\n\nYour new balance is ₦${user.balance.amount.toFixed(2)}.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        // Handle plan subscription
        // Set duration based on payment plan
        let durationDays = 1;
        if (payment.planType === '3days-unlimited') {
          durationDays = 3;
        } else if (payment.planType === '7days-unlimited') {
          durationDays = 7;
        }
        
        // Set up the plan
        await user.setPlan(payment.planType, durationDays);
        
        // Notify admin
        await ctx.reply(`✅ Plan payment approved!\nUser: ${user.firstName} ${user.lastName || ''}\nPlan: ${payment.planType}\nAmount: ₦${payment.amount}`, adminMenuKeyboard);
        
        // Notify user
        await ctx.telegram.sendMessage(
          user.chatId,
          `✅ Your payment for ${payment.planType} has been approved!\n\nYour plan is now active.`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error) {
      console.error('Error approving payment:', error);
      await ctx.reply(`❌ Error approving payment: ${error.message}`, adminMenuKeyboard);
    }
  } else {
    return ctx.reply('You do not have permission to use this command.');
  }
}); 