import { AuthError, type PublicRegisterRole } from '../types/auth';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,128}$/;
export function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }
export function validateRegistration(email: string, password: string, role: string): asserts role is PublicRegisterRole {
  if (!EMAIL.test(email) || email.length > 50) throw new AuthError('VALIDATION_ERROR', 'Correo inv├ílido o de m├ís de 50 caracteres.', 'email');
  if (!PASSWORD.test(password)) throw new AuthError('VALIDATION_ERROR', 'La contrase├▒a requiere 8ÔÇô128 caracteres, may├║scula, min├║scula, n├║mero y s├¡mbolo.', 'password');
  if (role !== 'reader' && role !== 'publisher') throw new AuthError('FORBIDDEN_ROLE', 'Solo se permite el registro de lectores y editoriales.', 'requestedRole');
}
export function validateLogin(email: string, password: string): void {
  if (!EMAIL.test(email) || email.length > 50 || !password) throw new AuthError('INVALID_CREDENTIALS', 'Correo o contrase├▒a incorrectos.');
}

// Field-oriented validations consumed by the existing AuthPage UI.
// Keep SPEC-001 password range: 8-128 characters.
import type { AuthValidationErrors, RegisterRole } from '../types/auth';

export function validateEmail(value: string): string | undefined {
  const email = normalizeEmail(value);
  if (!email || email.length > 50 || !EMAIL.test(email)) {
    return 'Enter a valid email address (maximum 50 characters).';
  }
  return undefined;
}
export function validateRegistrationPassword(password: string): string | undefined {
  if (!PASSWORD.test(password)) {
    return 'Use 8-128 characters with upper/lowercase letters, a number, and a symbol.';
  }
  return undefined;
}
export function validateLoginInput(email: string, password: string): AuthValidationErrors {
  const errors: AuthValidationErrors = {};
  if (validateEmail(email)) errors.email = validateEmail(email);
  if (!password) errors.password = 'Password is required.';
  return errors;
}
export function validateRegisterInput(email: string, password: string, role: string): AuthValidationErrors {
  const errors: AuthValidationErrors = {};
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;
  const passwordError = validateRegistrationPassword(password);
  if (passwordError) errors.password = passwordError;
  if (!(['reader', 'publisher'] as RegisterRole[]).includes(role as RegisterRole)) {
    errors.role = 'Select Reader or Publisher.';
  }
  return errors;
}