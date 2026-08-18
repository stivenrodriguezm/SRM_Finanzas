import express from 'express';
import {
  getClosings,
  getClosingByPeriod,
  captureNow,
  updateClosing,
  deleteClosing,
} from '../controllers/monthlyClosingController';
import { protect } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validate';
import { captureClosingSchema, updateClosingSchema } from '../schemas/monthlyClosingSchemas';

const router = express.Router();

router.route('/').get(protect, getClosings).post(protect, validate(captureClosingSchema), captureNow);

router
  .route('/:period')
  .get(protect, getClosingByPeriod)
  .put(protect, validate(updateClosingSchema), updateClosing)
  .delete(protect, deleteClosing);

export default router;
