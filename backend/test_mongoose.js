const mongoose = require('mongoose');
require('dotenv').config();
const Debt = require('./src/models/Debt');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const debt = new Debt({
      user: new mongoose.Types.ObjectId(),
      name: 'Test Debt',
      totalAmount: 50000,
      remainingAmount: 50000,
      type: 'debo',
      // NO dueDate
    });
    await debt.save();
    console.log('Saved successfully');
  } catch (err) {
    console.error('Error saving:', err.message);
  } finally {
    mongoose.disconnect();
  }
}
test();
