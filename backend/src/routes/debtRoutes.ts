import express from 'express';
import {
  getDebts,
  getDebtById,
  getDebtTransactions,
  setDebt,
  updateDebt,
  deleteDebt,
  addPayment,
} from '../controllers/debtController';
import { protect } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validate';
import { createDebtSchema, updateDebtSchema, addPaymentSchema } from '../schemas/debtSchemas';

const router = express.Router();

router.route('/').get(protect, getDebts).post(protect, validate(createDebtSchema), setDebt);

// Rutas específicas ANTES de /:id para evitar conflictos de Express
router.route('/:id/payment').post(protect, validate(addPaymentSchema), addPayment);
router.route('/:id/transactions').get(protect, getDebtTransactions);

router
  .route('/:id')
  .get(protect, getDebtById)
  .put(protect, validate(updateDebtSchema), updateDebt)
  .delete(protect, deleteDebt);

export default router;
