const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: [true, 'La descripción es obligatoria'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'El monto es obligatorio'],
      min: [0.01, 'El monto debe ser mayor a cero'], // El monto siempre es positivo
    },
    type: {
      type: String,
      enum: ['income', 'expense', 'transfer'],
      required: [true, 'El tipo de transacción es obligatorio'],
    },
    category: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    fromAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      // Obligatorio si es gasto o transferencia
      required: function() {
        return this.type === 'expense' || this.type === 'transfer';
      }
    },
    toAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      // Obligatorio si es ingreso o transferencia
      required: function() {
        return this.type === 'income' || this.type === 'transfer';
      }
    },
    // user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
