const MasterAdmin = require('../models/masterAdmin');
const Client = require('../models/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Admin login
const masterAdminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log('Login Attempt:', { username, password });

    // Find the master admin by username
    const masterAdmin = await MasterAdmin.findOne({ username });
    if (!masterAdmin) {
      console.log('Master Admin not found');
      return res.status(400).json({ success: false, message: 'Invalid username or password' });
    }

    console.log('Master Admin Found:', masterAdmin);

    // Check if the account is blocked
    if (masterAdmin.status === 'blocked') {
      console.log('Account is blocked');
      return res.status(403).json({ success: false, message: 'Connect to Super Admin for activation' });
    }

    // Compare the provided password with the stored hashed password
    const isPasswordValid = await bcrypt.compare(password, masterAdmin.password);
    if (!isPasswordValid) {
      console.log('Invalid Password');
      return res.status(400).json({ success: false, message: 'Invalid username or password' });
    }

    // Create a JWT token with the master admin's ID and a 2-day expiration
    const token = jwt.sign({ id: masterAdmin._id }, process.env.SECRET_KEY, { expiresIn: '2d' });

    return res.status(200).json({ success: true, message: 'Master admin logged in successfully', token });
  } catch (error) {
    console.error('Error in master admin login:', error);
    return res.status(500).json({ success: false, message: 'An error occurred' });
  }
};
// Function for adding a client
const addClient = async (req, res) => {
  try {
    const { clientCode, budget, status, mcxBrokerageType, mcxBrokerage, shareBrokerage, username, password } = req.body;

    // Set clientId to be the same as username
    const clientId = username;

    // Check if client code already exists
    const existingClient = await Client.findOne({ client_code: clientCode });
    if (existingClient) {
      return res.status(400).json({ success: false, message: 'Client code already exists' });
    }

    // Check if username already exists
    const existingUsername = await Client.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Get the master admin ID from the authenticated user
    const master_admin_id = req.user._id;

    // Check if master admin exists
    const masterAdmin = await MasterAdmin.findById(master_admin_id);
    if (!masterAdmin) {
      return res.status(404).json({ success: false, message: 'MasterAdmin not found' });
    }

    // Check if master admin's available budget is sufficient
    if (budget > masterAdmin.availableBudget) {
      return res.status(400).json({ success: false, message: 'Insufficient budget' });
    }

    // Check if client limit is set and if the master admin has reached the client limit
    if (masterAdmin.client_limit) {
      const clientCount = await Client.countDocuments({ master_admin_id: master_admin_id });
      if (clientCount >= masterAdmin.client_limit) {
        return res.status(400).json({ success: false, message: 'Client limit reached' });
      }
    }

    // Create a new client
    const newClient = new Client({
      client_id: clientId,  // Set clientId based on username
      master_admin_id,
      client_code: clientCode,
      budget,
      availableBudget: budget,
      status,
      mcx_brokerage_type: mcxBrokerageType,
      mcx_brokerage: mcxBrokerage,
      share_brokerage: shareBrokerage,
      username,
      password: hashedPassword,
    });

    // Save the new client to the database
    await newClient.save();

    // Deduct budget from MasterAdmin's available budget
    masterAdmin.availableBudget -= budget;
    masterAdmin.allotedBudget += budget; // Update allotedBudget with the new client's budget
    await masterAdmin.save();

    // Update MasterAdmin's clients array
    const updatedMasterAdmin = await MasterAdmin.findByIdAndUpdate(
      master_admin_id,
      { $push: { clients: newClient._id } },
      { new: true }
    );

    if (!updatedMasterAdmin) {
      return res.status(404).json({ success: false, message: 'MasterAdmin not found' });
    }

    return res.status(201).json({ success: true, message: 'Client created successfully', newClient });
  } catch (error) {
    console.error('Error in client creation:', error);
    return res.status(500).json({ success: false, message: 'An error occurred' });
  }
};



// Function for updating client
const updateClient = async (req, res) => {
  try {
    const clientId = req.params.id.trim();
    const updateData = { ...req.body };

    // Handle password update
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    // Ensure certain fields are not allowed to be updated directly
    const restrictedFields = ['client_code', 'username', 'master_admin_id'];
    restrictedFields.forEach(field => delete updateData[field]);

    // Check if any restricted fields are being modified
    if (updateData.client_code) {
      const existingClientByCode = await Client.findOne({ client_code: updateData.client_code });
      if (existingClientByCode && existingClientByCode._id.toString() !== clientId) {
        return res.status(400).json({ success: false, message: 'Client code already exists' });
      }
    }

    if (updateData.username) {
      const existingClientByUsername = await Client.findOne({ username: updateData.username });
      if (existingClientByUsername && existingClientByUsername._id.toString() !== clientId) {
        return res.status(400).json({ success: false, message: 'Username already exists' });
      }
    }

    const client = await Client.findById(clientId).populate('master_admin_id');
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    // Budget update logic
    if (updateData.budget !== undefined) {
      const masterAdmin = await MasterAdmin.findById(client.master_admin_id._id);
      if (!masterAdmin) {
        return res.status(404).json({ success: false, message: 'MasterAdmin not found' });
      }

      const budgetDifference = updateData.budget - client.budget;

      if (budgetDifference > masterAdmin.availableBudget) {
        return res.status(400).json({ success: false, message: 'Insufficient budget' });
      }

      masterAdmin.availableBudget -= budgetDifference;
      masterAdmin.allotedBudget += budgetDifference;
      await masterAdmin.save();
    }

    // Update client details
    const updatedClient = await Client.findByIdAndUpdate(clientId, updateData, { new: true });

    if (!updatedClient) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    return res.status(200).json({ success: true, message: 'Client updated successfully', updatedClient });
  } catch (error) {
    console.error('Error in updating client:', error);
    return res.status(500).json({ success: false, message: 'An error occurred', error: error.message });
  }
};


// Function for deleting client
const deleteClient = async (req, res) => {
  try {
    const clientId  = req.params.id.trim();

    const deletedClient = await Client.findByIdAndDelete(clientId);
    if (!deletedClient) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    return res.status(200).json({ success: true, message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Error in deleting client:', error);
    return res.status(500).json({ success: false, message: 'An error occurred' });
  }
};

// Function for changing master admin password
const changeMasterAdminPassword = async (req, res) => {
  try {
    const masterAdminId = req.params.id; 
    const { oldPassword, newPassword } = req.body;

    const masterAdmin = await MasterAdmin.findById(masterAdminId);
    if (!masterAdmin) {
      return res.status(404).json({ success: false, message: 'MasterAdmin not found' });
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, masterAdmin.password);
    if (!isOldPasswordValid) {
      return res.status(400).json({ success: false, message: 'Invalid old password' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    masterAdmin.password = hashedNewPassword;
    await masterAdmin.save();

    return res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error in changing password:', error);
    return res.status(500).json({ success: false, message: 'An error occurred' });
  }
};

// Function for getting client by ID
const getClientById = async (req, res) => {
  try {
    const id = req.params.id.trim();
    const client = await Client.findById(id)
      .select({
        _id: 1,
        client_id: 1,
        client_code: 1,
        budget: 1,
        availableBudget: 1,
        share_brokerage: 1,
        mcx_brokerage_type: 1,
        mcx_brokerage: 1,
        username: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1
      });

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    return res.status(200).json({ success: true, client });
  } catch (error) {
    console.error('Error fetching client:', error);
    return res.status(500).json({ success: false, message: 'An error occurred' });
  }
};


// Function for getting all clients
const getAllClients = async (req, res) => {
  try {
    const clients = await Client.find({}, '_id client_code budget availableBudget currentProfitLoss currentbrokerage share_brokerage mcx_brokerage_type mcx_brokerage username status createdAt updatedAt');
    
    if (!clients || clients.length === 0) {
      return res.status(404).json({ success: false, message: 'No clients found' });
    }

    return res.status(200).json({ success: true, clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return res.status(500).json({ success: false, message: 'An error occurred' });
  }
};
// Function for getting a master admin by ID
const getMasterAdminById = async (req, res) => {
  try {
    // Extract the ID from the request parameters
    const masterAdminId = req.params.id;

    // Fetch the MasterAdmin document by ID
    const masterAdmin = await MasterAdmin.findById(masterAdminId)
      .populate('super_admin_id', 'username')  // Populate related data
      .select('-password'); // Exclude sensitive fields like password from the response

    if (!masterAdmin) {
      return res.status(404).json({ success: false, message: 'MasterAdmin not found' });
    }

    // Manually remove the super_admin_id from the populated data
    const response = masterAdmin.toObject();
    delete response.super_admin_id; // Remove the populated field from the response

    return res.status(200).json({ success: true, masterAdmin: response });
  } catch (error) {
    console.error('Error fetching master admin by ID:', error);
    return res.status(500).json({ success: false, message: 'An error occurred' });
  }
};

const getAllClientsByMasterId = async (req, res) => {
  try {
    const { masterId } = req.params;  // Extract masterAdminId from route parameters

    if (!masterId) {
      return res.status(400).json({ success: false, message: 'Master Admin ID is required' });
    }

    // Find clients associated with the given masterAdminId
    const clients = await Client.find({ master_admin_id: masterId }, 
      '_id client_code budget availableBudget currentProfitLoss currentbrokerage share_brokerage mcx_brokerage_type mcx_brokerage username status createdAt updatedAt'
    );

    if (!clients || clients.length === 0) {
      return res.status(404).json({ success: false, message: 'No clients found' });
    }

    return res.status(200).json({ success: true, clients });
  } catch (error) {
    console.error('Error fetching clients by Master Admin ID:', error);
    return res.status(500).json({ success: false, message: 'An error occurred while fetching clients' });
  }
};

module.exports = {
  masterAdminLogin,
  addClient,
  getAllClients,
  updateClient,
  deleteClient,
  getClientById,
  changeMasterAdminPassword,
  getMasterAdminById,
  getAllClientsByMasterId
};
