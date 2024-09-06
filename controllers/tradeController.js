const mongoose = require('mongoose');
const Trade = require('../models/Trade');
const Client = require('../models/client');
const Stock = require('../models/stock');

const addTrade = async (req, res) => {
  try {
    const { _id, instrumentIdentifier, name, exchange, trade_type, quantity, price } = req.body;

    if (!_id || !instrumentIdentifier || !name || !exchange || !trade_type || !quantity || !price) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!['buy', 'sell'].includes(trade_type)) {
      return res.status(400).json({ message: 'Invalid trade_type. It should be either "buy" or "sell".' });
    }

    if (quantity <= 0 || price <= 0) {
      return res.status(400).json({ message: 'Quantity and price must be greater than zero.' });
    }

    // Validate the '_id' format
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: 'Invalid User' });
    }

    // Find the client document using the provided '_id'
    const client = await Client.findById(_id);

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Create a new trade instance
    const newTrade = new Trade({
      userId: client._id,
      stockId: instrumentIdentifier,
      instrumentIdentifier,
      name,
      exchange,
      tradeType: trade_type,
      quantity,
      price,
      action: trade_type,
      status: 'open',
      date: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    // Save the trade to the database
    const savedTrade = await newTrade.save();

    // Respond with the saved trade data
    res.status(201).json({ message: 'Trade added successfully', trade: savedTrade });
  } catch (error) {
    console.error('Error adding trade:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};



const getTrades = async (req, res) => {
  try {
    const { clientId } = req.params;

    // Validate the 'clientId' format
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ message: 'Invalid Client ID' });
    }

    // Find the client document using the provided 'clientId'
    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Fetch all trades related to the client
    const trades = await Trade.find({ userId: clientId });

    if (!trades || trades.length === 0) {
      return res.status(404).json({ message: 'No trades found for this client' });
    }

    // Modify the action to display the opposite action (buy to sell, sell to buy)
    const modifiedTrades = trades.map(trade => {
      return {
        ...trade._doc,
        oppositeAction: trade.tradeType === 'buy' ? 'sell' : 'buy'
      };
    });

    // Respond with the modified trade data
    res.status(200).json({ trades: modifiedTrades });
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Controller function to delete a trade
const deleteTrade = async (req, res) => {
  try {
    const { tradeId } = req.params;

    // Validate the 'tradeId' format
    if (!mongoose.Types.ObjectId.isValid(tradeId)) {
      return res.status(400).json({ message: 'Invalid Trade ID' });
    }

    // Find the trade to be deleted
    const trade = await Trade.findById(tradeId);

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    // Find the client related to this trade
    const client = await Client.findById(trade.userId);

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Calculate the total cost of the trade
    const totalCost = trade.quantity * trade.price;

    // Update the client's available budget if the trade was a buy trade
    const updatedAvailableBudget = trade.tradeType === 'buy' ? client.availableBudget + totalCost : client.availableBudget;

    await Client.updateOne(
      { _id: client._id },
      { $set: { availableBudget: updatedAvailableBudget } }
    );

    // Delete the trade
    await Trade.findByIdAndDelete(tradeId);

    // Respond with success message
    res.status(200).json({ message: 'Trade deleted successfully' });
  } catch (error) {
    console.error('Error deleting trade:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};


// Get all trades for a specific instrumentIdentifier and userId
const getTradesByInstrumentIdentifier = async (req, res) => {
  const { instrumentIdentifier } = req.params;
  const { userId } = req.query; // Get userId from query parameters

  try {
    // Check if userId is provided in the query
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required.' });
    }

    // Find trades matching both the instrumentIdentifier and userId
    const trades = await Trade.find({
      instrumentIdentifier: instrumentIdentifier,
      userId: userId
    });

    if (trades.length === 0) {
      return res.status(404).json({ message: 'No trades found for this instrument identifier and user.' });
    }

    return res.status(200).json(trades);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const getTradesForChart = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate the 'userId' format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid User ID' });
    }

    // Fetch all trades related to the user
    const trades = await Trade.find({ userId });

    if (!trades || trades.length === 0) {
      return res.status(404).json({ message: 'No trades found for this user' });
    }

    // Process trades data for charting
    // Example: Aggregating data by date and summing quantities
    const tradeData = trades.reduce((acc, trade) => {
      const date = new Date(trade.date).toISOString().split('T')[0]; // Use date only
      if (!acc[date]) {
        acc[date] = { date, totalQuantity: 0, totalPrice: 0 };
      }
      acc[date].totalQuantity += trade.quantity;
      acc[date].totalPrice += trade.price * trade.quantity;
      return acc;
    }, {});

    // Convert aggregated data to an array
    const chartData = Object.values(tradeData);

    // Respond with the processed data
    res.status(200).json({ chartData });
  } catch (error) {
    console.error('Error fetching trades for chart:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Get all trades for a specific user and calculate remaining quantities
exports.getTradesByUserId = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Find trades by userId
    const trades = await Trade.find({ userId });

    // Calculate remaining quantities
    const tradeSummary = trades.reduce((acc, trade) => {
      // If it's a buy trade, add the quantity
      if (trade.tradeType === 'buy') {
        acc[trade.instrumentIdentifier] = (acc[trade.instrumentIdentifier] || 0) + trade.quantity;
      }
      // If it's a sell trade, subtract the quantity
      else if (trade.tradeType === 'sell') {
        acc[trade.instrumentIdentifier] = (acc[trade.instrumentIdentifier] || 0) - trade.quantity;
      }
      return acc;
    }, {});

    res.status(200).json({ success: true, data: tradeSummary });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};


// Function to calculate net quantity for an instrumentIdentifier by user
// const calculateNetQuantityByUser = async (req, res) => {
//   try {
//     const { userId } = req.params;

//     // Validate userId
//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//       return res.status(400).json({ error: 'Invalid userId' });
//     }

//     // Fetch all trades for the given userId
//     const trades = await Trade.find({ userId });

//     if (trades.length === 0) {
//       return res.status(404).json({ error: 'No trades found for the specified user' });
//     }

//     // Group trades by instrumentIdentifier and include additional fields
//     const instrumentMap = trades.reduce((acc, trade) => {
//       if (!acc[trade.instrumentIdentifier]) {
//         acc[trade.instrumentIdentifier] = {
//           totalBuyQuantity: 0,
//           totalSellQuantity: 0,
//           name: trade.name,
//           exchange: trade.exchange,
//           status: trade.status,
//           price: trade.price,
//           action: trade.action
//         };
//       }
//       if (trade.tradeType === 'buy') {
//         acc[trade.instrumentIdentifier].totalBuyQuantity += trade.quantity;
//       } else if (trade.tradeType === 'sell') {
//         acc[trade.instrumentIdentifier].totalSellQuantity += trade.quantity;
//       }
//       return acc;
//     }, {});

//     // Calculate net quantity and investment value for each instrumentIdentifier and include additional fields
//     const netQuantities = Object.keys(instrumentMap)
//       .map(instrumentIdentifier => {
//         const {
//           totalBuyQuantity,
//           totalSellQuantity,
//           name,
//           exchange,
//           status,
//           price,
//           action
//         } = instrumentMap[instrumentIdentifier];
//         const netQuantity = totalBuyQuantity - totalSellQuantity;
//         const absoluteNetQuantity = Math.abs(netQuantity); // Convert net quantity to positive
//         const investmentValue = absoluteNetQuantity * price; // Calculate investment value
//         return {
//           instrumentIdentifier,
//           netQuantity: absoluteNetQuantity, // Display net quantity as positive
//           investmentValue,
//           name,
//           exchange,
//           status,
//           price,
//           action
//         };
//       })
//       // Filter out trades where netQuantity is 0
//       .filter(trade => trade.netQuantity !== 0);

//     res.status(200).json({ userId, netQuantities });
//   } catch (error) {
//     res.status(500).json({ error: 'Error calculating net quantity by user', details: error.message });
//   }
// };
const calculateNetQuantityByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    // Fetch all trades for the given userId
    const trades = await Trade.find({ userId });

    if (trades.length === 0) {
      return res.status(404).json({ error: 'No trades found for the specified user' });
    }

    // Group trades by instrumentIdentifier and include additional fields
    const instrumentMap = trades.reduce((acc, trade) => {
      if (!acc[trade.instrumentIdentifier]) {
        acc[trade.instrumentIdentifier] = {
          totalBuyQuantity: 0,
          totalSellQuantity: 0,
          name: trade.name,
          exchange: trade.exchange,
          status: trade.status,
          price: trade.price,
          action: trade.action // Default to the action of the first trade
        };
      }
      if (trade.tradeType === 'buy') {
        acc[trade.instrumentIdentifier].totalBuyQuantity += trade.quantity;
      } else if (trade.tradeType === 'sell') {
        acc[trade.instrumentIdentifier].totalSellQuantity += trade.quantity;
      }
      // Update the action to reflect the last action found for this instrument
      acc[trade.instrumentIdentifier].action = trade.tradeType === 'buy' ? 'sell' : 'buy';
      return acc;
    }, {});

    // Calculate net quantity and investment value for each instrumentIdentifier and include additional fields
    const netQuantities = Object.keys(instrumentMap)
      .map(instrumentIdentifier => {
        const {
          totalBuyQuantity,
          totalSellQuantity,
          name,
          exchange,
          status,
          price,
          action
        } = instrumentMap[instrumentIdentifier];
        const netQuantity = totalBuyQuantity - totalSellQuantity;
        const absoluteNetQuantity = Math.abs(netQuantity); // Convert net quantity to positive
        const investmentValue = absoluteNetQuantity * price; // Calculate investment value

        // Determine the opposite action
        const oppositeAction = action === 'buy' ? 'sell' : 'buy';

        return {
          instrumentIdentifier,
          netQuantity: absoluteNetQuantity, 
          investmentValue,
          name,
          exchange,
          status,
          price,
          action: oppositeAction 
        };
      })
      // Filter out trades where netQuantity is 0
      .filter(trade => trade.netQuantity !== 0);

    res.status(200).json({ userId, netQuantities });
  } catch (error) {
    res.status(500).json({ error: 'Error calculating net quantity by user', details: error.message });
  }
};


const calculateMCXTradesByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    // Fetch all trades for the given userId
    const trades = await Trade.find({ userId });

    if (trades.length === 0) {
      return res.status(404).json({ error: 'No trades found for the specified user' });
    }

    // Filter trades to include only those with exchange 'MCX'
    const mcxTrades = trades.filter(trade => trade.exchange === 'MCX');

    if (mcxTrades.length === 0) {
      return res.status(404).json({ error: 'No MCX trades found for the specified user' });
    }

    // Group trades by instrumentIdentifier and calculate totals and saudaCount
    const instrumentMap = mcxTrades.reduce((acc, trade) => {
      const { instrumentIdentifier, tradeType, quantity } = trade;

      if (!acc[instrumentIdentifier]) {
        acc[instrumentIdentifier] = {
          totalBuyQuantity: 0,
          totalSellQuantity: 0,
          saudaCount: 0
        };
      }

      if (tradeType === 'buy') {
        acc[instrumentIdentifier].totalBuyQuantity += quantity;
      } else if (tradeType === 'sell') {
        acc[instrumentIdentifier].totalSellQuantity += quantity;
      }

      // Increment saudaCount for each trade action
      acc[instrumentIdentifier].saudaCount += 1;

      return acc;
    }, {});

    // Fetch QuotationLot for each instrumentIdentifier from the Stock model
    const instrumentIdentifiers = Object.keys(instrumentMap);
    const stocks = await Stock.find({ InstrumentIdentifier: { $in: instrumentIdentifiers } });

    const stockMap = stocks.reduce((acc, stock) => {
      acc[stock.InstrumentIdentifier] = stock.QuotationLot;
      return acc;
    }, {});

    // Create the response with the required calculations
    const result = Object.keys(instrumentMap)
      .map(instrumentIdentifier => {
        const { totalBuyQuantity, totalSellQuantity } = instrumentMap[instrumentIdentifier];
        const QuotationLot = stockMap[instrumentIdentifier] || null; // Default to null if not found

        // Perform the calculations
        const totalBuyLots = QuotationLot ? totalBuyQuantity / QuotationLot : 0;
        const totalSellLots = QuotationLot ? totalSellQuantity / QuotationLot : 0;

        // Determine the lowest value between totalBuyLots and totalSellLots
        const lowestLots = Math.min(totalBuyLots, totalSellLots);

        return {
          instrumentIdentifier,
          totalBuyQuantity,
          totalSellQuantity,
          QuotationLot,
          totalBuyLots: totalBuyLots.toFixed(2), // Limit to 2 decimal places
          totalSellLots: totalSellLots.toFixed(2), // Limit to 2 decimal places
          saudaCount: lowestLots.toFixed(2) // Set saudaCount to the lowest value
        };
      });

    res.status(200).json({ userId, trades: result });
  } catch (error) {
    res.status(500).json({ error: 'Error calculating trades by user', details: error.message });
  }
};

// Get all trades by instrumentIdentifier and display adjusted quantities
// const getAllTradesByInstrumentIdentifier = async (req, res) => {
//   const { instrumentIdentifier } = req.params;

//   try {
//     if (!instrumentIdentifier) {
//       return res.status(400).json({ message: 'Instrument Identifier is required' });
//     }

//     // Fetch all trades for the given instrumentIdentifier
//     const trades = await Trade.find({ instrumentIdentifier }).exec();

//     if (trades.length === 0) {
//       return res.status(404).json({ message: 'No trades found for this instrumentIdentifier' });
//     }

//     // Initialize quantities
//     let totalSellQuantity = 0;
//     let totalBuyQuantity = 0;

//     // Calculate total quantities based on trade type
//     trades.forEach(trade => {
//       if (trade.tradeType === 'sell') {
//         totalSellQuantity += trade.quantity;
//       } else if (trade.tradeType === 'buy') {
//         totalBuyQuantity += trade.quantity;
//       }
//     });

//     // Calculate net quantities
//     const netSellQuantity = totalSellQuantity - totalBuyQuantity;
//     const netBuyQuantity = totalBuyQuantity - totalSellQuantity;

//     // Prepare adjusted trade list
//     const tradeList = trades.map(trade => {
//       let adjustedQuantity;
//       if (trade.tradeType === 'sell') {
//         // Adjust sell quantities based on remaining buys
//         adjustedQuantity = netSellQuantity > 0 ? Math.max(trade.quantity - totalBuyQuantity, 0) : trade.quantity;
//       } else if (trade.tradeType === 'buy') {
//         // Adjust buy quantities based on remaining sells
//         adjustedQuantity = netBuyQuantity > 0 ? Math.max(trade.quantity - totalSellQuantity, 0) : trade.quantity;
//       }
//       return {
//         ...trade._doc,
//         adjustedQuantity,
//         action: trade.tradeType
//       };
//     });

//     // Send the response
//     res.json({
//       instrumentIdentifier,
//       netSellQuantity: netSellQuantity > 0 ? netSellQuantity : 0,
//       netBuyQuantity: netBuyQuantity > 0 ? netBuyQuantity : 0,
//       trades: tradeList
//     });
//   } catch (err) {
//     console.error('Error fetching trades or calculating quantities:', err);
//     res.status(500).json({ message: 'Internal Server Error' });
//   }
// };

const getAllTradesByInstrumentIdentifier = async (req, res) => {
  const { instrumentIdentifier } = req.params;
  const { userId } = req.query; // Fetch userId from query parameters

  try {
    if (!instrumentIdentifier) {
      return res.status(400).json({ message: 'Instrument Identifier is required' });
    }

    // Fetch all trades for the given instrumentIdentifier and userId
    const trades = await Trade.find({ instrumentIdentifier, userId }).exec();

    if (trades.length === 0) {
      return res.status(404).json({ message: 'No trades found for this instrumentIdentifier' });
    }

    // Initialize quantities
    let totalSellQuantity = 0;
    let totalBuyQuantity = 0;

    // Calculate total quantities based on trade type
    trades.forEach(trade => {
      if (trade.tradeType === 'sell') {
        totalSellQuantity += trade.quantity;
      } else if (trade.tradeType === 'buy') {
        totalBuyQuantity += trade.quantity;
      }
    });

    // Calculate net quantities
    const netSellQuantity = totalSellQuantity - totalBuyQuantity;
    const netBuyQuantity = totalBuyQuantity - totalSellQuantity;

    // Prepare adjusted trade list with opposite actions
    const tradeList = [];
    if (netSellQuantity > 0) {
      tradeList.push({
        action: 'buy', // Opposite of sell
        quantity: netSellQuantity
      });
    }
    if (netBuyQuantity > 0) {
      tradeList.push({
        action: 'sell', // Opposite of buy
        quantity: netBuyQuantity
      });
    }

    // Send the response
    res.json({
      instrumentIdentifier,
      netSellQuantity: Math.max(netSellQuantity, 0),
      netBuyQuantity: Math.max(netBuyQuantity, 0),
      trades: tradeList
    });
  } catch (err) {
    console.error('Error fetching trades or calculating quantities:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};



module.exports = {
  addTrade,
  getTrades,
  deleteTrade,
  getTradesByInstrumentIdentifier,
  getTradesForChart,
  calculateNetQuantityByUser,
  calculateMCXTradesByUser,
  getAllTradesByInstrumentIdentifier
};
