// controllers/transactionController.js
// Aquí irá la lógica de negocio para las transacciones

// const Transaction = require('../models/Transaction');

// @desc  Obtener todas las transacciones
// @route GET /api/transactions
const getTransactions = async (req, res) => {
  try {
    // const transactions = await Transaction.find();
    res.json({ message: 'getTransactions – pendiente de implementar' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc  Crear una transacción
// @route POST /api/transactions
const createTransaction = async (req, res) => {
  try {
    // const transaction = await Transaction.create(req.body);
    res.status(201).json({ message: 'createTransaction – pendiente de implementar' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = { getTransactions, createTransaction };
