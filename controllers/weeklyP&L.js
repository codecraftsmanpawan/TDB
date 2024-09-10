const mongoose = require('mongoose');
const Trade = require('../models/Trade');
const Client = require('../models/client');

// Helper function to get the Monday and Sunday of the current week
function getWeekDateRange() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { start: monday, end: sunday };
}

// Function to calculate weekly P&L (Monday to Sunday) and brokerage
async function getWeeklyPnLByMasterId(masterAdminId) {
  try {
    const { start, end } = getWeekDateRange();

    // Fetch all clients under the master admin
    const clients = await Client.find({ master_admin_id: masterAdminId }).select('_id client_code username share_brokerage mcx_brokerage_type mcx_brokerage');

    if (!clients || clients.length === 0) {
      throw new Error('No clients found for the given master admin.');
    }

    const clientIds = clients.map(client => client._id);

    // Aggregate trades for those clients
    const trades = await Trade.aggregate([
      { 
        $match: { 
          userId: { $in: clientIds }, 
          date: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { 
            userId: '$userId', 
            dayOfWeek: {
              $dayOfWeek: '$date'
            }
          },
          totalPnL: {
            $sum: {
              $multiply: [
                { $subtract: ['$price', 0] }, // Assuming price is the profit/loss
                '$quantity'
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: { 
            userId: '$_id.userId'
          },
          weeklyPnL: {
            $push: {
              dayOfWeek: '$_id.dayOfWeek',
              pnl: '$totalPnL'
            }
          }
        }
      }
    ]);

    // Calculate brokerage for each client
    const clientBrokeragePromises = clients.map(async (client) => {
      const clientId = client._id;
      const nseTrades = await Trade.find({ userId: clientId, exchange: 'NSE' });
      const mcxTrades = await Trade.find({ userId: clientId, exchange: 'MCX' });

      const totalNSEAmount = nseTrades.reduce((total, trade) => total + trade.price, 0);
      const totalMCXAmount = mcxTrades.reduce((total, trade) => total + trade.price, 0);

      let brokeragePerNSECrore = 0;
      let brokeragePerMCX = 0;
      let totalSaudas = 0;

      if (totalNSEAmount >= 100) {
        brokeragePerNSECrore = (client.share_brokerage / 100) * totalNSEAmount;
      }

      if (client.mcx_brokerage_type === "per_sauda") {
        const instrumentMap = {};

        mcxTrades.forEach(trade => {
          const instrument = trade.instrumentIdentifier;
          if (!instrumentMap[instrument]) {
            instrumentMap[instrument] = { buy: 0, sell: 0 };
          }
          if (trade.tradeType === 'buy') {
            instrumentMap[instrument].buy += trade.quantity;
          } else if (trade.tradeType === 'sell') {
            instrumentMap[instrument].sell += trade.quantity;
          }
        });

        for (const instrument in instrumentMap) {
          const { buy, sell } = instrumentMap[instrument];
          totalSaudas += Math.min(buy, sell);
        }

        brokeragePerMCX = totalSaudas * client.mcx_brokerage;

      } else if (client.mcx_brokerage_type === "per_crore" && totalMCXAmount >= 100) {
        brokeragePerMCX = (client.mcx_brokerage / totalMCXAmount) * 100;
      }

      const totalAmount = totalNSEAmount + totalMCXAmount;
      const totalBrokerage = brokeragePerNSECrore + brokeragePerMCX;

      await Client.findByIdAndUpdate(clientId, { currentbrokerage: totalBrokerage.toFixed(2) });

      return {
        clientId,
        client_code: client.client_code,
        username: client.username,
        totalAmount: totalAmount.toFixed(2),
        totalBrokerage: totalBrokerage.toFixed(2),
        weeklyPnL: (trades.find(trade => trade._id === clientId) || { weeklyPnL: [] }).weeklyPnL
      };
    });

    // Wait for all brokerage calculations to finish
    const clientBrokerageResults = await Promise.all(clientBrokeragePromises);

    // Calculate total amounts and brokerage across all clients
    const allClientTotalAmount = clientBrokerageResults.reduce((total, client) => total + parseFloat(client.totalAmount), 0).toFixed(2);
    const allClientTotalBrokerage = clientBrokerageResults.reduce((total, client) => total + parseFloat(client.totalBrokerage), 0).toFixed(2);

    // Format the result as Monday to Sunday
    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const formattedResult = weekDays.map((day, index) => {
      const tradeForDay = trades.flatMap(trade => trade.weeklyPnL).find(pnl => pnl.dayOfWeek === index + 1);
      return {
        day,
        pnl: tradeForDay ? tradeForDay.pnl.toFixed(2) : '0.00' 
      };
    });

    return {
      weeklyPnL: formattedResult,
      clientData: clientBrokerageResults,
      allClientTotalAmount,
      allClientTotalBrokerage
    };

  } catch (error) {
    console.error('Error fetching weekly P&L and brokerage:', error);
    throw error;
  }
}

module.exports = { getWeeklyPnLByMasterId };
