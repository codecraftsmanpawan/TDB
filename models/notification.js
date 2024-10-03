const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    created_at: {
        type: Date,
        default: Date.now,
    },
    expiresAt: {
        type: Date,
        required: true,
    },
});

// Automatically set expiresAt when creating a notification
notificationSchema.pre('save', function(next) {
    // Set the expiration date to 24 hours from now
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); 
    next();
});

// Optional: Index the expiresAt field to automatically delete documents after the specified date
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', notificationSchema);
