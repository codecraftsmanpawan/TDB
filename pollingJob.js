// polling.js
const Stock = require('./models/stock');
const { executeTradesAndStopLosses } = require('./controllers/processingController');

const POLLING_INTERVAL = 1000; 

async function processStocks() {
  console.log('Polling started...');
  try {
    const stocks = await Stock.find({});
    console.log(`Fetched ${stocks.length} stocks for processing.`);

    await Promise.all(stocks.map(async (stock) => {
      console.log(`Processing stock with InstrumentIdentifier: ${stock.InstrumentIdentifier}`);
      try {
        await executeTradesAndStopLosses(stock);
        console.log(`Completed processing for stock with InstrumentIdentifier: ${stock.InstrumentIdentifier}`);
      } catch (processError) {
        // console.error(`Error processing stock with InstrumentIdentifier ${stock.InstrumentIdentifier}:`, processError);
      }
    }));

    // console.log('Polling cycle completed.');
  } catch (error) {
    // console.error('Error during polling:', error);
  }
}

function startPolling() {
  console.log(`Starting polling every ${POLLING_INTERVAL / 1000} seconds...`);
  
  setInterval(() => {
    processStocks().catch(err => {
      console.error('Unhandled error in polling cycle:', err);
    });
  }, POLLING_INTERVAL);
}

module.exports = startPolling;
