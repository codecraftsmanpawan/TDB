const mongoose = require('mongoose');

const quantityLimitSchema = new mongoose.Schema(
  {
    overallLimit: {
      type: Number,
      default: 0, 
    },
    items: [
      {
        symbol: {
          type: String,
          required: true,
        },
         name: {
          type: String,
          required: true,
        },
        limit: {
          type: Number,
          required: true,
        },
        lotSize: {
          type: Number,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('quantityLimit', quantityLimitSchema);
