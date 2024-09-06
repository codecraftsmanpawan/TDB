const QuantityLimit = require('../models/quantityLimit'); 

exports.updateOverallLimit = async (req, res) => {
  try {
    const { overallLimit } = req.body;

    if (typeof overallLimit !== 'number') {
      return res.status(400).json({ error: 'overallLimit must be a number' });
    }

    // Find or create a default document
    const firstDocument = await QuantityLimit.findOneAndUpdate(
      {}, // Match all documents
      { overallLimit },
      { upsert: true, new: true } 
    );

    res.status(200).json(firstDocument);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while updating the overallLimit' });
  }
};

exports.getOverallLimit = async (req, res) => {
  try {
    // Retrieve the first document from the collection (or a specific one)
    const firstDocument = await QuantityLimit.findOne();

    if (!firstDocument) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.status(200).json(firstDocument);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while retrieving the overallLimit' });
  }
};

// Add a new item to the 
exports.addItem = async (req, res) => {
  try {
    const { symbol, limit, lotSize, name } = req.body;

    if (!symbol || typeof limit !== 'number' || typeof lotSize !== 'number' || !name) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    // Find the document
    const document = await QuantityLimit.findOne({});

    // Check if the symbol already exists in the items array
    const itemExists = document.items.some(item => item.symbol === symbol);

    if (itemExists) {
      return res.status(400).json({ error: 'Item with this symbol already exists' });
    }

    // Add the new item to the items array
    const updatedDocument = await QuantityLimit.findOneAndUpdate(
      {},
      { $push: { items: { symbol, limit, lotSize, name } } },
      { new: true, upsert: true }
    );

    res.status(200).json(updatedDocument);
  } catch (error) {
    console.error(error); // Log error details for debugging
    res.status(500).json({ error: 'An error occurred while adding the item' });
  }
};

// Get all items from the `items` array
exports.getAllItems = async (req, res) => {
  try {
    const document = await QuantityLimit.findOne();

    if (!document || !document.items) {
      return res.status(404).json({ error: 'No items found' });
    }

    res.status(200).json(document.items);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while retrieving items' });
  }
};

// Update an item in the `items` array by symbol
exports.updateItem = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit, lotSize } = req.body;

    if (typeof limit !== 'number' || typeof lotSize !== 'number') {
      return res.status(400).json({ error: 'Invalid input' });
    }

    // Find the document and update the item
    const updatedDocument = await QuantityLimit.findOneAndUpdate(
      { "items.symbol": symbol },
      { $set: { "items.$.limit": limit, "items.$.lotSize": lotSize } },
      { new: true }
    );

    if (!updatedDocument) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.status(200).json(updatedDocument);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while updating the item' });
  }
};

// Delete an item from the `items` array by symbol
exports.deleteItem = async (req, res) => {
  try {
    const { symbol } = req.params;

    // Find the document and remove the item
    const updatedDocument = await QuantityLimit.findOneAndUpdate(
      {},
      { $pull: { items: { symbol } } },
      { new: true }
    );

    if (!updatedDocument) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.status(200).json(updatedDocument);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while deleting the item' });
  }
};
