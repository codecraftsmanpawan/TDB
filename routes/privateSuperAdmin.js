const express = require("express");
const {
  privateAdminLogin,
  verifyPrivateAdminOTP,
  getAllClients,
  getClientById,
  getTrades,
  getStockByInstrumentIdentifier,
  getTradesBrokerageByClientId,
  deleteTrade,
  searchStocksByInstrumentIdentifier,
  addTrade,
} = require("../controllers/PrivateSuperAdminController");
const privateSuperAdminAuth = require("../middleware/PrivateSuperAdminAuth");

const router = express.Router();

// Route to send OTP (login)
router.post("/login", privateAdminLogin);

// Route to verify OTP and login
router.post("/verify-otp", verifyPrivateAdminOTP);

// Example protected route for Private Super Admins
router.get("/protected", privateSuperAdminAuth, (req, res) => {
  res
    .status(200)
    .json({ message: "Welcome to the protected Private Super Admin route" });
});

router.get("/clients", privateSuperAdminAuth, getAllClients);

router.get("/getClientById/:id", privateSuperAdminAuth, getClientById);

// Route to get all trades for a specific client
router.get("/trades/:clientId", privateSuperAdminAuth, getTrades);

// Ensure the user is authenticated with checkLogin middleware
router.get(
  "/stocks/:instrumentIdentifier",
  privateSuperAdminAuth,
  getStockByInstrumentIdentifier
);

// Route to get trades and brokerage details by client ID
router.get(
  "/trades/brokerage/:clientId",
  privateSuperAdminAuth,
  getTradesBrokerageByClientId
);

// Route to delete a trade
router.delete("/trades/:tradeId", privateSuperAdminAuth, deleteTrade);
// Ensure the user is authenticated with checkLogin middleware
router.get(
  "/stocks/searchByInstrumentIdentifier",
  privateSuperAdminAuth,
  searchStocksByInstrumentIdentifier
);
// Route to create a new trade
router.post("/trades", privateSuperAdminAuth, addTrade);

module.exports = router;
