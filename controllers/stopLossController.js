const mongoose = require('mongoose');
const Stoploss = require('../models/StopLoss');
const Stock = require('../models/stock');
const Client = require('../models/client');

// Controller to insert data into the Stoploss collection
const addStoploss = async (req, res) => {
  try {
    const { userId, instrumentIdentifier, stopPrice, quantity, tradeType } = req.body;

    // Validate required fields
    if (!userId || !instrumentIdentifier || !stopPrice || !quantity || !tradeType) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Create a new Stoploss document
    const stoploss = new Stoploss({
      userId,
      instrumentIdentifier,
      stopPrice,
      quantity,
      tradeType,
    });

    // Save the document to the database
    await stoploss.save();

    // Respond with the created stoploss data
    return res.status(201).json({
      message: 'Stoploss order created successfully',
      stoploss,
    });
  } catch (error) {
    // Handle any errors during the process
    return res.status(500).json({ error: 'Failed to create stoploss order', details: error.message });
  }
};

const getStoploss = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId parameter
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Find stoploss documents for the given userId
    const stoplosses = await Stoploss.find({ userId });

    // Check if any stoplosses were found
    if (stoplosses.length === 0) {
      return res.status(404).json({ message: 'No stoploss orders found for this user' });
    }

    // Respond with the retrieved stoploss data
    return res.status(200).json({
      message: 'Stoploss orders retrieved successfully',
      stoplosses,
    });
  } catch (error) {
    // Handle any errors during the process
    return res.status(500).json({ error: 'Failed to retrieve stoploss orders', details: error.message });
  }
};

// Update Stoploss by ID
const updateStoploss = async (req, res) => {
    const { id } = req.params; // Get the ID from request parameters
    const { stopPrice, quantity, tradeType, status } = req.body; // Destructure the request body

    try {
        const updatedStoploss = await Stoploss.findByIdAndUpdate(
            id,
            { stopPrice, quantity, tradeType, status, updatedAt: Date.now() }, // Update fields
            { new: true, runValidators: true } // Options to return the updated document and run validation
        );

        if (!updatedStoploss) {
            return res.status(404).json({ message: 'Stoploss not found' });
        }

        res.status(200).json(updatedStoploss); // Return the updated stoploss
    } catch (error) {
        res.status(400).json({ message: error.message }); // Return error message
    }
};

// Delete Stoploss by ID
const deleteStoploss = async (req, res) => {
    const { id } = req.params; // Get the ID from request parameters

    try {
        const deletedStoploss = await Stoploss.findByIdAndDelete(id); // Find and delete the stoploss

        if (!deletedStoploss) {
            return res.status(404).json({ message: 'Stoploss not found' });
        }

        res.status(200).json({ message: 'Stoploss deleted successfully' }); // Success message
    } catch (error) {
        res.status(400).json({ message: error.message }); // Return error message
    }
};




module.exports = {
  addStoploss, getStoploss, updateStoploss, deleteStoploss
};
