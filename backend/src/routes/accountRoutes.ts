import express from 'express';
import { getAccounts, setAccount, updateAccount, deleteAccount } from '../controllers/accountController';
import { protect } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validate';
import { createAccountSchema, updateAccountSchema } from '../schemas/accountSchemas';

const router = express.Router();

router.route('/').get(protect, getAccounts).post(protect, validate(createAccountSchema), setAccount);
router
  .route('/:id')
  .put(protect, validate(updateAccountSchema), updateAccount)
  .delete(protect, deleteAccount);

export default router;
