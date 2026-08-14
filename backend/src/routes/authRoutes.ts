import express from 'express';
import {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  changePassword,
  updatePreferences,
  forgotPassword,
  resetPassword,
} from '../controllers/authController';
import { protect } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validate';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  updatePreferencesSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/authSchemas';

const router = express.Router();

router.post('/register', validate(registerSchema), registerUser);
router.post('/login', validate(loginSchema), loginUser);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, validate(updateProfileSchema), updateProfile);
router.put('/change-password', protect, validate(changePasswordSchema), changePassword);
router.put('/preferences', protect, validate(updatePreferencesSchema), updatePreferences);

export default router;
