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

module.exports = router;
