const express = require('express');
const router = express.Router();
const { getAccounts, setAccount, updateAccount, deleteAccount } = require('../controllers/accountController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/').get(protect, getAccounts).post(protect, setAccount);
router.route('/:id').put(protect, updateAccount).delete(protect, deleteAccount);

module.exports = router;
