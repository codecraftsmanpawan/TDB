const mongoose = require('mongoose');
const Bid = require('../models/Bid');
const Stock = require('../models/stock');
const Client = require('../models/client');

const addBid = async (req, res) => {
  try {
    const { userId, instrumentIdentifier, bidPrice, bidQuantity, tradeType } = req.body;

    if (!userId || !instrumentIdentifier || !bidPrice || !bidQuantity || !tradeType) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!['buy', 'sell'].includes(tradeType)) {
      return res.status(400).json({ message: 'Invalid trade_type. It should be either "buy" or "sell".' });
    }

    if (bidQuantity <= 0 || bidPrice <= 0) {
      return res.status(400).json({ message: 'Bid quantity and price must be greater than zero.' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid User ID' });
    }

    // Find the stock using InstrumentIdentifier
    const stock = await Stock.findOne({ InstrumentIdentifier: instrumentIdentifier });
    if (!stock) {
      return res.status(404).json({ message: 'Stock not found' });
    }

    // Find the client using userId
    const client = await Client.findById(userId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const newBid = new Bid({
      userId,
      stockId: stock._id,
      instrumentIdentifier,
      bidPrice,
      bidQuantity,
      tradeType,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    const savedBid = await newBid.save();

    res.status(201).json({
      message: 'Bid added successfully',
      bid: savedBid
    });
  } catch (error) {
    console.error('Error adding bid:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const getBidsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid User ID' });
    }

    // Find bids associated with the given userId
    const bids = await Bid.find({ userId }).populate('stockId', 'InstrumentIdentifier'); // Optionally populate stockId to include stock details

    if (bids.length === 0) {
      return res.status(404).json({ message: 'No bids found for this user' });
    }

    res.status(200).json({
      message: 'Bids retrieved successfully',
      bids
    });
  } catch (error) {
    console.error('Error retrieving bids:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};


module.exports = {
  addBid,
  getBidsByUserId
};
