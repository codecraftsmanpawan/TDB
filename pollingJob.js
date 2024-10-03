const mongoose = require('mongoose');
const Bid = require('./models/Bid');
const Stock = require('./models/stock');
const Stoploss = require('./models/StopLoss');
const Trade = require('./models/Trade'); 

// Function to create a trade from a fulfilled bid or stop-loss
async function createTrade(bidOrStoploss, stock, price) {
  try {
    // Determine the quantity based on whether it's a bid or stoploss
    const quantity = bidOrStoploss.bidQuantity || bidOrStoploss.quantity;

    // Ensure quantity exists before creating the trade
    if (!quantity) {
      console.error(`Error: Quantity is missing for ${bidOrStoploss.instrumentIdentifier}. Cannot create trade.`);
      return; // Early return if quantity is missing
    }

    const trade = new Trade({
      userId: bidOrStoploss.userId,
      stockId: stock._id,
      instrumentIdentifier: bidOrStoploss.instrumentIdentifier,
      name: stock.name,
      exchange: stock.Exchange,
      tradeType: bidOrStoploss.tradeType,
      quantity: quantity,  
      price: price,
      status: 'open',
      action: bidOrStoploss.tradeType === 'buy' ? 'sell' : 'buy',
      date: new Date()
    });

    await trade.save();
    console.log(`Trade created for ${bidOrStoploss.instrumentIdentifier} at ${price}`);
  } catch (error) {
    console.error('Error creating trade:', error);
  }
}

// Function to check and update active bids
async function checkAndUpdateBids() {
  try {
    // Fetch all active bids
    const activeBids = await Bid.find({ status: 'active' });

    // If no active bids, return early
    if (!activeBids.length) {
      // console.log('No active bids to process.');
    } else {
      // Loop through each active bid
      for (const bid of activeBids) {
        const { instrumentIdentifier, bidPrice, tradeType, _id, quantity, userId } = bid;

        // Fetch the stock corresponding to the instrumentIdentifier
        const stock = await Stock.findOne({ InstrumentIdentifier: instrumentIdentifier });

        if (!stock) {
          console.log(`Stock with instrumentIdentifier ${instrumentIdentifier} not found.`);
          continue;
        }

        // Process the bid based on its trade type
        if (tradeType === 'buy') {
          if (bidPrice >= stock.BuyPrice) {
            // If the bidPrice is greater than or equal to the stock's BuyPrice, fulfill the bid
            await Bid.updateOne({ _id }, { 
              $set: { 
                status: 'fulfilled', 
                fulfilledAt: new Date() // Set fulfilledAt timestamp
              } 
            });
            console.log(`Bid ${_id} (buy) fulfilled at price ${bidPrice}.`);

            // Create a trade when the bid is fulfilled
            await createTrade(bid, stock, stock.BuyPrice);
          }
        } else if (tradeType === 'sell') {
          if (bidPrice <= stock.SellPrice) {
            // If the bidPrice is less than or equal to the stock's SellPrice, fulfill the bid
            await Bid.updateOne({ _id }, { 
              $set: { 
                status: 'fulfilled', 
                fulfilledAt: new Date() // Set fulfilledAt timestamp
              } 
            });
            console.log(`Bid ${_id} (sell) fulfilled at price ${bidPrice}.`);

            // Create a trade when the bid is fulfilled
            await createTrade(bid, stock, stock.SellPrice);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error checking and updating bids:', error);
  }
}

// Function to check and update active stop-losses
async function checkAndUpdateStoplosses() {
  try {
    // Fetch all active stop-loss orders
    const activeStoplosses = await Stoploss.find({ status: 'active' });

    // If no active stop-loss orders, return early
    if (!activeStoplosses.length) {
      // console.log('No active stop-losses to process.');
    } else {
      // Loop through each active stop-loss order
      for (const stoploss of activeStoplosses) {
        const { instrumentIdentifier, stopPrice, quantity, tradeType, _id, userId } = stoploss;

        // Fetch the stock corresponding to the instrumentIdentifier
        const stock = await Stock.findOne({ InstrumentIdentifier: instrumentIdentifier });

        if (!stock) {
          console.log(`Stock with instrumentIdentifier ${instrumentIdentifier} not found.`);
          continue;
        }

        // Process the stop-loss based on its trade type
        if (tradeType === 'buy') {
          if (stock.LastTradePrice <= stopPrice) {
            // If the stock's LastTradePrice is less than or equal to the stopPrice, fulfill the stop-loss
            await Stoploss.updateOne({ _id }, { 
              $set: { 
                status: 'fulfilled', 
                fulfilledAt: new Date() // Set fulfilledAt timestamp
              } 
            });
            console.log(`Stop-loss ${_id} (buy) fulfilled at price ${stock.LastTradePrice}.`);

            // Create a trade when the stop-loss is fulfilled
            await createTrade(stoploss, stock, stock.LastTradePrice);
          }
        } else if (tradeType === 'sell') {
          if (stock.LastTradePrice >= stopPrice) {
            // If the stock's LastTradePrice is greater than or equal to the stopPrice, fulfill the stop-loss
            await Stoploss.updateOne({ _id }, { 
              $set: { 
                status: 'fulfilled', 
                fulfilledAt: new Date() // Set fulfilledAt timestamp
              } 
            });
            console.log(`Stop-loss ${_id} (sell) fulfilled at price ${stock.LastTradePrice}.`);

            // Create a trade when the stop-loss is fulfilled
            await createTrade(stoploss, stock, stock.LastTradePrice);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error checking and updating stop-losses:', error);
  }
}

// Function to initiate polling
function startBidPolling(intervalMs) {
  // Check and update bids and stop-losses immediately, then every interval
  checkAndUpdateBids();
  checkAndUpdateStoplosses();

  // Set interval to check bids and stop-losses periodically
  setInterval(() => {
    // console.log('Polling for active bids and stop-losses...');
    checkAndUpdateBids();
    checkAndUpdateStoplosses();
  }, intervalMs);
}

// Export the function
module.exports = { startBidPolling };
