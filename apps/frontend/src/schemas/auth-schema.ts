import { AuthError, type PublicRegisterRole } from '../types/auth';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,128}$/;
export function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }
export function validateRegistration(email: string, password: string, role: string): asserts role is PublicRegisterRole {
  if (!EMAIL.test(email) || email.length > 50) throw new AuthError('VALIDATION_ERROR', 'Correo inválido o de más de 50 caracteres.', 'email');
  if (!PASSWORD.test(password)) throw new AuthError('VALIDATION_ERROR', 'La contraseña requiere 8–128 caracteres, mayúscula, minúscula, número y símbolo.', 'password');
  if (role !== 'reader' && role !== 'publisher') throw new AuthError('FORBIDDEN_ROLE', 'Solo se permite el registro de lectores y editoriales.', 'requestedRole');
}
export function validateLogin(email: string, password: string): void {
  if (!EMAIL.test(email) || email.length > 50 || !password) throw new AuthError('INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
}
