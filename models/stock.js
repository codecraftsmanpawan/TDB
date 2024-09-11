const mongoose = require('mongoose');
const Bid = require('../models/bid'); 
const Stoploss = require('../models/StopLoss'); 
const Trade = require('../models/Trade'); 

const stockSchema = new mongoose.Schema({
  Exchange: { type: String, required: true },
  InstrumentIdentifier: { type: String, unique: true, required: true },
  BuyPrice: { type: Number, required: true },
  Close: { type: Number, required: false },
  High: { type: Number, required: false },
  Low: { type: Number, required: false },
  LastTradePrice: { type: Number, required: true },
  Open: { type: Number, required: false },
  QuotationLot: { type: Number, required: false },
  SellPrice: { type: Number, required: true },
  BuyQty: { type: Number, required: false },
  SellQty: { type: Number, required: false },
  ltp_up: { type: Boolean, required: false },
  name: { type: String, required: false },
  volume: { type: Number, required: false },
  expiry: { type: Date, required: false },
  strike_price: { type: String, required: false },
  option_type: { type: String, required: false },
  volume_up: { type: Boolean, required: false },
  product: { type: String, required: false },
  OpenInterest: { type: Number, required: false },
  TotalQtyTraded: { type: Number, required: false },
  Value: { type: Number, required: false },
  PreOpen: { type: Boolean, required: false },
  PriceChange: { type: Number, required: false },
  PriceChangePercentage: { type: Number, required: false },
  OpenInterestChange: { type: Number, required: false },
  MessageType: { type: String, required: false },
  LastTradeTime: { type: Number, required: false },
  ServerTime: { type: Number, required: false },
}, { timestamps: true });

stockSchema.post('updateOne', async function (doc) {
  const stock = doc; // The updated stock document
  
  // Check all active bids for this stock
  const activeBids = await Bid.find({ stockId: stock._id, status: 'active' });

  for (const bid of activeBids) {
    if (
      (bid.tradeType === 'buy' && stock.BuyPrice <= bid.bidPrice) ||
      (bid.tradeType === 'sell' && stock.SellPrice >= bid.bidPrice)
    ) {
      // Bid fulfilled, create a new trade
      const trade = new Trade({
        userId: bid.userId,
        stockId: stock._id,
        instrumentIdentifier: bid.instrumentIdentifier,
        name: stock.name,
        exchange: stock.Exchange,
        tradeType: bid.tradeType,
        quantity: bid.bidQuantity,
        price: bid.bidPrice,
        status: 'closed',
        action: bid.tradeType === 'buy' ? 'sell' : 'buy',
      });
      await trade.save();

      // Mark the bid as fulfilled
      bid.status = 'fulfilled';
      await bid.save();
    }
  }

  // Check all active stop-losses for this stock
  const activeStoplosses = await Stoploss.find({ instrumentIdentifier: stock.InstrumentIdentifier, status: 'active' });

  for (const stoploss of activeStoplosses) {
    if (
      (stoploss.tradeType === 'buy' && stock.BuyPrice >= stoploss.stopPrice) ||
      (stoploss.tradeType === 'sell' && stock.SellPrice <= stoploss.stopPrice)
    ) {
      // Stop-loss triggered, create a new trade
      const trade = new Trade({
        userId: stoploss.userId,
        stockId: stock._id,
        instrumentIdentifier: stoploss.instrumentIdentifier,
        name: stock.name,
        exchange: stock.Exchange,
        tradeType: stoploss.tradeType,
        quantity: stoploss.quantity,
        price: stoploss.stopPrice,
        status: 'closed',
        action: stoploss.tradeType === 'buy' ? 'sell' : 'buy',
      });
      await trade.save();

      // Mark the stop-loss as fulfilled
      stoploss.status = 'fulfilled';
      await stoploss.save();
    }
  }
});

const Stock = mongoose.models.Stock || mongoose.model('Stock', stockSchema);

module.exports = Stock;
