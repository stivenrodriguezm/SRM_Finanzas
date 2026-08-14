const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre de la cuenta es obligatorio'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['asset', 'liability'],
      required: [true, 'La naturaleza de la cuenta (activo/pasivo) es obligatoria'],
    },
    category: {
      type: String,
      enum: ['bank', 'cash', 'credit_card', 'loan_payable', 'loan_receivable'],
      required: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, 'El saldo contable se maneja como valor absoluto positivo'],
    },
    creditLimit: {
      type: Number,
      default: null, // Útil para tarjetas de crédito o cupos rotativos
    },
    // user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Account', accountSchema);
