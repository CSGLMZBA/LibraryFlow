export class AuthCloudError extends Error {
  constructor(public readonly code: string, message: string, public readonly field?: string, public readonly httpStatus = 400, public readonly recoveryAvailable = false) {
    super(message);
    this.name = 'AuthCloudError';
  }
}
