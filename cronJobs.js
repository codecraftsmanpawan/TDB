const cron = require("node-cron");
const Bid = require("./models/Bid");
const Stoploss = require("./models/StopLoss");
const Stock = require("./models/stock");
const moment = require("moment-timezone");

// Kolta Time zone (replace 'Asia/Kolkata' with your correct Kolta timezone if different)
const KOLTA_TIMEZONE = "Asia/Kolkata";

// Function to delete unfulfilled and fulfilled bids and stop-losses for MCX and NSE
async function deleteOrders() {
  const currentTime = moment().tz(KOLTA_TIMEZONE);
  const currentHour = currentTime.hours();
  const currentMinute = currentTime.minutes();

  // Delete unfulfilled and fulfilled bids and stop-losses for MCX at 11:30 PM Kolta time
  if (currentHour === 23 && currentMinute === 30) {
    const MCXStocks = await Stock.find({ Exchange: "MCX" });

    for (const stock of MCXStocks) {
      await Bid.deleteMany({
        stockId: stock._id,
        status: { $in: ["active", "fulfilled"] },
      });
      await Stoploss.deleteMany({
        instrumentIdentifier: stock.InstrumentIdentifier,
        status: { $in: ["active", "fulfilled"] },
      });
    }
    console.log(
      "Deleted unfulfilled and fulfilled MCX orders at 11:30 PM Kolta time"
    );
  }

  // Delete unfulfilled and fulfilled bids and stop-losses for NSE at 3:30 PM Kolta time
  if (currentHour === 15 && currentMinute === 30) {
    const NSEStocks = await Stock.find({ Exchange: "NSE" });

    for (const stock of NSEStocks) {
      await Bid.deleteMany({
        stockId: stock._id,
        status: { $in: ["active", "fulfilled"] },
      });
      await Stoploss.deleteMany({
        instrumentIdentifier: stock.InstrumentIdentifier,
        status: { $in: ["active", "fulfilled"] },
      });
    }
    console.log(
      "Deleted unfulfilled and fulfilled NSE orders at 3:30 PM Kolta time"
    );
  }
}

// Function to start the cron job
function startCronJobs() {
  // Schedule the job to run every minute and check the time
  cron.schedule("* * * * *", deleteOrders);
}

module.exports = { startCronJobs };
