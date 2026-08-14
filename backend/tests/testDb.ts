import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

// Las operaciones de dinero usan session.withTransaction(), que Mongo solo permite
// sobre un replica set (no un mongod standalone) — por eso usamos MongoMemoryReplSet.
let replSet: MongoMemoryReplSet;

export const connectTestDB = async (): Promise<void> => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
};

export const clearTestDB = async (): Promise<void> => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
};

export const closeTestDB = async (): Promise<void> => {
  await mongoose.connection.close();
  await replSet.stop();
};
