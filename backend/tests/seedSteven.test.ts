import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { seedStevenAccount } from '../src/utils/seedStevenService';

// OJO: a diferencia del resto de la suite (que usa testDb.ts / mongodb-memory-server, aislado),
// este test se conecta al MONGO_URI real del .env y puebla la cuenta de demo steven@gmail.com
// en esa base de datos de verdad. Ver PROYECTO.md — es una decisión consciente para tener siempre
// datos de ejemplo frescos, pero implica que `npm test` toca la base de datos real cada vez que corre.
describe('Seed Steven Account Data', () => {
  it('populates a large, coherent dataset for steven@gmail.com', async () => {
    const mongoUri = process.env.MONGO_URI;
    expect(mongoUri).toBeDefined();

    await mongoose.connect(mongoUri!);
    const result = await seedStevenAccount();

    expect(result.accountsCount).toBeGreaterThan(0);
    expect(result.debtsCount).toBeGreaterThan(0);
    expect(result.transactionsCount).toBeGreaterThan(100);
    expect(result.closingsCount).toBeGreaterThan(0);

    await mongoose.disconnect();
  }, 120000);
});
