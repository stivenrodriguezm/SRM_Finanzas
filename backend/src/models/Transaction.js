const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Account',
    },
    reminder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reminder',
    },
    title: {
      type: String,
      required: [true, 'Por favor añade un título'],
    },
    amount: {
      type: Number,
      required: [true, 'Por favor añade un monto'],
    },
    type: {
      type: String,
      required: true,
      enum: ['ingreso', 'egreso', 'abono_deuda'],
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Transaction', TransactionSchema);
