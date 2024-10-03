// controllers/notificationController.js
const Notification = require('../models/notification');
// Create a new notification
exports.createNotification = async (req, res) => {
    try {
        const { title, message } = req.body;
        const notification = new Notification({ title, message });
        await notification.save();
        res.status(201).json({ message: 'Notification created successfully', notification });
    } catch (error) {
        res.status(500).json({ message: 'Error creating notification', error });
    }
};

// Get all notifications
exports.getAllNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find();
        res.status(200).json(notifications);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching notifications', error });
    }
};

// Get a single notification by ID
exports.getNotificationById = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        res.status(200).json(notification);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching notification', error });
    }
};

// Update a notification by ID
exports.updateNotification = async (req, res) => {
    try {
        const { title, message } = req.body;
        const notification = await Notification.findByIdAndUpdate(req.params.id, { title, message }, { new: true });
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        res.status(200).json({ message: 'Notification updated successfully', notification });
    } catch (error) {
        res.status(500).json({ message: 'Error updating notification', error });
    }
};

// Delete a notification by ID
exports.deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findByIdAndDelete(req.params.id);
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        res.status(200).json({ message: 'Notification deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting notification', error });
    }
};