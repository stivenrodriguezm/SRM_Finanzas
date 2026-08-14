const mongoose = require('mongoose');

const DebtSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    name: {
      type: String,
      required: [true, 'Por favor añade un nombre para la deuda'],
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    remainingAmount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['debo', 'me_deben'], // debo = Yo debo, me_deben = Me deben a mi
    },
    dueDate: {
      type: Date,
    },
    color: {
      type: String,
      default: '#EF4444',
    },
    icon: {
      type: String,
      default: 'person',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Debt', DebtSchema);
