const { Markup } = require('telegraf');

// Main menu keyboard
const mainMenuKeyboard = Markup.keyboard([
  ['Show Me 🔎', 'My Plan 📊'],
  ['My Balance 💰', 'Buy Plan 💲'],
  ['Help ℹ️']
]).resize();

// Admin menu keyboard
const adminMenuKeyboard = {
  reply_markup: {
    keyboard: [
      ['View Pending Payments 💲', 'Statistics 📈'],
      ['SMS Users 📱', 'Deduct SMS Fee 💸'],
      ['View Users 👥', 'Set Message 📝'],
      ['Admin Help 📋', 'Back to User Menu 👤']
    ],
    resize_keyboard: true
  }
};

// Plans keyboard
const plansKeyboard = Markup.keyboard([
  ['15GB-1day (₦X)', '3days-unlimited (₦Y)'],
  ['7days-unlimited (₦Z)'],
  ['Back 🔙']
]).resize();

// Balance menu keyboard
const balanceKeyboard = {
  reply_markup: {
    keyboard: [
      ['Add Balance 💰'],
      ['SMS Token Settings 📱'],
      ['Back 🔙']
    ],
    resize_keyboard: true
  }
};

// Back keyboard
const backKeyboard = Markup.keyboard([
  [{text: 'Back 🔙'}]
]).resize();

// Payment method keyboard
const paymentMethodKeyboard = Markup.keyboard([
  ['Pay with Balance 💼', 'Pay Now 💳'],
  [{text: 'Back 🔙'}]
]).resize();

// SMS option keyboard
const smsOptionKeyboard = Markup.keyboard([
  ['Enable SMS (+₦5) ✅', 'Skip SMS ❌'],
  ['Back 🔙']
]).resize();

// Inline payment verification keyboard
const paymentVerificationKeyboard = (paymentId) => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Approve', `approve_payment_${paymentId}`),
      Markup.button.callback('❌ Decline', `decline_payment_${paymentId}`)
    ]
  ]);
};

// Inline payment reference submission keyboard
const submitReferenceKeyboard = (plan) => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Submit Payment Reference', `submit_reference_${plan}`)],
    [Markup.button.callback('Cancel', 'cancel_payment')]
  ]);
};

module.exports = {
  mainMenuKeyboard,
  adminMenuKeyboard,
  plansKeyboard,
  balanceKeyboard,
  backKeyboard,
  paymentMethodKeyboard,
  smsOptionKeyboard,
  paymentVerificationKeyboard,
  submitReferenceKeyboard
}; 