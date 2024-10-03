const Wishlist = require('../models/wishlist');

// Controller to get wishlist data by userId
exports.getWishlistByUserId = async (req, res) => {
  const { userId } = req.params;

  try {
    const wishlist = await Wishlist.findOne({ user: userId }).populate('user');

    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    res.status(200).json(wishlist);
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// Controller to update wishlist order by userId
exports.updateWishlistOrder = async (req, res) => {
  const { userId } = req.params;
  const { newOrder } = req.body; 

  if (!newOrder || !Array.isArray(newOrder)) {
    return res.status(400).json({ message: 'Invalid order data' });
  }

  try {
    const wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    // Reorder wishlist items using the method defined in the model
    await wishlist.reorderItems(newOrder);

    res.status(200).json({ message: 'Wishlist order updated successfully' });
  } catch (error) {
    console.error('Error updating wishlist order:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
