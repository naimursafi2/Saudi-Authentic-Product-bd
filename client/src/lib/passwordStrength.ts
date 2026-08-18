// Mirrors backend/src/validators/auth.validator.ts's PASSWORD_REGEX — at
// least one lowercase letter, one uppercase letter and one digit, 8+ chars.
export function meetsPasswordRequirements(password: string): boolean {
  return password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

export type PasswordStrengthLabel = "Too short" | "Weak" | "Fair" | "Strong";

export interface PasswordStrength {
  score: number; // 0-4
  label: PasswordStrengthLabel;
  checks: {
    length: boolean;
    lowerUpper: boolean;
    number: boolean;
    symbol: boolean;
  };
}

export function getPasswordStrength(password: string): PasswordStrength {
  const checks = {
    length: password.length >= 8,
    lowerUpper: /[a-z]/.test(password) && /[A-Z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;

  const label: PasswordStrengthLabel = !checks.length
    ? "Too short"
    : score <= 2
      ? "Weak"
      : score === 3
        ? "Fair"
        : "Strong";

  return { score, label, checks };
}
