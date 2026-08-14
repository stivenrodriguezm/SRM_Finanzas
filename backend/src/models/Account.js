const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    name: {
      type: String,
      required: [true, 'Por favor añade un nombre para la cuenta'],
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
    },
    color: {
      type: String,
      default: '#000000',
    },
    icon: {
      type: String,
      default: 'wallet',
    },
    isLiability: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Account', AccountSchema);
