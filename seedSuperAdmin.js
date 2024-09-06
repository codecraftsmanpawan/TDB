const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const SuperAdmin = require('./models/superAdmin');
const dotenv = require('dotenv');

dotenv.config();

const seedSuperAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL)
        .then(() => {
            console.log('Connected to the database');
        })
        .catch((err) => {
            console.error('Database connection error:', err);
        });

        const existingSuperAdmin = await SuperAdmin.findOne({ username: 'SuperAdmin' });
        if (!existingSuperAdmin) {
            const hashedPassword = await bcrypt.hash('superadmin123', 10);
            const superAdmin = new SuperAdmin({
                super_admin_id: 'superadmin123', 
                username: 'SuperAdmin',
                password: hashedPassword
            });
            await superAdmin.save();
            console.log('SuperAdmin seeded successfully');
        } else {
            console.log('SuperAdmin already exists');
        }
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error seeding SuperAdmin:', error);
    }
};

seedSuperAdmin();
