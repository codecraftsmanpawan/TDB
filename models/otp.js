const mongoose = require("mongoose");

// Define the schema for OTP
const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  otpExpires: {
    type: Date,
    required: true,
  },
  used: {
    type: Boolean,
    default: false,
  },
});

// Create a static method on the schema to clean up expired OTPs
otpSchema.statics.cleanExpiredOTPs = async function () {
  try {
    const result = await this.deleteMany({ otpExpires: { $lt: Date.now() } });
    if (result.deletedCount > 0) {
      // console.log(`Cleaned up ${result.deletedCount} expired OTP(s).`);
    }
  } catch (error) {
    console.error("Error cleaning up expired OTPs:", error);
  }
};

// Schedule the cleanup task to run every minute
const runCleanupTask = () => {
  setInterval(async () => {
    await OTP.cleanExpiredOTPs();
  }, 60 * 1000); // Run every 1 minute
};

// Initialize the cleanup task
runCleanupTask();

// Create the OTP model
const OTP = mongoose.model("OTP", otpSchema);

module.exports = OTP;
