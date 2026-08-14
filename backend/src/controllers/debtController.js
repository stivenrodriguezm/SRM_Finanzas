const Debt = require('../models/Debt');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');

// @desc    Get user debts
// @route   GET /api/debts
// @access  Private
const getDebts = async (req, res) => {
  try {
    const debts = await Debt.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(debts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single debt
// @route   GET /api/debts/:id
// @access  Private
const getDebtById = async (req, res) => {
  try {
    const debt = await Debt.findById(req.params.id);
    if (!debt) return res.status(404).json({ message: 'Deuda no encontrada' });
    if (debt.user.toString() !== req.user.id) return res.status(401).json({ message: 'Usuario no autorizado' });
    res.status(200).json(debt);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all transactions related to a debt (abonos)
// @route   GET /api/debts/:id/transactions
// @access  Private
const getDebtTransactions = async (req, res) => {
  try {
    const debt = await Debt.findById(req.params.id);
    if (!debt || debt.user.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Deuda no encontrada o no autorizada' });
    }

    // Buscar transacciones cuyo título contiene el nombre de la deuda
    const transactions = await Transaction.find({
      user: req.user.id,
      type: 'abono_deuda',
      title: { $regex: debt.name, $options: 'i' }
    })
      .populate('account', 'name color icon')
      .sort({ date: -1 });

    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create debt
// @route   POST /api/debts
// @access  Private
const setDebt = async (req, res) => {
  try {
    const { name, totalAmount, type, dueDate, color, icon, isActive, description } = req.body;

    if (!name) return res.status(400).json({ message: 'El nombre es requerido' });
    if (!totalAmount || isNaN(Number(totalAmount))) return res.status(400).json({ message: 'El monto total es requerido y debe ser un número' });
    if (!type || !['debo', 'me_deben'].includes(type)) return res.status(400).json({ message: 'El tipo debe ser "debo" o "me_deben"' });

    const amount = Number(totalAmount);

    const debtData = {
      user: req.user.id,
      name: name.trim(),
      totalAmount: amount,
      remainingAmount: amount,
      type,
      color: color || (type === 'debo' ? '#EF4444' : '#10B981'),
      icon: icon || 'person',
      isActive: isActive !== undefined ? isActive : true,
      description: description || '',
    };

    if (dueDate) {
      debtData.dueDate = new Date(dueDate);
    }

    const debt = await Debt.create(debtData);
    res.status(201).json(debt);
  } catch (error) {
    console.error('Error al crear deuda:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update debt (general details)
// @route   PUT /api/debts/:id
// @access  Private
const updateDebt = async (req, res) => {
  try {
    const debt = await Debt.findById(req.params.id);

    if (!debt) return res.status(404).json({ message: 'Deuda no encontrada' });
    if (debt.user.toString() !== req.user.id) return res.status(401).json({ message: 'Usuario no autorizado' });

    // Construir el objeto de actualización con solo los campos permitidos
    const allowedFields = ['name', 'type', 'dueDate', 'color', 'icon', 'isActive', 'description', 'totalAmount', 'remainingAmount'];
    const updateData = {};
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'dueDate') {
          updateData.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : undefined;
        } else {
          updateData[field] = req.body[field];
        }
      }
    }

    const updatedDebt = await Debt.findByIdAndUpdate(req.params.id, { $set: updateData }, {
      new: true,
      runValidators: true,
    });

    res.status(200).json(updatedDebt);
  } catch (error) {
    console.error('Error al actualizar deuda:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add payment to debt (abonar)
// @route   POST /api/debts/:id/payment
// @access  Private
const addPayment = async (req, res) => {
  try {
    const { amount, accountId, date } = req.body;

    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({ message: 'Monto requerido y debe ser un número válido' });
    }
    if (!accountId) {
      return res.status(400).json({ message: 'La cuenta es requerida' });
    }

    const paymentAmount = Number(amount);

    const debt = await Debt.findById(req.params.id);
    if (!debt || debt.user.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Deuda no encontrada o no autorizada' });
    }

    const account = await Account.findById(accountId);
    if (!account || account.user.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Cuenta no encontrada o no autorizada' });
    }

    // Actualizar restante de la deuda
    debt.remainingAmount = Math.max(0, debt.remainingAmount - paymentAmount);
    if (debt.remainingAmount === 0) {
      debt.isActive = false; // Deuda completamente saldada
    }
    await debt.save();

    // Crear transacción del abono
    const transaction = await Transaction.create({
      user: req.user.id,
      account: accountId,
      title: `Abono a: ${debt.name}`,
      amount: paymentAmount,
      type: 'abono_deuda',
      date: date || Date.now(),
    });

    // Actualizar balance de la cuenta
    if (debt.type === 'debo') {
      // Yo pago una deuda -> sale dinero de mi cuenta
      account.balance -= paymentAmount;
    } else {
      // Me pagan una deuda -> entra dinero a mi cuenta
      account.balance += paymentAmount;
    }
    await account.save();

    res.status(200).json({ debt, transaction });
  } catch (error) {
    console.error('Error al agregar pago:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete debt
// @route   DELETE /api/debts/:id
// @access  Private
const deleteDebt = async (req, res) => {
  try {
    const debt = await Debt.findById(req.params.id);

    if (!debt) return res.status(404).json({ message: 'Deuda no encontrada' });
    if (debt.user.toString() !== req.user.id) return res.status(401).json({ message: 'Usuario no autorizado' });

    await debt.deleteOne();
    res.status(200).json({ id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDebts,
  getDebtById,
  getDebtTransactions,
  setDebt,
  updateDebt,
  addPayment,
  deleteDebt,
};
