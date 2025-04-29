const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  chatId: { 
    type: String, 
    required: true 
  },
  reference: { 
    type: String, 
    required: true, 
    unique: true 
  },
  type: {
    type: String,
    enum: ['plan', 'balance', 'sms', 'admin-added'],
    required: true
  },
  plan: { 
    type: String, 
    enum: ['15GB-1day', '3days-unlimited', '7days-unlimited', 'balance-topup'], 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  smsTokenEnabled: {
    type: Boolean,
    default: false
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'declined'], 
    default: 'pending' 
  },
  approvedBy: { 
    type: String 
  },
  approvedAt: { 
    type: Date 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Static method to find payment by reference
paymentSchema.statics.findByReference = function(reference) {
  return this.findOne({ reference });
};

// Static method to approve payment
paymentSchema.statics.approvePayment = function(paymentId, adminId) {
  return this.findByIdAndUpdate(
    paymentId,
    {
      status: 'approved',
      approvedBy: adminId,
      approvedAt: new Date()
    },
    { new: true }
  );
};

// Static method to decline payment
paymentSchema.statics.declinePayment = function(paymentId, adminId) {
  return this.findByIdAndUpdate(
    paymentId,
    {
      status: 'declined',
      approvedBy: adminId,
      approvedAt: new Date()
    },
    { new: true }
  );
};

// Get pending payments
paymentSchema.statics.getPendingPayments = function() {
  return this.find({ status: 'pending' }).sort({ createdAt: 1 }).populate('userId');
};

// Get balance topup payments
paymentSchema.statics.getBalanceTopupPayments = function() {
  return this.find({ plan: 'balance-topup', status: 'approved' }).sort({ createdAt: -1 }).populate('userId');
};

module.exports = mongoose.model('Payment', paymentSchema); 