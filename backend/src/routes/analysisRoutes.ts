import express from 'express';
import { getAiChats, getAiChatById, createAiChat, postAiChatMessage, deleteAiChat } from '../controllers/analysisController';
import { protect } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validate';
import { postChatMessageSchema } from '../schemas/analysisSchemas';

const router = express.Router();

router.route('/chats').get(protect, getAiChats).post(protect, createAiChat);
router.route('/chats/:id').get(protect, getAiChatById).delete(protect, deleteAiChat);
router.post('/chats/:id/messages', protect, validate(postChatMessageSchema), postAiChatMessage);

export default router;
