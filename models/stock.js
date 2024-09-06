const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  Exchange: String,
  InstrumentIdentifier: {
    type: String,
    unique: true,
    required: true
  },
  BuyPrice: {
    type: Number,
    required: true
  },
  Close: Number,
  High: Number,
  Low: Number,
  LastTradePrice: {
    type: Number,
    required: true
  },
  Open: Number,
  QuotationLot: Number,
  SellPrice: {
    type: Number,
    required: true
  },
  BuyQty: Number,
  SellQty: Number,
  ltp_up: Boolean,
  name: String,
  volume: Number,
  expiry: Date,
  strike_price: String,
  option_type: String,
  volume_up: Boolean,
  product: String,
  OpenInterest: Number,
  TotalQtyTraded: Number,
  Value: Number,
  PreOpen: Boolean,
  PriceChange: Number,
  PriceChangePercentage: Number,
  OpenInterestChange: Number,
  MessageType: String,
  LastTradeTime: Number,
  ServerTime: Number,
}, { timestamps: true });

stockSchema.post('save', async function (doc) {
  await executeTradesAndStopLosses(doc);
});

stockSchema.post('updateOne', async function (doc) {
  await executeTradesAndStopLosses(doc);
});

const Stock = mongoose.model('Stock', stockSchema);
module.exports = Stock;

// Function to execute trades, stop-losses, and bids based on stock updates
async function executeTradesAndStopLosses(stock) {
  const Trade = mongoose.model('Trade');
  const StopLoss = mongoose.model('StopLoss');
  const Bid = mongoose.model('Bid');

  // Execute Stop Losses
  const stopLosses = await StopLoss.find({
    stockId: stock.InstrumentIdentifier,
    status: 'pending',
    stopLossPrice: { $gte: stock.LastTradePrice }
  });

  for (let stopLoss of stopLosses) {
    stopLoss.status = 'executed';
    stopLoss.executedAt = new Date();
    await stopLoss.save();
  }

  // Execute Trades
  const trades = await Trade.find({
    stockId: stock.InstrumentIdentifier,
    status: 'open',
  });

  for (let trade of trades) {
    if ((trade.tradeType === 'buy' && trade.bidPrice >= stock.BuyPrice) ||
        (trade.tradeType === 'sell' && trade.bidPrice <= stock.SellPrice)) {
      trade.status = 'closed';
      trade.updatedAt = new Date();
      await trade.save();
    }
  }

  // Fulfill Bids
  const bids = await Bid.find({
    stockId: stock.InstrumentIdentifier,
    status: 'active',
    bidPrice: {
      $lte: stock.BuyPrice,
      $gte: stock.SellPrice // This ensures bids are considered for both Buy and Sell price
    }
  });

  for (let bid of bids) {
    if (bid.tradeType === 'buy' && bid.bidPrice <= stock.BuyPrice ||
        bid.tradeType === 'sell' && bid.bidPrice >= stock.SellPrice) {
      bid.status = 'fulfilled';
      await bid.save();
    }
  }
}