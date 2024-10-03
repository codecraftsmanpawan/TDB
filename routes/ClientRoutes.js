const express = require('express');
const { 
  clientLogin, 
  getAvailableBudget,
  changeClientPassword, 
  searchStocksByName, 
  addItemToWishlist, 
  removeItemFromWishlist, 
  getWishlist,
  getStockByInstrumentIdentifier,
  getClientDetails, currentProfitLoss, getClientStatus
} = require('../controllers/clientController');
const checkLogin = require('../middleware/checkLogin');
const { addTrade, getTrades, deleteTrade, getTradesByInstrumentIdentifier, getTradesForChart, calculateNetQuantityByUser, calculateMCXTradesByUser, getAllTradesByInstrumentIdentifier, getClientStockHistory, getTradesBrokerageByClientId } = require('../controllers/tradeController');
const { addBid, getBidsByUserId,updateBid, deleteBidById } = require('../controllers/bidController');
const { addStoploss, getStoploss, updateStoploss, deleteStoploss } = require('../controllers/stopLossController');

const router = express.Router();

// Route for client login
router.post('/clientLogin', clientLogin);

// Define route for getting client details by client_id
router.get('/:client_id',checkLogin, getClientDetails);

// Setup the PATCH route to handle profit/loss updates
router.patch('/updateProfitLoss/:userId',checkLogin, currentProfitLoss);

// Route to get availableBudget for a specific client by client ID
router.get('/clients/:id/availableBudget',checkLogin, getAvailableBudget);

// Ensure the user is authenticated with checkLogin middleware
router.put('/change-password', checkLogin, changeClientPassword);

// Ensure the user is authenticated with checkLogin middleware
router.get('/stocks/search', checkLogin, searchStocksByName);

// Ensure the user is authenticated with checkLogin middleware
router.post('/wishlist/add', checkLogin, addItemToWishlist);

// Ensure the user is authenticated with checkLogin middleware
router.delete('/wishlist/remove/:userId/:itemId', checkLogin, removeItemFromWishlist);

// Ensure the user is authenticated with checkLogin middleware
router.get('/wishlist/:userId', checkLogin, getWishlist);

// Ensure the user is authenticated with checkLogin middleware
router.get('/stocks/:instrumentIdentifier', checkLogin, getStockByInstrumentIdentifier);

// Route to create a new trade
router.post('/trades',checkLogin, addTrade);

// Route to get all trades for a specific client
router.get('/trades/:clientId',checkLogin, getTrades);

// Route to get all trades by instrumentIdentifier
router.get('/trades/details/:instrumentIdentifier',checkLogin, getTradesByInstrumentIdentifier);

// Route to calculate net quantity for an instrumentIdentifier by user
router.get('/trades/net-quantity/:userId',checkLogin, calculateNetQuantityByUser);

// Route for calculating MCX trades by userId
router.get('/trades/mcx/:userId',checkLogin, calculateMCXTradesByUser);

// Route to get trades for chart
router.get('/trades/chart/:userId', getTradesForChart);

// Route to delete a trade
router.delete('/trades/:tradeId',checkLogin, deleteTrade);

// POST route for creating or updating a bid
router.post('/add/bid',checkLogin, addBid);

// Route for getting bids by user ID
router.get('/bids/:userId',checkLogin, getBidsByUserId);

// Update bid route
router.put('/bids/:id',checkLogin, updateBid);

// Route to delete a bid by ID
router.delete('/bids/:id',checkLogin, deleteBidById);

// Route to add a new stop-loss order
router.post('/add/stoploss',checkLogin, addStoploss);

// Route to get stop-loss records
router.get('/stoploss/:userId',checkLogin, getStoploss);

// Update Stoploss
router.put('/stoploss/:id', updateStoploss);

// Delete Stoploss
router.delete('/stoploss/:id', deleteStoploss);

// Define the route for fetching trades by instrumentIdentifier
router.get('/instrument/:instrumentIdentifier/trades',checkLogin, getAllTradesByInstrumentIdentifier);

// Define the route for getting all stock trades for a client
router.get('/getClientStockHistory/:userId',checkLogin, getClientStockHistory);

// Route to get trades and brokerage details by client ID
router.get('/trades/client/brokerage/:clientId',checkLogin, getTradesBrokerageByClientId);

// Define the route to get the client status
router.get('/:id/status', getClientStatus);


module.exports = router;
