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

    // Set price based on whether it's a bid or stop-loss
    const tradePrice = bidOrStoploss.bidPrice || bidOrStoploss.stopPrice || price; 

    const trade = new Trade({
      userId: bidOrStoploss.userId,
      stockId: stock._id,
      instrumentIdentifier: bidOrStoploss.instrumentIdentifier,
      name: stock.name,
      exchange: stock.Exchange,
      tradeType: bidOrStoploss.tradeType,
      quantity: quantity,
      price: tradePrice, 
      status: 'open',
      action: bidOrStoploss.tradeType === 'buy' ? 'sell' : 'buy',
      date: new Date()
    });

    await trade.save();
    console.log(`Trade created for ${bidOrStoploss.instrumentIdentifier} at ${tradePrice}`);
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
    if (activeBids.length === 0) {
      // Optionally, log that there are no active bids
      // console.log('No active bids to process.');
      return;
    }

    // Fetch all relevant stocks in a single query to minimize database calls
    const instrumentIdentifiers = activeBids.map(bid => bid.instrumentIdentifier);
    const stocks = await Stock.find({ InstrumentIdentifier: { $in: instrumentIdentifiers } });

    // Create a map for quick stock lookup
    const stockMap = new Map();
    stocks.forEach(stock => {
      stockMap.set(stock.InstrumentIdentifier, stock);
    });

    // Prepare bulk operations for efficiency
    const bulkOperations = [];

    for (const bid of activeBids) {
      const { instrumentIdentifier, bidPrice, tradeType, _id, quantity, userId } = bid;

      const stock = stockMap.get(instrumentIdentifier);

      if (!stock) {
        console.log(`Stock with instrumentIdentifier ${instrumentIdentifier} not found.`);
        continue;
      }

      let shouldFulfill = false;

      if (tradeType === 'buy') {
        // Fulfill if bidPrice is less than stock.BuyPrice
        if (bidPrice > stock.BuyPrice) {
          shouldFulfill = true;
        }
      } else if (tradeType === 'sell') {
        // Fulfill if bidPrice is greater than stock.SellPrice
        if (bidPrice < stock.SellPrice) {
          shouldFulfill = true;
        }
      } else {
        console.log(`Unknown trade type ${tradeType} for bid ${_id}.`);
        continue;
      }

      if (shouldFulfill) {
        bulkOperations.push({
          updateOne: {
            filter: { _id },
            update: {
              $set: {
                status: 'fulfilled',
                fulfilledAt: new Date(),
              },
            },
          },
        });

        console.log(
          `Bid ${_id} (${tradeType}) fulfilled at price ${bidPrice}.`
        );

        // Assuming createTrade is an async function
        await createTrade(bid, stock, bidPrice);
      }
    }

    // Execute bulk update if there are operations to perform
    if (bulkOperations.length > 0) {
      await Bid.bulkWrite(bulkOperations);
      console.log(`${bulkOperations.length} bids have been fulfilled.`);
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
    if (activeStoplosses.length === 0) {
      // Optionally, log that there are no active stop-loss orders
      // console.log('No active stop-loss orders to process.');
      return;
    }

    // Extract all unique instrument identifiers from active stop-loss orders
    const instrumentIdentifiers = activeStoplosses.map(stoploss => stoploss.instrumentIdentifier);

    // Fetch all relevant stocks in a single query
    const stocks = await Stock.find({ InstrumentIdentifier: { $in: instrumentIdentifiers } });

    // Create a map for quick stock lookup by InstrumentIdentifier
    const stockMap = new Map();
    stocks.forEach(stock => {
      stockMap.set(stock.InstrumentIdentifier, stock);
    });

    // Prepare bulk operations for efficient database updates
    const bulkOperations = [];

    for (const stoploss of activeStoplosses) {
      const { instrumentIdentifier, stopPrice, tradeType, _id, quantity, userId } = stoploss;

      const stock = stockMap.get(instrumentIdentifier);

      if (!stock) {
        console.log(`Stock with InstrumentIdentifier ${instrumentIdentifier} not found for Stoploss ${_id}.`);
        continue;
      }

      let shouldFulfill = false;

      if (tradeType === 'buy') {
        // Fulfill if stopPrice is less than stock.BuyPrice
        if (stopPrice < stock.BuyPrice) {
          shouldFulfill = true;
        }
      } else if (tradeType === 'sell') {
        // Fulfill if stopPrice is greater than stock.SellPrice
        if (stopPrice > stock.SellPrice) {
          shouldFulfill = true;
        }
      } else {
        console.log(`Unknown trade type "${tradeType}" for Stoploss ${_id}.`);
        continue;
      }

      if (shouldFulfill) {
        // Prepare the update operation for bulkWrite
        bulkOperations.push({
          updateOne: {
            filter: { _id },
            update: {
              $set: {
                status: 'fulfilled',
                fulfilledAt: new Date(),
              },
            },
          },
        });

        console.log(
          `Stoploss ${_id} (${tradeType}) fulfilled at price ${
            tradeType === 'buy' ? stock.BuyPrice : stock.SellPrice
          }.`
        );

        // Create a trade when the stop-loss is fulfilled
        // Assuming createTrade is an async function
        await createTrade(stoploss, stock, tradeType === 'buy' ? stock.BuyPrice : stock.SellPrice);
      }
    }

    // Execute bulk update if there are operations to perform
    if (bulkOperations.length > 0) {
      await Stoploss.bulkWrite(bulkOperations);
      console.log(`${bulkOperations.length} stop-loss orders have been fulfilled.`);
    }
  } catch (error) {
    console.error('Error checking and updating stop-loss orders:', error);
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
