const express = require('express');
const {
  superAdminLogin,
  addMasterAdmin,
  updateMasterAdmin,
  deleteMasterAdmin,
  getSuperAdminWithMasterAdmins,
  getAllMasterAdminsWithClients,
  getMasterAdminWithClients,
  getAllClients,
  updateClientStatus,
  getClientById
} = require('../controllers/superAdminController');
const {
  getDataController,
  addBlockStock,
  deleteBlockStock,
  getBlockStocks,
} = require('../controllers/stocksController'); 
const checkLogin = require('../middleware/checkLogin');
const { updateOverallLimit, getOverallLimit, addItem, getAllItems, updateItem, deleteItem } = require('../controllers/quantityLimitController'); 
const router = express.Router();


const notificationController = require('../controllers/notificationController');


// Public route
router.post('/superAdminLogin', superAdminLogin);

// Protected routes with authentication middleware
router.post('/add-masterAdmin', checkLogin, addMasterAdmin);
router.put('/update-masterAdmin/:id', checkLogin, updateMasterAdmin);
router.delete('/delete-masterAdmin/:id', checkLogin, deleteMasterAdmin);
router.get('/getSuperAdmin', checkLogin, getSuperAdminWithMasterAdmins);
router.get('/getMasterAdmin/:id', checkLogin, getMasterAdminWithClients);
router.get('/getAllMasterAdmin', checkLogin, getAllMasterAdminsWithClients);
router.get('/getAllClients', checkLogin, getAllClients);
router.get('/getClientById/:id', checkLogin, getClientById);
router.put('/clients/:clientId/status', checkLogin, updateClientStatus); 

// Routes for block stock management
router.get('/api/stocks', checkLogin, getDataController);
router.post('/api/blockStock', checkLogin, addBlockStock); 
router.delete('/api/blockStock/:symbol', checkLogin, deleteBlockStock); 
router.get('/api/blockStocks', checkLogin, getBlockStocks);

// Routes for overall limit management
router.put('/overall-limit', checkLogin, updateOverallLimit);
router.get('/overall-limit', checkLogin, getOverallLimit);
router.post('/items', checkLogin, addItem);
router.get('/items', checkLogin, getAllItems);
router.put('/items/:symbol', checkLogin, updateItem);
router.delete('/items/:symbol', checkLogin, deleteItem);

// Route to create a new notification
router.post('/notifications', notificationController.createNotification);

// Route to get all notifications
router.get('/notifications', notificationController.getAllNotifications);

// Route to get a single notification by ID
router.get('/notifications/:id', notificationController.getNotificationById);

// Route to update a notification by ID
router.put('/notifications/:id', notificationController.updateNotification);

// Route to delete a notification by ID
router.delete('/notifications/:id', notificationController.deleteNotification);

module.exports = router;
