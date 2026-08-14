const Transaction = require('../models/Transaction');
const Account = require('../models/Account');

// @desc    Get user transactions
// @route   GET /api/transactions
// @access  Private
const getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user.id })
      .populate('account', 'name color icon')
      .sort({ date: -1 });
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create transaction
// @route   POST /api/transactions
// @access  Private
const setTransaction = async (req, res) => {
  try {
    const { account, title, amount, type, date } = req.body;

    if (!account || !title || !amount || !type) {
      return res.status(400).json({ message: 'Cuenta, título, monto y tipo son requeridos' });
    }

    if (!['ingreso', 'egreso', 'abono_deuda'].includes(type)) {
      return res.status(400).json({ message: 'El tipo debe ser: ingreso, egreso o abono_deuda' });
    }

    const txAmount = Number(amount);
    if (isNaN(txAmount) || txAmount <= 0) {
      return res.status(400).json({ message: 'El monto debe ser un número positivo' });
    }

    // Verify account exists and belongs to user
    const userAccount = await Account.findById(account);
    if (!userAccount || userAccount.user.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Cuenta no encontrada o no autorizada' });
    }

    // Create transaction
    const transaction = await Transaction.create({
      user: req.user.id,
      account,
      title: title.trim(),
      amount: txAmount,
      type,
      date: date || Date.now(),
    });

    // Update account balance
    if (type === 'ingreso') {
      userAccount.balance += txAmount;
    } else if (type === 'egreso' || type === 'abono_deuda') {
      userAccount.balance -= txAmount;
    }

    await userAccount.save();

    // Return with populated account
    const populated = await Transaction.findById(transaction._id).populate('account', 'name color icon');
    res.status(201).json(populated);
  } catch (error) {
    console.error('Error al crear transacción:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete transaction (and revert balance)
// @route   DELETE /api/transactions/:id
// @access  Private
const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transacción no encontrada' });
    }

    if (transaction.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Usuario no autorizado' });
    }

    // Revert account balance
    const userAccount = await Account.findById(transaction.account);
    if (userAccount) {
      if (transaction.type === 'ingreso') {
        userAccount.balance -= Number(transaction.amount);
      } else if (transaction.type === 'egreso' || transaction.type === 'abono_deuda') {
        userAccount.balance += Number(transaction.amount);
      }
      await userAccount.save();
    }

    await transaction.deleteOne();

    res.status(200).json({ id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getTransactions,
  setTransaction,
  deleteTransaction,
};
