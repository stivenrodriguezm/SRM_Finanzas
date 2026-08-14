const Account = require('../models/Account');

// @desc    Get user accounts (optional: ?isLiability=true)
// @route   GET /api/accounts
// @access  Private
const getAccounts = async (req, res) => {
  try {
    const filter = { user: req.user.id };
    if (req.query.isLiability !== undefined) {
      filter.isLiability = req.query.isLiability === 'true';
    }
    const accounts = await Account.find(filter);
    res.status(200).json(accounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create account
// @route   POST /api/accounts
// @access  Private
const setAccount = async (req, res) => {
  try {
    const { name, balance, color, icon, isLiability, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'El nombre de la cuenta es requerido' });
    }

    const account = await Account.create({
      user: req.user.id,
      name,
      balance: balance || 0,
      color,
      icon,
      isLiability: isLiability || false,
      description: description || '',
    });

    res.status(201).json(account);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update account
// @route   PUT /api/accounts/:id
// @access  Private
const updateAccount = async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);

    if (!account) {
      return res.status(404).json({ message: 'Cuenta no encontrada' });
    }

    // Asegurar que el usuario logueado coincida con el dueño de la cuenta
    if (account.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Usuario no autorizado' });
    }

    const updatedAccount = await Account.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    res.status(200).json(updatedAccount);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete account
// @route   DELETE /api/accounts/:id
// @access  Private
const deleteAccount = async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);

    if (!account) {
      return res.status(404).json({ message: 'Cuenta no encontrada' });
    }

    if (account.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Usuario no autorizado' });
    }

    await account.deleteOne();

    res.status(200).json({ id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAccounts,
  setAccount,
  updateAccount,
  deleteAccount,
};
