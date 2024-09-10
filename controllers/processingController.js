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
    // Find all active bids for the stock
    const bids = await Bid.find({
      stockId: stock._id,
      status: 'active',
    }).populate('userId');

    if (bids.length === 0) return;

    // Process each bid
    await Promise.all(bids.map(async (bid) => {
      let isTradeExecutable = false;
      let tradePrice = 0;

      // Determine if the bid can be fulfilled based on the trade type
      if (bid.tradeType === 'buy') {
        // Buy bids are executable if the bid price is greater than or equal to the stock's BuyPrice
        if (bid.bidPrice >= stock.BuyPrice) {
          isTradeExecutable = true;
          tradePrice = stock.BuyPrice;
        }
      } else if (bid.tradeType === 'sell') {
        // Sell bids are executable if the bid price is less than or equal to the stock's SellPrice
        if (bid.bidPrice <= stock.SellPrice) {
          isTradeExecutable = true;
          tradePrice = stock.SellPrice;
        }
      }

      if (isTradeExecutable) {
        // Create a new trade record
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

        // Save the trade record
        await trade.save();

        // Delete the bid from the Bid model
        await Bid.findByIdAndDelete(bid._id);
      }
    }));
  } catch (error) {
    console.error('Error executing trades and stop-losses:', error);
  }
}

module.exports = {
  executeTradesAndStopLosses
};
