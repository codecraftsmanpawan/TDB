const Bid = require('../models/Bid');
const Stoploss = require('../models/StopLoss');
const Trade = require('../models/Trade');
const Stock = require('../models/stock'); 

// In the Stock schema post-update hook
Stock.schema.post('updateOne', async function (doc) {
  const stock = doc; // The updated stock document
  
  // Check all active bids for this stock
  const activeBids = await Bid.find({ stockId: stock._id, status: 'active' });

  for (const bid of activeBids) {
    if (
      (bid.tradeType === 'buy' && stock.buyPrice <= bid.bidPrice) ||  
      (bid.tradeType === 'sell' && stock.sellPrice >= bid.bidPrice)   
    ) {
      // Bid fulfilled, create a new trade
      const trade = new Trade({
        userId: bid.userId,
        stockId: stock._id,
        instrumentIdentifier: bid.instrumentIdentifier,
        name: stock.name,
        exchange: stock.exchange, 
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
  const activeStoplosses = await Stoploss.find({ instrumentIdentifier: stock.instrumentIdentifier, status: 'active' });

  for (const stoploss of activeStoplosses) {
    if (
      (stoploss.tradeType === 'buy' && stock.buyPrice >= stoploss.stopPrice) ||
      (stoploss.tradeType === 'sell' && stock.sellPrice <= stoploss.stopPrice)
    ) {
      // Stop-loss triggered, create a new trade
      const trade = new Trade({
        userId: stoploss.userId,
        stockId: stock._id,
        instrumentIdentifier: stoploss.instrumentIdentifier,
        name: stock.name,
        exchange: stock.exchange, 
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
