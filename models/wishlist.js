const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    items: [
      {
        product: {
          type: String,
          required: true,
        },
        exchange: {
          type: String,
          enum: ["MCX", "NSE"],
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
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Wishlist", wishlistSchema);
