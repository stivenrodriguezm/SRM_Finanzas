import { TransactionType } from '../models/Transaction';

/**
 * Cuánto suma/resta un movimiento de tipo `type` al `balance` de una cuenta.
 *
 * En una cuenta normal, un ingreso suma y un egreso resta. En una cuenta de deuda
 * (`isLiability: true`, donde `balance` representa cuánto se debe, siempre como número
 * positivo — ver `PROYECTO.md` 3.3), el efecto se invierte: un egreso es un cargo a la deuda
 * (p. ej. pagar un recordatorio con una tarjeta de crédito) y aumenta lo que se debe; un
 * ingreso es un crédito (p. ej. un reembolso) y lo reduce. `abono_deuda` siempre resta sin
 * importar el tipo de cuenta — representa un pago explícito hacia la deuda, ya calculado por
 * quien lo crea (`accountController.ts::payLiabilityAccount`, `debtController.ts::addPayment`).
 */
export const balanceDelta = (type: TransactionType, amount: number, isLiability: boolean): number => {
  if (type === 'abono_deuda') return -amount;
  const isCredit = type === 'ingreso';
  if (isLiability) return isCredit ? -amount : amount;
  return isCredit ? amount : -amount;
};
