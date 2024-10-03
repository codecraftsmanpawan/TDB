const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const notificationController = require('../controllers/notificationController');
const { getAllBlockStocks } = require('../controllers/blockStockController');

// Route to get wishlist data by userId
router.get('/wishlist/:userId', wishlistController.getWishlistByUserId);

// Route to update the wishlist order by userId
router.post('/wishlist/:userId/reorder', wishlistController.updateWishlistOrder);

// Route to get all notifications
router.get('/notifications', notificationController.getAllNotifications);

// Route to get all block stocks
router.get('/blockstocks', getAllBlockStocks);

module.exports = router;
