const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Debt = require('./src/models/Debt');

dotenv.config();

async function testEndpointLocally() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // Create a fake req object
  const req = {
    user: { id: '60d0fe4f5311236168a109ca' }, // fake valid object id
    body: {
      name: 'Préstamo a Juan',
      totalAmount: 100000,
      type: 'me_deben',
      dueDate: null,
      description: 'Prueba',
      color: '#10B981',
      icon: 'person'
    }
  };

  try {
    const { name, totalAmount, type, dueDate, color, icon, isActive, description } = req.body;
    
    if (!name || !totalAmount || !type) {
      throw new Error('Validacion falló');
    }

    const debtData = {
      user: req.user.id,
      name,
      totalAmount,
      remainingAmount: totalAmount,
      type,
      color,
      icon,
      isActive: isActive !== undefined ? isActive : true,
      description: description || '',
    };
    
    if (dueDate) {
      debtData.dueDate = dueDate;
    }

    const debt = await Debt.create(debtData);
    console.log('DEUDA CREADA CON EXITO:', debt);
  } catch (err) {
    console.error('ERROR EN CONTROLADOR:', err.message);
  } finally {
    mongoose.disconnect();
  }
}

testEndpointLocally();
