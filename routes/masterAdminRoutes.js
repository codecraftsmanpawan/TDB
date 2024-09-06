const express=require('express');
const { addClient, masterAdminLogin, updateClient, deleteClient, changeMasterAdminPassword,  getAllClients, getClientById,getMasterAdminById } = require('../controllers/masterAdminController');
const checkLogin = require('../middleware/checkLogin');
const router=express.Router();
router.post('/masterAdminLogin',  masterAdminLogin)
router.get('/masteradmin/:id', getMasterAdminById);
router.post('/add-client', checkLogin, addClient);
router.put('/update-client/:id' , checkLogin, updateClient);
router.delete('/delete-client/:id',   checkLogin, deleteClient);
router.put('/change-Password/:id',checkLogin, changeMasterAdminPassword)
router.get('/getAllClients',checkLogin,getAllClients)
router.get('/getClient/:id',checkLogin, getClientById)


module.exports=router