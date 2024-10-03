const mongoose = require('mongoose');

const stoplossSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  instrumentIdentifier: {
    type: String,
    required: true
  },
  stopPrice: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  tradeType: {
    type: String,
    enum: ['buy', 'sell'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'fulfilled', 'canceled','closed'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Stoploss = mongoose.models.Stoploss || mongoose.model('Stoploss', stoplossSchema);

module.exports = Stoploss;
