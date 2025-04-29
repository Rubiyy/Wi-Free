const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  username: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  deviceInfo: {
    ip: { type: String },
    userAgent: { type: String },
    fingerprint: { type: String }
  },
  plan: {
    type: { type: String, enum: ['none', '15GB-1day', '3days-unlimited', '7days-unlimited'], default: 'none' },
    startDate: { type: Date },
    endDate: { type: Date },
    isActive: { type: Boolean, default: false }
  },
  showMeUsage: {
    lastUsed: { type: Date },
    usedToday: { type: Boolean, default: false }
  },
  balance: { 
    amount: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  smsToken: {
    isEnabled: { type: Boolean, default: false },
    phoneNumber: { type: String },
    lastSent: { type: Date }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Check if user can use "show me" function
userSchema.methods.canUseShowMe = function() {
  // If user has active plan, they can use show me
  if (this.plan.isActive && this.plan.endDate > new Date()) {
    return true;
  }
  
  // If user has used show me in the last 24 hours, they can't use it again
  if (this.showMeUsage.lastUsed) {
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    return this.showMeUsage.lastUsed < oneDayAgo;
  }
  
  // First time user, they can use show me
  return true;
};

// Record show me usage
userSchema.methods.recordShowMeUsage = function() {
  this.showMeUsage.lastUsed = new Date();
  this.showMeUsage.usedToday = true;
  return this.save();
};

// Set user plan
userSchema.methods.setPlan = function(planType, durationInDays) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + durationInDays);
  
  this.plan = {
    type: planType,
    startDate,
    endDate,
    isActive: true
  };
  
  return this.save();
};

// Check if plan is expired
userSchema.methods.checkPlanExpiration = function() {
  if (this.plan.isActive && this.plan.endDate < new Date()) {
    this.plan.isActive = false;
    return this.save();
  }
  return Promise.resolve(this);
};

// Add balance to user account
userSchema.methods.addBalance = function(amount) {
  this.balance.amount += amount;
  this.balance.lastUpdated = new Date();
  return this.save();
};

// Deduct balance from user account
userSchema.methods.deductBalance = function(amount) {
  if (this.balance.amount >= amount) {
    this.balance.amount -= amount;
    this.balance.lastUpdated = new Date();
    return this.save();
  }
  return Promise.reject(new Error('Insufficient balance'));
};

// Check if user has enough balance
userSchema.methods.hasEnoughBalance = function(amount) {
  return this.balance.amount >= amount;
};

// Enable SMS token feature
userSchema.methods.enableSmsToken = function(phoneNumber) {
  this.smsToken.isEnabled = true;
  this.smsToken.phoneNumber = phoneNumber;
  return this.save();
};

// Disable SMS token feature
userSchema.methods.disableSmsToken = function() {
  this.smsToken.isEnabled = false;
  return this.save();
};

// Static method to get users with SMS token enabled
userSchema.statics.getUsersWithSmsEnabled = function() {
  return this.find({ 'smsToken.isEnabled': true });
};

module.exports = mongoose.model('User', userSchema); 