const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  Exchange: { type: String, required: true },
  InstrumentIdentifier: { type: String, unique: true, required: true },
  BuyPrice: { type: Number, required: true },
  Close: { type: Number },
  High: { type: Number },
  Low: { type: Number },
  LastTradePrice: { type: Number, required: true },
  Open: { type: Number },
  QuotationLot: { type: Number },
  SellPrice: { type: Number, required: true },
  BuyQty: { type: Number },
  SellQty: { type: Number },
  ltp_up: { type: Boolean },
  name: { type: String },
  volume: { type: Number },
  expiry: { type: Date },
  strike_price: { type: Number },
  option_type: { type: String },
  volume_up: { type: Boolean },
  product: { type: String },
  OpenInterest: { type: Number },
  TotalQtyTraded: { type: Number },
  Value: { type: Number },
  PreOpen: { type: Boolean },
  PriceChange: { type: Number },
  PriceChangePercentage: { type: Number },
  OpenInterestChange: { type: Number },
  MessageType: { type: String },
  LastTradeTime: { type: Number },
  ServerTime: { type: Number },
}, { timestamps: true });

// Post-save middleware without any additional checks or processing
stockSchema.post('save', function (doc) {
  console.log('Stock document saved:', doc);
});

const Stock = mongoose.models.Stock || mongoose.model('Stock', stockSchema);

module.exports = Stock;
