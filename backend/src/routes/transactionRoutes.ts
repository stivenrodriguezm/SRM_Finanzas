import express from 'express';
import { getTransactions, setTransaction, updateTransaction, deleteTransaction } from '../controllers/transactionController';
import { protect } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validate';
import { createTransactionSchema, updateTransactionSchema } from '../schemas/transactionSchemas';

const router = express.Router();

router.route('/').get(protect, getTransactions).post(protect, validate(createTransactionSchema), setTransaction);
router
  .route('/:id')
  .put(protect, validate(updateTransactionSchema), updateTransaction)
  .delete(protect, deleteTransaction);

export default router;
