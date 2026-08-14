const express = require('express');
const router = express.Router();
const { getTransactions, setTransaction, deleteTransaction } = require('../controllers/transactionController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/').get(protect, getTransactions).post(protect, setTransaction);
router.route('/:id').delete(protect, deleteTransaction);

module.exports = router;
