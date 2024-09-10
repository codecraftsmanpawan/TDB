const express = require('express');
require('./models/mongooseconn'); // Import mongoose connection
const SuperAdminRoutes = require('./routes/SuperAdminRoutes');
const MasterAdminRoutes = require('./routes/masterAdminRoutes');
const ClientRoutes = require('./routes/ClientRoutes');
const pnlRoutes = require('./routes/PnlRoutes'); 
const dotenv = require('dotenv');
const cors = require('cors');

// Import and start the polling
const startPolling = require('./pollingJob');

const app = express();
dotenv.config();

app.use(express.json());
app.use(cors());

// Setup routes
app.use('/api/var/superAdmin', SuperAdminRoutes);
app.use('/api/var/masterAdmin', MasterAdminRoutes);
app.use('/api/var/client', ClientRoutes);
app.use('/api/var/pnl', pnlRoutes);

const port = process.env.PORT || 5000; 

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    // Start the polling after the server starts
    startPolling();
});
