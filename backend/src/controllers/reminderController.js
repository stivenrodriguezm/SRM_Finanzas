const Reminder = require('../models/Reminder');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');

// @desc    Get user reminders
// @route   GET /api/reminders
// @access  Private
const getReminders = async (req, res) => {
  try {
    const reminders = await Reminder.find({ user: req.user.id }).sort({ date: 1 });
    res.status(200).json(reminders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create reminder
// @route   POST /api/reminders
// @access  Private
const setReminder = async (req, res) => {
  try {
    const { title, date, type, amount, isPaid, paymentLink, description, dayOfMonth } = req.body;

    if (!title || !type) {
      return res.status(400).json({ message: 'Título y tipo son requeridos' });
    }

    // La fecha es requerida solo para recordatorios únicos
    if (type === 'unico' && !date) {
      return res.status(400).json({ message: 'La fecha es requerida para recordatorios únicos' });
    }

    // Para periódicos, calcular la próxima fecha si no viene
    let reminderDate = date;
    if (type === 'periodico' && !date && dayOfMonth) {
      const now = new Date();
      let nextDate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
      if (nextDate <= now) nextDate.setMonth(nextDate.getMonth() + 1);
      reminderDate = nextDate;
    }

    const reminder = await Reminder.create({
      user: req.user.id,
      title: title.trim(),
      date: reminderDate,
      type,
      amount: amount ? Number(amount) : undefined,
      isPaid: isPaid !== undefined ? isPaid : false,
      paymentLink: paymentLink && paymentLink.trim() ? paymentLink.trim() : undefined,
      description: description && description.trim() ? description.trim() : undefined,
      dayOfMonth: dayOfMonth ? Number(dayOfMonth) : undefined,
    });

    res.status(201).json(reminder);
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update reminder
// @route   PUT /api/reminders/:id
// @access  Private
const updateReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);

    if (!reminder) {
      return res.status(404).json({ message: 'Recordatorio no encontrado' });
    }

    if (reminder.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Usuario no autorizado' });
    }

    const updatedReminder = await Reminder.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    res.status(200).json(updatedReminder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark reminder as paid
// @route   PUT /api/reminders/:id/mark-paid
// @access  Private
const markReminderPaid = async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);

    if (!reminder) {
      return res.status(404).json({ message: 'Recordatorio no encontrado' });
    }

    if (reminder.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Usuario no autorizado' });
    }

    reminder.isPaid = true;
    
    // Si es periódico, calcular la próxima fecha
    if (reminder.type === 'periodico' && reminder.dayOfMonth) {
      const currentDate = new Date(reminder.date);
      const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, reminder.dayOfMonth);
      reminder.date = nextDate;
      reminder.isPaid = false; // Reset para el próximo mes
    }
    
    await reminder.save();
    res.status(200).json(reminder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete reminder
// @route   DELETE /api/reminders/:id
// @access  Private
const deleteReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);

    if (!reminder) {
      return res.status(404).json({ message: 'Recordatorio no encontrado' });
    }

    if (reminder.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Usuario no autorizado' });
    }

    await reminder.deleteOne();

    res.status(200).json({ id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Pay reminder (creates transaction)
// @route   POST /api/reminders/:id/pay
// @access  Private
const payReminder = async (req, res) => {
  try {
    const { amount, accountId } = req.body;
    
    if (!amount || !accountId) {
      return res.status(400).json({ message: 'Monto y cuenta son requeridos' });
    }

    const reminder = await Reminder.findById(req.params.id);
    if (!reminder) return res.status(404).json({ message: 'Recordatorio no encontrado' });
    if (reminder.user.toString() !== req.user.id) return res.status(401).json({ message: 'Usuario no autorizado' });

    const account = await Account.findById(accountId);
    if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });
    if (account.user.toString() !== req.user.id) return res.status(401).json({ message: 'Usuario no autorizado' });

    // 1. Create Transaction
    const transaction = await Transaction.create({
      user: req.user.id,
      account: accountId,
      reminder: reminder._id,
      title: `Pago: ${reminder.title}`,
      amount: Number(amount),
      type: 'egreso', // Assuming payment is always an expense
      date: new Date()
    });

    // 2. Update Account Balance
    account.balance -= Number(amount);
    await account.save();

    // 3. Update Reminder
    if (reminder.type === 'unico') {
      reminder.isPaid = true;
    } else if (reminder.type === 'periodico') {
      // Advance to next month
      const now = new Date();
      let nextDate = new Date(now.getFullYear(), now.getMonth(), reminder.dayOfMonth || reminder.date.getDate());
      if (nextDate <= now) {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
      reminder.date = nextDate;
    }
    await reminder.save();

    res.status(200).json({ message: 'Pago registrado exitosamente', transaction, reminder });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get reminder payments history
// @route   GET /api/reminders/:id/payments
// @access  Private
const getReminderPayments = async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);
    if (!reminder) return res.status(404).json({ message: 'Recordatorio no encontrado' });
    if (reminder.user.toString() !== req.user.id) return res.status(401).json({ message: 'Usuario no autorizado' });

    const payments = await Transaction.find({ reminder: req.params.id })
      .populate('account', 'name color icon')
      .sort({ date: -1 });

    res.status(200).json(payments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getReminders,
  setReminder,
  updateReminder,
  markReminderPaid,
  deleteReminder,
  payReminder,
  getReminderPayments
};
