/** S1-AUTH-01: validation shared in semantics with SPEC-001 §5, §6 and US-REA-010. */
export type RegisterRole = 'reader' | 'publisher';
export type AuthInputError = {code: string; message: string; field?: string};
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,128}$/;

export class AuthValidationError extends Error {
  readonly code: string;
  readonly field?: string;
  constructor(code: string, message: string, field?: string) {
    super(message);
    this.code = code;
    this.field = field;
    this.name = 'AuthValidationError';
  }
}

export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') throw new AuthValidationError('VALIDATION_ERROR', 'El correo es obligatorio.', 'email');
  return value.trim().toLowerCase();
}
export function assertValidEmail(email: string): void {
  if (email.length > 50 || !emailPattern.test(email)) {
    throw new AuthValidationError('VALIDATION_ERROR', 'El correo es inválido (máximo 50 caracteres).', 'email');
  }
}
export function assertValidPassword(password: unknown): asserts password is string {
  if (typeof password !== 'string' || !passwordPattern.test(password)) {
    throw new AuthValidationError('VALIDATION_ERROR', 'La contraseña requiere 8–128 caracteres, mayúscula, minúscula, número y símbolo.', 'password');
  }
}
export function parseRegistration(value: unknown): {email: string; password: string; requestedRole: RegisterRole} {
  if (!value || typeof value !== 'object') throw new AuthValidationError('VALIDATION_ERROR', 'Datos de registro inválidos.');
  const body = value as Record<string, unknown>;
  const email = normalizeEmail(body.email);
  assertValidEmail(email);
  assertValidPassword(body.password);
  if (body.requestedRole !== 'reader' && body.requestedRole !== 'publisher') {
    throw new AuthValidationError('VALIDATION_ERROR', 'Solo se permite registrar lectores o editoriales.', 'requestedRole');
  }
  return {email, password: body.password, requestedRole: body.requestedRole};
}
export function parseLogin(value: unknown): {email: string; password: string} {
  if (!value || typeof value !== 'object') throw new AuthValidationError('INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
  const body = value as Record<string, unknown>;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!emailPattern.test(email) || email.length > 50 || typeof body.password !== 'string' || !body.password) {
    throw new AuthValidationError('INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
  }
  return {email, password: body.password};
}
