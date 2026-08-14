const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');

// Cargar variables de entorno
dotenv.config();

// Conectar a la base de datos
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/accounts', require('./src/routes/accountRoutes'));
app.use('/api/transactions', require('./src/routes/transactionRoutes'));
app.use('/api/debts', require('./src/routes/debtRoutes'));
app.use('/api/reminders', require('./src/routes/reminderRoutes'));

// Ruta base
app.get('/', (req, res) => {
  res.send('API de Finanzas Personales funcionando 🚀');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
