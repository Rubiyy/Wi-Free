const mongoose = require('mongoose');

const adminMessageSchema = new mongoose.Schema({
  message: { 
    type: String, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
});

// Set only one message active at a time
adminMessageSchema.pre('save', async function(next) {
  if (this.isActive) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { $set: { isActive: false } }
    );
  }
  this.updatedAt = Date.now();
  next();
});

// Static method to get active message
adminMessageSchema.statics.getActiveMessage = function() {
  return this.findOne({ isActive: true }).sort({ updatedAt: -1 });
};

module.exports = mongoose.model('AdminMessage', adminMessageSchema); 