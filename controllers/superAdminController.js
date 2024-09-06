const MasterAdmin = require('../models/masterAdmin');
const SuperAdmin = require('../models/superAdmin');
const Client = require('../models/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Generate master admin ID based on username
const generateId = (username) => {
  return username;
};

// Super Admin Login
const superAdminLogin = async (req, res) => {
  try {
    const { super_admin_id, password } = req.body;

    const superAdmin = await SuperAdmin.findOne({ super_admin_id });
    if (!superAdmin) {
      return res.status(401).json({ success: false, message: 'Invalid ID or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, superAdmin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid ID or password' });
    }

    const token = jwt.sign({ id: superAdmin._id }, process.env.SECRET_KEY, { expiresIn: '2d' });

    return res.json({ success: true, message: 'Super admin logged in successfully', token });
  } catch (error) {
    console.error('Error in super admin login:', error);
    return res.status(500).json({ success: false, message: 'An error occurred' });
  }
};

// Add Master Admin
const addMasterAdmin = async (req, res) => {
  try {
    const {
      username, password, budget, status, master_code, mcx_brokerage_type,
      mcx_brokerage, client_limit, share_brokerage
    } = req.body;

    // Check if username or master admin code already exists
    const existingMasterAdmin = await MasterAdmin.findOne({ $or: [{ username }, { master_code }] });
    if (existingMasterAdmin) {
      return res.status(400).json({ success: false, message: 'Username or MasterAdmin code already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const masterAdminId = generateId(username);
    const super_admin_id = req.user._id;

    // Find the super admin
    const superAdmin = await SuperAdmin.findById(super_admin_id);
    if (!superAdmin) {
      return res.status(404).json({ success: false, message: 'SuperAdmin not found' });
    }

    // Create a new master admin
    const newMasterAdmin = new MasterAdmin({
      master_admin_id: masterAdminId, // Use username as the master_admin_id
      super_admin_id,
      username,
      password: hashedPassword,
      budget,
      availableBudget: budget, // Initialize availableBudget with the budget value
      allotedBudget: 0, // Initialize allotedBudget to 0
      status,
      master_code,
      mcx_brokerage_type,
      mcx_brokerage,
      client_limit,
      share_brokerage
    });

    // Save the new master admin to the database
    await newMasterAdmin.save();

    // Update SuperAdmin's master_admins array
    superAdmin.master_admins.push(newMasterAdmin._id);
    await superAdmin.save();

    return res.status(201).json({ success: true, message: 'Master admin created successfully', newMasterAdmin });
  } catch (error) {
    console.error('Error in master admin creation:', error);
    return res.status(500).json({ success: false, message: 'An error occurred' });
  }
};

// Update Master Admin
const updateMasterAdmin = async (req, res) => {
  try {
    const id = req.params.id;
    const {
      budget,
      mcx_brokerage_type,
      mcx_brokerage,
      share_brokerage,
      client_limit,
      status 
    } = req.body;

    // Find the MasterAdmin
    const masterAdmin = await MasterAdmin.findById(id);
    if (!masterAdmin) {
      return res.status(404).json({ success: false, message: 'MasterAdmin not found' });
    }

    // Update the specified fields
    if (budget !== undefined) {
      masterAdmin.budget = budget;
      masterAdmin.availableBudget = budget - masterAdmin.allotedBudget;
    }

    if (mcx_brokerage_type !== undefined) masterAdmin.mcx_brokerage_type = mcx_brokerage_type;
    if (mcx_brokerage !== undefined) masterAdmin.mcx_brokerage = mcx_brokerage;
    if (share_brokerage !== undefined) masterAdmin.share_brokerage = share_brokerage;
    if (client_limit !== undefined) masterAdmin.client_limit = client_limit;
    if (status !== undefined) masterAdmin.status = status; // Update status if provided

    // Save the updated MasterAdmin
    const updatedMasterAdmin = await masterAdmin.save();

    // Remove sensitive fields before sending the response
    const responseMasterAdmin = updatedMasterAdmin.toObject();
    delete responseMasterAdmin.password;
    delete responseMasterAdmin.super_admin_id;

    return res.status(200).json({
      success: true,
      message: 'MasterAdmin updated successfully',
      updatedMasterAdmin: responseMasterAdmin
    });
  } catch (error) {
    console.error('Error in updating MasterAdmin:', error);
    return res.status(500).json({ success: false, message: 'An error occurred', error: error.message });
  }
};


// Delete MasterAdmin
const deleteMasterAdmin = async (req, res) => {
  try {
    const id = req.params.id;

    const deletedMasterAdmin = await MasterAdmin.findByIdAndDelete(id);
    if (!deletedMasterAdmin) {
      return res.status(404).json({ success: false, message: 'MasterAdmin not found' });
    }

    // Remove MasterAdmin reference from SuperAdmin
    const superAdmin = await SuperAdmin.findById(deletedMasterAdmin.super_admin_id);
    if (superAdmin) {
      superAdmin.master_admins.pull(deletedMasterAdmin._id);
      await superAdmin.save();
    }

    return res.status(200).json({ success: true, message: 'MasterAdmin deleted successfully' });
  } catch (error) {
    console.error('Error in deleting MasterAdmin:', error);
    return res.status(500).json({ success: false, message: 'An error occurred' });
  }
};

// Get Super Admin with Master Admins
const getSuperAdminWithMasterAdmins = async (req, res) => {
  try {
    // Check if the user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Fetch SuperAdmin and populate the master_admins field
    const superAdmin = await SuperAdmin.findById(req.user._id)
      .populate({
        path: 'master_admins',
        select: 'master_admin_id username status budget availableBudget allotedBudget master_code mcx_brokerage_type mcx_brokerage share_brokerage client_limit createdAt clients', // Include createdAt and clients for counting
        options: { lean: true }
      });

    if (!superAdmin) {
      return res.status(404).json({ success: false, message: 'SuperAdmin not found' });
    }

    // Calculate total client count
    const totalClients = superAdmin.master_admins.reduce((total, masterAdmin) => total + masterAdmin.clients.length, 0);

    // Remove sensitive fields from the response
    const sanitizedSuperAdmin = {
      _id: superAdmin._id,
      super_admin_id: superAdmin.super_admin_id,
      username: superAdmin.username,
      totalClients, // Include total clients count
      master_admins: superAdmin.master_admins.map(masterAdmin => ({
        _id: masterAdmin._id,
        master_admin_id: masterAdmin.master_admin_id,
        username: masterAdmin.username,
        budget: masterAdmin.budget,
        availableBudget: masterAdmin.availableBudget,
        allotedBudget: masterAdmin.allotedBudget,
        status: masterAdmin.status,
        master_code: masterAdmin.master_code,
        mcx_brokerage_type: masterAdmin.mcx_brokerage_type,
        mcx_brokerage: masterAdmin.mcx_brokerage,
        share_brokerage: masterAdmin.share_brokerage,
        client_limit: masterAdmin.client_limit,
        createdAt: masterAdmin.createdAt,
        totalClients: masterAdmin.clients.length 
      }))
    };

    // Return the sanitized SuperAdmin document
    return res.status(200).json({ success: true, superAdmin: sanitizedSuperAdmin });
  } catch (error) {
    console.error('Error fetching SuperAdmin with MasterAdmins:', error);
    return res.status(500).json({ success: false, message: 'An error occurred while fetching SuperAdmin', error: error.message });
  }
};


// Get Master Admin with Clients
const getMasterAdminWithClients = async (req, res) => {
  try {
    const id = req.params.id;

    const masterAdmin = await MasterAdmin.findById(id).populate('clients');
    if (!masterAdmin) {
      return res.status(404).json({ success: false, message: 'MasterAdmin not found' });
    }

    return res.status(200).json({ success: true, masterAdmin });
  } catch (error) {
    console.error('Error fetching MasterAdmin with clients:', error);
    return res.status(500).json({ success: false, message: 'An error occurred' });
  }
};

// Get All Master Admins with Clients
const getAllMasterAdminsWithClients = async (req, res) => {
  try {
    const masterAdmins = await MasterAdmin.find().populate('clients');
    if (masterAdmins.length === 0) {
      return res.status(404).json({ success: false, message: 'No MasterAdmins found' });
    }

    return res.status(200).json({ success: true, masterAdmins });
  } catch (error) {
    console.error('Error fetching MasterAdmins with clients:', error);
    return res.status(500).json({ success: false, message: 'An error occurred' });
  }
};

// Controller file (superAdminController.js)
const getAllClients = async (req, res) => {
  try {
    // Fetch all clients with only the specified fields
    const clients = await Client.find()
      .select('username status updatedAt __v'); // Specify fields to include

    return res.status(200).json({ success: true, clients });
  } catch (error) {
    console.error('Error fetching all clients:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching all clients',
      error: error.message
    });
  }
};

const updateClientStatus = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { status } = req.body;

    // Validate the status
    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status provided'
      });
    }

    // Find the client and update the status
    const client = await Client.findByIdAndUpdate(
      clientId,
      { status },
      { new: true, runValidators: true } 
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    return res.status(200).json({
      success: true,
      status: 'update successfully'
    });
  } catch (error) {
    console.error('Error updating client status:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while updating client status',
      error: error.message
    });
  }
};

const getClientById = async (req, res) => {
  try {
    // Extract client ID from the request parameters
    const clientId = req.params.id;

    // Validate the client ID format
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client ID format'
      });
    }

    // Fetch the client by ID with the specified fields
    const client = await Client.findById(clientId)
      .select('client_id master_admin_id client_code budget availableBudget share_brokerage mcx_brokerage_type mcx_brokerage username status updatedAt __v'); // Specify fields to include

    // If the client is not found, return a 404 error
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Return the client data if found
    return res.status(200).json({
      success: true,
      client
    });
  } catch (error) {
    console.error('Error fetching client by ID:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching the client',
      error: error.message
    });
  }
};


module.exports = {
  superAdminLogin,
  addMasterAdmin,
  updateMasterAdmin,
  deleteMasterAdmin,
  getMasterAdminWithClients,
  getAllMasterAdminsWithClients,
  getSuperAdminWithMasterAdmins,
  getAllClients,
  updateClientStatus,
  getClientById
};
