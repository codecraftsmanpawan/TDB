const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const OTP = require("../models/otp");
const Client = require("../models/client");
const MasterAdmin = require("../models/masterAdmin");
const Trade = require("../models/Trade");
const Stock = require("../models/stock");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
require("dotenv").config();

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

// Send OTP via Email
const sendOTPEmail = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your OTP for Private Super Admin Login",
    text: `Your OTP is ${otp}. It is valid for 1 minute.`,
  };

  console.log(`Sending OTP ${otp} to ${email}`);

  return transporter.sendMail(mailOptions);
};

// Login (Send OTP)
exports.privateAdminLogin = async (req, res) => {
  // Use the email from the environment variables
  const adminEmail = process.env.PRIVATE_SUPER_ADMIN_EMAIL;

  try {
    // Remove any existing OTP for this email
    await OTP.deleteOne({ email: adminEmail });

    const otp = generateOTP();
    const otpExpires = Date.now() + 60 * 1000; // OTP expires in 1 minute

    // Save new OTP to the database
    await OTP.create({
      email: adminEmail,
      otp,
      otpExpires,
      used: false,
    });

    // console.log(`Generated OTP for ${adminEmail}: ${otp}`);

    await sendOTPEmail(adminEmail, otp);
    res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// Verify OTP and issue JWT
exports.verifyPrivateAdminOTP = async (req, res) => {
  const { otp } = req.body;

  // Use the email from the environment variables
  const adminEmail = process.env.PRIVATE_SUPER_ADMIN_EMAIL;

  try {
    // Find the OTP in the database
    const storedOTPData = await OTP.findOne({ email: adminEmail, otp });

    if (!storedOTPData) {
      return res
        .status(400)
        .json({ message: "OTP not found. Please request a new OTP." });
    }

    // Check if OTP is expired
    if (Date.now() > storedOTPData.otpExpires) {
      // Delete expired OTP from the database
      await OTP.deleteOne({ _id: storedOTPData._id });
      return res
        .status(400)
        .json({ message: "OTP has expired. Please request a new OTP." });
    }

    // Check if OTP has already been used
    if (storedOTPData.used) {
      return res.status(400).json({ message: "OTP has already been used." });
    }

    // Log OTP comparison for debugging
    // console.log(`Stored OTP: ${storedOTPData.otp}, Provided OTP: ${otp}`);

    // Mark OTP as used
    storedOTPData.used = true;
    await storedOTPData.save();

    // Generate JWT token
    const payload = {
      email: adminEmail,
      role: "privatesuperadmin",
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET_PRIVATE, {
      expiresIn: "1h",
    });

    // console.log(`Login successful for ${adminEmail}`);

    res.status(200).json({
      token,
      message: "Login successful",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// Controller to get all clients
exports.getAllClients = async (req, res) => {
  try {
    const clients = await Client.find()
      .select("-password") // Exclude the password field from the response
      .populate("master_admin_id", "master_code")
      .exec();

    // If no clients found
    if (!clients || clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No clients found",
      });
    }

    // Return the list of clients with success status
    return res.status(200).json({
      success: true,
      data: clients,
    });
  } catch (error) {
    // Error handling for any issues during database operations
    console.error("Error fetching clients:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching clients",
    });
  }
};

exports.getClientById = async (req, res) => {
  try {
    // Extract client ID from the request parameters
    const clientId = req.params.id;

    // Validate the client ID format
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid client ID format",
      });
    }

    // Fetch the client by ID with the specified fields
    const client = await Client.findById(clientId).select(
      "client_id master_admin_id client_code budget availableBudget currentProfitLoss currentbrokerage share_brokerage mcx_brokerage_type mcx_brokerage username status updatedAt __v"
    ); // Specify fields to include

    // If the client is not found, return a 404 error
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    // Return the client data if found
    return res.status(200).json({
      success: true,
      client,
    });
  } catch (error) {
    console.error("Error fetching client by ID:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching the client",
      error: error.message,
    });
  }
};

// Controller to fetch all trades by clientId
exports.getTrades = async (req, res) => {
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

// Controller to fetch stock by instrumentIdentifier
exports.getStockByInstrumentIdentifier = async (req, res) => {
  try {
    const { instrumentIdentifier } = req.params;

    // Validate the instrumentIdentifier parameter
    if (!instrumentIdentifier || typeof instrumentIdentifier !== "string") {
      return res.status(400).json({
        message: "Valid instrumentIdentifier path parameter is required.",
      });
    }

    // Search for the stock with the given instrumentIdentifier
    const stock = await Stock.findOne({
      InstrumentIdentifier: instrumentIdentifier,
    });

    if (!stock) {
      return res.status(404).json({
        message: "No stock found with the given instrumentIdentifier.",
      });
    }

    // Check if the stock matches the first condition for GOLD
    if (
      stock.name === "GOLD" &&
      stock.product === "GOLD" &&
      stock.Exchange === "MCX"
    ) {
      stock.QuotationLot = 100;
    }

    // Check if the stock matches the second condition for GOLDM
    if (
      stock.name === "GOLDM" &&
      stock.product === "GOLDM" &&
      stock.Exchange === "MCX"
    ) {
      stock.QuotationLot = 10;
    }

    // Get current time in Kolkata (Indian Standard Time, UTC+5:30)
    const now = new Date();
    const kolkataTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    const currentHour = kolkataTime.getHours();
    const currentMinutes = kolkataTime.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinutes;

    // 3:30 PM is 15:30 (15*60 + 30 = 930), and 9:15 AM is 9:15 (9*60 + 15 = 555)
    const timeCondition =
      currentTimeInMinutes >= 930 || currentTimeInMinutes < 555;

    // Check if today is Saturday (6) or Sunday (0)
    const isWeekend = kolkataTime.getDay() === 6 || kolkataTime.getDay() === 0;

    // Apply stock price updates for NSE and MCX during the weekend
    if (isWeekend) {
      stock.BuyPrice = stock.Close;
      stock.SellPrice = stock.Close;
    }

    // NSE stock price update condition: between 3:30 PM and 9:15 AM
    if (stock.Exchange === "NSE" && !isWeekend && timeCondition) {
      stock.BuyPrice = stock.LastTradePrice;
      stock.SellPrice = stock.LastTradePrice;
    }

    // MCX stock price update condition: from 11:30 PM to 9:15 AM or on weekends
    const mcxTimeCondition =
      currentTimeInMinutes >= 23 * 60 + 30 || currentTimeInMinutes < 555;

    if (stock.Exchange === "MCX" && (mcxTimeCondition || isWeekend)) {
      stock.BuyPrice = stock.Close;
      stock.SellPrice = stock.Close;
    }

    // Monday to Friday condition: Use LastTradePrice from 9:15 AM to 3:30 PM
    const isWeekday = kolkataTime.getDay() >= 1 && kolkataTime.getDay() <= 5;
    const weekdayTimeCondition =
      currentTimeInMinutes >= 555 && currentTimeInMinutes < 930;

    if (isWeekday && weekdayTimeCondition) {
      stock.BuyPrice = stock.LastTradePrice;
      stock.SellPrice = stock.LastTradePrice;
    }

    // Respond with the stock data
    return res.status(200).json(stock);
  } catch (error) {
    // Error handling for database or other server issues
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.getTradesBrokerageByClientId = async (req, res) => {
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
      nseTrades,
      totalNSEAmount: isNaN(totalNSEAmount) ? 0 : totalNSEAmount.toFixed(2),
      mcxTrades: mcxTradeDetails,
      totalMCXAmount: isNaN(totalMCXAmount) ? 0 : totalMCXAmount.toFixed(2),
      totalSaudas: isNaN(totalSaudas) ? 0 : totalSaudas,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error });
  }
};

exports.deleteTrade = async (req, res) => {
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

    // Update the client's available budget
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

exports.searchStocksByInstrumentIdentifier = async (req, res) => {
  try {
    const { instrumentIdentifier } = req.query;

    // Validate the instrumentIdentifier
    if (!instrumentIdentifier || typeof instrumentIdentifier !== "string") {
      return res.status(400).json({
        message: "Valid instrumentIdentifier query parameter is required.",
      });
    }

    // Search for stocks with instrumentIdentifier matching the query
    const stock = await Stock.findOne(
      { instrumentIdentifier: new RegExp(instrumentIdentifier, "i") }, // Case-insensitive search using regex
      "instrumentIdentifier exchange name product" // Select only these fields
    );

    // If no stock is found, return a 404 error
    if (!stock) {
      return res.status(404).json({
        message: "No stock found with the given instrumentIdentifier.",
      });
    }

    // Return the matching stock
    return res.status(200).json(stock);
  } catch (error) {
    console.error("Error searching stock:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.addTrade = async (req, res) => {
  try {
    const {
      _id,
      instrumentIdentifier,
      name,
      exchange,
      trade_type,
      quantity,
      price,
      tradePercentage,
    } = req.body;

    // Check for required fields
    if (
      !_id ||
      !instrumentIdentifier ||
      !name ||
      !exchange ||
      !trade_type ||
      !quantity ||
      !price ||
      tradePercentage === undefined
    ) {
      //   console.log("Missing required fields in request body:", req.body);
      return res.status(400).json({ message: "All fields are required" });
    }

    // Validate that tradePercentage is a number
    if (typeof tradePercentage !== "number") {
      //   console.log("Invalid tradePercentage:", tradePercentage);
      return res
        .status(400)
        .json({ message: "tradePercentage must be a number" });
    }

    // Check if quantity and price are greater than zero
    if (quantity <= 0 || price <= 0) {
      //   console.log("Invalid quantity or price:", { quantity, price });
      return res
        .status(400)
        .json({ message: "Quantity and price must be greater than zero." });
    }

    // Validate the '_id' format
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      //   console.log("Invalid user ID:", _id);
      return res.status(400).json({ message: "Invalid User" });
    }

    // Find the client document using the provided '_id'
    const client = await Client.findById(_id);

    if (!client) {
      //   console.log("Client not found:", _id);
      return res.status(404).json({ message: "Client not found" });
    }

    // Set maximum totalPercentage limit for each exchange based on client's PerMCXTrade and PerNSETrade
    const maxLimits = {
      MCX: client.PerMCXTrade * 100,
      NSE: client.PerNSETrade * 100,
    };

    // Ensure the exchange exists in maxLimits
    if (!maxLimits.hasOwnProperty(exchange)) {
      //   console.log("Exchange not supported:", exchange);
      return res
        .status(400)
        .json({ message: `Exchange ${exchange} is not supported.` });
    }

    // Fetch all trades for the client with the same instrument and exchange
    const clientTrades = await Trade.find({
      userId: client._id,
      exchange,
      name,
    }).exec();

    // console.log(`Found ${clientTrades.length} trades for client`);

    // Calculate current totals for buy and sell trades
    const currentBuyTotal = clientTrades
      .filter((trade) => trade.tradePercentage > 0) // Buy trades (positive percentage)
      .reduce((sum, trade) => sum + trade.tradePercentage, 0);

    const currentSellTotal = clientTrades
      .filter((trade) => trade.tradePercentage < 0) // Sell trades (negative percentage)
      .reduce((sum, trade) => sum + Math.abs(trade.tradePercentage), 0); // Use absolute value for sell total

    // console.log("Current Buy Total:", currentBuyTotal);
    // console.log("Current Sell Total:", currentSellTotal);

    // Calculate the net total percentage (buy - sell)
    const netTotal = currentBuyTotal - currentSellTotal;
    // console.log("Net Total (Buy - Sell):", netTotal);

    // Calculate the proposed net total after adding the new trade
    const proposedNetTotal = netTotal + tradePercentage;
    // console.log("Proposed Net Total after new trade:", proposedNetTotal);

    // Check if the absolute value of proposed net total exceeds the limit
    if (Math.abs(proposedNetTotal) > maxLimits[exchange]) {
      //   console.log("Proposed net total exceeds the limit:", proposedNetTotal);

      // Calculate remaining trade percentages
      const remainingBuy = maxLimits[exchange] - netTotal;
      const remainingSell = maxLimits[exchange] + netTotal;

      return res.status(400).json({
        message: `Adding this trade would exceed the combined limit of ${maxLimits[exchange]} for ${exchange}.`,
        remainingBuy: remainingBuy >= 0 ? remainingBuy : 0,
        remainingSell: remainingSell >= 0 ? remainingSell : 0,
      });
    }

    // Create a new trade instance
    const newTrade = new Trade({
      userId: client._id,
      stockId: instrumentIdentifier,
      instrumentIdentifier,
      name,
      exchange,
      tradeType: tradePercentage > 0 ? "buy" : "sell",
      quantity,
      price,
      tradePercentage,
      action: tradePercentage > 0 ? "buy" : "sell",
      status: "open",
      date: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // console.log("New trade created:", newTrade);

    // Save the trade to the database
    const savedTrade = await newTrade.save();

    // console.log("Trade saved to database:", savedTrade);

    // Fetch updated trades for the client
    const updatedClientTrades = await Trade.find({ userId: client._id }).exec();

    // console.log("Updated client trades:", updatedClientTrades);

    // Calculate remaining trade percentages after the proposed trade
    const newNetTotal = proposedNetTotal;
    const remainingBuy = maxLimits[exchange] - newNetTotal;
    const remainingSell = maxLimits[exchange] + newNetTotal;

    // Respond with the saved trade and the updated trades along with remaining percentages
    res.status(201).json({
      message: "Trade added successfully",
      trade: savedTrade,
      updatedClientTrades,
      remainingBuy: remainingBuy >= 0 ? remainingBuy : 0,
      remainingSell: remainingSell >= 0 ? remainingSell : 0,
    });
  } catch (error) {
    console.error("Error adding trade:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};
