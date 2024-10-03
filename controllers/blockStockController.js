const BlockStock = require('../models/blockStock'); 

// Get all block stocks
const getAllBlockStocks = async (req, res) => {
  try {
    const blockStocks = await BlockStock.find();
    res.status(200).json(blockStocks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAllBlockStocks,
};
