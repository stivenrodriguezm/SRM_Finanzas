const mongoose = require('mongoose');

const ReminderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    title: {
      type: String,
      required: [true, 'Por favor añade un título'],
    },
    date: {
      type: Date,
      required: true,
    },
    type: {
      type: String, // 'unico' o 'periodico'
      required: true,
      enum: ['unico', 'periodico'],
      default: 'unico',
    },
    amount: {
      type: Number,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paymentLink: {
      type: String,
    },
    description: {
      type: String,
    },
    dayOfMonth: {
      type: Number, // Para recordatorios periódicos, día del mes
      min: 1,
      max: 31,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Reminder', ReminderSchema);
