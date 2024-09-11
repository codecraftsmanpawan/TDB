const Client = require('../models/client');
const Stock = require('../models/stock');
const Wishlist = require("../models/wishlist");
const blockStock = require('../models/blockStock');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const moment = require('moment-timezone');

const clientLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find the client by username
    const client = await Client.findOne({ username });
    if (!client) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    // Check if the client status is active
    if (client.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account is not active. Please contact your admin to activate your ID.'
      });
    }

    // Validate the password
    const isPasswordValid = await bcrypt.compare(password, client.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign({ id: client._id }, process.env.SECRET_KEY, { expiresIn: '2d' });

    return res.status(200).json({ 
      success: true, 
      message: 'Client logged in successfully', 
      token,
    });
  } catch (error) {
    console.error('Error in client login:', error);
    return res.status(500).json({ success: false, message: 'An error occurred', error: error.message });
  }
};

//changeclientpassword
const changeClientPassword = async (req, res) => {
  try {
    const clientId = req.user._id; 

    console.log('Client ID:', clientId); 
    const client = await Client.findById(clientId);
    if (!client) {
      console.log('Client not found'); 
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const { oldPassword, newPassword } = req.body;

    const isOldPasswordValid = await bcrypt.compare(oldPassword, client.password);
    if (!isOldPasswordValid) {
      return res.status(400).json({ success: false, message: 'Invalid old password' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    client.password = hashedNewPassword;
    await client.save();

    return res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error in changing password:', error);
    return res.status(500).json({ success: false, message: 'An error occurred' });
  }
};

// Controller to search stocks by name
const searchStocksByName = async (req, res) => {
  try {
    const { name } = req.query;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ message: 'Valid stock name query parameter is required.' });
    }

    // Search for stocks with names matching the query
    const stocks = await Stock.find(
      { name: new RegExp(name, 'i') },
      'InstrumentIdentifier Exchange name product'  
    );

    if (stocks.length === 0) {
      return res.status(404).json({ message: 'No stocks found with the given name.' });
    }

    return res.status(200).json(stocks);
  } catch (error) {
    console.error('Error searching stocks:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};


// Add an item to the wishlist
const addItemToWishlist = async (req, res) => {
  try {
    const { userId, item } = req.body;

    // Validate user
    const user = await Client.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find or create wishlist
    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      wishlist = new Wishlist({ user: userId, items: [] });
    }

    // Check if the item already exists in the wishlist
    const itemExists = wishlist.items.some(
      (i) => i.product === item.product && i.exchange === item.exchange
    );
    if (itemExists) {
      return res.status(400).json({ message: 'Item already in wishlist' });
    }

    // Add item to wishlist
    wishlist.items.push(item);
    await wishlist.save();

    res.status(201).json(wishlist);
  } catch (error) {
    console.error('Error adding item to wishlist:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Remove an item from the wishlist
const removeItemFromWishlist = async (req, res) => {
  try {
    const { userId, itemId } = req.params;

    // Validate user
    const user = await Client.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find wishlist
    const wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    // Check if the item exists in the wishlist
    const itemIndex = wishlist.items.findIndex(item => item.instrumentIdentifier === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in wishlist' });
    }

    // Remove item from wishlist
    wishlist.items.splice(itemIndex, 1);
    await wishlist.save();

    res.status(200).json({ message: 'Item removed successfully', wishlist });
  } catch (error) {
    console.error('Error removing item from wishlist:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// Get the wishlist for a user
// const getWishlist = async (req, res) => {
//   try {
//     const { userId } = req.params;

//     // Validate user
//     const user = await Client.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     // Find wishlist
//     const wishlist = await Wishlist.findOne({ user: userId });
//     if (!wishlist) {
//       return res.status(404).json({ message: 'Wishlist not found' });
//     }

//     res.status(200).json(wishlist);
//   } catch (error) {
//     console.error('Error getting wishlist:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// };
const getWishlist = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user
    const user = await Client.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find wishlist
    const wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    // Get all blocked stocks
    const blockedStocks = await blockStock.find({}, { symbol: 1, _id: 0 });
    const blockedSymbols = blockedStocks.map(stock => stock.symbol);

    // Filter wishlist items based on blocked symbols
    const filteredItems = wishlist.items.filter(
      item => !blockedSymbols.includes(item.instrumentIdentifier)
    );

    res.status(200).json({ ...wishlist.toObject(), items: filteredItems });
  } catch (error) {
    console.error('Error getting wishlist:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// const getStockByInstrumentIdentifier = async (req, res) => {
//   try {
//     const { instrumentIdentifier } = req.params;

//     // Validate the instrumentIdentifier parameter
//     if (!instrumentIdentifier || typeof instrumentIdentifier !== 'string') {
//       return res.status(400).json({ message: 'Valid instrumentIdentifier path parameter is required.' });
//     }

//     // Search for the stock with the given instrumentIdentifier
//     const stock = await Stock.findOne({ InstrumentIdentifier: instrumentIdentifier });

//     if (!stock) {
//       return res.status(404).json({ message: 'No stock found with the given instrumentIdentifier.' });
//     }

//     // Check if the stock matches the first condition
//     if (
//       stock.name === 'GOLD' &&
//       stock.product === 'GOLD' &&
//       stock.Exchange === 'MCX'
//     ) {
//       stock.QuotationLot = 100;
//     }

//     // Check if the stock matches the second condition
//     if (
//       stock.name === 'GOLDM' &&
//       stock.product === 'GOLDM' &&
//       stock.Exchange === 'MCX'
//     ) {
//       stock.QuotationLot = 10;
//     }

//     // Respond with the stock data
//     return res.status(200).json(stock);
//   } catch (error) {
//     console.error('Error fetching stock data:', error);
//     return res.status(500).json({ message: 'Internal server error', error: error.message });
//   }
// };


// Controller to get stock data using InstrumentIdentifier
// const getStockByInstrumentIdentifier = async (req, res) => {
//   try {
//     const { instrumentIdentifier } = req.params;

//     // Validate the instrumentIdentifier parameter
//     if (!instrumentIdentifier || typeof instrumentIdentifier !== 'string') {
//       return res.status(400).json({ message: 'Valid instrumentIdentifier path parameter is required.' });
//     }

//     // Search for the stock with the given instrumentIdentifier
//     const stock = await Stock.findOne({ InstrumentIdentifier: instrumentIdentifier });

//     if (!stock) {
//       return res.status(404).json({ message: 'No stock found with the given instrumentIdentifier.' });
//     }

//     // Respond with the stock data
//     return res.status(200).json(stock);
//   } catch (error) {
//     console.error('Error fetching stock data:', error);
//     return res.status(500).json({ message: 'Internal server error', error: error.message });
//   }
// };

// Get availableBudget for a specific client

// const getStockByInstrumentIdentifier = async (req, res) => {
//   try {
//     const { instrumentIdentifier } = req.params;

//     // Validate the instrumentIdentifier parameter
//     if (!instrumentIdentifier || typeof instrumentIdentifier !== 'string') {
//       return res.status(400).json({ message: 'Valid instrumentIdentifier path parameter is required.' });
//     }

//     // Search for the stock with the given instrumentIdentifier
//     const stock = await Stock.findOne({ InstrumentIdentifier: instrumentIdentifier });

//     if (!stock) {
//       return res.status(404).json({ message: 'No stock found with the given instrumentIdentifier.' });
//     }

//     // Check if the stock matches the first condition
//     if (
//       stock.name === 'GOLD' &&
//       stock.product === 'GOLD' &&
//       stock.Exchange === 'MCX'
//     ) {
//       stock.QuotationLot = 100;
//     }

//     // Check if the stock matches the second condition
//     if (
//       stock.name === 'GOLDM' &&
//       stock.product === 'GOLDM' &&
//       stock.Exchange === 'MCX'
//     ) {
//       stock.QuotationLot = 10;
//     }

//     // Condition for NSE exchange between 3:30 PM and 9:15 AM
//     const now = new Date();
//     const currentHour = now.getHours();
//     const currentMinutes = now.getMinutes();
//     const currentTimeInMinutes = currentHour * 60 + currentMinutes;

//     // 3:30 PM is 15:30 (15*60 + 30 = 930), and 9:15 AM is 9:15 (9*60 + 15 = 555)
//     const timeCondition = (currentTimeInMinutes >= 930 || currentTimeInMinutes < 555);
    
//     if (stock.Exchange === 'NSE' && timeCondition) {
//       stock.BuyPrice = stock.Close;
//       stock.SellPrice = stock.Close;
//     }

//     // Respond with the stock data
//     return res.status(200).json(stock);
//   } catch (error) {
//     console.error('Error fetching stock data:', error);
//     return res.status(500).json({ message: 'Internal server error', error: error.message });
//   }
// };
const getStockByInstrumentIdentifier = async (req, res) => {
  try {
    const { instrumentIdentifier } = req.params;

    // Validate the instrumentIdentifier parameter
    if (!instrumentIdentifier || typeof instrumentIdentifier !== 'string') {
      return res.status(400).json({ message: 'Valid instrumentIdentifier path parameter is required.' });
    }

    // Search for the stock with the given instrumentIdentifier
    const stock = await Stock.findOne({ InstrumentIdentifier: instrumentIdentifier });

    if (!stock) {
      return res.status(404).json({ message: 'No stock found with the given instrumentIdentifier.' });
    }

    // Check if the stock matches the first condition
    if (
      stock.name === 'GOLD' &&
      stock.product === 'GOLD' &&
      stock.Exchange === 'MCX'
    ) {
      stock.QuotationLot = 100;
    }

    // Check if the stock matches the second condition
    if (
      stock.name === 'GOLDM' &&
      stock.product === 'GOLDM' &&
      stock.Exchange === 'MCX'
    ) {
      stock.QuotationLot = 10;
    }

    // Get the current time in India/Kolkata timezone
    const now = moment.tz('Asia/Kolkata');
    const currentHour = now.hour();
    const currentMinutes = now.minute();
    const currentTimeInMinutes = currentHour * 60 + currentMinutes;

    // Define time boundaries in minutes (3:30 PM is 15:30 = 930, 9:15 AM is 9:15 = 555)
    const timeCondition = (currentTimeInMinutes >= 930 || currentTimeInMinutes < 555);

    if (stock.Exchange === 'NSE' && timeCondition) {
      stock.BuyPrice = stock.Close;
      stock.SellPrice = stock.Close;
    }

    // Respond with the stock data
    return res.status(200).json(stock);
  } catch (error) {
    console.error('Error fetching stock data:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};


const getAvailableBudget = async (req, res) => {
  try {
    const { id } = req.params; // Extract the ObjectId from request parameters

    // Validate the ObjectId
    if (!id) {
      console.log('Client ObjectId is missing');
      return res.status(400).json({ success: false, message: 'Client ObjectId is required' });
    }

    console.log(`Fetching available budget and current profit/loss for client ObjectId: ${id}`);

    // Find the client by _id (ObjectId)
    const client = await Client.findById(id);

    if (!client) {
      console.log(`Client not found with ObjectId: ${id}`);
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    // Calculate the total budget including the profit/loss
    const totalProfitLossAmount = client.availableBudget + client.currentProfitLoss;

    // Determine if the current profit/loss is a profit or a loss
    const profitLossStatus = client.currentProfitLoss >= 0 ? 'Profit' : 'Loss';

    // Return the original availableBudget, adjusted totalProfitLossAmount, and profit/loss status
    return res.status(200).json({
      success: true,
      originalAvailableBudget: client.availableBudget, // Original available budget
      currentProfitLoss: client.currentProfitLoss,
      totalProfitLossAmount: totalProfitLossAmount, // Available budget adjusted for current profit/loss
      profitLossStatus: profitLossStatus // Indicates if it is a profit or a loss
    });
  } catch (error) {
    console.error('Error retrieving available budget and current profit/loss:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};


// Get client details by client_id
const getClientDetails = async (req, res) => {
  try {
    const { client_id } = req.params;

    // Validate client_id
    if (!mongoose.Types.ObjectId.isValid(client_id)) {
      return res.status(400).json({ error: 'Invalid client ID format' });
    }

    // Fetch the client by client_id
    const client = await Client.findOne({ _id: client_id }).select(
      'client_code share_brokerage mcx_brokerage_type mcx_brokerage username'
    );

    // If no client is found, return a 404 error
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Structure the client details
    const clientDetails = {
      clientId: client._id,
      clientCode: client.client_code,
      shareBrokerage: client.share_brokerage,
      mcxBrokerageType: client.mcx_brokerage_type,
      mcxBrokerage: client.mcx_brokerage,
      username: client.username,
    };

    // Send the response
    res.status(200).json({ clientId: client_id, clientDetails });
  } catch (error) {
    console.error('Error fetching client details:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

const currentProfitLoss = async (req, res) => {
    const { userId } = req.params; // Expecting `userId` to be an ObjectId
    const { profitLoss } = req.body;

    // Validate profitLoss
    if (typeof profitLoss !== 'number') {
        return res.status(400).json({ message: 'Invalid profitLoss value. It must be a number.' });
    }

    try {
        // Update the client document
        const result = await Client.findByIdAndUpdate(
            userId,
            { $set: { currentProfitLoss: profitLoss } },
            { new: true, runValidators: true } // `new: true` returns the updated document if needed
        );

        // If no client found, return 404
        if (!result) {
            return res.status(404).json({ message: 'Client not found' });
        }

        // Return a success message
        res.json({ message: 'Current profit/loss updated successfully.' });
    } catch (error) {
        console.error('Error updating current profit/loss:', error);
        res.status(500).json({ message: 'Error updating current profit/loss', error: error.message });
    }
};






module.exports = { 
  clientLogin,
  changeClientPassword,
  searchStocksByName,
   addItemToWishlist,
  removeItemFromWishlist,
  getWishlist,
  getStockByInstrumentIdentifier,
  getAvailableBudget,
  getClientDetails,
  currentProfitLoss
};