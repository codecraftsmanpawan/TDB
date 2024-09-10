const mongoose = require('mongoose');
const { executeTradesAndStopLosses } = require('../controllers/processingController');

// Define the Stock schema
const stockSchema = new mongoose.Schema(
  {
    Exchange: {
      type: String,
      required: true
    },
    InstrumentIdentifier: {
      type: String,
      unique: true,
      required: true
    },
    BuyPrice: {
      type: Number,
      required: true
    },
    Close: {
      type: Number,
      required: false
    },
    High: {
      type: Number,
      required: false
    },
    Low: {
      type: Number,
      required: false
    },
    LastTradePrice: {
      type: Number,
      required: true
    },
    Open: {
      type: Number,
      required: false
    },
    QuotationLot: {
      type: Number,
      required: false
    },
    SellPrice: {
      type: Number,
      required: true
    },
    BuyQty: {
      type: Number,
      required: false
    },
    SellQty: {
      type: Number,
      required: false
    },
    ltp_up: {
      type: Boolean,
      required: false
    },
    name: {
      type: String,
      required: false
    },
    volume: {
      type: Number,
      required: false
    },
    expiry: {
      type: Date,
      required: false
    },
    strike_price: {
      type: String,
      required: false
    },
    option_type: {
      type: String,
      required: false
    },
    volume_up: {
      type: Boolean,
      required: false
    },
    product: {
      type: String,
      required: false
    },
    OpenInterest: {
      type: Number,
      required: false
    },
    TotalQtyTraded: {
      type: Number,
      required: false
    },
    Value: {
      type: Number,
      required: false
    },
    PreOpen: {
      type: Boolean,
      required: false
    },
    PriceChange: {
      type: Number,
      required: false
    },
    PriceChangePercentage: {
      type: Number,
      required: false
    },
    OpenInterestChange: {
      type: Number,
      required: false
    },
    MessageType: {
      type: String,
      required: false
    },
    LastTradeTime: {
      type: Number,
      required: false
    },
    ServerTime: {
      type: Number,
      required: false
    },
  },
  { timestamps: true }
);

// Trigger execution of trades and stop-losses after saving or updating stock data
stockSchema.post('save', async function (doc) {
  await executeTradesAndStopLosses(doc);
});

stockSchema.post('updateOne', async function (doc) {
  await executeTradesAndStopLosses(doc);
});

// Create and export the Stock model
const Stock = mongoose.model('Stock', stockSchema);

module.exports = Stock;
