import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from './config/db';
import app from './app';
import { startMonthlyClosingScheduler } from './utils/monthlyClosingScheduler';

connectDB();
startMonthlyClosingScheduler();

const PORT = Number(process.env.PORT) || 5000;
// En el Mac (LAN) debe ser 0.0.0.0 para que el iPhone lo alcance por la red local.
// En la VPS debe ser 127.0.0.1: solo Nginx (reverse proxy) queda expuesto a internet,
// el proceso de Node nunca escucha directamente en la interfaz pública.
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
});
