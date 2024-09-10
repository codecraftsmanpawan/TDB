const mongoose = require('mongoose');
const Bid = require('../models/Bid');  // Path to your Bid model
const Stock = require('../models/stock');  // Path to your Stock model
const Trade = require('../models/Trade');  // Path to your Trade model

/**
 * Executes trades based on the bids and stock prices.
 * @param {Object} stock - The stock document that was updated.
 */
async function executeTradesAndStopLosses(stock) {
  try {
    const bids = await Bid.find({
      stockId: stock._id,
      status: 'active',
    }).populate('userId');

    if (bids.length === 0) return;

    await Promise.all(bids.map(async (bid) => {
      let isTradeExecutable = false;
      let tradePrice = 0;

      if (bid.tradeType === 'buy') {
        if (bid.bidPrice >= stock.BuyPrice) {
          isTradeExecutable = true;
          tradePrice = stock.BuyPrice;
        }
      } else if (bid.tradeType === 'sell') {
        if (bid.bidPrice <= stock.SellPrice) {
          isTradeExecutable = true;
          tradePrice = stock.SellPrice;
        }
      }

      if (isTradeExecutable) {
        const trade = new Trade({
          userId: bid.userId._id,
          stockId: stock._id,
          instrumentIdentifier: bid.instrumentIdentifier,
          name: stock.name,
          exchange: stock.Exchange,
          tradeType: bid.tradeType,
          quantity: bid.bidQuantity,
          price: tradePrice,
          action: bid.tradeType === 'buy' ? 'sell' : 'buy',
          date: new Date()
        });

        await trade.save();
        await Bid.findByIdAndDelete(bid._id);
      }
    }));
  } catch (error) {
    console.error('Error executing trades and stop-losses:', error);
    // Optionally add retry logic here
  }
}


module.exports = {
  executeTradesAndStopLosses
};
