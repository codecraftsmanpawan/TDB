const mongoose = require("mongoose");

const budgetHistorySchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

const masterAdminSchema = new mongoose.Schema(
  {
    master_admin_id: {
      type: String,
      required: true,
      unique: true,
    },
    super_admin_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SuperAdmin",
      required: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    budget: {
      type: Number,
      required: true,
    },
    budgetHistory: [
      {
        type: budgetHistorySchema,
        required: true,
      },
    ],
    availableBudget: {
      type: Number,
      required: true,
    },
    allotedBudget: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      required: true,
    },
    master_code: {
      type: String,
      required: true,
      unique: true,
    },
    currentProfitLoss: {
      type: Number,
      required: true,
      default: 0,
    },
    currentbrokerage: {
      type: Number,
      required: true,
      default: 0,
    },
    mcx_brokerage_type: {
      type: String,
      required: true,
    },
    mcx_brokerage: {
      type: Number,
      required: true,
    },
    share_brokerage: {
      type: Number,
      required: true,
    },
    client_limit: {
      type: Number,
      required: false,
    },
    pattiPercentage: {
      type: Number,
      default: 0,
    },
    clients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Client",
      },
    ],
  },
  { timestamps: true }
);

// Middleware to automatically update budgetHistory and availableBudget when budget or allotedBudget is updated
masterAdminSchema.pre("save", function (next) {
  if (this.isModified("budget") || this.isModified("allotedBudget")) {
    // Calculate availableBudget as budget - allotedBudget
    this.availableBudget = this.budget - this.allotedBudget;

    // Add an entry to budgetHistory
    this.budgetHistory.push({ amount: this.budget });
  }
  next();
});

masterAdminSchema.pre("updateOne", function (next) {
  const update = this.getUpdate();
  if (
    (update.$set && update.$set.budget !== undefined) ||
    (update.$set && update.$set.allotedBudget !== undefined)
  ) {
    // Calculate the updated availableBudget
    const newBudget =
      update.$set.budget !== undefined ? update.$set.budget : this.budget;
    const newAllotedBudget =
      update.$set.allotedBudget !== undefined
        ? update.$set.allotedBudget
        : this.allotedBudget;
    const newAvailableBudget = newBudget - newAllotedBudget;

    // Apply the updates to the availableBudget and budgetHistory
    this.update(
      {},
      {
        $set: { availableBudget: newAvailableBudget },
        $push: { budgetHistory: { amount: newBudget } },
      }
    );
  }
  next();
});

module.exports = mongoose.model("MasterAdmin", masterAdminSchema);
