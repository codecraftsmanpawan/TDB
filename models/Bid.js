const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  stockId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
    required: true
  },
  instrumentIdentifier: {
    type: String,
    required: true
  },
  bidPrice: {
    type: Number,
    required: true
  },
  bidQuantity: {
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
    enum: ['active', 'fulfilled', 'canceled'],
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

const Bid = mongoose.models.Bid || mongoose.model('Bid', bidSchema);

module.exports = Bid;
