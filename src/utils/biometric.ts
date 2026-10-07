/**
 * Biometric utility — wraps capacitor-native-biometric.
 * All biometric preference state lives in localStorage only (never Firestore).
 * Gracefully returns false/error on web or if hardware is unavailable.
 */
import { NativeBiometric, BiometricAuthError } from 'capacitor-native-biometric';

export const BIOMETRIC_KEY = 'niyam-biometric-enabled';

export const isBiometricEnabled = (): boolean =>
  localStorage.getItem(BIOMETRIC_KEY) === 'true';

export const setBiometricEnabled = (v: boolean): void => {
  if (v) localStorage.setItem(BIOMETRIC_KEY, 'true');
  else   localStorage.removeItem(BIOMETRIC_KEY);
};

/** Returns true if the device has biometric hardware enrolled and available. */
export const checkBiometricAvailable = async (): Promise<boolean> => {
  try {
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch {
    return false;
  }
};

/** Shows the native biometric prompt. Returns 'success', 'cancel', or 'error'. */
export const promptBiometric = async (): Promise<'success' | 'cancel' | 'error'> => {
  try {
    await NativeBiometric.verifyIdentity({
      reason: 'Unlock Niyam',
      title:  'Niyam',
      subtitle: 'Use your fingerprint to continue',
      negativeButtonText: 'Use PIN',
      useFallback: false,
      maxAttempts: 3,
    });
    return 'success';
  } catch (err) {
    const e = err as { code?: number; errorCode?: number };
    const code = e?.code ?? e?.errorCode ?? -1;
    // USER_CANCEL = 16, APP_CANCEL = 11, SYSTEM_CANCEL = 15
    if (
      code === BiometricAuthError.USER_CANCEL ||
      code === BiometricAuthError.APP_CANCEL  ||
      code === BiometricAuthError.SYSTEM_CANCEL
    ) {
      return 'cancel';
    }
    return 'error';
  }
};
