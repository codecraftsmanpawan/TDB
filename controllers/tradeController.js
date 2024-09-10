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

    const instrumentMap = trades.reduce((acc, trade) => {
      if (!acc[trade.instrumentIdentifier]) {
        acc[trade.instrumentIdentifier] = {
          totalBuyQuantity: 0,
          totalSellQuantity: 0,
          name: trade.name,
          exchange: trade.exchange,
          status: trade.status,
          price: trade.price,
        };
      }

      // Adjust the quantities: Buy remains positive, Sell becomes negative
      if (trade.tradeType === 'buy') {
        acc[trade.instrumentIdentifier].totalBuyQuantity += trade.quantity;
      } else if (trade.tradeType === 'sell') {
        acc[trade.instrumentIdentifier].totalSellQuantity -= trade.quantity; 
      }

      return acc;
    }, {});

    // Fetch stocks data to get QuotationLot
    const stocks = await Stock.find({
      InstrumentIdentifier: { $in: Object.keys(instrumentMap) }
    }).lean();

    // Create a map for quick lookup of QuotationLot
    const stockMap = stocks.reduce((acc, stock) => {
      acc[stock.InstrumentIdentifier] = stock.QuotationLot || 1; 
      return acc;
    }, {});

    const netQuantities = Object.keys(instrumentMap)
      .map(instrumentIdentifier => {
        const {
          totalBuyQuantity,
          totalSellQuantity,
          name,
          exchange,
          status,
          price
        } = instrumentMap[instrumentIdentifier];

        // Adjust quantity for MCX exchange using the QuotationLot
        const quantityAdjustment = exchange === 'MCX' ? stockMap[instrumentIdentifier] : 1;

        // Net quantity should reflect the correct buy/sell balance (buys - sells)
        const netQuantity = (totalBuyQuantity + totalSellQuantity) / quantityAdjustment;
        const absoluteNetQuantity = Math.abs(netQuantity);

        // Determine the tradeType based on the sign of netQuantity
        const tradeType = netQuantity < 0 ? 'sell' : 'buy';

        // Set action as opposite of tradeType
        const action = tradeType === 'buy' ? 'sell' : 'buy';

        // Calculate investment value as absoluteNetQuantity * price
        const investmentValue = absoluteNetQuantity * price;

        return {
          instrumentIdentifier,
          netQuantity: absoluteNetQuantity,  
          investmentValue,                  
          name,
          exchange,
          tradeType,                         
          status,
          price,
          action                            
        };
      })
      // Filter out trades where netQuantity is 0
      .filter(trade => trade.netQuantity !== 0);

    res.status(200).json({ userId, netQuantities });
  } catch (error) {
    res.status(500).json({ error: 'Error calculating net quantity by user', details: error.message });
  }
};



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
//           action: trade.action // Default to the action of the first trade
//         };
//       }
//       if (trade.tradeType === 'buy') {
//         acc[trade.instrumentIdentifier].totalBuyQuantity += trade.quantity;
//       } else if (trade.tradeType === 'sell') {
//         acc[trade.instrumentIdentifier].totalSellQuantity += trade.quantity;
//       }
//       // Update the action to reflect the last action found for this instrument
//       acc[trade.instrumentIdentifier].action = trade.tradeType === 'buy' ? 'sell' : 'buy';
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

//         // Determine the opposite action
//         const oppositeAction = action === 'buy' ? 'sell' : 'buy';

//         return {
//           instrumentIdentifier,
//           netQuantity: absoluteNetQuantity, 
//           investmentValue,
//           name,
//           exchange,
//           status,
//           price,
//           action: oppositeAction 
//         };
//       })
//       // Filter out trades where netQuantity is 0
//       .filter(trade => trade.netQuantity !== 0);

//     res.status(200).json({ userId, netQuantities });
//   } catch (error) {
//     res.status(500).json({ error: 'Error calculating net quantity by user', details: error.message });
//   }
// };


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

// Controller function to get all stock trades for a given client
const getClientStockHistory = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Validate the userId format (assuming it's a valid ObjectId)
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    // Fetch all trades for the given userId
    const trades = await Trade.find({ userId }).exec();

    if (!trades || trades.length === 0) {
      return res.status(404).json({ message: 'No trades found for this user' });
    }

    // Send the trades in the response
    res.status(200).json({ trades });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching trades' });
  }
};


// Controller to get all NSE and MCX trade data and brokerage details by client object ID
// const getTradesBrokerageByClientId = async (req, res) => {
//   try {
//     const { clientId } = req.params;

//     // Find the client and include brokerage details
//     const client = await Client.findById(clientId).select('share_brokerage mcx_brokerage_type mcx_brokerage');
    
//     if (!client) {
//       return res.status(404).json({ message: "Client not found" });
//     }

//     // Get all trades for the client in NSE exchange and MCX exchange
//     const nseTrades = await Trade.find({ userId: clientId, exchange: 'NSE' });
//     const mcxTrades = await Trade.find({ userId: clientId, exchange: 'MCX' });

//     // Calculate the total amount for NSE and MCX trades
//     const totalNSEAmount = nseTrades.reduce((total, trade) => total + trade.price, 0);
//     const totalMCXAmount = mcxTrades.reduce((total, trade) => total + trade.price, 0);

//     // Initialize brokerage per crore for NSE and MCX
//     let brokeragePerNSECrore = 0;
//     let brokeragePerMCX = 0;
//     let totalSaudas = 0;

//     // Calculate brokerage amount for NSE (instead of percentage)
//     if (totalNSEAmount >= 100) {
//       brokeragePerNSECrore = (client.share_brokerage / 100) * totalNSEAmount;
//     }

//     // MCX brokerage calculation logic
//     if (client.mcx_brokerage_type === "per_sauda") {
//       // Group trades by instrumentIdentifier and count buys and sells for sauda calculation
//       const instrumentMap = {};

//       mcxTrades.forEach(trade => {
//         const instrument = trade.instrumentIdentifier;
//         if (!instrumentMap[instrument]) {
//           instrumentMap[instrument] = { buy: 0, sell: 0 };
//         }
//         if (trade.tradeType === 'buy') {
//           instrumentMap[instrument].buy += trade.quantity;
//         } else if (trade.tradeType === 'sell') {
//           instrumentMap[instrument].sell += trade.quantity;
//         }
//       });

//       // Calculate saudas based on matching buys and sells
//       for (const instrument in instrumentMap) {
//         const { buy, sell } = instrumentMap[instrument];
//         totalSaudas += Math.min(buy, sell); 
//       }

//       // Calculate total brokerage based on saudas
//       brokeragePerMCX = totalSaudas * client.mcx_brokerage;

//     } else if (client.mcx_brokerage_type === "per_crore" && totalMCXAmount >= 100) {
//       // Calculate brokerage per crore for MCX
//       brokeragePerMCX = (client.mcx_brokerage / totalMCXAmount) * 100;
//     }

//     // Calculate total amount and total brokerage
//     const totalAmount = totalNSEAmount + totalMCXAmount;
//     const totalBrokerage = brokeragePerNSECrore + brokeragePerMCX;

//     // Return trade data along with brokerage details, total amounts, and brokerage per crore/sauda for both NSE and MCX
//     res.status(200).json({
//       success: true,
//       client: {
//         share_brokerage: client.share_brokerage,
//         mcx_brokerage_type: client.mcx_brokerage_type,
//         mcx_brokerage: client.mcx_brokerage,
//       },
//       nseTrades,
//       totalNSEAmount,
//       brokeragePerNSECrore: brokeragePerNSECrore.toFixed(2),
//       mcxTrades,
//       totalMCXAmount,
//       totalSaudas,
//       brokeragePerMCX: brokeragePerMCX.toFixed(2), 
//       totalAmount: totalAmount.toFixed(2), 
//       totalBrokerage: totalBrokerage.toFixed(2) 
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error', error });
//   }
// };




const getTradesBrokerageByClientId = async (req, res) => {
  try {
    const { clientId } = req.params;

    // Find the client and include brokerage details
    const client = await Client.findById(clientId).select('share_brokerage mcx_brokerage_type mcx_brokerage currentbrokerage');
    
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Get all trades for the client in NSE exchange and MCX exchange
    const nseTrades = await Trade.find({ userId: clientId, exchange: 'NSE' });
    const mcxTrades = await Trade.find({ userId: clientId, exchange: 'MCX' });

    // Retrieve QuotationLot for MCX instruments
    const stockIdentifiers = [...new Set(mcxTrades.map(trade => trade.instrumentIdentifier))];
    const stockMap = await Stock.find({ InstrumentIdentifier: { $in: stockIdentifiers } }).select('InstrumentIdentifier name product Exchange QuotationLot');

    // Update QuotationLot based on conditions
    const stockQuotationLotMap = {};
    stockMap.forEach(stock => {
      if (
        stock.name === 'GOLD' &&
        stock.product === 'GOLD' &&
        stock.Exchange === 'MCX'
      ) {
        stock.QuotationLot = 100;
      } else if (
        stock.name === 'GOLDM' &&
        stock.product === 'GOLDM' &&
        stock.Exchange === 'MCX'
      ) {
        stock.QuotationLot = 10;
      }
      stockQuotationLotMap[stock.InstrumentIdentifier] = stock.QuotationLot;
    });

    // Save updated stocks to the database
    await Promise.all(stockMap.map(stock => stock.save()));

    // Calculate the total amount for NSE trades (without using lot size)
    const totalNSEAmount = nseTrades.reduce((total, trade) => {
      return total + (trade.price * trade.quantity);
    }, 0);

    // Calculate the total amount for MCX trades (adjusted for lot size)
    const mcxTradeDetails = mcxTrades.map(trade => {
      const lotSize = stockQuotationLotMap[trade.instrumentIdentifier] || 1;
      return {
        ...trade.toObject(),
        adjustedQuantity: trade.quantity / lotSize
      };
    });

    const totalMCXAmount = mcxTradeDetails.reduce((total, trade) => {
      return total + (trade.price * trade.adjustedQuantity);
    }, 0);

    // Initialize brokerage amounts
    let brokeragePerNSECrore = 0;
    let brokeragePerMCX = 0;
    let totalSaudas = 0;

    // Calculate brokerage amount for NSE (always per crore)
    if (totalNSEAmount > 0) {
      brokeragePerNSECrore = (totalNSEAmount / 10000000) * client.share_brokerage;
    }

    // MCX brokerage calculation logic
    if (client.mcx_brokerage_type === "per_sauda") {
      // Group trades by instrumentIdentifier and count buys and sells for sauda calculation
      const instrumentMap = {};

      mcxTradeDetails.forEach(trade => {
        const instrument = trade.instrumentIdentifier;
        if (!instrumentMap[instrument]) {
          instrumentMap[instrument] = { buy: 0, sell: 0 };
        }
        if (trade.tradeType === 'buy') {
          instrumentMap[instrument].buy += trade.adjustedQuantity;
        } else if (trade.tradeType === 'sell') {
          instrumentMap[instrument].sell += trade.adjustedQuantity;
        }
      });

      // Calculate saudas based on matching buys and sells
      for (const instrument in instrumentMap) {
        const { buy, sell } = instrumentMap[instrument];
        totalSaudas += Math.min(buy, sell); 
      }

      // Calculate total brokerage based on saudas
      brokeragePerMCX = (totalSaudas * client.mcx_brokerage);

    } else if (client.mcx_brokerage_type === "per_crore" && totalMCXAmount >= 100) {
      // Calculate brokerage per crore for MCX
      brokeragePerMCX = ((totalMCXAmount / 10000000) * client.mcx_brokerage);
    }

    // Calculate total amount and total brokerage
    const totalAmount = totalNSEAmount + totalMCXAmount;
    const totalBrokerage = brokeragePerNSECrore + brokeragePerMCX;

    // Update the client's currentbrokerage field
    await Client.findByIdAndUpdate(clientId, { currentbrokerage: totalBrokerage.toFixed(2) });

    // Return trade data along with brokerage details, total amounts, and brokerage per crore/sauda for both NSE and MCX
    res.status(200).json({
      success: true,
      client: {
        share_brokerage: client.share_brokerage,
        mcx_brokerage_type: client.mcx_brokerage_type,
        mcx_brokerage: client.mcx_brokerage,
        currentbrokerage: totalBrokerage.toFixed(2), 
      },
      nseTrades,
      totalNSEAmount,
      brokeragePerNSECrore: brokeragePerNSECrore.toFixed(2),
      mcxTrades: mcxTradeDetails,
      totalMCXAmount,
      totalSaudas,
      brokeragePerMCX: brokeragePerMCX.toFixed(2), 
      totalAmount: totalAmount.toFixed(2), 
      totalBrokerage: totalBrokerage.toFixed(2) 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error });
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
  getAllTradesByInstrumentIdentifier,
  getClientStockHistory,
  getTradesBrokerageByClientId
};
