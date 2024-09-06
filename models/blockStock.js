const mongoose = require("mongoose");

const blockStockSchema = new mongoose.Schema(
  {
        symbol: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        exchange: {
          type: String,
          required: true,
        },
      
    
  },
  { timestamps: true }
);

module.exports = mongoose.model("blockStock", blockStockSchema);