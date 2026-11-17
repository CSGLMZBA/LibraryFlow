import type { AuthValidationErrors, RegisterRole } from "../types/auth";

const EMAIL_MAX_LENGTH = 50;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 20;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /[0-9]/;
const SPECIAL_CHAR_REGEX = /[^A-Za-z0-9]/;

export function validateEmail(email: string): string | undefined {
  const trimmed = email.trim();
  if (!trimmed) {
    return "Email is required.";
  }
  if (trimmed.length > EMAIL_MAX_LENGTH) {
    return `Email must not exceed ${EMAIL_MAX_LENGTH} characters.`;
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return "Enter a valid email address.";
  }
  return undefined;
}

export function validateRegistrationPassword(password: string): string | undefined {
  if (!password) {
    return "Password is required.";
  }
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (!UPPERCASE_REGEX.test(password)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!LOWERCASE_REGEX.test(password)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!NUMBER_REGEX.test(password)) {
    return "Password must include at least one number.";
  }
  if (!SPECIAL_CHAR_REGEX.test(password)) {
    return "Password must include at least one special character.";
  }
  return undefined;
}

export function validateLoginInput(email: string, password: string): AuthValidationErrors {
  const errors: AuthValidationErrors = {};
  const emailError = validateEmail(email);
  if (emailError) {
    errors.email = emailError;
  }
  if (!password.trim()) {
    errors.password = "Password is required.";
  }
  return errors;
}

export function validateRegisterInput(
  email: string,
  password: string,
  role: string
): AuthValidationErrors {
  const errors: AuthValidationErrors = {};
  const emailError = validateEmail(email);
  if (emailError) {
    errors.email = emailError;
  }

  const passwordError = validateRegistrationPassword(password);
  if (passwordError) {
    errors.password = passwordError;
  }

  const validRoles: RegisterRole[] = ["reader", "publisher"];
  if (!validRoles.includes(role as RegisterRole)) {
    errors.role = "Select a valid role (Reader or Publisher).";
  }

  return errors;
}