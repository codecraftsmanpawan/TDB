const mongoose = require("mongoose");
const Client = require("./client");

const tradeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
    required: true,
  },
  stockId: {
    type: String,
    ref: "Stock",
    required: true,
  },
  instrumentIdentifier: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  exchange: {
    type: String,
    required: true,
    enum: ["MCX", "NSE"],
  },
  tradeType: {
    type: String,
    enum: ["buy", "sell"],
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, "Quantity must be at least 1"],
  },
  tradePercentage: {
    type: Number,
    required: false,
  },
  price: {
    type: Number,
    required: true,
    min: [0, "Price must be positive"],
  },
  status: {
    type: String,
    enum: ["open", "closed", "canceled"],
    default: "open",
  },
  action: {
    type: String,
    enum: ["buy", "sell"],
    required: true,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
  },
});

// Pre-save hook to set the 'action' field based on 'tradeType' and update 'updatedAt'
tradeSchema.pre("save", async function (next) {
  // Set 'action' based on 'tradeType'
  this.action = this.tradeType === "buy" ? "sell" : "buy";

  // Update 'updatedAt' timestamp
  this.updatedAt = Date.now();

  try {
    // Fetch existing open trades for this user and exchange
    const existingTrades = await Trade.find({
      userId: this.userId,
      exchange: this.exchange,
      status: "open",
    });

    // Calculate the total trade percentage
    const totalTradePercentage =
      existingTrades.reduce((sum, trade) => {
        return sum + (trade.tradePercentage || 0);
      }, 0) + (this.tradePercentage || 0);

    // Fetch the client to check total trade limits
    const client = await Client.findById(this.userId);
    if (!client) {
      return next("Client not found.");
    }

    // Validate against client limits (multiply by 100)
    if (
      this.exchange === "MCX" &&
      totalTradePercentage > client.TotalMCXTrade * 100
    ) {
      // console.log("Trade percentage limit exceeded for MCX.");
      return next("Trade percentage limit exceeded.");
    } else if (
      this.exchange === "NSE" &&
      totalTradePercentage > client.TotalNSETrade * 100
    ) {
      // console.log("Trade percentage limit exceeded for NSE.");
      return next(new Error("Trade percentage limit exceeded."));
    }

    next();
  } catch (error) {
    next(error);
  }
});

const Trade = mongoose.model("Trade", tradeSchema);
module.exports = Trade;
