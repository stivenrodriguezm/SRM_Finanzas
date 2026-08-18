import express from 'express';
import {
  getReminders,
  getReminderById,
  setReminder,
  updateReminder,
  markReminderPaid,
  deleteReminder,
  payReminder,
  getReminderPayments,
} from '../controllers/reminderController';
import { protect } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validate';
import { createReminderSchema, updateReminderSchema, payReminderSchema } from '../schemas/reminderSchemas';

const router = express.Router();

router.route('/').get(protect, getReminders).post(protect, validate(createReminderSchema), setReminder);
router
  .route('/:id')
  .get(protect, getReminderById)
  .put(protect, validate(updateReminderSchema), updateReminder)
  .delete(protect, deleteReminder);
router.route('/:id/mark-paid').put(protect, markReminderPaid);
router.route('/:id/pay').post(protect, validate(payReminderSchema), payReminder);
router.route('/:id/payments').get(protect, getReminderPayments);

export default router;
