const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
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
}, { timestamps: true });

// Check if the model is already compiled before defining it
const Client = mongoose.models.Client || mongoose.model("Client", clientSchema);
module.exports = Client;
