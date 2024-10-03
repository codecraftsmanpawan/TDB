const express = require('express');
require('./models/mongooseconn'); 
const SuperAdminRoutes = require('./routes/SuperAdminRoutes');
const MasterAdminRoutes = require('./routes/masterAdminRoutes');
const ClientRoutes = require('./routes/ClientRoutes');
const pnlRoutes = require('./routes/PnlRoutes'); 
const Wishlist = require('./routes/wishlistRoutes');
const dotenv = require('dotenv');
const cors = require('cors');
const { startCronJobs } = require('./cronJobs');
// Import and start the polling
const { startBidPolling } = require('./pollingJob'); 

const app = express();
dotenv.config();

app.use(express.json());
app.use(cors());

// Setup routes
app.use('/api/var/superAdmin', SuperAdminRoutes);
app.use('/api/var/masterAdmin', MasterAdminRoutes);
app.use('/api/var/client', ClientRoutes);
app.use('/api/var/pnl', pnlRoutes);
app.use('/api/var/Wishlist', Wishlist);

const port = process.env.PORT || 5000; 

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    // Start the polling after the server starts
    startBidPolling(1000);
    startCronJobs(); 
});
