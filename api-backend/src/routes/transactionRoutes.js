const express = require('express');
const router  = express.Router();

// const { getTransactions, createTransaction } = require('../controllers/transactionController');

// GET    /api/transactions
router.get('/',  (req, res) => res.json({ message: 'GET /api/transactions – pendiente' }));

// POST   /api/transactions
router.post('/', (req, res) => res.json({ message: 'POST /api/transactions – pendiente' }));

// GET    /api/transactions/:id
router.get('/:id', (req, res) => res.json({ message: `GET /api/transactions/${req.params.id} – pendiente` }));

// PUT    /api/transactions/:id
router.put('/:id', (req, res) => res.json({ message: `PUT /api/transactions/${req.params.id} – pendiente` }));

// DELETE /api/transactions/:id
router.delete('/:id', (req, res) => res.json({ message: `DELETE /api/transactions/${req.params.id} – pendiente` }));

module.exports = router;
