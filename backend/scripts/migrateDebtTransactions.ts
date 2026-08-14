/**
 * Migración única: rellena el campo `debt` en transacciones de tipo abono_deuda
 * creadas antes de que existiera esa relación (cuando `getDebtTransactions` las
 * encontraba solo por regex sobre el título). Es aditiva y segura de re-correr:
 * solo toca transacciones que todavía no tienen `debt` seteado.
 *
 * Uso: npx tsx scripts/migrateDebtTransactions.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Debt from '../src/models/Debt';
import Transaction from '../src/models/Transaction';

async function run() {
  await mongoose.connect(process.env.MONGO_URI as string);
  console.log('Conectado a MongoDB');

  const debts = await Debt.find({});
  let totalUpdated = 0;

  for (const debt of debts) {
    const result = await Transaction.updateMany(
      {
        user: debt.user,
        type: 'abono_deuda',
        debt: { $exists: false },
        title: { $regex: debt.name, $options: 'i' },
      },
      { $set: { debt: debt._id } }
    );
    if (result.modifiedCount > 0) {
      console.log(`  "${debt.name}": ${result.modifiedCount} transacción(es) vinculada(s)`);
      totalUpdated += result.modifiedCount;
    }
  }

  console.log(`Listo. ${totalUpdated} transacción(es) actualizada(s) en total.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Error en la migración:', err);
  process.exit(1);
});
