const express = require('express');
const router = express.Router();
const { getWeeklyPnLByMasterId } = require('../controllers/weeklyP&L'); 
const checkLogin = require('../middleware/checkLogin');
// Route to get weekly P&L by masterAdminId
router.get('/master-admin/:masterAdminId/weekly-pnl', async (req, res) => {
  try {
    const masterAdminId = req.params.masterAdminId;
    const pnlData = await getWeeklyPnLByMasterId(masterAdminId);

    res.status(200).json({
      success: true,
      data: pnlData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'No Client Found weekly P&L',
      error: error.message
    });
  }
});

module.exports = router;
