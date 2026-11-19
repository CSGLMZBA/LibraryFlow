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
  if (typeof value !== 'string') throw new AuthValidationError('VALIDATION_ERROR', 'Email is required.', 'email');
  return value.trim().toLowerCase();
}
export function assertValidEmail(email: string): void {
  if (email.length > 50 || !emailPattern.test(email)) {
    throw new AuthValidationError('VALIDATION_ERROR', 'Invalid email (maximum 50 characters).', 'email');
  }
}
export function assertValidPassword(password: unknown): asserts password is string {
  if (typeof password !== 'string' || !passwordPattern.test(password)) {
    throw new AuthValidationError('VALIDATION_ERROR', 'Password requires 8–128 characters, uppercase, lowercase, number, and symbol.', 'password');
  }
}
export function parseRegistration(value: unknown): {email: string; password: string; requestedRole: RegisterRole} {
  if (!value || typeof value !== 'object') throw new AuthValidationError('VALIDATION_ERROR', 'Invalid registration data.');
  const body = value as Record<string, unknown>;
  const email = normalizeEmail(body.email);
  assertValidEmail(email);
  assertValidPassword(body.password);
  if (body.requestedRole !== 'reader' && body.requestedRole !== 'publisher') {
    throw new AuthValidationError('VALIDATION_ERROR', 'Only reader and publisher registration is allowed.', 'requestedRole');
  }
  return {email, password: body.password, requestedRole: body.requestedRole};
}
export function parseLogin(value: unknown): {email: string; password: string} {
  if (!value || typeof value !== 'object') throw new AuthValidationError('INVALID_CREDENTIALS', 'Incorrect email or password.');
  const body = value as Record<string, unknown>;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!emailPattern.test(email) || email.length > 50 || typeof body.password !== 'string' || !body.password) {
    throw new AuthValidationError('INVALID_CREDENTIALS', 'Incorrect email or password.');
  }
  return {email, password: body.password};
}
