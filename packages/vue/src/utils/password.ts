export interface PasswordValidationResult {
  valid: boolean;
  errorKey: string | null;
}

/**
 * Password policy validation (upstreamed from shittim-chest).
 *
 * Rules: match with the confirmation, ≥ 8 chars, letters + digits.
 * `errorKey` is an i18n key the caller resolves with its own catalog
 * (override the prefix via the second arg if your catalog differs).
 */
export function validatePassword(
  password: string,
  confirmPassword: string,
  keyPrefix = "common.validation",
): PasswordValidationResult {
  if (password !== confirmPassword) {
    return { valid: false, errorKey: `${keyPrefix}.passwordMismatch` };
  }
  if (password.length < 8) {
    return { valid: false, errorKey: `${keyPrefix}.minLength` };
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return { valid: false, errorKey: `${keyPrefix}.passwordNeedsVariety` };
  }
  return { valid: true, errorKey: null };
}

export type PasswordLevel = "weak" | "fair" | "strong";

/**
 * Password strength level for a traffic-light indicator:
 * - "strong": ≥ 10 chars + upper + lower + special (green)
 * - "fair":   ≥ 8 chars + letters + digits (yellow)
 * - "weak":   below fair (red)
 * - null:     empty (no indicator)
 */
export function passwordLevel(password: string): PasswordLevel | null {
  if (!password) return null;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  if (password.length >= 10 && hasUpper && hasLower && hasSpecial) {
    return "strong";
  }
  if (password.length >= 8 && hasLetter && hasDigit) {
    return "fair";
  }
  return "weak";
}
