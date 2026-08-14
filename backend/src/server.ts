import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from './config/db';
import app from './app';

connectDB();

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
