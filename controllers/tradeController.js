const mongoose = require("mongoose");
const Trade = require("../models/Trade");
const Client = require("../models/client");
const Stock = require("../models/stock");
const MasterAdmin = require("../models/masterAdmin");

const addTrade = async (req, res) => {
  try {
    const {
      _id,
      instrumentIdentifier,
      name,
      exchange,
      trade_type, // buy or sell
      quantity,
      price,
    } = req.body;

    console.log("Request Body:", req.body);

    // 1. Validate required fields
    if (
      !_id ||
      !instrumentIdentifier ||
      !name ||
      !exchange ||
      !trade_type ||
      !quantity ||
      !price
    ) {
      console.log("Validation failed: All fields are required");
      return res.status(400).json({ message: "All fields are required" });
    }

    // 2. Validate trade_type
    if (!["buy", "sell"].includes(trade_type)) {
      console.log("Invalid trade_type:", trade_type);
      return res.status(400).json({
        message: 'Invalid trade_type. It should be either "buy" or "sell".',
      });
    }

    // 3. Validate quantity and price
    if (quantity <= 0 || price <= 0) {
      console.log("Invalid quantity or price:", quantity, price);
      return res
        .status(400)
        .json({ message: "Quantity and price must be greater than zero." });
    }

    // 4. Validate the '_id' format (User ID check)
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      console.log("Invalid _id format:", _id);
      return res.status(400).json({ message: "Invalid User" });
    }

    // 5. Fetch client based on '_id' and validate
    const client = await Client.findById(_id);
    if (!client) {
      console.log("Client not found for _id:", _id);
      return res.status(404).json({ message: "Client not found" });
    }
    console.log("Client found:", client);

    // 6. Validation: Check if the trade is for MCX exchange
    if (exchange !== "MCX") {
      console.log("Invalid exchange:", exchange);
      return res.status(400).json({ message: "Only MCX trades are supported" });
    }

    // 7. Validate trade limits for the user based on MCX exchange
    const tradeLimit = client.PerMCXTrade; // Trade limit for MCX
    console.log("MCX Trade Limit for User:", tradeLimit);

    // 8. Fetch the stock details based on instrumentIdentifier and name
    const stock = await Stock.findOne({
      InstrumentIdentifier: instrumentIdentifier,
      name: name, // Validate by both instrumentIdentifier and name
    });
    if (!stock) {
      console.log(
        `Stock not found for instrumentIdentifier: ${instrumentIdentifier} and name: ${name}`
      );
      return res.status(404).json({
        message: `Stock not found for instrumentIdentifier: ${instrumentIdentifier} and name: ${name}`,
      });
    }
    console.log("Stock found:", stock);

    // 9. Validate if trade quantity is divisible by the stock's QuotationLot
    const lotSize = quantity / stock.QuotationLot;
    if (quantity % stock.QuotationLot !== 0) {
      console.log(
        `Trade quantity ${quantity} is not divisible by QuotationLot ${stock.QuotationLot}`
      );
      return res.status(400).json({
        message: `Trade quantity must be divisible by the QuotationLot of ${stock.QuotationLot}.`,
      });
    }
    console.log(`Lot size for the trade: ${lotSize}`);

    // 10. Fetch only existing open trades for this instrumentIdentifier and user
    const existingTrades = await Trade.find({
      userId: client._id,
      exchange,
      instrumentIdentifier, // Only fetch trades for this specific instrument
      status: "open", // Assuming only 'open' trades count towards the limit
    });

    let totalBuyLots = 0;
    let totalSellLots = 0;

    existingTrades.forEach((trade) => {
      const tradeLots = trade.quantity / stock.QuotationLot;
      if (trade.tradeType === "buy") {
        totalBuyLots += tradeLots;
      } else if (trade.tradeType === "sell") {
        totalSellLots += tradeLots;
      }
    });

    console.log(
      `Total Buy Lots for ${instrumentIdentifier}: ${totalBuyLots}, Total Sell Lots: ${totalSellLots}`
    );

    // 11. Validation logic for buy/sell on MCX
    if (trade_type === "buy") {
      const remainingBuyLots = tradeLimit - (totalBuyLots - totalSellLots); // Adjusted for net position
      if (lotSize > remainingBuyLots) {
        console.log(`You can only buy ${remainingBuyLots} more lots`);
        return res.status(400).json({
          message: `You can only buy ${remainingBuyLots} more lots for ${instrumentIdentifier}.`,
          maxBuyLimitReached: true, // Flag to indicate max buy limit is reached
        });
      }
    } else if (trade_type === "sell") {
      const netBuyLots = totalBuyLots - totalSellLots;
      const maxSellableLots = tradeLimit;
      const sellableLots =
        netBuyLots > 0
          ? Math.min(netBuyLots, maxSellableLots)
          : maxSellableLots;

      if (lotSize > sellableLots) {
        console.log("Cannot sell more than the maximum allowed");
        return res.status(400).json({
          message: `You can only sell a maximum of ${sellableLots} lots for ${instrumentIdentifier}.`,
        });
      }

      // Check sell limit against tradeLimit
      const remainingSellLots = tradeLimit - totalSellLots; // Remaining limit for selling
      if (lotSize > remainingSellLots) {
        console.log(`You can only sell ${remainingSellLots} more lots`);
        return res.status(400).json({
          message: `You can only sell ${remainingSellLots} more lots for ${instrumentIdentifier}.`,
        });
      }
    }

    // 12. Create a new trade instance
    const newTrade = new Trade({
      userId: client._id,
      stockId: stock._id,
      instrumentIdentifier,
      name,
      exchange,
      tradeType: trade_type,
      quantity,
      price,
      action: trade_type,
      status: "open",
      date: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log("New Trade Data:", newTrade);

    // 13. Save the trade to the database
    const savedTrade = await newTrade.save();

    // 14. Respond with the saved trade data
    console.log("Trade saved successfully:", savedTrade);
    res
      .status(201)
      .json({ message: "Trade added successfully", trade: savedTrade });
  } catch (error) {
    console.error("Error adding trade:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// const addTrade = async (req, res) => {
//   try {
//     const {
//       _id,
//       instrumentIdentifier,
//       name,
//       exchange,
//       trade_type,
//       quantity,
//       price,
//     } = req.body;

//     if (
//       !_id ||
//       !instrumentIdentifier ||
//       !name ||
//       !exchange ||
//       !trade_type ||
//       !quantity ||
//       !price
//     ) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     if (!["buy", "sell"].includes(trade_type)) {
//       return res.status(400).json({
//         message: 'Invalid trade_type. It should be either "buy" or "sell".',
//       });
//     }

//     if (quantity <= 0 || price <= 0) {
//       return res
//         .status(400)
//         .json({ message: "Quantity and price must be greater than zero." });
//     }

//     // Validate the '_id' format
//     if (!mongoose.Types.ObjectId.isValid(_id)) {
//       return res.status(400).json({ message: "Invalid User" });
//     }

//     // Find the client document using the provided '_id'
//     const client = await Client.findById(_id);

//     if (!client) {
//       return res.status(404).json({ message: "Client not found" });
//     }

//     // Create a new trade instance
//     const newTrade = new Trade({
//       userId: client._id,
//       stockId: instrumentIdentifier,
//       instrumentIdentifier,
//       name,
//       exchange,
//       tradeType: trade_type,
//       quantity,
//       price,
//       action: trade_type,
//       status: "open",
//       date: Date.now(),
//       createdAt: Date.now(),
//       updatedAt: Date.now(),
//     });

//     // Save the trade to the database
//     const savedTrade = await newTrade.save();

//     // Respond with the saved trade data
//     res
//       .status(201)
//       .json({ message: "Trade added successfully", trade: savedTrade });
//   } catch (error) {
//     console.error("Error adding trade:", error);
//     res
//       .status(500)
//       .json({ message: "Internal server error", error: error.message });
//   }
// };

// const addTrade = async (req, res) => {
//   try {
//     const {
//       _id,
//       instrumentIdentifier,
//       name,
//       exchange,
//       trade_type,
//       quantity,
//       price,
//     } = req.body;

//     // Validate required fields
//     if (
//       !_id ||
//       !instrumentIdentifier ||
//       !name ||
//       !exchange ||
//       !trade_type ||
//       !quantity ||
//       !price
//     ) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     if (!["buy", "sell"].includes(trade_type)) {
//       return res.status(400).json({
//         message: 'Invalid trade_type. It should be either "buy" or "sell".',
//       });
//     }

//     if (quantity <= 0 || price <= 0) {
//       return res
//         .status(400)
//         .json({ message: "Quantity and price must be greater than zero." });
//     }

//     // Validate the '_id' format
//     if (!mongoose.Types.ObjectId.isValid(_id)) {
//       return res.status(400).json({ message: "Invalid User" });
//     }

//     // Find the client document using the provided '_id'
//     const client = await Client.findById(_id);
//     if (!client) {
//       return res.status(404).json({ message: "Client not found" });
//     }

//     // Find the stock document to get QuotationLot information
//     const stock = await Stock.findOne({
//       InstrumentIdentifier: instrumentIdentifier,
//     });
//     if (!stock) {
//       return res.status(404).json({ message: "Stock not found" });
//     }

//     const QuotationLot = stock.QuotationLot;

//     // Log the input details including the trade type
//     console.log(
//       `Calculating totalLots for stock: ${name}, tradeType: ${trade_type}`
//     );
//     console.log(`Quantity (Lots): ${quantity}, QuotationLot: ${QuotationLot}`);

//     // Calculate total lots in terms of QuotationLot
//     const totalLots = Math.floor(quantity / QuotationLot); // Total lots traded
//     console.log(
//       `Total lots being traded (divided by QuotationLot): ${totalLots}`
//     );

//     // Check exchange-specific trade limits
//     if (exchange === "MCX") {
//       // Find existing trades made by the client for this stock based on the name
//       const existingTrades = await Trade.find({
//         userId: client._id,
//         name,
//         exchange: "MCX",
//       });

//       // Log existing trades data for debugging
//       console.log("Existing trades data for this stock:", existingTrades);

//       const existingTradeCount = existingTrades.length; // Count of existing trades
//       console.log(`Existing trades for this stock: ${existingTradeCount}`);

//       // Calculate how many lots the client has already traded for buy and sell
//       const totalTradedQuantity = existingTrades.reduce(
//         (sum, trade) => sum + trade.quantity,
//         0
//       );
//       const totalTradedLots = Math.floor(totalTradedQuantity / QuotationLot);
//       console.log(`Total lots traded for this stock: ${totalTradedLots}`);

//       // Calculate remaining allowed trades for per-stock limit
//       const maxAllowedPerStock = client.PerMCXTrade; // Maximum trades allowed per stock
//       const remainingAllowedTrades = maxAllowedPerStock - totalTradedLots; // Remaining allowed trades
//       console.log(
//         `Remaining allowed trades for this stock: ${remainingAllowedTrades}`
//       );

//       // Check if the new trade exceeds the remaining allowed trades for this stock
//       if (totalLots > remainingAllowedTrades) {
//         console.log(
//           `Trade exceeds the allowed limit for this stock. Max allowed: ${maxAllowedPerStock}, Total lots: ${totalLots}`
//         );
//         return res.status(400).json({
//           message: `Trade quantity exceeds the allowed limit for this stock. Maximum allowed: ${maxAllowedPerStock} lots.`,
//         });
//       }

//       // Check trade_type limits using the maxTradeLimitPerType from client
//       const maxTradeLimitPerType = client.PerMCXTrade; // Get the limit from the client
//       const buyTradeCount = existingTrades.filter(
//         (trade) => trade.tradeType === "buy"
//       ).length;
//       const sellTradeCount = existingTrades.filter(
//         (trade) => trade.tradeType === "sell"
//       ).length;

//       console.log(`Existing buy trades for this stock: ${buyTradeCount}`);
//       console.log(`Existing sell trades for this stock: ${sellTradeCount}`);

//       // Check if new trade violates limits based on existing trades
//       if (trade_type === "buy" && buyTradeCount >= maxTradeLimitPerType) {
//         return res.status(400).json({
//           message: `Maximum ${maxTradeLimitPerType} buy trades allowed for this stock.`,
//         });
//       }

//       if (trade_type === "sell" && sellTradeCount >= maxTradeLimitPerType) {
//         return res.status(400).json({
//           message: `Maximum ${maxTradeLimitPerType} sell trades allowed for this stock.`,
//         });
//       }

//       // Allow trades if they do not exceed the limits
//     }

//     // Log the trade type before creating the new trade
//     console.log(`Preparing to add a new trade: TradeType: ${trade_type}`);

//     // Create a new trade instance
//     const newTrade = new Trade({
//       userId: client._id,
//       stockId: instrumentIdentifier,
//       instrumentIdentifier,
//       name,
//       exchange,
//       tradeType: trade_type,
//       quantity,
//       price,
//       action: trade_type,
//       status: "open",
//       date: Date.now(),
//       createdAt: Date.now(),
//       updatedAt: Date.now(),
//     });

//     // Save the trade to the database
//     const savedTrade = await newTrade.save();

//     // Respond with the saved trade data
//     res
//       .status(201)
//       .json({ message: "Trade added successfully", trade: savedTrade });
//   } catch (error) {
//     console.error("Error adding trade:", error);
//     res
//       .status(500)
//       .json({ message: "Internal server error", error: error.message });
//   }
// };

// const addTrade = async (req, res) => {
//   try {
//     const {
//       _id,
//       instrumentIdentifier,
//       name,
//       exchange,
//       trade_type,
//       quantity,
//       price,
//     } = req.body;

//     // Validate required fields
//     if (
//       !_id ||
//       !instrumentIdentifier ||
//       !name ||
//       !exchange ||
//       !trade_type ||
//       !quantity ||
//       !price
//     ) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     if (!["buy", "sell"].includes(trade_type)) {
//       return res.status(400).json({
//         message: 'Invalid trade_type. It should be either "buy" or "sell".',
//       });
//     }

//     if (quantity <= 0 || price <= 0) {
//       return res
//         .status(400)
//         .json({ message: "Quantity and price must be greater than zero." });
//     }

//     // Validate the '_id' format
//     if (!mongoose.Types.ObjectId.isValid(_id)) {
//       return res.status(400).json({ message: "Invalid User" });
//     }

//     // Find the client document using the provided '_id'
//     const client = await Client.findById(_id);
//     if (!client) {
//       return res.status(404).json({ message: "Client not found" });
//     }

//     // Find the stock document to get QuotationLot information
//     const stock = await Stock.findOne({
//       InstrumentIdentifier: instrumentIdentifier,
//     });
//     if (!stock) {
//       return res.status(404).json({ message: "Stock not found" });
//     }

//     const QuotationLot = stock.QuotationLot;

//     // Log the input details including the trade type
//     console.log(
//       `Calculating totalLots for stock: ${name}, tradeType: ${trade_type}`
//     );
//     console.log(`Quantity (Lots): ${quantity}, QuotationLot: ${QuotationLot}`);

//     // Calculate total lots in terms of QuotationLot
//     const totalLots = Math.floor(quantity / QuotationLot); // Total lots traded
//     console.log(
//       `Total lots being traded (divided by QuotationLot): ${totalLots}`
//     );

//     // Check exchange-specific trade limits
//     if (exchange === "MCX") {
//       // Find existing trades made by the client for this stock based on the name, exchange, and trade type
//       const existingTrades = await Trade.find({
//         userId: client._id,
//         name,
//         exchange: "MCX",
//       });

//       // Log existing trades data for debugging
//       console.log("Existing trades data for this stock:", existingTrades);

//       const totalTradedQuantity = existingTrades.reduce(
//         (sum, trade) => sum + trade.quantity,
//         0
//       );
//       const totalTradedLots = Math.floor(totalTradedQuantity / QuotationLot);
//       console.log(`Total lots traded for this stock: ${totalTradedLots}`);

//       // Calculate remaining allowed trades for per-stock limit
//       const maxAllowedPerStock = client.PerMCXTrade; // Maximum trades allowed per stock
//       const remainingAllowedTrades = maxAllowedPerStock - totalTradedLots; // Remaining allowed trades
//       console.log(
//         `Remaining allowed trades for this stock: ${remainingAllowedTrades}`
//       );

//       // Count the existing buy and sell trades separately
//       const buyTrades = existingTrades.filter(
//         (trade) => trade.tradeType === "buy"
//       );
//       const sellTrades = existingTrades.filter(
//         (trade) => trade.tradeType === "sell"
//       );

//       const buyTradeCount = buyTrades.length;
//       const sellTradeCount = sellTrades.length;

//       console.log(`Existing buy trades for this stock: ${buyTradeCount}`);
//       console.log(`Existing sell trades for this stock: ${sellTradeCount}`);

//       // Calculate remaining allowed trades for buy and sell
//       const maxTradeLimitPerType = client.PerMCXTrade; // Get the limit from the client
//       const remainingBuyTrades = maxTradeLimitPerType - buyTradeCount;
//       const remainingSellTrades = maxTradeLimitPerType - sellTradeCount;

//       console.log(
//         `Remaining allowed buy trades for this stock: ${remainingBuyTrades}`
//       );
//       console.log(
//         `Remaining allowed sell trades for this stock: ${remainingSellTrades}`
//       );

//       // Check if the new trade violates limits based on existing trades
//       if (trade_type === "buy") {
//         if (remainingBuyTrades <= 0) {
//           return res.status(400).json({
//             message: `Maximum ${maxTradeLimitPerType} buy trades allowed for this stock. You cannot buy more.`,
//           });
//         }

//         // Ensure the buy quantity does not exceed the remaining allowed buy trades
//         if (totalLots > remainingBuyTrades) {
//           return res.status(400).json({
//             message: `Trade quantity exceeds the allowed limit for buy trades. Maximum allowed: ${remainingBuyTrades} lots.`,
//           });
//         }
//       }

//       if (trade_type === "sell") {
//         if (remainingSellTrades <= 0) {
//           return res.status(400).json({
//             message: `Maximum ${maxTradeLimitPerType} sell trades allowed for this stock. You cannot sell more.`,
//           });
//         }

//         // Ensure the sell quantity does not exceed the remaining allowed sell trades
//         if (totalLots > remainingSellTrades) {
//           return res.status(400).json({
//             message: `Trade quantity exceeds the allowed limit for sell trades. Maximum allowed: ${remainingSellTrades} lots.`,
//           });
//         }
//       }
//     }

//     // Add logic for NSE exchange with PerNSETrade
//     if (exchange === "NSE") {
//       // Find existing trades made by the client for this stock based on the name, exchange, and trade type
//       const existingTrades = await Trade.find({
//         userId: client._id,
//         name,
//         exchange: "NSE",
//       });

//       // Log existing trades data for debugging
//       console.log("Existing trades data for this stock (NSE):", existingTrades);

//       const totalTradedQuantity = existingTrades.reduce(
//         (sum, trade) => sum + trade.quantity,
//         0
//       );
//       const totalTradedLots = Math.floor(totalTradedQuantity / QuotationLot);
//       console.log(`Total lots traded for this stock: ${totalTradedLots}`);

//       // Calculate remaining allowed trades for per-stock limit
//       const maxAllowedPerStock = client.PerNSETrade;
//       const remainingAllowedTrades = maxAllowedPerStock - totalTradedLots;
//       console.log(
//         `Remaining allowed trades for this stock (NSE): ${remainingAllowedTrades}`
//       );

//       // Count the existing buy and sell trades separately
//       const buyTrades = existingTrades.filter(
//         (trade) => trade.tradeType === "buy"
//       );
//       const sellTrades = existingTrades.filter(
//         (trade) => trade.tradeType === "sell"
//       );

//       const buyTradeCount = buyTrades.length;
//       const sellTradeCount = sellTrades.length;

//       console.log(`Existing buy trades for this stock (NSE): ${buyTradeCount}`);
//       console.log(
//         `Existing sell trades for this stock (NSE): ${sellTradeCount}`
//       );

//       // Calculate remaining allowed trades for buy and sell
//       const maxTradeLimitPerType = client.PerNSETrade;
//       const remainingBuyTrades = maxTradeLimitPerType - buyTradeCount;
//       const remainingSellTrades = maxTradeLimitPerType - sellTradeCount;

//       console.log(
//         `Remaining allowed buy trades for this stock (NSE): ${remainingBuyTrades}`
//       );
//       console.log(
//         `Remaining allowed sell trades for this stock (NSE): ${remainingSellTrades}`
//       );

//       // Check if the new trade violates limits based on existing trades
//       if (trade_type === "buy") {
//         if (remainingBuyTrades <= 0) {
//           return res.status(400).json({
//             message: `Maximum ${maxTradeLimitPerType} buy trades allowed for this stock. You cannot buy more.`,
//           });
//         }

//         // Ensure the buy quantity does not exceed the remaining allowed buy trades
//         if (totalLots > remainingBuyTrades) {
//           return res.status(400).json({
//             message: `Trade quantity exceeds the allowed limit for buy trades. Maximum allowed: ${remainingBuyTrades} lots.`,
//           });
//         }
//       }

//       if (trade_type === "sell") {
//         if (remainingSellTrades <= 0) {
//           return res.status(400).json({
//             message: `Maximum ${maxTradeLimitPerType} sell trades allowed for this stock. You cannot sell more.`,
//           });
//         }

//         // Ensure the sell quantity does not exceed the remaining allowed sell trades
//         if (totalLots > remainingSellTrades) {
//           return res.status(400).json({
//             message: `Trade quantity exceeds the allowed limit for sell trades. Maximum allowed: ${remainingSellTrades} lots.`,
//           });
//         }
//       }
//     }

//     // Log the trade type before creating the new trade
//     console.log(`Preparing to add a new trade: TradeType: ${trade_type}`);

//     // Create a new trade instance
//     const newTrade = new Trade({
//       userId: client._id,
//       stockId: instrumentIdentifier,
//       instrumentIdentifier,
//       name,
//       exchange,
//       tradeType: trade_type,
//       quantity,
//       price,
//       action: trade_type,
//       status: "open",
//       date: Date.now(),
//       createdAt: Date.now(),
//       updatedAt: Date.now(),
//     });

//     // Save the trade to the database
//     const savedTrade = await newTrade.save();

//     // Respond with the saved trade data
//     res
//       .status(201)
//       .json({ message: "Trade added successfully", trade: savedTrade });
//   } catch (error) {
//     console.error("Error adding trade:", error);
//     res
//       .status(500)
//       .json({ message: "Internal server error", error: error.message });
//   }
// };

const getTrades = async (req, res) => {
  try {
    const { clientId } = req.params;

    // Validate the 'clientId' format
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ message: "Invalid Client ID" });
    }

    // Find the client document using the provided 'clientId'
    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Fetch all trades related to the client
    const trades = await Trade.find({ userId: clientId });

    if (!trades || trades.length === 0) {
      return res
        .status(404)
        .json({ message: "No trades found for this client" });
    }

    // Modify the action to display the opposite action (buy to sell, sell to buy)
    const modifiedTrades = trades.map((trade) => {
      return {
        ...trade._doc,
        oppositeAction: trade.tradeType === "buy" ? "sell" : "buy",
      };
    });

    // Respond with the modified trade data
    res.status(200).json({ trades: modifiedTrades });
  } catch (error) {
    console.error("Error fetching trades:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const getTotalTrades = async (req, res) => {
  try {
    const { clientId } = req.params;

    // Validate the client ID format
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      console.log("Invalid Client ID:", clientId); // Log invalid clientId
      return res.status(400).json({ message: "Invalid Client ID" });
    }

    // Find the client document using the provided 'clientId'
    const client = await Client.findById(clientId);
    if (!client) {
      console.log("Client not found for ID:", clientId); // Log when client is not found
      return res.status(404).json({ message: "Client not found" });
    }

    console.log("Found client:", client); // Log found client details

    // Fetch trades related to the client
    const trades = await Trade.find({ userId: clientId }).populate(
      "instrumentIdentifier"
    );
    console.log("Fetched trades for client:", trades); // Log fetched trades

    // Helper function to calculate adjusted trades for a specific exchange
    const calculateAdjustedTrades = async (exchange) => {
      // Filter trades based on exchange
      const filteredTrades = trades.filter(
        (trade) => trade.exchange === exchange
      );

      // Process each trade to calculate the adjusted quantity based on QuotationLot
      const adjustedTrades = await Promise.all(
        filteredTrades.map(async (trade) => {
          // Fetch associated stock for this trade
          const stock = await Stock.findOne({
            InstrumentIdentifier: trade.instrumentIdentifier,
          });
          console.log(`Stock for trade ${trade._id}:`, stock); // Log stock details

          // Get the QuotationLot (default to 1 if not available)
          const quotationLot = stock?.QuotationLot || 1;

          // Calculate the adjusted quantity
          const adjustedQuantity = trade.quantity / quotationLot;

          return {
            ...trade.toObject(),
            adjustedQuantity, // New field with the divided quantity
            stockData: stock, // Include stock details if needed
          };
        })
      );

      return adjustedTrades;
    };

    // Calculate adjusted trades for MCX and NSE exchanges
    const adjustedMCXTrades = await calculateAdjustedTrades("MCX");
    const adjustedNSETrades = await calculateAdjustedTrades("NSE");

    // Filter out sensitive client information from the clientDetails object
    const filteredClientDetails = {
      TotalMCXTrade: client.TotalMCXTrade,
      TotalNSETrade: client.TotalNSETrade,
      PerMCXTrade: client.PerMCXTrade,
      PerNSETrade: client.PerNSETrade,
    };

    // Calculate the total adjusted quantities for buy and sell trades in MCX and NSE
    const totalMCXBuyTrades = adjustedMCXTrades
      .filter((trade) => trade.tradeType === "buy")
      .reduce((acc, trade) => acc + trade.adjustedQuantity, 0);

    const totalMCXSellTrades = adjustedMCXTrades
      .filter((trade) => trade.tradeType === "sell")
      .reduce((acc, trade) => acc + trade.adjustedQuantity, 0);

    const totalNSEBuyTrades = adjustedNSETrades
      .filter((trade) => trade.tradeType === "buy")
      .reduce((acc, trade) => acc + trade.adjustedQuantity, 0);

    const totalNSESellTrades = adjustedNSETrades
      .filter((trade) => trade.tradeType === "sell")
      .reduce((acc, trade) => acc + trade.adjustedQuantity, 0);

    // Return the data including the adjusted trades with divided quantity
    res.status(200).json({
      clientId: clientId,
      clientDetails: filteredClientDetails, // Exclude sensitive fields
      TotalMCXBuyTrades: totalMCXBuyTrades, // Total adjusted buy trades for MCX
      TotalMCXSellTrades: totalMCXSellTrades, // Total adjusted sell trades for MCX
      TotalNSEBuyTrades: totalNSEBuyTrades, // Total adjusted buy trades for NSE
      TotalNSESellTrades: totalNSESellTrades, // Total adjusted sell trades for NSE
      allMCXTrades: adjustedMCXTrades, // MCX trades with adjusted quantity
      allNSETrades: adjustedNSETrades, // NSE trades with adjusted quantity
    });
  } catch (error) {
    console.error("Error retrieving total trades:", error); // Log the error
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Controller function to delete a trade
const deleteTrade = async (req, res) => {
  try {
    const { tradeId } = req.params;

    // Validate the 'tradeId' format
    if (!mongoose.Types.ObjectId.isValid(tradeId)) {
      return res.status(400).json({ message: "Invalid Trade ID" });
    }

    // Find the trade to be deleted
    const trade = await Trade.findById(tradeId);

    if (!trade) {
      return res.status(404).json({ message: "Trade not found" });
    }

    // Find the client related to this trade
    const client = await Client.findById(trade.userId);

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Calculate the total cost of the trade
    const totalCost = trade.quantity * trade.price;

    // Update the client's available budget if the trade was a buy trade
    const updatedAvailableBudget =
      trade.tradeType === "buy"
        ? client.availableBudget + totalCost
        : client.availableBudget;

    await Client.updateOne(
      { _id: client._id },
      { $set: { availableBudget: updatedAvailableBudget } }
    );

    // Delete the trade
    await Trade.findByIdAndDelete(tradeId);

    // Respond with success message
    res.status(200).json({ message: "Trade deleted successfully" });
  } catch (error) {
    console.error("Error deleting trade:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Get all trades for a specific instrumentIdentifier and userId
// const getTradesByInstrumentIdentifier = async (req, res) => {
//   const { instrumentIdentifier } = req.params;
//   const { userId } = req.query; // Get userId from query parameters

//   try {
//     // Check if userId is provided in the query
//     if (!userId) {
//       return res.status(400).json({ message: 'User ID is required.' });
//     }

//     // Find trades matching both the instrumentIdentifier and userId
//     const trades = await Trade.find({
//       instrumentIdentifier: instrumentIdentifier,
//       userId: userId
//     });

//     if (trades.length === 0) {
//       return res.status(404).json({ message: 'No trades found for this instrument identifier and user.' });
//     }

//     return res.status(200).json(trades);
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ message: 'Server error' });
//   }
// };

const getTradesByInstrumentIdentifier = async (req, res) => {
  const { instrumentIdentifier } = req.params;
  const { userId } = req.query; // Get userId from query parameters

  try {
    // Check if userId is provided in the query
    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    // Find trades matching both the instrumentIdentifier and userId
    const trades = await Trade.find({
      instrumentIdentifier: instrumentIdentifier,
      userId: userId,
    });

    if (trades.length === 0) {
      return res.status(404).json({
        message: "No trades found for this instrument identifier and user.",
      });
    }

    // Get the current time
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentDay = currentTime.getDay(); // 0 = Sunday, 6 = Saturday

    // Check if trades need to be adjusted based on the exchange and day of the week
    const adjustedTrades = trades.map((trade) => {
      // Check for Saturday (6) and Sunday (0)
      if (currentDay === 0 || currentDay === 6) {
        return {
          ...trade.toObject(),
          BuyPrice: trade.Close,
          SellPrice: trade.Close,
        };
      }

      // Check for exchange-specific time adjustments
      if (
        trade.exchange === "NSE" &&
        (currentHour > 15 || (currentHour === 15 && currentMinutes >= 30))
      ) {
        // After 3:30 PM, set BuyPrice and SellPrice to Close price
        return {
          ...trade.toObject(),
          BuyPrice: trade.Close,
          SellPrice: trade.Close,
        };
      } else if (
        trade.exchange === "MCX" &&
        (currentHour > 23 || (currentHour === 23 && currentMinutes >= 30))
      ) {
        // After 11:30 PM, set BuyPrice and SellPrice to Close price
        return {
          ...trade.toObject(),
          BuyPrice: trade.Close,
          SellPrice: trade.Close,
        };
      }
      // Return the trade as is if no adjustments are needed
      return trade;
    });

    return res.status(200).json(adjustedTrades);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

const getTradesForChart = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate the 'userId' format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User ID" });
    }

    // Fetch all trades related to the user
    const trades = await Trade.find({ userId });

    if (!trades || trades.length === 0) {
      return res.status(404).json({ message: "No trades found for this user" });
    }

    // Process trades data for charting
    // Example: Aggregating data by date and summing quantities
    const tradeData = trades.reduce((acc, trade) => {
      const date = new Date(trade.date).toISOString().split("T")[0]; // Use date only
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
    console.error("Error fetching trades for chart:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
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
      if (trade.tradeType === "buy") {
        acc[trade.instrumentIdentifier] =
          (acc[trade.instrumentIdentifier] || 0) + trade.quantity;
      }
      // If it's a sell trade, subtract the quantity
      else if (trade.tradeType === "sell") {
        acc[trade.instrumentIdentifier] =
          (acc[trade.instrumentIdentifier] || 0) - trade.quantity;
      }
      return acc;
    }, {});

    res.status(200).json({ success: true, data: tradeSummary });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
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

//     const instrumentMap = trades.reduce((acc, trade) => {
//       if (!acc[trade.instrumentIdentifier]) {
//         acc[trade.instrumentIdentifier] = {
//           totalBuyQuantity: 0,
//           totalSellQuantity: 0,
//           name: trade.name,
//           exchange: trade.exchange,
//           status: trade.status,
//           price: trade.price,
//         };
//       }

//       // Adjust the quantities: Buy remains positive, Sell becomes negative
//       if (trade.tradeType === 'buy') {
//         acc[trade.instrumentIdentifier].totalBuyQuantity += trade.quantity;
//       } else if (trade.tradeType === 'sell') {
//         acc[trade.instrumentIdentifier].totalSellQuantity -= trade.quantity;
//       }

//       return acc;
//     }, {});

//     // Fetch stocks data to get QuotationLot
//     const stocks = await Stock.find({
//       InstrumentIdentifier: { $in: Object.keys(instrumentMap) }
//     }).lean();

//     // Create a map for quick lookup of QuotationLot
//     const stockMap = stocks.reduce((acc, stock) => {
//       acc[stock.InstrumentIdentifier] = stock.QuotationLot || 1;
//       return acc;
//     }, {});

//     const netQuantities = Object.keys(instrumentMap)
//       .map(instrumentIdentifier => {
//         const {
//           totalBuyQuantity,
//           totalSellQuantity,
//           name,
//           exchange,
//           status,
//           price
//         } = instrumentMap[instrumentIdentifier];

//         // Adjust quantity for MCX exchange using the QuotationLot
//         const quantityAdjustment = exchange === 'MCX' ? stockMap[instrumentIdentifier] : 1;

//         // Net quantity should reflect the correct buy/sell balance (buys - sells)
//         const netQuantity = (totalBuyQuantity + totalSellQuantity) / quantityAdjustment;
//         const absoluteNetQuantity = Math.abs(netQuantity);

//         // Determine the tradeType based on the sign of netQuantity
//         const tradeType = netQuantity < 0 ? 'sell' : 'buy';

//         // Set action as opposite of tradeType
//         const action = tradeType === 'buy' ? 'sell' : 'buy';

//         // Calculate investment value as absoluteNetQuantity * price
//         const investmentValue = absoluteNetQuantity * price;

//         return {
//           instrumentIdentifier,
//           netQuantity: absoluteNetQuantity,
//           investmentValue,
//           name,
//           exchange,
//           tradeType,
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
      return res.status(400).json({ error: "Invalid userId" });
    }

    // Fetch all trades for the given userId
    const trades = await Trade.find({ userId });

    if (trades.length === 0) {
      return res
        .status(404)
        .json({ error: "No trades found for the specified user" });
    }

    // Reduce trades to accumulate necessary data per instrument
    const instrumentMap = trades.reduce((acc, trade) => {
      const instrumentId = trade.instrumentIdentifier;

      if (!acc[instrumentId]) {
        acc[instrumentId] = {
          totalBuyQuantity: 0,
          totalSellQuantity: 0,
          totalPriceQuantity: 0,
          totalQuantity: 0,
          name: trade.name,
          exchange: trade.exchange,
          status: trade.status,
          price: trade.price,
        };
      }

      if (trade.tradeType === "buy") {
        acc[instrumentId].totalBuyQuantity += trade.quantity;
        acc[instrumentId].totalPriceQuantity += trade.price * trade.quantity;
        acc[instrumentId].totalQuantity += trade.quantity;
      } else if (trade.tradeType === "sell") {
        acc[instrumentId].totalSellQuantity += trade.quantity;
        acc[instrumentId].totalPriceQuantity += trade.price * trade.quantity;
        acc[instrumentId].totalQuantity += trade.quantity;
      }

      return acc;
    }, {});

    // Fetch stocks data to get QuotationLot
    const stocks = await Stock.find({
      InstrumentIdentifier: { $in: Object.keys(instrumentMap) },
    }).lean();

    // Create a map for quick lookup of QuotationLot
    const stockMap = stocks.reduce((acc, stock) => {
      acc[stock.InstrumentIdentifier] = stock.QuotationLot || 1;
      return acc;
    }, {});

    const netQuantities = Object.keys(instrumentMap)
      .map((instrumentIdentifier) => {
        const {
          totalBuyQuantity,
          totalSellQuantity,
          totalPriceQuantity,
          totalQuantity,
          name,
          exchange,
          status,
          price,
        } = instrumentMap[instrumentIdentifier];

        // Custom quantity adjustment for GOLD and GOLDM
        let quantityAdjustment;
        if (name === "GOLD") {
          quantityAdjustment = 100; // Custom value for GOLD
        } else if (name === "GOLDM") {
          quantityAdjustment = 10; // Custom value for GOLDM
        } else {
          // Default adjustment logic
          quantityAdjustment =
            exchange === "MCX" ? stockMap[instrumentIdentifier] : 1;
        }

        // Calculate net quantity (buys - sells) and apply custom adjustment
        let netQuantity =
          (totalBuyQuantity - totalSellQuantity) / quantityAdjustment;

        const absoluteNetQuantity = Math.abs(netQuantity);

        // Calculate average price
        const averagePrice =
          totalQuantity > 0 ? totalPriceQuantity / totalQuantity : 0;

        // Determine the tradeType based on the sign of netQuantity
        const tradeType = netQuantity < 0 ? "sell" : "buy";

        // Set action as opposite of tradeType
        const action = tradeType === "buy" ? "sell" : "buy";

        // Calculate investment value as absoluteNetQuantity * averagePrice
        const investmentValue = absoluteNetQuantity * averagePrice;

        return {
          instrumentIdentifier,
          netQuantity: parseFloat(absoluteNetQuantity.toFixed(2)),
          averagePrice: parseFloat(averagePrice.toFixed(2)),
          investmentValue: parseFloat(investmentValue.toFixed(2)),
          name,
          exchange,
          tradeType,
          status,
          price,
          action,
        };
      })
      // Filter out trades where netQuantity is 0
      .filter((trade) => trade.netQuantity !== 0);

    res.status(200).json({ userId, netQuantities });
  } catch (error) {
    console.error("Error in calculateNetQuantityByUser:", error);
    res.status(500).json({
      error: "Error calculating net quantity by user",
      details: error.message,
    });
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

//     const instrumentMap = trades.reduce((acc, trade) => {
//       if (!acc[trade.instrumentIdentifier]) {
//         acc[trade.instrumentIdentifier] = {
//           totalBuyQuantity: 0,
//           totalSellQuantity: 0,
//           name: trade.name,
//           exchange: trade.exchange,
//           status: trade.status,
//           price: trade.price,
//         };
//       }

//       // Adjust the quantities: Buy remains positive, Sell becomes negative
//       if (trade.tradeType === 'buy') {
//         acc[trade.instrumentIdentifier].totalBuyQuantity += trade.quantity;
//       } else if (trade.tradeType === 'sell') {
//         acc[trade.instrumentIdentifier].totalSellQuantity -= trade.quantity;
//       }

//       return acc;
//     }, {});

//     // Fetch stocks data to get QuotationLot
//     const stocks = await Stock.find({
//       InstrumentIdentifier: { $in: Object.keys(instrumentMap) }
//     }).lean();

//     // Create a map for quick lookup of QuotationLot
//     const stockMap = stocks.reduce((acc, stock) => {
//       acc[stock.InstrumentIdentifier] = stock.QuotationLot || 1;
//       return acc;
//     }, {});

//     const netQuantities = Object.keys(instrumentMap)
//       .map(instrumentIdentifier => {
//         const {
//           totalBuyQuantity,
//           totalSellQuantity,
//           name,
//           exchange,
//           status,
//           price
//         } = instrumentMap[instrumentIdentifier];

//         // Custom quantity adjustment for GOLD and GOLDM
//         let quantityAdjustment;
//         if (name === 'GOLD') {
//           quantityAdjustment = 100; // Custom value for GOLD
//         } else if (name === 'GOLDM') {
//           quantityAdjustment = 10; // Custom value for GOLDM
//         } else {
//           // Default adjustment logic
//           quantityAdjustment = exchange === 'MCX' ? stockMap[instrumentIdentifier] : 1;
//         }

//         // Net quantity should reflect the correct buy/sell balance (buys - sells)
//         const netQuantity = (totalBuyQuantity + totalSellQuantity) / quantityAdjustment;
//         const absoluteNetQuantity = Math.abs(netQuantity);

//         // Determine the tradeType based on the sign of netQuantity
//         const tradeType = netQuantity < 0 ? 'sell' : 'buy';

//         // Set action as opposite of tradeType
//         const action = tradeType === 'buy' ? 'sell' : 'buy';

//         // Calculate investment value as absoluteNetQuantity * price
//         const investmentValue = absoluteNetQuantity * price;

//         return {
//           instrumentIdentifier,
//           netQuantity: absoluteNetQuantity,
//           investmentValue,
//           name,
//           exchange,
//           tradeType,
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

//     // Reduce trades to accumulate necessary data per instrument
//     const instrumentMap = trades.reduce((acc, trade) => {
//       const instrumentId = trade.instrumentIdentifier;

//       if (!acc[instrumentId]) {
//         acc[instrumentId] = {
//           totalBuyQuantity: 0,
//           totalSellQuantity: 0,
//           totalPriceQuantity: 0,
//           totalQuantity: 0,
//           name: trade.name,
//           exchange: trade.exchange,
//           status: trade.status,
//           price: trade.price,
//         };
//       }

//       if (trade.tradeType === 'buy') {
//         acc[instrumentId].totalBuyQuantity += trade.quantity;
//         acc[instrumentId].totalPriceQuantity += trade.price * trade.quantity;
//         acc[instrumentId].totalQuantity += trade.quantity;
//       } else if (trade.tradeType === 'sell') {
//         acc[instrumentId].totalSellQuantity += trade.quantity;
//         acc[instrumentId].totalPriceQuantity += trade.price * trade.quantity;
//         acc[instrumentId].totalQuantity += trade.quantity;
//       }

//       return acc;
//     }, {});

//     // Fetch stocks data to get QuotationLot
//     const stocks = await Stock.find({
//       InstrumentIdentifier: { $in: Object.keys(instrumentMap) }
//     }).lean();

//     // Create a map for quick lookup of QuotationLot
//     const stockMap = stocks.reduce((acc, stock) => {
//       acc[stock.InstrumentIdentifier] = stock.QuotationLot || 1;
//       return acc;
//     }, {});

//     const netQuantities = Object.keys(instrumentMap)
//       .map(instrumentIdentifier => {
//         const {
//           totalBuyQuantity,
//           totalSellQuantity,
//           totalPriceQuantity,
//           totalQuantity,
//           name,
//           exchange,
//           status,
//           price
//         } = instrumentMap[instrumentIdentifier];

//         // Calculate net quantity (buys - sells)
//         let netQuantity = totalBuyQuantity - totalSellQuantity;

//         // If exchange is MCX, divide netQuantity by QuotationLot
//         if (exchange === 'MCX') {
//           const quotationLot = stockMap[instrumentIdentifier] || 1;
//           netQuantity = netQuantity / quotationLot;
//         }

//         const absoluteNetQuantity = Math.abs(netQuantity);

//         // Calculate average price
//         // Ensure totalQuantity is not zero to avoid division by zero
//         const averagePrice = totalQuantity > 0 ? (totalPriceQuantity / totalQuantity) : 0;

//         // Determine the tradeType based on the sign of netQuantity
//         const tradeType = netQuantity < 0 ? 'sell' : 'buy';

//         // Set action as opposite of tradeType
//         const action = tradeType === 'buy' ? 'sell' : 'buy';

//         // Calculate investment value as absoluteNetQuantity * averagePrice
//         const investmentValue = absoluteNetQuantity * averagePrice;

//         return {
//           instrumentIdentifier,
//           netQuantity: parseFloat(absoluteNetQuantity.toFixed(2)),
//           averagePrice: parseFloat(averagePrice.toFixed(2)),
//           investmentValue: parseFloat(investmentValue.toFixed(2)),
//           name,
//           exchange,
//           tradeType,
//           status,
//           price,
//           action
//         };
//       })
//       // Filter out trades where netQuantity is 0
//       .filter(trade => trade.netQuantity !== 0);

//     res.status(200).json({ userId, netQuantities });
//   } catch (error) {
//     console.error('Error in calculateNetQuantityByUser:', error);
//     res.status(500).json({ error: 'Error calculating net quantity by user', details: error.message });
//   }
// };

const calculateMCXTradesByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    // Fetch all trades for the given userId
    const trades = await Trade.find({ userId });

    if (trades.length === 0) {
      return res
        .status(404)
        .json({ error: "No trades found for the specified user" });
    }

    // Filter trades to include only those with exchange 'MCX'
    const mcxTrades = trades.filter((trade) => trade.exchange === "MCX");

    if (mcxTrades.length === 0) {
      return res
        .status(404)
        .json({ error: "No MCX trades found for the specified user" });
    }

    // Group trades by instrumentIdentifier and calculate totals and saudaCount
    const instrumentMap = mcxTrades.reduce((acc, trade) => {
      const { instrumentIdentifier, tradeType, quantity } = trade;

      if (!acc[instrumentIdentifier]) {
        acc[instrumentIdentifier] = {
          totalBuyQuantity: 0,
          totalSellQuantity: 0,
          saudaCount: 0,
        };
      }

      if (tradeType === "buy") {
        acc[instrumentIdentifier].totalBuyQuantity += quantity;
      } else if (tradeType === "sell") {
        acc[instrumentIdentifier].totalSellQuantity += quantity;
      }

      // Increment saudaCount for each trade action
      acc[instrumentIdentifier].saudaCount += 1;

      return acc;
    }, {});

    // Fetch QuotationLot for each instrumentIdentifier from the Stock model
    const instrumentIdentifiers = Object.keys(instrumentMap);
    const stocks = await Stock.find({
      InstrumentIdentifier: { $in: instrumentIdentifiers },
    });

    const stockMap = stocks.reduce((acc, stock) => {
      acc[stock.InstrumentIdentifier] = stock.QuotationLot;
      return acc;
    }, {});

    // Create the response with the required calculations
    const result = Object.keys(instrumentMap).map((instrumentIdentifier) => {
      const { totalBuyQuantity, totalSellQuantity } =
        instrumentMap[instrumentIdentifier];
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
        saudaCount: lowestLots.toFixed(2), // Set saudaCount to the lowest value
      };
    });

    res.status(200).json({ userId, trades: result });
  } catch (error) {
    res.status(500).json({
      error: "Error calculating trades by user",
      details: error.message,
    });
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
      return res
        .status(400)
        .json({ message: "Instrument Identifier is required" });
    }

    // Fetch all trades for the given instrumentIdentifier and userId
    const trades = await Trade.find({ instrumentIdentifier, userId }).exec();

    if (trades.length === 0) {
      return res
        .status(404)
        .json({ message: "No trades found for this instrumentIdentifier" });
    }

    // Initialize quantities
    let totalSellQuantity = 0;
    let totalBuyQuantity = 0;

    // Calculate total quantities based on trade type
    trades.forEach((trade) => {
      if (trade.tradeType === "sell") {
        totalSellQuantity += trade.quantity;
      } else if (trade.tradeType === "buy") {
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
        action: "buy", // Opposite of sell
        quantity: netSellQuantity,
      });
    }
    if (netBuyQuantity > 0) {
      tradeList.push({
        action: "sell", // Opposite of buy
        quantity: netBuyQuantity,
      });
    }

    // Send the response
    res.json({
      instrumentIdentifier,
      netSellQuantity: Math.max(netSellQuantity, 0),
      netBuyQuantity: Math.max(netBuyQuantity, 0),
      trades: tradeList,
    });
  } catch (err) {
    console.error("Error fetching trades or calculating quantities:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Controller function to get all stock trades for a given client
const getClientStockHistory = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Validate the userId format (assuming it's a valid ObjectId)
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    // Fetch all trades for the given userId
    const trades = await Trade.find({ userId }).exec();

    if (!trades || trades.length === 0) {
      return res.status(404).json({ message: "No trades found for this user" });
    }

    // Send the trades in the response
    res.status(200).json({ trades });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while fetching trades" });
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

// const getTradesBrokerageByClientId = async (req, res) => {
//   try {
//     const { clientId } = req.params;

//     // Find the client and include brokerage details
//     const client = await Client.findById(clientId).select('share_brokerage mcx_brokerage_type mcx_brokerage currentbrokerage');

//     if (!client) {
//       return res.status(404).json({ message: "Client not found" });
//     }

//     // Get all trades for the client in NSE exchange and MCX exchange
//     const nseTrades = await Trade.find({ userId: clientId, exchange: 'NSE' });
//     const mcxTrades = await Trade.find({ userId: clientId, exchange: 'MCX' });

//     // Retrieve QuotationLot for MCX instruments
//     const stockIdentifiers = [...new Set(mcxTrades.map(trade => trade.instrumentIdentifier))];
//     const stockMap = await Stock.find({ InstrumentIdentifier: { $in: stockIdentifiers } }).select('InstrumentIdentifier name product Exchange QuotationLot');

//     // Update QuotationLot based on conditions
//     const stockQuotationLotMap = {};
//     stockMap.forEach(stock => {
//       if (
//         stock.name === 'GOLD' &&
//         stock.product === 'GOLD' &&
//         stock.Exchange === 'MCX'
//       ) {
//         stock.QuotationLot = 100;
//       } else if (
//         stock.name === 'GOLDM' &&
//         stock.product === 'GOLDM' &&
//         stock.Exchange === 'MCX'
//       ) {
//         stock.QuotationLot = 10;
//       }
//       stockQuotationLotMap[stock.InstrumentIdentifier] = stock.QuotationLot;
//     });

//     // Save updated stocks to the database
//     await Promise.all(stockMap.map(stock => stock.save()));

//     // Calculate the total amount for NSE trades (without using lot size)
//     const totalNSEAmount = nseTrades.reduce((total, trade) => {
//       return total + (trade.price * trade.quantity);
//     }, 0);

//     // Calculate the total amount for MCX trades (adjusted for lot size)
//     const mcxTradeDetails = mcxTrades.map(trade => {
//       const lotSize = stockQuotationLotMap[trade.instrumentIdentifier] || 1;
//       return {
//         ...trade.toObject(),
//         adjustedQuantity: trade.quantity / lotSize
//       };
//     });

//     const totalMCXAmount = mcxTradeDetails.reduce((total, trade) => {
//       return total + (trade.price * trade.adjustedQuantity);
//     }, 0);

//     // Initialize brokerage amounts
//     let brokeragePerNSECrore = 0;
//     let brokeragePerMCX = 0;
//     let totalSaudas = 0;

//     // Calculate brokerage amount for NSE (always per crore)
//     if (totalNSEAmount > 0) {
//       brokeragePerNSECrore = (totalNSEAmount / 10000000) * client.share_brokerage;
//     }

//     // MCX brokerage calculation logic
//     if (client.mcx_brokerage_type === "per_sauda") {
//       // Group trades by instrumentIdentifier and count buys and sells for sauda calculation
//       const instrumentMap = {};

//       mcxTradeDetails.forEach(trade => {
//         const instrument = trade.instrumentIdentifier;
//         if (!instrumentMap[instrument]) {
//           instrumentMap[instrument] = { buy: 0, sell: 0 };
//         }
//         if (trade.tradeType === 'buy') {
//           instrumentMap[instrument].buy += trade.adjustedQuantity;
//         } else if (trade.tradeType === 'sell') {
//           instrumentMap[instrument].sell += trade.adjustedQuantity;
//         }
//       });

//       // Calculate saudas based on matching buys and sells
//       for (const instrument in instrumentMap) {
//         const { buy, sell } = instrumentMap[instrument];
//         totalSaudas += Math.min(buy, sell);
//       }

//       // Calculate total brokerage based on saudas
//       brokeragePerMCX = (totalSaudas * client.mcx_brokerage);

//     } else if (client.mcx_brokerage_type === "per_crore" && totalMCXAmount >= 100) {
//       // Calculate brokerage per crore for MCX
//       brokeragePerMCX = ((totalMCXAmount / 10000000) * client.mcx_brokerage);
//     }

//     // Calculate total amount and total brokerage
//     const totalAmount = totalNSEAmount + totalMCXAmount;
//     const totalBrokerage = brokeragePerNSECrore + brokeragePerMCX;

//     // Update the client's currentbrokerage field
//     await Client.findByIdAndUpdate(clientId, { currentbrokerage: totalBrokerage.toFixed(2) });

//     // Return trade data along with brokerage details, total amounts, and brokerage per crore/sauda for both NSE and MCX
//     res.status(200).json({
//       success: true,
//       client: {
//         share_brokerage: client.share_brokerage,
//         mcx_brokerage_type: client.mcx_brokerage_type,
//         mcx_brokerage: client.mcx_brokerage,
//         currentbrokerage: totalBrokerage.toFixed(2),
//       },
//       nseTrades,
//       totalNSEAmount,
//       brokeragePerNSECrore: brokeragePerNSECrore.toFixed(2),
//       mcxTrades: mcxTradeDetails,
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

// const getTradesBrokerageByClientId = async (req, res) => {
//   try {
//     const { clientId } = req.params;

//     // Find the client and include brokerage details
//     const client = await Client.findById(clientId).select(
//       "share_brokerage mcx_brokerage_type mcx_brokerage currentbrokerage"
//     );

//     if (!client) {
//       return res.status(404).json({ message: "Client not found" });
//     }

//     // Get all trades for the client in NSE exchange and MCX exchange
//     const nseTrades = await Trade.find({ userId: clientId, exchange: "NSE" });
//     const mcxTrades = await Trade.find({ userId: clientId, exchange: "MCX" });

//     // Retrieve QuotationLot for MCX instruments
//     const stockIdentifiers = [
//       ...new Set(mcxTrades.map((trade) => trade.instrumentIdentifier)),
//     ];
//     const stockMap = await Stock.find({
//       InstrumentIdentifier: { $in: stockIdentifiers },
//     }).select("InstrumentIdentifier name product Exchange QuotationLot");

//     // Update QuotationLot based on conditions
//     const stockQuotationLotMap = {};
//     stockMap.forEach((stock) => {
//       if (
//         stock.name === "GOLD" &&
//         stock.product === "GOLD" &&
//         stock.Exchange === "MCX"
//       ) {
//         stock.QuotationLot = 100;
//       } else if (
//         stock.name === "GOLDM" &&
//         stock.product === "GOLDM" &&
//         stock.Exchange === "MCX"
//       ) {
//         stock.QuotationLot = 10;
//       }
//       stockQuotationLotMap[stock.InstrumentIdentifier] = stock.QuotationLot;
//     });

//     // Save updated stocks to the database
//     await Promise.all(stockMap.map((stock) => stock.save()));

//     // Calculate the total amount for NSE trades (without using lot size)
//     const totalNSEAmount = nseTrades.reduce((total, trade) => {
//       return total + trade.price * trade.quantity;
//     }, 0);

//     // Calculate the total amount for MCX trades
//     let totalMCXAmount;
//     let mcxTradeDetails;

//     if (client.mcx_brokerage_type === "per_crore") {
//       // Calculate total MCX amount directly
//       totalMCXAmount = mcxTrades.reduce((total, trade) => {
//         return total + trade.price * trade.quantity;
//       }, 0);
//       mcxTradeDetails = mcxTrades; // No adjustments needed for lot size
//     } else {
//       // Calculate total MCX amount adjusted for lot size
//       mcxTradeDetails = mcxTrades.map((trade) => {
//         const lotSize = stockQuotationLotMap[trade.instrumentIdentifier] || 1;
//         return {
//           ...trade.toObject(),
//           adjustedQuantity: trade.quantity / lotSize,
//         };
//       });

//       totalMCXAmount = mcxTradeDetails.reduce((total, trade) => {
//         return total + trade.price * trade.adjustedQuantity;
//       }, 0);
//     }

//     // Initialize brokerage amounts
//     let brokeragePerNSECrore = 0;
//     let brokeragePerMCX = 0;
//     let totalSaudas = 0;

//     // Calculate brokerage amount for NSE (always per crore)
//     if (totalNSEAmount > 0) {
//       brokeragePerNSECrore =
//         (totalNSEAmount / 10000000) * client.share_brokerage;
//     }

//     // MCX brokerage calculation logic
//     if (client.mcx_brokerage_type === "per_sauda") {
//       // Group trades by instrumentIdentifier and count buys and sells for sauda calculation
//       const instrumentMap = {};

//       mcxTradeDetails.forEach((trade) => {
//         const instrument = trade.instrumentIdentifier;
//         if (!instrumentMap[instrument]) {
//           instrumentMap[instrument] = { buy: 0, sell: 0 };
//         }
//         if (trade.tradeType === "buy") {
//           instrumentMap[instrument].buy += trade.adjustedQuantity;
//         } else if (trade.tradeType === "sell") {
//           instrumentMap[instrument].sell += trade.adjustedQuantity;
//         }
//       });

//       // Calculate saudas based on matching buys and sells
//       for (const instrument in instrumentMap) {
//         const { buy, sell } = instrumentMap[instrument];
//         totalSaudas += Math.min(buy, sell);
//       }

//       // Calculate total brokerage based on saudas
//       brokeragePerMCX = totalSaudas * client.mcx_brokerage;
//     } else if (client.mcx_brokerage_type === "per_crore") {
//       // Calculate brokerage per crore for MCX directly
//       brokeragePerMCX = (totalMCXAmount / 10000000) * client.mcx_brokerage;
//     }

//     // Calculate total amount and total brokerage
//     const totalAmount = totalNSEAmount + totalMCXAmount;
//     const totalBrokerage = brokeragePerNSECrore + brokeragePerMCX;

//     // Update the client's currentbrokerage field
//     await Client.findByIdAndUpdate(clientId, {
//       currentbrokerage: totalBrokerage.toFixed(2),
//     });

//     // Return trade data along with brokerage details, total amounts, and brokerage per crore/sauda for both NSE and MCX
//     res.status(200).json({
//       success: true,
//       client: {
//         share_brokerage: client.share_brokerage,
//         mcx_brokerage_type: client.mcx_brokerage_type,
//         mcx_brokerage: client.mcx_brokerage,
//         currentbrokerage: totalBrokerage.toFixed(2),
//       },
//       nseTrades,
//       totalNSEAmount,
//       brokeragePerNSECrore: brokeragePerNSECrore.toFixed(2),
//       mcxTrades: mcxTradeDetails,
//       totalMCXAmount,
//       totalSaudas,
//       brokeragePerMCX: brokeragePerMCX.toFixed(2),
//       totalAmount: totalAmount.toFixed(2),
//       totalBrokerage: totalBrokerage.toFixed(2),
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Server error", error });
//   }
// };

// const getTradesBrokerageByClientId = async (req, res) => {
//   try {
//     const { clientId } = req.params;

//     // Find the client and include brokerage details
//     const client = await Client.findById(clientId).select(
//       "share_brokerage mcx_brokerage_type mcx_brokerage currentbrokerage brokeragePerMCX brokeragePerNSECrore"
//     );

//     if (!client) {
//       return res.status(404).json({ message: "Client not found" });
//     }

//     // Get all trades for the client in NSE exchange and MCX exchange
//     const nseTrades = await Trade.find({ userId: clientId, exchange: "NSE" });
//     const mcxTrades = await Trade.find({ userId: clientId, exchange: "MCX" });

//     // Retrieve QuotationLot for MCX instruments
//     const stockIdentifiers = [
//       ...new Set(mcxTrades.map((trade) => trade.instrumentIdentifier)),
//     ];
//     const stockMap = await Stock.find({
//       InstrumentIdentifier: { $in: stockIdentifiers },
//     }).select("InstrumentIdentifier name product Exchange QuotationLot");

//     // Update QuotationLot based on conditions
//     const stockQuotationLotMap = {};
//     stockMap.forEach((stock) => {
//       if (
//         stock.name === "GOLD" &&
//         stock.product === "GOLD" &&
//         stock.Exchange === "MCX"
//       ) {
//         stock.QuotationLot = 100;
//       } else if (
//         stock.name === "GOLDM" &&
//         stock.product === "GOLDM" &&
//         stock.Exchange === "MCX"
//       ) {
//         stock.QuotationLot = 10;
//       }
//       stockQuotationLotMap[stock.InstrumentIdentifier] = stock.QuotationLot;
//     });

//     // Save updated stocks to the database
//     await Promise.all(stockMap.map((stock) => stock.save()));

//     // Calculate the total amount for NSE trades (without using lot size)
//     const totalNSEAmount = nseTrades.reduce((total, trade) => {
//       return total + trade.price * trade.quantity;
//     }, 0);

//     // Calculate the total amount for MCX trades
//     let totalMCXAmount;
//     let mcxTradeDetails;

//     if (client.mcx_brokerage_type === "per_crore") {
//       // Calculate total MCX amount directly
//       totalMCXAmount = mcxTrades.reduce((total, trade) => {
//         return total + trade.price * trade.quantity;
//       }, 0);
//       mcxTradeDetails = mcxTrades; // No adjustments needed for lot size
//     } else {
//       // Calculate total MCX amount adjusted for lot size
//       mcxTradeDetails = mcxTrades.map((trade) => {
//         const lotSize = stockQuotationLotMap[trade.instrumentIdentifier] || 1;
//         return {
//           ...trade.toObject(),
//           adjustedQuantity: trade.quantity / lotSize,
//         };
//       });

//       totalMCXAmount = mcxTradeDetails.reduce((total, trade) => {
//         return total + trade.price * trade.adjustedQuantity;
//       }, 0);
//     }

//     // Initialize brokerage amounts
//     let brokeragePerNSECrore = 0;
//     let brokeragePerMCX = 0;
//     let totalSaudas = 0;

//     // Calculate brokerage amount for NSE (always per crore)
//     if (totalNSEAmount > 0) {
//       brokeragePerNSECrore =
//         (totalNSEAmount / 10000000) * client.share_brokerage;
//     }

//     // MCX brokerage calculation logic
//     if (client.mcx_brokerage_type === "per_sauda") {
//       // Group trades by instrumentIdentifier and count buys and sells for sauda calculation
//       const instrumentMap = {};

//       mcxTradeDetails.forEach((trade) => {
//         const instrument = trade.instrumentIdentifier;
//         if (!instrumentMap[instrument]) {
//           instrumentMap[instrument] = { buy: 0, sell: 0 };
//         }
//         if (trade.tradeType === "buy") {
//           instrumentMap[instrument].buy += trade.adjustedQuantity;
//         } else if (trade.tradeType === "sell") {
//           instrumentMap[instrument].sell += trade.adjustedQuantity;
//         }
//       });

//       // Calculate saudas based on matching buys and sells
//       for (const instrument in instrumentMap) {
//         const { buy, sell } = instrumentMap[instrument];
//         totalSaudas += Math.min(buy, sell);
//       }

//       // Calculate total brokerage based on saudas
//       brokeragePerMCX = totalSaudas * client.mcx_brokerage;
//     } else if (client.mcx_brokerage_type === "per_crore") {
//       // Calculate brokerage per crore for MCX directly
//       brokeragePerMCX = (totalMCXAmount / 10000000) * client.mcx_brokerage;
//     }

//     // Calculate total amount and total brokerage
//     const totalAmount = totalNSEAmount + totalMCXAmount;
//     const totalBrokerage = brokeragePerNSECrore + brokeragePerMCX;

//     // Update the client's currentbrokerage field and brokeragePerMCX / brokeragePerNSECrore
//     await Client.findByIdAndUpdate(clientId, {
//       currentbrokerage: totalBrokerage.toFixed(2),
//       brokeragePerMCX: brokeragePerMCX.toFixed(2),
//       brokeragePerNSECrore: brokeragePerNSECrore.toFixed(2),
//     });

//     // Return trade data along with brokerage details, total amounts, and brokerage per crore/sauda for both NSE and MCX
//     res.status(200).json({
//       success: true,
//       client: {
//         share_brokerage: client.share_brokerage,
//         mcx_brokerage_type: client.mcx_brokerage_type,
//         mcx_brokerage: client.mcx_brokerage,
//         currentbrokerage: totalBrokerage.toFixed(2),
//         brokeragePerMCX: brokeragePerMCX.toFixed(2),
//         brokeragePerNSECrore: brokeragePerNSECrore.toFixed(2),
//       },
//       nseTrades,
//       totalNSEAmount,
//       brokeragePerNSECrore: brokeragePerNSECrore.toFixed(2),
//       mcxTrades: mcxTradeDetails,
//       totalMCXAmount,
//       totalSaudas,
//       brokeragePerMCX: brokeragePerMCX.toFixed(2),
//       totalAmount: totalAmount.toFixed(2),
//       totalBrokerage: totalBrokerage.toFixed(2),
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Server error", error });
//   }
// };

// const getTradesBrokerageByClientId = async (req, res) => {
//   try {
//     const { clientId } = req.params;

//     // Find the client and include brokerage details
//     const client = await Client.findById(clientId).select(
//       "share_brokerage mcx_brokerage_type mcx_brokerage currentbrokerage brokeragePerMCX brokeragePerNSECrore master_admin_id"
//     );

//     if (!client) {
//       return res.status(404).json({ message: "Client not found" });
//     }

//     // Fetch the MasterAdmin details using the master_admin_id
//     const masterAdmin = await MasterAdmin.findById(
//       client.master_admin_id
//     ).select("share_brokerage mcx_brokerage_type mcx_brokerage");

//     if (!masterAdmin) {
//       return res.status(404).json({ message: "MasterAdmin not found" });
//     }

//     // Get all trades for the client in NSE exchange and MCX exchange
//     const nseTrades = await Trade.find({ userId: clientId, exchange: "NSE" });
//     const mcxTrades = await Trade.find({ userId: clientId, exchange: "MCX" });

//     // Retrieve QuotationLot for MCX instruments
//     const stockIdentifiers = [
//       ...new Set(mcxTrades.map((trade) => trade.instrumentIdentifier)),
//     ];
//     const stockMap = await Stock.find({
//       InstrumentIdentifier: { $in: stockIdentifiers },
//     }).select("InstrumentIdentifier name product Exchange QuotationLot");

//     // Update QuotationLot based on conditions
//     const stockQuotationLotMap = {};
//     stockMap.forEach((stock) => {
//       if (
//         stock.name === "GOLD" &&
//         stock.product === "GOLD" &&
//         stock.Exchange === "MCX"
//       ) {
//         stock.QuotationLot = 100;
//       } else if (
//         stock.name === "GOLDM" &&
//         stock.product === "GOLDM" &&
//         stock.Exchange === "MCX"
//       ) {
//         stock.QuotationLot = 10;
//       }
//       stockQuotationLotMap[stock.InstrumentIdentifier] = stock.QuotationLot;
//     });

//     // Save updated stocks to the database
//     await Promise.all(stockMap.map((stock) => stock.save()));

//     // Calculate the total amount for NSE trades (without using lot size)
//     const totalNSEAmount = nseTrades.reduce((total, trade) => {
//       return total + trade.price * trade.quantity;
//     }, 0);

//     // Calculate the total amount for MCX trades
//     let totalMCXAmount;
//     let mcxTradeDetails;

//     if (client.mcx_brokerage_type === "per_crore") {
//       // Calculate total MCX amount directly
//       totalMCXAmount = mcxTrades.reduce((total, trade) => {
//         return total + trade.price * trade.quantity;
//       }, 0);
//       mcxTradeDetails = mcxTrades; // No adjustments needed for lot size
//     } else {
//       // Calculate total MCX amount adjusted for lot size
//       mcxTradeDetails = mcxTrades.map((trade) => {
//         const lotSize = stockQuotationLotMap[trade.instrumentIdentifier] || 1;
//         return {
//           ...trade.toObject(),
//           adjustedQuantity: trade.quantity / lotSize,
//         };
//       });

//       totalMCXAmount = mcxTradeDetails.reduce((total, trade) => {
//         return total + trade.price * trade.adjustedQuantity;
//       }, 0);
//     }

//     // Initialize brokerage amounts for client
//     let brokeragePerNSECrore = 0;
//     let brokeragePerMCX = 0;
//     let totalSaudas = 0;

//     // Calculate brokerage amount for NSE (always per crore)
//     if (totalNSEAmount > 0) {
//       brokeragePerNSECrore =
//         (totalNSEAmount / 10000000) * client.share_brokerage;
//     }

//     // MCX brokerage calculation logic for client
//     if (client.mcx_brokerage_type === "per_sauda") {
//       const instrumentMap = {};

//       mcxTradeDetails.forEach((trade) => {
//         const instrument = trade.instrumentIdentifier;
//         if (!instrumentMap[instrument]) {
//           instrumentMap[instrument] = { buy: 0, sell: 0 };
//         }
//         if (trade.tradeType === "buy") {
//           instrumentMap[instrument].buy += trade.adjustedQuantity;
//         } else if (trade.tradeType === "sell") {
//           instrumentMap[instrument].sell += trade.adjustedQuantity;
//         }
//       });

//       for (const instrument in instrumentMap) {
//         const { buy, sell } = instrumentMap[instrument];
//         totalSaudas += Math.min(buy, sell);
//       }

//       brokeragePerMCX = totalSaudas * client.mcx_brokerage;
//     } else if (client.mcx_brokerage_type === "per_crore") {
//       brokeragePerMCX = (totalMCXAmount / 10000000) * client.mcx_brokerage;
//     }

//     // Total amount and brokerage for client
//     const totalAmount = totalNSEAmount + totalMCXAmount;
//     const totalBrokerage = brokeragePerNSECrore + brokeragePerMCX;

//     // Update the client's currentbrokerage field and brokeragePerMCX / brokeragePerNSECrore
//     await Client.findByIdAndUpdate(clientId, {
//       currentbrokerage: totalBrokerage.toFixed(2),
//       brokeragePerMCX: brokeragePerMCX.toFixed(2),
//       brokeragePerNSECrore: brokeragePerNSECrore.toFixed(2),
//     });

//     // Perform similar calculations for MasterAdmin's brokerage
//     let masterAdminBrokeragePerNSECrore = 0;
//     let masterAdminBrokeragePerMCX = 0;
//     let masterAdminTotalSaudas = 0;

//     const totalMasterAdminNSEAmount = totalNSEAmount; // MasterAdmin uses the same NSE trades
//     const totalMasterAdminMCXAmount = mcxTradeDetails.reduce((total, trade) => {
//       return total + trade.price * trade.adjustedQuantity;
//     }, 0);

//     // Calculate MasterAdmin brokerage for NSE
//     if (totalMasterAdminNSEAmount > 0) {
//       masterAdminBrokeragePerNSECrore =
//         (totalMasterAdminNSEAmount / 10000000) * masterAdmin.share_brokerage;
//     }

//     // MasterAdmin MCX brokerage calculation
//     if (masterAdmin.mcx_brokerage_type === "per_sauda") {
//       const instrumentMap = {};

//       mcxTradeDetails.forEach((trade) => {
//         const instrument = trade.instrumentIdentifier;
//         if (!instrumentMap[instrument]) {
//           instrumentMap[instrument] = { buy: 0, sell: 0 };
//         }
//         if (trade.tradeType === "buy") {
//           instrumentMap[instrument].buy += trade.adjustedQuantity;
//         } else if (trade.tradeType === "sell") {
//           instrumentMap[instrument].sell += trade.adjustedQuantity;
//         }
//       });

//       for (const instrument in instrumentMap) {
//         const { buy, sell } = instrumentMap[instrument];
//         masterAdminTotalSaudas += Math.min(buy, sell);
//       }

//       masterAdminBrokeragePerMCX =
//         masterAdminTotalSaudas * masterAdmin.mcx_brokerage;
//     } else if (masterAdmin.mcx_brokerage_type === "per_crore") {
//       masterAdminBrokeragePerMCX =
//         (totalMasterAdminMCXAmount / 10000000) * masterAdmin.mcx_brokerage;
//     }

//     const masterAdminTotalAmount =
//       totalMasterAdminNSEAmount + totalMasterAdminMCXAmount;
//     const masterAdminTotalBrokerage =
//       masterAdminBrokeragePerNSECrore + masterAdminBrokeragePerMCX;

//     // Calculate the difference between client and master admin current brokerages
//     const finalMasterBrokerage = (
//       parseFloat(client.currentbrokerage) -
//       parseFloat(masterAdminTotalBrokerage)
//     ).toFixed(2);

//     // Respond with both client and master admin data
//     res.status(200).json({
//       success: true,
//       client: {
//         share_brokerage: client.share_brokerage,
//         mcx_brokerage_type: client.mcx_brokerage_type,
//         mcx_brokerage: client.mcx_brokerage,
//         currentbrokerage: totalBrokerage.toFixed(2),
//         brokeragePerMCX: brokeragePerMCX.toFixed(2),
//         brokeragePerNSECrore: brokeragePerNSECrore.toFixed(2),
//       },
//       masterAdmin: {
//         share_brokerage: masterAdmin.share_brokerage,
//         mcx_brokerage_type: masterAdmin.mcx_brokerage_type,
//         mcx_brokerage: masterAdmin.mcx_brokerage,
//         currentbrokerage: masterAdminTotalBrokerage.toFixed(2),
//         brokeragePerMCX: masterAdminBrokeragePerMCX.toFixed(2),
//         brokeragePerNSECrore: masterAdminBrokeragePerNSECrore.toFixed(2),
//       },
//       finalMasterBrokerage: finalMasterBrokerage,
//       nseTrades,
//       totalNSEAmount,
//       brokeragePerNSECrore: brokeragePerNSECrore.toFixed(2),
//       mcxTrades: mcxTradeDetails,
//       totalMCXAmount,
//       totalSaudas,
//       brokeragePerMCX: brokeragePerMCX.toFixed(2),
//       totalAmount: totalAmount.toFixed(2),
//       totalBrokerage: totalBrokerage.toFixed(2),
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Server error", error });
//   }
// };

const getTradesBrokerageByClientId = async (req, res) => {
  try {
    const { clientId } = req.params;

    // Find the client and include brokerage details
    const client = await Client.findById(clientId).select(
      "share_brokerage mcx_brokerage_type mcx_brokerage currentbrokerage brokeragePerMCX brokeragePerNSECrore master_admin_id finalMasterBrokerage"
    );

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Fetch the MasterAdmin details using the master_admin_id
    const masterAdmin = await MasterAdmin.findById(
      client.master_admin_id
    ).select("share_brokerage mcx_brokerage_type mcx_brokerage");

    if (!masterAdmin) {
      return res.status(404).json({ message: "MasterAdmin not found" });
    }

    // Get all trades for the client in NSE exchange and MCX exchange
    const nseTrades = await Trade.find({ userId: clientId, exchange: "NSE" });
    const mcxTrades = await Trade.find({ userId: clientId, exchange: "MCX" });

    // Retrieve QuotationLot for MCX instruments
    const stockIdentifiers = [
      ...new Set(mcxTrades.map((trade) => trade.instrumentIdentifier)),
    ];
    const stockMap = await Stock.find({
      InstrumentIdentifier: { $in: stockIdentifiers },
    }).select("InstrumentIdentifier name product Exchange QuotationLot");

    // Update QuotationLot based on conditions
    const stockQuotationLotMap = {};
    stockMap.forEach((stock) => {
      if (
        stock.name === "GOLD" &&
        stock.product === "GOLD" &&
        stock.Exchange === "MCX"
      ) {
        stock.QuotationLot = 100;
      } else if (
        stock.name === "GOLDM" &&
        stock.product === "GOLDM" &&
        stock.Exchange === "MCX"
      ) {
        stock.QuotationLot = 10;
      }
      stockQuotationLotMap[stock.InstrumentIdentifier] = stock.QuotationLot;
    });

    // Save updated stocks to the database
    await Promise.all(stockMap.map((stock) => stock.save()));

    // Calculate the total amount for NSE trades (without using lot size)
    const totalNSEAmount = nseTrades.reduce((total, trade) => {
      return total + trade.price * trade.quantity;
    }, 0);

    // Calculate the total amount for MCX trades
    let totalMCXAmount;
    let mcxTradeDetails;

    if (client.mcx_brokerage_type === "per_crore") {
      // Calculate total MCX amount directly for per_crore type
      totalMCXAmount = mcxTrades.reduce((total, trade) => {
        return total + trade.price * trade.quantity;
      }, 0);
      mcxTradeDetails = mcxTrades; // No adjustments needed for lot size
    } else {
      // Calculate total MCX amount adjusted for lot size
      mcxTradeDetails = mcxTrades.map((trade) => {
        const lotSize = stockQuotationLotMap[trade.instrumentIdentifier] || 1;
        return {
          ...trade.toObject(),
          adjustedQuantity: trade.quantity / lotSize,
        };
      });

      totalMCXAmount = mcxTradeDetails.reduce((total, trade) => {
        return total + trade.price * trade.adjustedQuantity;
      }, 0);
    }

    // Initialize brokerage amounts for client
    let brokeragePerNSECrore = 0;
    let brokeragePerMCX = 0;
    let totalSaudas = 0;

    // Calculate brokerage amount for NSE (always per crore)
    if (totalNSEAmount > 0) {
      brokeragePerNSECrore =
        (totalNSEAmount / 10000000) * client.share_brokerage;
    }

    // MCX brokerage calculation logic for client
    if (client.mcx_brokerage_type === "per_sauda") {
      const instrumentMap = {};

      mcxTradeDetails.forEach((trade) => {
        const instrument = trade.instrumentIdentifier;
        if (!instrumentMap[instrument]) {
          instrumentMap[instrument] = { buy: 0, sell: 0 };
        }
        if (trade.tradeType === "buy") {
          instrumentMap[instrument].buy += trade.adjustedQuantity;
        } else if (trade.tradeType === "sell") {
          instrumentMap[instrument].sell += trade.adjustedQuantity;
        }
      });

      for (const instrument in instrumentMap) {
        const { buy, sell } = instrumentMap[instrument];
        totalSaudas += Math.min(buy, sell);
      }

      brokeragePerMCX = totalSaudas * client.mcx_brokerage;
    } else if (client.mcx_brokerage_type === "per_crore") {
      brokeragePerMCX = (totalMCXAmount / 10000000) * client.mcx_brokerage;
    }

    // Total amount and brokerage for client
    const totalAmount = totalNSEAmount + totalMCXAmount;
    const totalBrokerage = brokeragePerNSECrore + brokeragePerMCX;

    // Update the client's currentbrokerage field and brokeragePerMCX / brokeragePerNSECrore
    const updatedClient = await Client.findByIdAndUpdate(
      clientId,
      {
        currentbrokerage: isNaN(totalBrokerage) ? 0 : totalBrokerage.toFixed(2),
        brokeragePerMCX: isNaN(brokeragePerMCX)
          ? 0
          : brokeragePerMCX.toFixed(2),
        brokeragePerNSECrore: isNaN(brokeragePerNSECrore)
          ? 0
          : brokeragePerNSECrore.toFixed(2),
      },
      { new: true }
    );

    // Perform similar calculations for MasterAdmin's brokerage
    let masterAdminBrokeragePerNSECrore = 0;
    let masterAdminBrokeragePerMCX = 0;
    let masterAdminTotalSaudas = 0;

    // Calculate totalMasterAdminMCXAmount based on masterAdmin's brokerage type
    let totalMasterAdminMCXAmount;
    if (masterAdmin.mcx_brokerage_type === "per_crore") {
      // For 'per_crore', use original trade quantities
      totalMasterAdminMCXAmount = mcxTrades.reduce((total, trade) => {
        return total + trade.price * trade.quantity;
      }, 0);
    } else {
      // For 'per_sauda', use adjusted quantities
      totalMasterAdminMCXAmount = mcxTradeDetails.reduce((total, trade) => {
        return total + trade.price * trade.adjustedQuantity;
      }, 0);
    }

    // Calculate MasterAdmin brokerage for NSE
    if (totalNSEAmount > 0) {
      masterAdminBrokeragePerNSECrore =
        (totalNSEAmount / 10000000) * masterAdmin.share_brokerage;
    }

    // MasterAdmin MCX brokerage calculation
    if (masterAdmin.mcx_brokerage_type === "per_sauda") {
      const instrumentMap = {};

      mcxTradeDetails.forEach((trade) => {
        const instrument = trade.instrumentIdentifier;
        if (!instrumentMap[instrument]) {
          instrumentMap[instrument] = { buy: 0, sell: 0 };
        }
        if (trade.tradeType === "buy") {
          instrumentMap[instrument].buy += trade.adjustedQuantity;
        } else if (trade.tradeType === "sell") {
          instrumentMap[instrument].sell += trade.adjustedQuantity;
        }
      });

      for (const instrument in instrumentMap) {
        const { buy, sell } = instrumentMap[instrument];
        masterAdminTotalSaudas += Math.min(buy, sell);
      }

      masterAdminBrokeragePerMCX =
        masterAdminTotalSaudas * masterAdmin.mcx_brokerage;
    } else if (masterAdmin.mcx_brokerage_type === "per_crore") {
      masterAdminBrokeragePerMCX =
        (totalMasterAdminMCXAmount / 10000000) * masterAdmin.mcx_brokerage;
    }

    const masterAdminTotalBrokerage =
      masterAdminBrokeragePerNSECrore + masterAdminBrokeragePerMCX;

    // Calculate the difference between client and master admin current brokerages
    const finalMasterBrokerage = (
      parseFloat(updatedClient.currentbrokerage) -
      parseFloat(masterAdminTotalBrokerage)
    ).toFixed(2);

    // Calculate finalMasterMCXBrokerage and finalMasterNSEBrokerage
    const finalMasterMCXBrokerage = (
      parseFloat(updatedClient.brokeragePerMCX) -
      parseFloat(masterAdminBrokeragePerMCX)
    ).toFixed(2);
    const finalMasterNSEBrokerage = (
      parseFloat(updatedClient.brokeragePerNSECrore) -
      parseFloat(masterAdminBrokeragePerNSECrore)
    ).toFixed(2);

    // Update the finalMasterBrokerage, finalMasterMCXBrokerage, and finalMasterNSEBrokerage for the client
    await Client.findByIdAndUpdate(clientId, {
      finalMasterBrokerage: isNaN(finalMasterBrokerage)
        ? 0
        : finalMasterBrokerage,
      finalMasterMCXBrokerage: isNaN(finalMasterMCXBrokerage)
        ? 0
        : finalMasterMCXBrokerage,
      finalMasterNSEBrokerage: isNaN(finalMasterNSEBrokerage)
        ? 0
        : finalMasterNSEBrokerage,
    });

    // Respond with both client and master admin data
    res.status(200).json({
      success: true,
      client: {
        share_brokerage: client.share_brokerage,
        mcx_brokerage_type: client.mcx_brokerage_type,
        mcx_brokerage: client.mcx_brokerage,
        currentbrokerage: isNaN(updatedClient.currentbrokerage)
          ? 0
          : updatedClient.currentbrokerage.toFixed(2),
        brokeragePerMCX: isNaN(brokeragePerMCX)
          ? 0
          : brokeragePerMCX.toFixed(2),
        brokeragePerNSECrore: isNaN(brokeragePerNSECrore)
          ? 0
          : brokeragePerNSECrore.toFixed(2),
        finalMasterBrokerage: isNaN(finalMasterBrokerage)
          ? 0
          : finalMasterBrokerage,
        finalMasterMCXBrokerage: isNaN(finalMasterMCXBrokerage)
          ? 0
          : finalMasterMCXBrokerage,
        finalMasterNSEBrokerage: isNaN(finalMasterNSEBrokerage)
          ? 0
          : finalMasterNSEBrokerage,
      },
      masterAdmin: {
        share_brokerage: masterAdmin.share_brokerage,
        mcx_brokerage_type: masterAdmin.mcx_brokerage_type,
        mcx_brokerage: masterAdmin.mcx_brokerage,
        currentbrokerage: isNaN(masterAdminTotalBrokerage)
          ? 0
          : masterAdminTotalBrokerage.toFixed(2),
        brokeragePerMCX: isNaN(masterAdminBrokeragePerMCX)
          ? 0
          : masterAdminBrokeragePerMCX.toFixed(2),
        brokeragePerNSECrore: isNaN(masterAdminBrokeragePerNSECrore)
          ? 0
          : masterAdminBrokeragePerNSECrore.toFixed(2),
      },
      finalMasterBrokerage: isNaN(finalMasterBrokerage)
        ? 0
        : finalMasterBrokerage,
      finalMasterMCXBrokerage: isNaN(finalMasterMCXBrokerage)
        ? 0
        : finalMasterMCXBrokerage,
      finalMasterNSEBrokerage: isNaN(finalMasterNSEBrokerage)
        ? 0
        : finalMasterNSEBrokerage,
      finalMasterMCXBrokerage: isNaN(finalMasterMCXBrokerage)
        ? 0
        : finalMasterMCXBrokerage,
      finalMasterNSEBrokerage: isNaN(finalMasterNSEBrokerage)
        ? 0
        : finalMasterNSEBrokerage,
      nseTrades,
      totalNSEAmount: isNaN(totalNSEAmount) ? 0 : totalNSEAmount.toFixed(2),
      brokeragePerNSECrore: isNaN(brokeragePerNSECrore)
        ? 0
        : brokeragePerNSECrore.toFixed(2),
      mcxTrades: mcxTradeDetails,
      totalMCXAmount: isNaN(totalMCXAmount) ? 0 : totalMCXAmount.toFixed(2),
      totalSaudas: isNaN(totalSaudas) ? 0 : totalSaudas,
      brokeragePerMCX: isNaN(brokeragePerMCX) ? 0 : brokeragePerMCX.toFixed(2),
      totalAmount: isNaN(totalAmount) ? 0 : totalAmount.toFixed(2),
      totalBrokerage: isNaN(totalBrokerage) ? 0 : totalBrokerage.toFixed(2),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error });
  }
};

module.exports = {
  addTrade,
  getTotalTrades,
  getTrades,
  deleteTrade,
  getTradesByInstrumentIdentifier,
  getTradesForChart,
  calculateNetQuantityByUser,
  calculateMCXTradesByUser,
  getAllTradesByInstrumentIdentifier,
  getClientStockHistory,
  getTradesBrokerageByClientId,
};
