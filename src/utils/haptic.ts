type HapticPattern = 'tap' | 'success' | 'error' | 'warning' | 'heavy';
const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap:     10,
  success: [10, 30, 60],
  error:   [50, 40, 100],
  warning: [30, 20, 30],
  heavy:   50,
};
export function haptic(type: HapticPattern = 'tap') {
  try { if ('vibrate' in navigator) navigator.vibrate(PATTERNS[type]); } catch {}
}
export const hapticTap     = () => haptic('tap');
export const hapticSuccess = () => haptic('success');
export const hapticError   = () => haptic('error');
export const hapticWarning = () => haptic('warning');
export const hapticHeavy   = () => haptic('heavy');
