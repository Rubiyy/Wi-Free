const { Scenes } = require('telegraf');
const { User, Payment } = require('../models');
const { formatDate } = require('../utils');
const { mainMenuKeyboard, plansKeyboard, paymentMethodKeyboard, smsOptionKeyboard, backKeyboard } = require('../keyboards');

// Plan prices - define prices for display
const PLAN_PRICES = {
  '15GB-1day': 200,
  '3days-unlimited': 500,
  '7days-unlimited': 1000
};

// SMS fee - configurable for admin
let SMS_FEE = 5;

// Helper function to get plan details including pricing
function getPlanDetails(planType) {
  let name, description, price, speed, usage, dependency;
  
  switch (planType) {
    case '15GB-1day':
      name = '15GB Daily Surf';
      description = 'Stay connected all day without breaking the bank!';
      price = PLAN_PRICES[planType];
      speed = '20Mbps';
      usage = 'Stream, download, and scroll all day';
      dependency = 'EEDC server dependency';
      break;
    case '3days-unlimited':
      name = '3 Days - Unlimited';
      description = 'Great for short-term heavy use';
      price = PLAN_PRICES[planType];
      speed = '40Mbps';
      usage = 'Stream, download, and scroll all day';
      dependency = 'EEDC server dependency';
      break;
    case '7days-unlimited':
      name = '7 Days - Unlimited';
      description = '7 days of freedom—stream, work, play!';
      price = PLAN_PRICES[planType];
      speed = '40Mbps';
      usage = 'Stream, download, and scroll all day';
      dependency = 'EEDC server dependency';
      break;
    default:
      name = 'Unknown Plan';
      description = 'Details not available';
      price = 0;
      speed = 'N/A';
      usage = 'N/A';
      dependency = 'N/A';
  }
  
  return { name, description, price, speed, usage, dependency };
}

// Function to update SMS fee - for admin
function updateSmsFee(newFee) {
  if (isNaN(newFee) || newFee < 0) {
    return false;
  }
  SMS_FEE = parseFloat(newFee);
  return true;
}

// Function to get current SMS fee
function getSmsFee() {
  return SMS_FEE;
}

// My Plan handler - Show user plan information
const myPlanHandler = async (ctx) => {
  try {
    const user = ctx.user;
    
    if (!user.plan.isActive) {
      await ctx.reply(
        `📊 *Your Plan*\n\n` +
        `You don't have an active plan.\n\n` +
        `Use the Buy Plan option to subscribe.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    const planDetails = getPlanDetails(user.plan.type);
    
    const planMessage = 
      `📊 *Your Active Plan*\n\n` +
      `Plan: ${planDetails.name}\n` +
      `Description: ${planDetails.description}\n` +
      `Status: Active ✅\n` +
      `Start Date: ${formatDate(user.plan.startDate)}\n` +
      `End Date: ${formatDate(user.plan.endDate)}\n` +
      `Remaining: ${getDaysRemaining(user.plan.endDate)} days\n\n` +
      `SMS Token: ${user.smsToken.isEnabled ? '✅ Enabled' : '❌ Disabled'}`;
    
    await ctx.replyWithMarkdown(planMessage);
  } catch (error) {
    console.error('Error in plan handler:', error);
    await ctx.reply('Sorry, something went wrong. Please try again later.');
  }
};

// Helper function to calculate days remaining
function getDaysRemaining(endDate) {
  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays < 0 ? 0 : diffDays;
}

// Buy Plan handler - Show available plans with prices
const buyPlanHandler = async (ctx) => {
  try {
    // Update plan keyboard with prices
    const pricedPlansKeyboard = {
      reply_markup: {
        keyboard: [
          [`15GB-1day (₦${PLAN_PRICES['15GB-1day']})`, `3days-unlimited (₦${PLAN_PRICES['3days-unlimited']})`],
          [`7days-unlimited (₦${PLAN_PRICES['7days-unlimited']})`],
          ['Back 🔙']
        ],
        resize_keyboard: true
      }
    };
    
    await ctx.reply(
      `💲 *Available Plans*\n\n` +
      `Please select a plan to view details and purchase:`,
      { parse_mode: 'Markdown', ...pricedPlansKeyboard }
    );
  } catch (error) {
    console.error('Error in buy plan handler:', error);
    await ctx.reply('Sorry, something went wrong. Please try again later.');
  }
};

// Plan details handler - Show plan details and subscription options
const planDetailsHandler = async (ctx, planType) => {
  try {
    // Extract plan type from button text if needed
    if (planType.includes('(₦')) {
      planType = planType.split(' (₦')[0];
    }
    
    // Store the selected plan in user session
    ctx.session.selectedPlan = planType;
    
    const planDetails = getPlanDetails(planType);
    
    await ctx.reply(
      `📱 *${planDetails.name}*\n\n` +
      `${planDetails.description}\n\n` +
      `✅ Data: ${planType === '15GB-1day' ? '15GB' : 'Unlimited'} for ${planType === '15GB-1day' ? '1 Day' : planType === '3days-unlimited' ? '3 Days' : '7 Days'}\n` +
      `✅ Internet Speed: ${planDetails.speed}\n` +
      `✅ Usage: ${planDetails.usage}\n` +
      `✅ ${planDetails.dependency}\n\n` +
      `Price: ₦${planDetails.price}\n\n` +
      `To purchase this plan, select an option:`,
      { parse_mode: 'Markdown', ...paymentMethodKeyboard }
    );
  } catch (error) {
    console.error('Error in plan details handler:', error);
    await ctx.reply('Sorry, something went wrong. Please try again later.');
  }
};

// Payment information handler - Show payment details for bank transfer
const paymentInfoHandler = async (ctx) => {
  try {
    if (!ctx.session.selectedPlan) {
      await ctx.reply('Please select a plan first.', plansKeyboard);
      return;
    }
    
    const planType = ctx.session.selectedPlan;
    const planDetails = getPlanDetails(planType);
    
    // Store payment method
    ctx.session.paymentMethod = 'bank';
    
    // Ensure user is loaded
    if (!ctx.user) {
      const chatId = ctx.from.id.toString();
      ctx.user = await User.findOne({ chatId });
      
      if (!ctx.user) {
        // Create new user if not found
        const newUser = new User({
          chatId,
          username: ctx.from.username || 'N/A',
          firstName: ctx.from.first_name || 'User',
          lastName: ctx.from.last_name || '',
          balance: { amount: 0 },
          plan: { isActive: false },
          smsToken: { isEnabled: false }
        });
        await newUser.save();
        ctx.user = newUser;
      }
    }
    
    // Check if user has SMS token enabled
    const hasSmsConfig = ctx.user && ctx.user.smsToken && ctx.user.smsToken.isEnabled;
    
    if (hasSmsConfig) {
      // Enhanced message for users with SMS already configured
      await ctx.reply(
        `💳 *Payment Details*\n\n` +
        `Plan: ${planDetails.name}\n` +
        `Base Price: ₦${planDetails.price}\n\n` +
        `You have SMS token enabled for phone: ${ctx.user.smsToken.phoneNumber}\n` +
        `Using SMS token will add ₦${SMS_FEE} to your plan cost.\n\n` +
        `Please make payment to the account below:\n\n` +
        `*Bank Name:* Palmpay Bank\n` +
        `*Account Number:* 9113692963\n` +
        `*Account Name:* Mr Nicholas\n\n` +
        `After making the payment, click the button below to submit your payment reference:`,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: "Submit Payment Reference", callback_data: `submit_reference_${planType}` }],
              [{ text: "Cancel", callback_data: "cancel_payment" }]
            ]
          }
        }
      );
    } else {
      // Message for users without SMS configuration
      await ctx.reply(
        `💳 *Payment Details*\n\n` +
        `Plan: ${planDetails.name}\n` +
        `Base Price: ₦${planDetails.price}\n\n` +
        `*Options:*\n` +
        `- Basic Plan (No SMS): ₦${planDetails.price}\n` +
        `- With SMS Token: ₦${planDetails.price + SMS_FEE} (includes ₦${SMS_FEE} SMS fee)\n\n` +
        `Please make payment to the account below:\n\n` +
        `*Bank Name:* Palmpay Bank\n` +
        `*Account Number:* 9113692963\n` +
        `*Account Name:* Mr Nicholas\n\n` +
        `After making the payment, click the button below to submit your payment reference:`,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: "Submit Payment Reference", callback_data: `submit_reference_${planType}` }],
              [{ text: "Cancel", callback_data: "cancel_payment" }]
            ]
          }
        }
      );
    }
  } catch (error) {
    console.error('Error in payment info handler:', error);
    await ctx.reply('Sorry, something went wrong. Please try again later.');
  }
};

// Submit Reference handler - Wizard scene for reference submission
const submitReferenceHandler = new Scenes.WizardScene(
  'submitReference',
  async (ctx) => {
    try {
      // Get user from context or find it directly
      const chatId = ctx.from?.id?.toString();
      if (!chatId) {
        await ctx.reply(
          '❌ Error: Unable to identify your account. Please try again by typing /start and then accessing payment options.',
          mainMenuKeyboard
        );
        return ctx.scene.leave();
      }
      
      // Ensure user is loaded - using ctx.from.id instead of chatId for consistency
      const user = ctx.user || await User.findOne({ chatId: ctx.from.id.toString() });
      if (!user) {
        // If user is still not found, create a new one
        console.error(`User not found with chatId ${chatId}, creating new user`);
        const newUser = new User({
          chatId,
          username: ctx.from.username,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name
        });
        await newUser.save();
        ctx.user = newUser;
      } else {
        ctx.user = user; // Set in context for future steps
      }
      
      // Get plan from callback data or session
      let planType;
      if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith('submit_reference_')) {
        planType = ctx.callbackQuery.data.replace('submit_reference_', '');
        ctx.session.selectedPlan = planType;
      } else {
        planType = ctx.session.selectedPlan;
      }
      
      if (!planType) {
        await ctx.reply('No plan selected. Please start again by selecting a plan.', mainMenuKeyboard);
        return ctx.scene.leave();
      }
      
      const planDetails = getPlanDetails(planType);
      
      // Check if user already has SMS configured
      const hasSmsConfig = ctx.user.smsToken && ctx.user.smsToken.isEnabled;
      
      if (hasSmsConfig) {
        // Ask if user wants to use their SMS config for this plan
        await ctx.reply(
          `💳 *Submit Payment Reference*\n\n` +
          `Plan: ${planDetails.name}\n` +
          `Base Price: ₦${planDetails.price}\n\n` +
          `You have SMS token enabled for phone: ${ctx.user.smsToken.phoneNumber}\n` +
          `Using SMS token will add ₦${SMS_FEE} to your plan cost.\n\n` +
          `Would you like to use SMS token for this plan?`,
          { 
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [
                ['Yes, use SMS token ✅'],
                ['No, skip SMS token ❌'],
                ['Back 🔙']
              ],
              resize_keyboard: true
            }
          }
        );
        
        ctx.wizard.state.data = { 
          planType,
          smsConfigured: true 
        };
        
        return ctx.wizard.next();
      } else {
        // First, ask for SMS preference
        await ctx.reply(
          `Do you want to enable SMS token notifications for this plan?\n\n` +
          `This will add ₦${SMS_FEE} to the plan cost and capture your phone number.\n\n` +
          `Note: This configures your account for SMS tokens.`,
          smsOptionKeyboard
        );
        
        ctx.wizard.state.data = { planType };
        return ctx.wizard.next();
      }
    } catch (error) {
      console.error('Error in submit reference handler:', error);
      await ctx.reply('❌ Error processing your request. Please try again later.', mainMenuKeyboard);
      return ctx.scene.leave();
    }
  },
  async (ctx) => {
    try {
      // Get response
      const response = ctx.message?.text;
      
      if (response === 'Back 🔙') {
        await ctx.reply('Payment submission cancelled.', mainMenuKeyboard);
        return ctx.scene.leave();
      }
      
      const planType = ctx.wizard.state.data.planType;
      const planDetails = getPlanDetails(planType);
      let enableSms = false;
      
      // Handle response based on whether user already has SMS configured
      if (ctx.wizard.state.data.smsConfigured) {
        // User already has SMS configured - just use it, no need to collect phone number again
        enableSms = response === 'Yes, use SMS token ✅';
        ctx.wizard.state.data.collectingPhone = false;
        ctx.wizard.state.data.enableSms = enableSms;
        
        // Calculate total amount with SMS fee if enabled
        let totalAmount = planDetails.price;
        if (enableSms) {
          totalAmount += SMS_FEE;
        }
        
        // Ask for payment reference
        await ctx.reply(
          `💳 *STEP 2: Submit Payment Reference*\n\n` +
          `${enableSms ? `SMS Token will be enabled for this plan\n` : 'SMS Token will not be used for this plan\n'}` +
          `Plan: ${planDetails.name}\n` +
          `Price: ₦${planDetails.price}\n` +
          `${enableSms ? `SMS Fee: ₦${SMS_FEE}\n` : ''}` +
          `Total Amount: ₦${totalAmount}\n\n` +
          `Please enter your payment reference/transaction ID:`,
          { parse_mode: 'Markdown', ...backKeyboard }
        );
        
        // Skip phone collection step, go straight to reference
        return ctx.wizard.selectStep(3); // Go directly to reference step
      } else {
        // User doesn't have SMS configured
        enableSms = response === 'Enable SMS (+₦5) ✅';
        ctx.wizard.state.data.enableSms = enableSms;
        
        // If they want SMS but don't have it configured, collect phone number
        if (enableSms) {
          await ctx.reply(
            `📱 *STEP 1: Phone Number Required*\n\n` +
            `Please enter your phone number to receive SMS tokens.\n` +
            `Use numerical format only (e.g., 08012345678)\n\n` +
            `Note: In the next step, you'll be asked for your payment reference.`,
            { parse_mode: 'Markdown', ...backKeyboard }
          );
          
          ctx.wizard.state.data.collectingPhone = true;
          return ctx.wizard.next();
        } else {
          // If SMS is not needed, skip to payment reference
          // Calculate total amount (just plan price, no SMS fee)
          let totalAmount = planDetails.price;
          
          // Ask for payment reference
          await ctx.reply(
            `💳 *STEP 2: Submit Payment Reference*\n\n` +
            `Plan: ${planDetails.name}\n` +
            `Price: ₦${totalAmount}\n\n` +
            `Please enter your payment reference/transaction ID:`,
            { parse_mode: 'Markdown', ...backKeyboard }
          );
          
          // Skip phone collection step, go straight to reference
          return ctx.wizard.selectStep(3); // Go directly to reference step
        }
      }
    } catch (error) {
      console.error('Error processing SMS preference:', error);
      await ctx.reply('❌ Error processing your selection. Please try again later.', mainMenuKeyboard);
      return ctx.scene.leave();
    }
  },
  async (ctx) => {
    try {
      // This is the phone number collection step
      const phoneNumber = ctx.message?.text;
      
      if (!phoneNumber) {
        await ctx.reply('Please enter a valid phone number:', backKeyboard);
        return;
      }
      
      if (phoneNumber === 'Back 🔙') {
        await ctx.reply('Payment submission cancelled.', mainMenuKeyboard);
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
      
      // Save phone number to state
      ctx.wizard.state.data.phoneNumber = phoneNumber;
      
      // Now ask for payment reference
      const planType = ctx.wizard.state.data.planType;
      const planDetails = getPlanDetails(planType);
      const totalAmount = planDetails.price + (ctx.wizard.state.data.enableSms ? SMS_FEE : 0);
      
      await ctx.reply(
        `💳 *STEP 2: Submit Payment Reference*\n\n` +
        `SMS will be configured for phone: ${phoneNumber}\n\n` +
        `Plan: ${planDetails.name}\n` +
        `Base Price: ₦${planDetails.price}\n` +
        `SMS Fee: ₦${SMS_FEE}\n` +
        `Total: ₦${totalAmount}\n\n` +
        `Please enter your payment reference/transaction ID:`,
        { parse_mode: 'Markdown', ...backKeyboard }
      );
      
      return ctx.wizard.next();
    } catch (error) {
      console.error('Error processing phone number:', error);
      await ctx.reply('❌ Error processing your phone number. Please try again later.', mainMenuKeyboard);
      return ctx.scene.leave();
    }
  },
  async (ctx) => {
    try {
      // Get the reference from the message
      const reference = ctx.message?.text;
      
      if (!reference) {
        await ctx.reply('❌ Please provide a valid reference.', backKeyboard);
        return;
      }
      
      if (reference === 'Back 🔙') {
        await ctx.reply('Payment submission cancelled.', mainMenuKeyboard);
        return ctx.scene.leave();
      }
      
      // Check if reference already exists
      const existingPayment = await Payment.findOne({ reference });
      if (existingPayment) {
        await ctx.reply('This payment reference has already been used. Please provide a different reference.', backKeyboard);
        return;
      }
      
      // Get or create user to ensure we have a valid user
      if (!ctx.user) {
        const chatId = ctx.from.id.toString();
        ctx.user = await User.findOne({ chatId });
        
        if (!ctx.user) {
          // Create a new user as fallback
          const newUser = new User({
            chatId,
            username: ctx.from.username || 'N/A',
            firstName: ctx.from.first_name || 'User',
            lastName: ctx.from.last_name || '',
            balance: { amount: 0 },
            plan: { isActive: false },
            smsToken: { isEnabled: false }
          });
          
          await newUser.save();
          ctx.user = newUser;
        }
      }
      
      // Get the plan details
      const planDetails = getPlanDetails(ctx.wizard.state.data.planType);
      if (!planDetails) {
        await ctx.reply('❌ Error: Plan details not found. Please try again later.', mainMenuKeyboard);
        return ctx.scene.leave();
      }
      
      // Create a new payment
      const payment = new Payment({
        userId: ctx.user._id,
        chatId: ctx.user.chatId,
        reference: reference,
        type: 'plan', // Required field
        plan: ctx.wizard.state.data.planType, // Required field
        amount: planDetails.price + (ctx.wizard.state.data.enableSms ? SMS_FEE : 0),
        smsTokenEnabled: ctx.wizard.state.data.enableSms,
        status: 'pending'
      });
      
      await payment.save();
      
      // If SMS is enabled and a phone number was provided, update the user's SMS settings
      if (ctx.wizard.state.data.enableSms && ctx.wizard.state.data.phoneNumber) {
        ctx.user.smsToken = {
          isEnabled: true,
          phoneNumber: ctx.wizard.state.data.phoneNumber
        };
        await ctx.user.save();
      }
      
      await ctx.reply(
        `✅ Your payment reference has been submitted! We'll verify it shortly.\n\n` +
        `Plan: ${planDetails.name}\n` +
        `Amount: ₦${payment.amount}\n` +
        `Reference: ${reference}\n` +
        `${ctx.wizard.state.data.enableSms ? 'SMS Token: Enabled✅' : 'SMS Token: Disabled❌'}`,
        mainMenuKeyboard
      );
      
      // Notify admin
      try {
        if (ctx.notifyAdmin) {
          await ctx.notifyAdmin(
            `💰 *New Payment Submission* 💰\n\n` +
            `*User:* ${ctx.user.firstName} ${ctx.user.lastName || ''} (@${ctx.user.username || 'N/A'})\n` +
            `*Plan:* ${planDetails.name}\n` +
            `*Amount:* ₦${payment.amount}\n` +
            `*Reference:* ${reference}\n` +
            `*SMS Token:* ${ctx.wizard.state.data.enableSms ? 'Enabled' : 'Disabled'}\n\n` +
            `Use /approve ${payment._id} to approve this payment.`
          );
        } else {
          // Fallback to direct message if notifyAdmin isn't available
          await ctx.telegram.sendMessage(
            process.env.ADMIN_CHAT_ID,
            `💰 New Payment Submission 💰\n\n` +
            `User: ${ctx.user.firstName} ${ctx.user.lastName || ''} (@${ctx.user.username || 'N/A'})\n` +
            `Plan: ${planDetails.name}\n` +
            `Amount: ₦${payment.amount}\n` +
            `Reference: ${reference}\n` +
            `SMS Token: ${ctx.wizard.state.data.enableSms ? 'Enabled' : 'Disabled'}`,
            { parse_mode: 'Markdown' }
          );
        }
      } catch (error) {
        console.error('Error notifying admin about payment:', error);
      }
      
      return ctx.scene.leave();
    } catch (error) {
      console.error('Error in submitReferenceHandler (reference step):', error);
      await ctx.reply('❌ An error occurred while processing your payment. Please try again later.', mainMenuKeyboard);
      return ctx.scene.leave();
    }
  }
);

// Cancel payment handler
const cancelPaymentHandler = async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('Payment cancelled.', mainMenuKeyboard);
  } catch (error) {
    console.error('Error cancelling payment:', error);
  }
};

// Pay with balance handler
const payWithBalanceHandler = async (ctx) => {
  try {
    if (!ctx.session.selectedPlan) {
      await ctx.reply('Please select a plan first.', plansKeyboard);
      return;
    }
    
    const planType = ctx.session.selectedPlan;
    const planDetails = getPlanDetails(planType);
    const user = ctx.user;
    
    // Store payment method
    ctx.session.paymentMethod = 'balance';
    
    // Check if user has enough balance for the base plan
    if (user.balance.amount < planDetails.price) {
      await ctx.reply(
        `❌ Insufficient balance.\n\n` +
        `Your current balance is ₦${user.balance.amount.toFixed(2)}.\n` +
        `Required amount for ${planDetails.name} is ₦${planDetails.price}.\n\n` +
        `Please add funds to your balance or choose another payment method.`,
        paymentMethodKeyboard
      );
      return;
    }
    
    // Check if user has SMS token enabled
    const hasSmsConfig = user.smsToken && user.smsToken.isEnabled;
    const hasSuffientBalanceWithSms = user.balance.amount >= (planDetails.price + SMS_FEE);
    
    if (!hasSmsConfig) {
      // Simple payment flow if no SMS is configured
      try {
        // Deduct from balance and set plan
        await user.deductBalance(planDetails.price);
        
        // Set duration based on plan
        let durationDays = 1;
        if (planType === '3days-unlimited') {
          durationDays = 3;
        } else if (planType === '7days-unlimited') {
          durationDays = 7;
        }
        
        await user.setPlan(planType, durationDays);
        
        // Create payment record for tracking
        const payment = new Payment({
          userId: user._id,
          chatId: user.chatId,
          reference: `BAL-${Date.now()}`,
          type: 'plan',
          plan: planType,
          amount: planDetails.price,
          smsTokenEnabled: false,
          status: 'approved',
          approvedBy: 'system'
        });
        
        await payment.save();
        
        await ctx.reply(
          `✅ *Plan Activated Successfully*\n\n` +
          `Plan: ${planDetails.name}\n` +
          `Amount: ₦${planDetails.price}\n` +
          `Active Until: ${formatDate(user.plan.endDate)}\n\n` +
          `Your plan is now active. To receive SMS tokens in the future, configure SMS settings in My Balance menu.`,
          { parse_mode: 'Markdown', ...mainMenuKeyboard }
        );
      } catch (error) {
        console.error('Error processing payment with balance:', error);
        await ctx.reply('❌ Error processing your payment. Please try again later.', mainMenuKeyboard);
      }
    } else {
      // Enhanced flow with SMS option
      await ctx.reply(
        `💰 *Pay with Balance*\n\n` +
        `You have SMS notifications enabled with phone number: ${user.smsToken.phoneNumber}\n\n` +
        `Plan: ${planDetails.name}\n` +
        `Base Price: ₦${planDetails.price}\n` +
        `SMS Fee: ₦${SMS_FEE}\n` +
        `Total with SMS: ₦${planDetails.price + SMS_FEE}\n\n` +
        `Your current balance: ₦${user.balance.amount.toFixed(2)}\n\n` +
        `Would you like to include SMS token for this plan?`,
        { 
          parse_mode: 'Markdown',
          ...smsOptionKeyboard
        }
      );
    }
  } catch (error) {
    console.error('Error in pay with balance handler:', error);
    await ctx.reply('Sorry, something went wrong. Please try again later.', mainMenuKeyboard);
  }
};

// Enable SMS handler
const enableSmsHandler = async (ctx) => {
  try {
    if (!ctx.session.selectedPlan || !ctx.session.paymentMethod) {
      await ctx.reply('Please start again by selecting a plan.', mainMenuKeyboard);
      return;
    }
    
    const planType = ctx.session.selectedPlan;
    const planDetails = getPlanDetails(planType);
    
    // Ensure user is loaded
    if (!ctx.user) {
      const chatId = ctx.from.id.toString();
      ctx.user = await User.findOne({ chatId });
      
      if (!ctx.user) {
        // Create new user if not found
        const newUser = new User({
          chatId,
          username: ctx.from.username || 'N/A',
          firstName: ctx.from.first_name || 'User',
          lastName: ctx.from.last_name || '',
          balance: { amount: 0 },
          plan: { isActive: false },
          smsToken: { isEnabled: false }
        });
        await newUser.save();
        ctx.user = newUser;
      }
    }
    
    // Set awaitingSmsSetup in session to handle direct phone number input
    ctx.session.awaitingSmsSetup = true;
    
    // If user doesn't have SMS enabled yet or phone number isn't set
    if (!ctx.user.smsToken.isEnabled || !ctx.user.smsToken.phoneNumber) {
      await ctx.reply(
        `📱 *Phone Number Required*\n\n` +
        `Please enter your phone number to enable SMS token notifications.\n` +
        `Use numerical format only (e.g., 08012345678)`,
        { parse_mode: 'Markdown', ...backKeyboard }
      );
      return;
    }
    
    // If user already has SMS enabled, confirm and calculate cost
    const totalCost = planDetails.price + SMS_FEE;
    
    // Check if user has sufficient balance with SMS fee
    if (ctx.session.paymentMethod === 'balance' && ctx.user.balance.amount < totalCost) {
      await ctx.reply(
        `❌ Insufficient balance for plan with SMS token.\n\n` +
        `Your current balance is ₦${ctx.user.balance.amount.toFixed(2)}.\n` +
        `Required amount with SMS fee is ₦${totalCost}.\n\n` +
        `Please add funds to your balance or choose another payment method.`,
        paymentMethodKeyboard
      );
      return;
    }
    
    // If paying with balance, process payment immediately
    if (ctx.session.paymentMethod === 'balance') {
      try {
        // Deduct from balance and set plan
        await ctx.user.deductBalance(totalCost);
        
        // Set duration based on plan
        let durationDays = 1;
        if (planType === '3days-unlimited') {
          durationDays = 3;
        } else if (planType === '7days-unlimited') {
          durationDays = 7;
        }
        
        // Activate plan
        await ctx.user.setPlan(planType, durationDays);
        
        // Send confirmation to user
        await ctx.reply(
          `✅ *Plan Activated with SMS Token*\n\n` +
          `Your ${planDetails.name} plan has been activated with SMS Token.\n\n` +
          `Base Price: ₦${planDetails.price}\n` +
          `SMS Fee: ₦${SMS_FEE}\n` +
          `Total: ₦${totalCost}\n\n` +
          `Your plan is active until: ${formatDate(ctx.user.plan.endDate)}\n` +
          `SMS Token is enabled for phone: ${ctx.user.smsToken.phoneNumber}`,
          { parse_mode: 'Markdown', ...mainMenuKeyboard }
        );
        
        // Clear selected plan and payment method
        ctx.session.selectedPlan = null;
        ctx.session.paymentMethod = null;
      } catch (error) {
        console.error('Error activating plan with SMS token:', error);
        await ctx.reply('❌ Error activating your plan. Please try again later.', mainMenuKeyboard);
      }
    } else {
      // For bank payment, show confirmation with SMS token
      await ctx.reply(
        `✅ *SMS Token Confirmed*\n\n` +
        `Your SMS token will be enabled for this plan purchase.\n` +
        `Phone: ${ctx.user.smsToken.phoneNumber}\n\n` +
        `Base Price: ₦${planDetails.price}\n` +
        `SMS Fee: ₦${SMS_FEE}\n` +
        `Total: ₦${totalCost}\n\n` +
        `Please submit your payment reference after making the payment.`,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: "Submit Payment Reference", callback_data: `submit_reference_${planType}` }],
              [{ text: "Cancel", callback_data: "cancel_payment" }]
            ]
          }
        }
      );
    }
  } catch (error) {
    console.error('Error in enable SMS handler:', error);
    await ctx.reply('Sorry, something went wrong. Please try again later.', mainMenuKeyboard);
  }
};

// Skip SMS handler
const skipSmsHandler = async (ctx) => {
  try {
    if (!ctx.session.selectedPlan || !ctx.session.paymentMethod) {
      await ctx.reply('Please start again by selecting a plan.', mainMenuKeyboard);
      return;
    }
    
    const planType = ctx.session.selectedPlan;
    const planDetails = getPlanDetails(planType);
    
    // Ensure user is loaded
    if (!ctx.user) {
      const chatId = ctx.from.id.toString();
      ctx.user = await User.findOne({ chatId });
      
      if (!ctx.user) {
        // Create new user if not found
        const newUser = new User({
          chatId,
          username: ctx.from.username || 'N/A',
          firstName: ctx.from.first_name || 'User',
          lastName: ctx.from.last_name || '',
          balance: { amount: 0 },
          plan: { isActive: false },
          smsToken: { isEnabled: false }
        });
        await newUser.save();
        ctx.user = newUser;
      }
    }
    
    // Clear SMS setup from session
    ctx.session.awaitingSmsSetup = false;
    
    // Process based on payment method
    if (ctx.session.paymentMethod === 'balance') {
      // Check if user has sufficient balance
      if (ctx.user.balance.amount < planDetails.price) {
        await ctx.reply(
          `❌ Insufficient balance.\n\n` +
          `Your current balance is ₦${ctx.user.balance.amount.toFixed(2)}.\n` +
          `Required amount for ${planDetails.name} is ₦${planDetails.price}.\n\n` +
          `Please add funds to your balance or choose another payment method.`,
          paymentMethodKeyboard
        );
        return;
      }
      
      // Deduct from balance and set plan
      try {
        await ctx.user.deductBalance(planDetails.price);
        
        // Set duration based on plan
        let durationDays = 1;
        if (planType === '3days-unlimited') {
          durationDays = 3;
        } else if (planType === '7days-unlimited') {
          durationDays = 7;
        }
        
        // Activate plan
        await ctx.user.setPlan(planType, durationDays);
        
        // Send confirmation to user
        await ctx.reply(
          `✅ *Plan Activated Successfully*\n\n` +
          `Your ${planDetails.name} plan has been activated without SMS token.\n\n` +
          `Amount: ₦${planDetails.price}\n` +
          `Active Until: ${formatDate(ctx.user.plan.endDate)}`,
          { parse_mode: 'Markdown', ...mainMenuKeyboard }
        );
        
        // Clear selected plan and payment method
        ctx.session.selectedPlan = null;
        ctx.session.paymentMethod = null;
      } catch (error) {
        console.error('Error processing payment with balance:', error);
        await ctx.reply('❌ Error processing your payment. Please try again later.', mainMenuKeyboard);
      }
    } else {
      // For bank payment, show payment instructions
      await ctx.reply(
        `💳 *Payment Details*\n\n` +
        `Plan: ${planDetails.name}\n` +
        `Amount: ₦${planDetails.price}\n\n` +
        `Please make payment to the account below:\n\n` +
        `*Bank Name:* Palmpay Bank\n` +
        `*Account Number:* 9113692963\n` +
        `*Account Name:* Mr Nicholas\n\n` +
        `After making the payment, click the button below to submit your payment reference:`,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: "Submit Payment Reference", callback_data: `submit_reference_${planType}` }],
              [{ text: "Cancel", callback_data: "cancel_payment" }]
            ]
          }
        }
      );
    }
  } catch (error) {
    console.error('Error in skip SMS handler:', error);
    await ctx.reply('Sorry, something went wrong. Please try again later.', mainMenuKeyboard);
  }
};

// Bank payment handler (simplified with Pay Now)
const bankPaymentHandler = async (ctx) => {
  try {
    if (!ctx.session.selectedPlan) {
      await ctx.reply('Please select a plan first.', plansKeyboard);
      return;
    }
    
    const planType = ctx.session.selectedPlan;
    const planDetails = getPlanDetails(planType);
    
    await ctx.reply(
      `💳 *Bank Payment*\n\n` +
      `Plan: ${planDetails.name}\n` +
      `Price: ₦${planDetails.price}\n\n` +
      `Please make payment to the account below:\n\n` +
      `*Bank Name:* Palmpay Bank\n` +
      `*Account Number:* 9113692963\n` +
      `*Account Name:* Mr Nicholas\n\n` +
      `After making the payment, click the button below to submit your payment reference:`,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "Submit Payment Reference", callback_data: `submit_reference_${planType}` }],
            [{ text: "Cancel", callback_data: "cancel_payment" }]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Error in bank payment handler:', error);
    await ctx.reply('Sorry, something went wrong. Please try again later.', mainMenuKeyboard);
  }
};

// Process SMS setup function - called from middleware
const processSmsSetup = async (ctx) => {
  // Only process text messages
  if (!ctx.message || !ctx.message.text) return false;
  
  // Check if we're expecting a phone number for SMS setup
  if (!ctx.session.awaitingSmsSetup) return false;
  
  const phoneNumber = ctx.message.text;
  
  // Validate phone number - only accept numbers
  if (!phoneNumber || !/^\d+$/.test(phoneNumber)) {
    await ctx.reply(
      `❌ Invalid phone number format. Please enter digits only.\n` +
      `For example: 08012345678`,
      backKeyboard
    );
    return true; // Handled the message
  }
  
  try {
    // Ensure user is loaded
    if (!ctx.user) {
      const chatId = ctx.from.id.toString();
      ctx.user = await User.findOne({ chatId });
      
      if (!ctx.user) {
        // Create new user if not found
        const newUser = new User({
          chatId,
          username: ctx.from.username || 'N/A',
          firstName: ctx.from.first_name || 'User',
          lastName: ctx.from.last_name || '',
          balance: { amount: 0 },
          plan: { isActive: false },
          smsToken: { isEnabled: false }
        });
        await newUser.save();
        ctx.user = newUser;
      }
    }
    
    // Enable SMS token
    ctx.user.smsToken = {
      isEnabled: true,
      phoneNumber: phoneNumber
    };
    await ctx.user.save();
    
    // Continue with payment process for the selected plan
    const planType = ctx.session.selectedPlan;
    const planDetails = getPlanDetails(planType);
    
    // Calculate total with SMS fee
    const totalCost = planDetails.price + SMS_FEE;
    
    if (ctx.session.paymentMethod === 'balance') {
      // Check if user has sufficient balance
      if (ctx.user.balance.amount < totalCost) {
        await ctx.reply(
          `❌ Insufficient balance for plan with SMS token.\n\n` +
          `Your current balance is ₦${ctx.user.balance.amount.toFixed(2)}.\n` +
          `Required amount with SMS fee is ₦${totalCost}.\n\n` +
          `Please add funds to your balance or choose another payment method.`,
          paymentMethodKeyboard
        );
        
        // Clear session data
        ctx.session.awaitingSmsSetup = false;
        return true;
      }
      
      // Deduct from balance and set plan
      try {
        await ctx.user.deductBalance(totalCost);
        
        // Set duration based on plan
        let durationDays = 1;
        if (planType === '3days-unlimited') {
          durationDays = 3;
        } else if (planType === '7days-unlimited') {
          durationDays = 7;
        }
        
        // Activate plan
        await ctx.user.setPlan(planType, durationDays);
        
        // Send confirmation to user
        await ctx.reply(
          `✅ *Plan Activated with SMS Token*\n\n` +
          `Your ${planDetails.name} plan has been activated with SMS Token.\n\n` +
          `Base Price: ₦${planDetails.price}\n` +
          `SMS Fee: ₦${SMS_FEE}\n` +
          `Total: ₦${totalCost}\n\n` +
          `Your plan is active until: ${formatDate(ctx.user.plan.endDate)}\n` +
          `SMS Token is enabled for phone: ${phoneNumber}`,
          { parse_mode: 'Markdown', ...mainMenuKeyboard }
        );
        
        // Clear session data
        ctx.session.awaitingSmsSetup = false;
        ctx.session.selectedPlan = null;
        ctx.session.paymentMethod = null;
        
        return true;
      } catch (error) {
        console.error('Error activating plan with SMS token:', error);
        await ctx.reply('❌ Error activating your plan. Please try again later.', mainMenuKeyboard);
        
        // Clear session data
        ctx.session.awaitingSmsSetup = false;
        return true;
      }
    } else {
      // For bank payment, show payment confirmation and request reference
      await ctx.reply(
        `✅ *SMS Token Configured*\n\n` +
        `SMS will be configured for phone: ${phoneNumber}\n\n` +
        `Plan: ${planDetails.name}\n` +
        `Base Price: ₦${planDetails.price}\n` +
        `SMS Fee: ₦${SMS_FEE}\n` +
        `Total: ₦${totalCost}\n\n` +
        `Please make payment to the account below:\n\n` +
        `*Bank Name:* Palmpay Bank\n` +
        `*Account Number:* 9113692963\n` +
        `*Account Name:* Mr Nicholas\n\n` +
        `After making the payment, click the button below to submit your payment reference:`,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: "Submit Payment Reference", callback_data: `submit_reference_${planType}` }],
              [{ text: "Cancel", callback_data: "cancel_payment" }]
            ]
          }
        }
      );
      
      // Clear session data
      ctx.session.awaitingSmsSetup = false;
      return true;
    }
  } catch (error) {
    console.error('Error processing SMS setup:', error);
    await ctx.reply('❌ Error setting up SMS token. Please try again later.', mainMenuKeyboard);
    
    // Clear session data
    ctx.session.awaitingSmsSetup = false;
    return true;
  }
};

// Process SMS setup for bank payment
const processSmsSetupForBankPayment = async (ctx) => {
  // Only process text messages
  if (!ctx.message || !ctx.message.text) return false;
  
  // If user is in the process of entering a reference - skip this handler
  if (ctx.scene.current) return false;
  
  // Check if we're expecting a payment reference
  if (!ctx.session.smsSetupForBank) return false;
  
  try {
    const phoneNumber = ctx.message.text;
    
    // Validate phone number - only accept numbers
    if (!phoneNumber || !/^\d+$/.test(phoneNumber)) {
      await ctx.reply(
        `❌ Invalid phone number format. Please enter digits only.\n` +
        `For example: 08012345678`,
        backKeyboard
      );
      return true; // Handled the message
    }
    
    // Ensure user is loaded
    if (!ctx.user) {
      const chatId = ctx.from.id.toString();
      ctx.user = await User.findOne({ chatId });
      
      if (!ctx.user) {
        // Create new user if not found
        const newUser = new User({
          chatId,
          username: ctx.from.username || 'N/A',
          firstName: ctx.from.first_name || 'User',
          lastName: ctx.from.last_name || '',
          balance: { amount: 0 },
          plan: { isActive: false },
          smsToken: { isEnabled: false }
        });
        await newUser.save();
        ctx.user = newUser;
      }
    }
    
    // Update user's SMS token settings
    ctx.user.smsToken = {
      isEnabled: true,
      phoneNumber: phoneNumber
    };
    await ctx.user.save();
    
    // Get plan information
    const planType = ctx.session.selectedPlan;
    const planDetails = getPlanDetails(planType);
    
    // Calculate total cost with SMS fee
    const totalCost = planDetails.price + SMS_FEE;
    
    // Prompt for payment reference
    await ctx.reply(
      `✅ *SMS Token Configured*\n\n` +
      `SMS will be configured for phone: ${phoneNumber}\n\n` +
      `Plan: ${planDetails.name}\n` +
      `Base Price: ₦${planDetails.price}\n` +
      `SMS Fee: ₦${SMS_FEE}\n` +
      `Total: ₦${totalCost}\n\n` +
      `Please enter your payment reference/transaction ID:`,
      { parse_mode: 'Markdown', ...backKeyboard }
    );
    
    // Update session to wait for payment reference
    ctx.session.smsSetupForBank = false;
    ctx.session.awaitingBankReference = true;
    
    return true;
  } catch (error) {
    console.error('Error processing SMS setup for bank payment:', error);
    await ctx.reply('❌ Error setting up SMS token. Please try again later.', mainMenuKeyboard);
    
    // Clear session data
    ctx.session.smsSetupForBank = false;
    return true;
  }
};

// Process bank payment with SMS
const processBankPaymentWithSms = async (ctx) => {
  // Only process text messages
  if (!ctx.message || !ctx.message.text) return false;
  
  // If user is in a scene - skip this handler
  if (ctx.scene.current) return false;
  
  // Check if we're expecting a payment reference
  if (!ctx.session.awaitingBankReference) return false;
  
  try {
    const reference = ctx.message.text;
    
    if (reference === 'Back 🔙') {
      await ctx.reply('Payment submission cancelled.', mainMenuKeyboard);
      ctx.session.awaitingBankReference = false;
      return true;
    }
    
    // Validate reference
    if (!reference || reference.trim().length === 0) {
      await ctx.reply('❌ Please provide a valid payment reference.', backKeyboard);
      return true;
    }
    
    // Check if reference already exists
    const existingPayment = await Payment.findOne({ reference });
    if (existingPayment) {
      await ctx.reply('This payment reference has already been used. Please provide a different reference.', backKeyboard);
      return true;
    }
    
    // Ensure user is loaded
    if (!ctx.user) {
      const chatId = ctx.from.id.toString();
      ctx.user = await User.findOne({ chatId });
      
      if (!ctx.user) {
        // User not found - this should never happen at this point
        await ctx.reply('❌ Error: User not found. Please try again by typing /start.', mainMenuKeyboard);
        ctx.session.awaitingBankReference = false;
        return true;
      }
    }
    
    // Get plan information
    const planType = ctx.session.selectedPlan;
    const planDetails = getPlanDetails(planType);
    
    // Calculate total with SMS fee
    const totalCost = planDetails.price + SMS_FEE;
    
    // Create payment record
    const payment = new Payment({
      userId: ctx.user._id,
      chatId: ctx.user.chatId,
      reference: reference,
      type: 'plan', // Required field
      plan: planType, // Required field
      amount: totalCost,
      smsTokenEnabled: true,
      status: 'pending'
    });
    
    await payment.save();
    
    // Send confirmation
    await ctx.reply(
      `✅ *Payment Reference Submitted*\n\n` +
      `Your payment reference for ${planDetails.name} with SMS token has been submitted.\n\n` +
      `Reference: ${reference}\n` +
      `Amount: ₦${totalCost}\n` +
      `SMS Token: Enabled for ${ctx.user.smsToken.phoneNumber}\n\n` +
      `Your plan will be activated once the payment is approved. You will receive a notification when your plan is active.`,
      { parse_mode: 'Markdown', ...mainMenuKeyboard }
    );
    
    // Notify admin
    try {
      if (ctx.notifyAdmin) {
        await ctx.notifyAdmin(
          `💰 *New Payment Submission* 💰\n\n` +
          `*User:* ${ctx.user.firstName} ${ctx.user.lastName || ''} (@${ctx.user.username || 'N/A'})\n` +
          `*Plan:* ${planDetails.name} with SMS\n` +
          `*Amount:* ₦${totalCost}\n` +
          `*Reference:* ${reference}\n\n` +
          `Use /approve ${payment._id} to approve this payment.`
        );
      } else {
        // Fallback to direct message
        await ctx.telegram.sendMessage(
          process.env.ADMIN_CHAT_ID,
          `💰 New Payment Submission 💰\n\n` +
          `User: ${ctx.user.firstName} ${ctx.user.lastName || ''} (@${ctx.user.username || 'N/A'})\n` +
          `Plan: ${planDetails.name} with SMS\n` +
          `Amount: ₦${totalCost}\n` +
          `Reference: ${reference}`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error) {
      console.error('Error notifying admin about payment:', error);
    }
    
    // Clear session data
    ctx.session.awaitingBankReference = false;
    ctx.session.selectedPlan = null;
    
    return true;
  } catch (error) {
    console.error('Error processing bank payment with SMS:', error);
    await ctx.reply('❌ Error processing your payment. Please try again later.', mainMenuKeyboard);
    
    // Clear session data
    ctx.session.awaitingBankReference = false;
    return true;
  }
};

// Help handler
const helpHandler = async (ctx) => {
  try {
    const helpMessage = 
      `ℹ️ *Wi-FREE Bot Help*\n\n` +
      `*Commands:*\n` +
      `/start - Start the bot and access main menu\n` +
      `/help - Show this help message\n\n` +
      
      `*Features:*\n` +
      `🔎 *Show Me* - View your device connection info\n` +
      `📊 *My Plan* - Check your current plan status\n` +
      `💰 *My Balance* - Check and manage your balance\n` +
      `💲 *Buy Plan* - Purchase a new data plan\n\n` +
      
      `*Balance Management:*\n` +
      `- Add funds to your balance by bank transfer\n` +
      `- Use balance to pay for plans\n` +
      `- Configure SMS token settings\n\n` +
      
      `*Plans:*\n` +
      `- 15GB Daily (₦${PLAN_PRICES['15GB-1day']})\n` +
      `- 3 Days Unlimited (₦${PLAN_PRICES['3days-unlimited']})\n` +
      `- 7 Days Unlimited (₦${PLAN_PRICES['7days-unlimited']})\n\n` +
      
      `For further assistance, please contact our support team.`;
    
    await ctx.replyWithMarkdown(helpMessage);
  } catch (error) {
    console.error('Error in help handler:', error);
    await ctx.reply('Sorry, something went wrong. Please try again later.');
  }
};

// Set SMS fee handler for admin
const setSmsFeeHandler = async (ctx, newFee) => {
  try {
    const fee = parseFloat(newFee);
    if (isNaN(fee) || fee < 0) {
      await ctx.reply('Please provide a valid fee amount (e.g. 5.00).', adminMenuKeyboard);
      return;
    }
    
    // Update the SMS fee
    if (updateSmsFee(fee)) {
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
      
      await ctx.reply(
        `✅ SMS fee successfully updated to ₦${fee.toFixed(2)}.`,
        { ...smsFeeKeyboard }
      );
    } else {
      await ctx.reply('❌ Failed to update SMS fee. Please try again.', adminMenuKeyboard);
    }
  } catch (error) {
    console.error('Error in set SMS fee handler:', error);
    await ctx.reply('❌ Error updating SMS fee. Please try again later.', adminMenuKeyboard);
  }
};

// Handle SMS fee button callbacks
const handleSmsFeeButton = async (ctx) => {
  try {
    const feeStr = ctx.callbackQuery.data.replace('sms_fee_', '');
    const fee = parseInt(feeStr, 10);
    
    if (isNaN(fee)) {
      try {
        await ctx.answerCbQuery('Invalid fee amount');
      } catch (error) {
        console.log('Callback query error (ignoring):', error.message);
      }
      return;
    }
    
    // Update the SMS fee
    if (updateSmsFee(fee)) {
      try {
        await ctx.answerCbQuery(`SMS fee updated to ₦${fee}`);
      } catch (error) {
        console.log('Callback query error (ignoring):', error.message);
      }
      
      await ctx.editMessageText(
        `📱 *SMS Fee Configuration*\n\n` +
        `SMS fee updated to: ₦${fee}\n\n` +
        `To update again, select a value below or use command:\n` +
        `/setsmsfee <amount>`,
        { 
          parse_mode: 'Markdown',
          reply_markup: ctx.callbackQuery.message.reply_markup
        }
      );
    } else {
      try {
        await ctx.answerCbQuery('Failed to update SMS fee');
      } catch (error) {
        console.log('Callback query error (ignoring):', error.message);
      }
    }
  } catch (error) {
    console.error('Error handling SMS fee button:', error);
    try {
      await ctx.answerCbQuery('Error updating fee');
    } catch (cbError) {
      console.log('Callback query error (ignoring):', cbError.message);
    }
  }
};

// Function to get expiry date based on plan type
function getExpiryDate(planType) {
  const now = new Date();
  let days = 1;
  
  if (planType === '3days-unlimited') {
    days = 3;
  } else if (planType === '7days-unlimited') {
    days = 7;
  }
  
  const expiry = new Date(now);
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

module.exports = {
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
  getPlanDetails,
  setSmsFeeHandler,
  handleSmsFeeButton,
  getSmsFee,
  updateSmsFee,
  SMS_FEE
};