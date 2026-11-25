import { Router, type Request, type Response } from 'express';
import { createAuthGuard, type VerifiedIdentity, type VerifySessionToken } from '../middleware/auth-guard.js';
import { verifyFirebaseIdentity } from '../services/firebase-auth-service.js';
import { accountSessionPolicy } from '../services/account-session-policy.js';
import { AuthCloudError } from '../services/auth-errors.js';

type BanPolicy = Pick<typeof accountSessionPolicy, 'ban' | 'liftBan' | 'recordUnauthorizedBanAttempt'>;

export function createBanRouter(
  verify: VerifySessionToken = verifyFirebaseIdentity,
  policy: BanPolicy = accountSessionPolicy,
  enabled = process.env.ENABLE_BAN_API === 'true',
) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  async function handle(req: Request, res: Response, action: 'ban' | 'lift'): Promise<void> {
    try {
      if (!enabled) throw new AuthCloudError('FEATURE_UNAVAILABLE', 'Ban moderation is not enabled.', undefined, 503);
      const uid = typeof req.params.uid === 'string' ? req.params.uid : '';
      if (!uid || uid.length > 128 || uid.includes('/')) {
        throw new AuthCloudError('VALIDATION_ERROR', 'Invalid account ID.', 'uid');
      }
      const actor: VerifiedIdentity = res.locals.auth;
      if (actor.role !== 'moderator') {
        await policy.recordUnauthorizedBanAttempt(uid, actor, action);
        throw new AuthCloudError('FORBIDDEN', 'Moderator access is required.', undefined, 403);
      }
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        throw new AuthCloudError('VALIDATION_ERROR', 'A JSON object is required.', 'body');
      }
      const {reason, endsAt, permanent} = req.body as Record<string, unknown>;
      if (typeof reason !== 'string' ||
          (endsAt !== undefined && typeof endsAt !== 'string') ||
          (permanent !== undefined && typeof permanent !== 'boolean')) {
        throw new AuthCloudError('VALIDATION_ERROR', 'Invalid ban fields.', 'body');
      }
      const data = action === 'ban'
        ? await policy.ban(uid, actor, {reason, endsAt, permanent})
        : await policy.liftBan(uid, actor, reason);
      res.status(200).json({success: true, data});
    } catch (error) {
      if (error instanceof AuthCloudError) {
        res.status(error.httpStatus).json({success: false, error: {
          code: error.code, message: error.message, ...(error.field ? {field: error.field} : {}),
        }});
      } else {
        console.error(`[moderation] Ban action failed: ${error instanceof Error ? error.name : typeof error}`);
        res.status(503).json({success: false, error: {code: 'MODERATION_UNAVAILABLE', message: 'The moderation service is unavailable.'}});
      }
    }
  }

  router.post('/accounts/:uid/ban', createAuthGuard(verify), (req, res) => void handle(req, res, 'ban'));
  router.post('/accounts/:uid/lift-ban', createAuthGuard(verify), (req, res) => void handle(req, res, 'lift'));
  return router;
}

export const banRouter = createBanRouter();
