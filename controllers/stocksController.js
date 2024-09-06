const Stock = require('../models/stock');
const BlockStock = require("../models/blockStock");

// Controller to get stock data
const getDataController = async (req, res) => {
  try {
    const stockData = await Stock.find({}); 
    res.status(200).json(stockData);
  } catch (error) {
    console.error("Error fetching stock data:", error);
    res.status(500).json({ message: "Error fetching stock data" });
  }
};

// Add a new block stock
const addBlockStock = async (req, res) => {
  try {
    const { symbol, exchange } = req.body;

    // Check if the stock already exists
    const existingStock = await BlockStock.findOne({ symbol });
    if (existingStock) {
      return res.status(400).json({ error: "Stock with this symbol already exists" });
    }

    // Create a new stock
    const newBlockStock = new BlockStock({
      symbol,
      exchange,
    });

    // Save the stock to the database
    const savedStock = await newBlockStock.save();

    return res.status(201).json({
      success: true,
      message: "Stock added successfully",
      stock: savedStock,
    });
  } catch (error) {
    console.error("Error adding stock:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add stock",
      error: error.message,
    });
  }
};

// Delete a block stock by symbol
const deleteBlockStock = async (req, res) => {
  try {
    const { symbol } = req.params;

    // Find the stock by symbol and delete it
    const deletedStock = await BlockStock.findOneAndDelete({ symbol });

    if (!deletedStock) {
      return res.status(404).json({
        success: false,
        message: "Stock not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Stock deleted successfully",
      stock: deletedStock,
    });
  } catch (error) {
    console.error("Error deleting stock:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete stock",
      error: error.message,
    });
  }
};

// Get all block stocks
const getBlockStocks = async (req, res) => {
  try {
    const stocks = await BlockStock.find({});
    return res.status(200).json({
      success: true,
      stocks,
    });
  } catch (error) {
    console.error("Error fetching stocks:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch stocks",
      error: error.message,
    });
  }
};

// Exporting functions
module.exports = {
  getDataController,
  addBlockStock,
  deleteBlockStock,
  getBlockStocks
};
