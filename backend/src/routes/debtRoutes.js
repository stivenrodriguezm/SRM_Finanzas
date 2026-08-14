const express = require('express');
const router = express.Router();
const { getDebts, getDebtById, getDebtTransactions, setDebt, updateDebt, deleteDebt, addPayment } = require('../controllers/debtController');
const { protect } = require('../middlewares/authMiddleware');

// Rutas generales
router.route('/').get(protect, getDebts).post(protect, setDebt);

// Rutas específicas ANTES de /:id para evitar conflictos de Express
router.route('/:id/payment').post(protect, addPayment);
router.route('/:id/transactions').get(protect, getDebtTransactions);

// CRUD por ID
router.route('/:id').get(protect, getDebtById).put(protect, updateDebt).delete(protect, deleteDebt);

module.exports = router;
