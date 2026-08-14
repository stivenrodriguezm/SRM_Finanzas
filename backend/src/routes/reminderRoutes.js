const express = require('express');
const router = express.Router();
const { getReminders, setReminder, updateReminder, markReminderPaid, deleteReminder, payReminder, getReminderPayments } = require('../controllers/reminderController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/').get(protect, getReminders).post(protect, setReminder);
router.route('/:id').put(protect, updateReminder).delete(protect, deleteReminder);
router.route('/:id/mark-paid').put(protect, markReminderPaid);
router.route('/:id/pay').post(protect, payReminder);
router.route('/:id/payments').get(protect, getReminderPayments);

module.exports = router;
