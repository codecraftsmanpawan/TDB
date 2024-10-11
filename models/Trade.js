const mongoose = require("mongoose");

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
tradeSchema.pre("save", function (next) {
  // Set 'action' based on 'tradeType'
  this.action = this.tradeType === "buy" ? "sell" : "buy";

  // Update 'updatedAt' timestamp
  this.updatedAt = Date.now();

  next();
});

const Trade = mongoose.model("Trade", tradeSchema);
module.exports = Trade;
