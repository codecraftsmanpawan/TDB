const Bid = require('./models/Bid');
const Stoploss = require('./models/Stoploss');
const Trade = require('./models/Trade');

// In the Stock schema post-update hook
stockSchema.post('updateOne', async function (doc) {
  const stock = doc; // The updated stock document
  
  // Check all active bids for this stock
  const activeBids = await Bid.find({ stockId: stock._id, status: 'active' });

  for (const bid of activeBids) {
    if (
      (bid.tradeType === 'buy' && stock.BuyPrice <= bid.bidPrice) ||  // Compare with BuyPrice for 'buy' bids
      (bid.tradeType === 'sell' && stock.SellPrice >= bid.bidPrice)    // Compare with SellPrice for 'sell' bids
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
      (stoploss.tradeType === 'buy' && stock.BuyPrice >= stoploss.stopPrice) ||  // Compare with BuyPrice for 'buy' stop-losses
      (stoploss.tradeType === 'sell' && stock.SellPrice <= stoploss.stopPrice)    // Compare with SellPrice for 'sell' stop-losses
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
