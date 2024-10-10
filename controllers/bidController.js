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

// Delete bid by ID
const deleteBidById = async (req, res) => {
  const { id } = req.params; 

  try {
    // Find and delete the bid
    const result = await Bid.findByIdAndDelete(id);

    // Check if the bid was found and deleted
    if (!result) {
      return res.status(404).json({ message: 'Bid not found' });
    }

    // Respond with a success message
    return res.status(200).json({ message: 'Bid deleted successfully' });
  } catch (error) {
    console.error('Error deleting bid:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update bid controller
const updateBid = async (req, res) => {
    const { id } = req.params; 
    const { bidPrice, bidQuantity, tradeType } = req.body;

    try {
        // Validate input
        if (bidPrice < 0 || bidQuantity < 0) {
            return res.status(400).json({ message: 'Bid price and quantity must be non-negative.' });
        }

        // Find and update the bid
        const updatedBid = await Bid.findByIdAndUpdate(
            id,
            { bidPrice, bidQuantity, tradeType, updatedAt: Date.now() }, 
            { new: true, runValidators: true } 
        );

        // Check if bid was found and updated
        if (!updatedBid) {
            return res.status(404).json({ message: 'Bid not found.' });
        }

        // Return the updated bid
        return res.status(200).json(updatedBid);
    } catch (error) {
        console.error('Error updating bid:', error);
        return res.status(500).json({ message: 'Server error. Please try again.' });
    }
};

const getBidsFulfilledByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate the userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid User ID' });
    }

    // Find bids associated with the given userId and status "fulfilled"
    const fulfilledBids = await Bid.find({ userId, status: 'fulfilled' })
      .populate('stockId', 'instrumentIdentifier'); 

    if (fulfilledBids.length === 0) {
      return res.status(404).json({ message: 'No fulfilled bids found for this user' });
    }

    res.status(200).json({
      message: 'Fulfilled bids retrieved successfully',
      bids: fulfilledBids
    });
  } catch (error) {
    console.error('Error retrieving bids:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

module.exports = {
  addBid,
  getBidsByUserId,
  deleteBidById,
  updateBid,
  getBidsFulfilledByUserId
};
