import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { seedStevenAccount } from '../src/utils/seedStevenService';

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ Error: MONGO_URI no está configurado en .env');
    process.exit(1);
  }

  console.log('🔌 Conectando a MongoDB Atlas...');
  await mongoose.connect(mongoUri);
  console.log('✅ Conectado exitosamente');

  const result = await seedStevenAccount();

  console.log('\n🎉 ¡Población de datos completada con éxito!');
  console.log('----------------------------------------------------');
  console.log(`👤 Usuario: ${result.email}`);
  console.log('🔑 Contraseña: Lottus123');
  console.log(`🏦 Cuentas creadas: ${result.accountsCount}`);
  console.log(`💳 Deudas/Cobros creados: ${result.debtsCount}`);
  console.log(`⏰ Recordatorios creados: ${result.remindersCount}`);
  console.log(`📊 Transacciones generadas: ${result.transactionsCount}`);
  console.log(`📈 Cierres mensuales: ${result.closingsCount}`);
  console.log('----------------------------------------------------');

  await mongoose.disconnect();
  console.log('🔌 Desconectado de MongoDB');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Error ejecutando seed:', err);
  process.exit(1);
});
