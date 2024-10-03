const cron = require('node-cron');
const Bid = require('./models/Bid');
const Stoploss = require('./models/StopLoss');
const Stock = require('./models/stock');

// Function to delete unfulfilled bids and stop-losses for MCX and NSE
async function deleteUnfulfilledOrders() {
  const currentTime = new Date();
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();

  // Delete unfulfilled bids and stop-losses for MCX at 11:30 PM
  if (currentHour === 23 && currentMinute === 30) {
    const MCXStocks = await Stock.find({ Exchange: 'MCX' });

    for (const stock of MCXStocks) {
      await Bid.deleteMany({ stockId: stock._id, status: 'active' });
      await Stoploss.deleteMany({ instrumentIdentifier: stock.InstrumentIdentifier, status: 'active' });
    }
    console.log("Deleted unfulfilled MCX orders at 11:30 PM");
  }

  // Delete unfulfilled bids and stop-losses for NSE at 3:30 PM
  if (currentHour === 15 && currentMinute === 30) {
    const NSEStocks = await Stock.find({ Exchange: 'NSE' });

    for (const stock of NSEStocks) {
      await Bid.deleteMany({ stockId: stock._id, status: 'active' });
      await Stoploss.deleteMany({ instrumentIdentifier: stock.InstrumentIdentifier, status: 'active' });
    }
    console.log("Deleted unfulfilled NSE orders at 3:30 PM");
  }
}

// Function to start the cron job
function startCronJobs() {
  // Schedule the job to run every minute and check the time
  cron.schedule('* * * * *', deleteUnfulfilledOrders);
}

module.exports = { startCronJobs };
