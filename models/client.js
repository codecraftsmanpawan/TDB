const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema(
  {
    client_id: {
      type: String,
      unique: true,
      required: true,
    },
    master_admin_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MasterAdmin",
      required: true,
    },
    client_code: {
      type: String,
      required: true,
      unique: true,
    },
    budget: {
      type: Number,
      required: true,
      min: 0,
    },
    availableBudget: {
      type: Number,
      required: true,
      min: 0,
    },
    investmentAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
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
    finalMasterBrokerage: {
      type: Number,
      default: 0,
    },
    finalMasterMCXBrokerage: {
      type: Number,
      default: 0,
    },
    finalMasterNSEBrokerage: {
      type: Number,
      default: 0,
    },
    brokeragePerMCX: {
      type: Number,
      default: 0,
      min: 0,
    },
    brokeragePerNSECrore: {
      type: Number,
      default: 0,
      min: 0,
    },
    share_brokerage: {
      type: Number,
      required: true,
      min: 0,
    },
    mcx_brokerage_type: {
      type: String,
      enum: ["per_crore", "per_sauda"],
      required: true,
    },
    mcx_brokerage: {
      type: Number,
      required: true,
      min: 0,
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
    status: {
      type: String,
      required: true,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    // Total lots for MCX that can be buy/sell
    TotalMCXTrade: {
      type: Number,
      required: true,
      min: 0,
    },
    // How many lots per stock for MCX can be buy/sell
    PerMCXTrade: {
      type: Number,
      required: true,
      min: 0,
    },
    // Total lots for NSE that can be buy/sell
    TotalNSETrade: {
      type: Number,
      required: true,
      min: 0,
    },
    PerNSETrade: {
      // How many lots per stock for NSE can be buy/sell
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

// Pre-save hook to check currentProfitLoss against budget
clientSchema.pre("save", function (next) {
  if (this.currentProfitLoss < -this.availableBudget) {
    this.status = "inactive";
  }
  next();
});

// Helper function to extract currentProfitLoss from update
function getCurrentProfitLoss(update) {
  if (update.currentProfitLoss !== undefined) {
    return update.currentProfitLoss;
  }

  if (update.$set && update.$set.currentProfitLoss !== undefined) {
    return update.$set.currentProfitLoss;
  }

  return undefined;
}

// Pre-findOneAndUpdate hook to handle updates via findOneAndUpdate
clientSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate();

    // Extract the new currentProfitLoss value from the update
    const newProfitLoss = getCurrentProfitLoss(update);

    if (newProfitLoss === undefined) {
      // currentProfitLoss is not being updated
      return next();
    }

    // Fetch the current document to get the budget
    const docToUpdate = await this.model.findOne(this.getQuery());

    if (!docToUpdate) {
      // No document found, proceed without changes
      return next();
    }

    if (newProfitLoss < -docToUpdate.availableBudget) {
      // Ensure status is set to 'inactive' in the update
      if (update.$set) {
        update.$set.status = "inactive";
      } else {
        update.status = "inactive";
      }
      this.setUpdate(update);
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Optionally, handle other update methods if used (e.g., updateMany, updateOne)

const Client = mongoose.models.Client || mongoose.model("Client", clientSchema);
module.exports = Client;
