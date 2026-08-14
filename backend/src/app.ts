import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import accountRoutes from './routes/accountRoutes';
import transactionRoutes from './routes/transactionRoutes';
import debtRoutes from './routes/debtRoutes';
import reminderRoutes from './routes/reminderRoutes';
import { notFound, errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.send('API de Finanzas Personales funcionando 🚀');
});

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/debts', debtRoutes);
app.use('/api/reminders', reminderRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
