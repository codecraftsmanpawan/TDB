const Stoploss = require('../models/StopLoss');
const Bid = require('../models/Bid');
const Stock = require('../models/stock');

async function processStopLosses(stock) {
  try {
    const stopLosses = await Stoploss.find({
      instrumentIdentifier: stock.InstrumentIdentifier,
      status: 'active',
      stopPrice: { $gte: stock.LastTradePrice } // Ensure stop price should be triggered
    });

    for (let stopLoss of stopLosses) {
      stopLoss.status = 'fulfilled'; // or 'triggered' based on your requirements
      stopLoss.updatedAt = new Date();
      await stopLoss.save();
    }
  } catch (error) {
    console.error('Error processing stop losses:', error);
  }
}

async function processBids(stock) {
  try {
    const bids = await Bid.find({
      instrumentIdentifier: stock.InstrumentIdentifier,
      status: 'active',
      bidPrice: {
        $lte: stock.BuyPrice, // Adjust this based on tradeType and bidPrice logic
        $gte: stock.SellPrice // Ensures bidPrice is within the acceptable range
      }
    });

    for (let bid of bids) {
      if (bid.tradeType === 'buy' && bid.bidPrice <= stock.BuyPrice ||
          bid.tradeType === 'sell' && bid.bidPrice >= stock.SellPrice) {
        bid.status = 'fulfilled';
        await bid.save();
      }
    }
  } catch (error) {
    console.error('Error processing bids:', error);
  }
}

async function executeTradesAndStopLosses(stock) {
  try {
    await processStopLosses(stock);
    await processBids(stock);

    // Process trades if necessary, similar to bids and stop losses
  } catch (error) {
    console.error('Error executing trades and stop losses:', error);
  }
}

module.exports = {
  executeTradesAndStopLosses,
};
