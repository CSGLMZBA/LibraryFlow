import { Router, type Request, type Response } from 'express';
import { createAuthGuard } from '../middleware/auth-guard.js';
import { verifyFirebaseIdentity } from '../services/firebase-auth-service.js';
import { requestAccountDeletion, requestDeletionCancellation, restoreAccount, pendingAccountRecoveryRequests } from '../services/account-lifecycle-service.js';
import { parseLogin, AuthValidationError } from '../schemas/auth-schema.js';
import { AuthCloudError } from '../services/auth-errors.js';

const defaults = {verifyFirebaseIdentity, requestAccountDeletion, requestDeletionCancellation, restoreAccount, pendingAccountRecoveryRequests};
export function createAccountRouter(services = defaults) {
  const router = Router();
  router.use(['/account', '/moderation/accounts', '/moderation/account-recovery-requests'], (_req, res, next) => {res.setHeader('Cache-Control', 'no-store'); next();});
  function fail(error: unknown, res: Response) {
    if (error instanceof AuthCloudError || error instanceof AuthValidationError) {
      res.status(error instanceof AuthCloudError ? error.httpStatus : error.code === 'INVALID_CREDENTIALS' ? 401 : 400)
        .json({success: false, error: {code: error.code, message: error.message, ...(error.field ? {field: error.field} : {})}});
    } else res.status(503).json({success: false, error: {code: 'AUTH_UNAVAILABLE', message: 'The account service is unavailable. Retry the operation.'}});
  }
  router.post('/account/deletion-request', async (req: Request, res: Response) => {
    try {
      const header = req.headers.authorization;
      const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
      if (!token) throw new AuthCloudError('AUTH_REQUIRED', 'Sign-in is required.', undefined, 401);
      if (req.body?.confirm !== true) throw new AuthCloudError('VALIDATION_ERROR', 'Explicit deletion confirmation is required.', 'confirm');
      res.status(200).json({success: true, data: await services.requestAccountDeletion(token)});
    } catch (error) {fail(error, res);}
  });
  router.post('/account/deletion-cancel', async (req: Request, res: Response) => {
    try {
      const {email, password} = parseLogin(req.body);
      res.status(202).json({success: true, data: await services.requestDeletionCancellation(email, password)});
    } catch (error) {fail(error, res);}
  });
  router.get('/moderation/account-recovery-requests', createAuthGuard(services.verifyFirebaseIdentity, 'moderator'), async (_req: Request, res: Response) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({success: true, data: await services.pendingAccountRecoveryRequests(res.locals.auth)});
    } catch (error) {fail(error, res);}
  });
  router.post('/moderation/accounts/:uid/restore', createAuthGuard(services.verifyFirebaseIdentity, 'moderator'), async (req: Request, res: Response) => {
    try {
      const revision = req.body?.revision;
      if (!Number.isInteger(revision) || revision < 1) throw new AuthCloudError('VALIDATION_ERROR', 'A positive revision is required.', 'revision');
      const actor = res.locals.auth as {uid: string; role: string};
      const uid = typeof req.params.uid === 'string' ? req.params.uid : '';
      if (!uid || uid.length > 128) throw new AuthCloudError('VALIDATION_ERROR', 'Invalid account ID.', 'uid');
      res.status(200).json({success: true, data: await services.restoreAccount(uid, actor, revision)});
    } catch (error) {fail(error, res);}
  });
  return router;
}
export const accountRouter = createAccountRouter();
