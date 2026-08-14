import * as LocalAuthentication from 'expo-local-authentication';

export const isBiometricAvailable = async (): Promise<boolean> => {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
};

export const authenticateWithBiometrics = async (
  promptMessage = 'Desbloquea Finanzas'
): Promise<boolean> => {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancelar',
    disableDeviceFallback: false,
  });
  return result.success;
};
