import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User, { IUser } from '../models/User';
import { AppError } from '../utils/AppError';
import { catchAsync } from '../utils/catchAsync';
import { generateToken } from '../utils/generateToken';
import { sendEmail } from '../utils/sendEmail';

const publicUser = (user: IUser) => ({
  _id: user.id,
  name: user.name,
  username: user.username,
  email: user.email,
  preferences: user.preferences,
});

export const registerUser = catchAsync(async (req: Request, res: Response) => {
  const { name, username, email, password } = req.body;

  const [emailExists, usernameExists] = await Promise.all([
    User.findOne({ email }),
    User.findOne({ username }),
  ]);

  if (emailExists) throw new AppError('El correo ya está registrado', 400);
  if (usernameExists) throw new AppError('El usuario ya existe', 400);

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    username,
    email,
    password: hashedPassword,
    preferences: { theme: 'light', hideAmounts: false },
  });

  res.status(201).json({ ...publicUser(user), token: generateToken(user.id) });
});

export const loginUser = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError('Credenciales inválidas', 401);
  }

  res.json({ ...publicUser(user), token: generateToken(user.id) });
});

export const getProfile = catchAsync(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id).select('-password');
  res.status(200).json(user);
});

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const { name, username, email } = req.body;
  const user = await User.findById(req.user!.id);
  if (!user) throw new AppError('Usuario no encontrado', 404);

  if (email && email !== user.email && (await User.findOne({ email }))) {
    throw new AppError('El correo ya está en uso', 400);
  }
  if (username && username !== user.username && (await User.findOne({ username }))) {
    throw new AppError('El nombre de usuario ya está en uso', 400);
  }

  if (name) user.name = name;
  if (username) user.username = username;
  if (email) user.email = email;

  const updatedUser = await user.save();
  res.json({ ...publicUser(updatedUser), token: generateToken(updatedUser.id) });
});

export const changePassword = catchAsync(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user!.id);
  if (!user) throw new AppError('Usuario no encontrado', 404);

  if (!(await bcrypt.compare(currentPassword, user.password))) {
    throw new AppError('La contraseña actual es incorrecta', 401);
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ message: 'Contraseña actualizada correctamente' });
});

export const updatePreferences = catchAsync(async (req: Request, res: Response) => {
  const { theme, hideAmounts, accountOrder, selectedAccounts, reminderOrder, debtOrder } = req.body;
  const user = await User.findById(req.user!.id);
  if (!user) throw new AppError('Usuario no encontrado', 404);

  if (theme) user.preferences.theme = theme;
  if (hideAmounts !== undefined) user.preferences.hideAmounts = hideAmounts;
  if (accountOrder !== undefined) user.preferences.accountOrder = accountOrder;
  if (selectedAccounts !== undefined) user.preferences.selectedAccounts = selectedAccounts;
  if (reminderOrder !== undefined) user.preferences.reminderOrder = reminderOrder;
  if (debtOrder !== undefined) user.preferences.debtOrder = debtOrder;

  const updatedUser = await user.save();
  res.json(publicUser(updatedUser));
});

const GENERIC_RESET_MESSAGE = 'Si el correo existe, se envió un código de recuperación';

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (user) {
    const code = crypto.randomInt(100000, 999999).toString();
    user.resetPasswordCodeHash = await bcrypt.hash(code, 10);
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendEmail(
      user.email,
      'Código de recuperación — SRM Finanzas',
      `<p>Tu código para restablecer la contraseña es:</p><h2 style="letter-spacing:4px">${code}</h2><p>Expira en 10 minutos. Si no lo solicitaste, ignora este correo.</p>`
    );
  }

  // Respuesta genérica siempre: no revela si el correo existe o no en la base de datos.
  res.json({ message: GENERIC_RESET_MESSAGE });
});

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body;
  const user = await User.findOne({ email }).select('+resetPasswordCodeHash +resetPasswordExpires');

  const invalidCodeError = () => new AppError('Código inválido o expirado', 400);

  if (!user || !user.resetPasswordCodeHash || !user.resetPasswordExpires) {
    throw invalidCodeError();
  }
  if (user.resetPasswordExpires.getTime() < Date.now()) {
    throw invalidCodeError();
  }
  if (!(await bcrypt.compare(code, user.resetPasswordCodeHash))) {
    throw invalidCodeError();
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordCodeHash = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({ message: 'Contraseña restablecida correctamente' });
});
