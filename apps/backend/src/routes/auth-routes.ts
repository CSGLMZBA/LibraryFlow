import {Router, type Request, type Response} from 'express';
import {AuthValidationError, parseLogin, parseRegistration} from '../schemas/auth-schema.js';
import {AuthCloudError, currentCloudSession, loginCloud, logoutCloud, registerCloud, verifyFirebaseIdentity} from '../services/firebase-auth-service.js';
import {createAuthGuard} from '../middleware/auth-guard.js';


const defaultServices = {currentCloudSession, loginCloud, logoutCloud, registerCloud, verifyFirebaseIdentity};

export function createAuthRouter(services = defaultServices) {
  const {currentCloudSession, loginCloud, logoutCloud, registerCloud, verifyFirebaseIdentity} = services;
  /** S1-AUTH-01 REST endpoints. Never trusts a browser-supplied role or user ID. */
  const authRouter = Router();
  authRouter.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  function handleError(error: unknown, response: Response): void {
    if (error instanceof AuthValidationError || error instanceof AuthCloudError) {
      const status = error instanceof AuthCloudError ? error.httpStatus : error.code === 'INVALID_CREDENTIALS' ? 401 : 400;
      response.status(status).json({success:false, error:{code:error.code, message:error.message, ...(error.field ? {field:error.field} : {}), ...(error instanceof AuthCloudError && error.recoveryAvailable ? {recoveryAvailable:true} : {})}});
      return;
    }
    response.status(503).json({success:false, error:{code:'AUTH_UNAVAILABLE', message:'Could not communicate with the authentication service.'}});
  }
  function tokenFrom(request: Request): string {
    const value = request.headers.authorization;
    return value?.startsWith('Bearer ') ? value.slice(7).trim() : '';
  }
  authRouter.post('/register', async (req: Request, res: Response) => {
    try {
      const {email, password, requestedRole} = parseRegistration(req.body);
      const session = await registerCloud(email, password, requestedRole);
      res.status(201).json({success: true, data: session});
    } catch (error) {handleError(error, res);}
  });
  authRouter.post('/login', async (req: Request, res: Response) => {
    try {
      const {email, password} = parseLogin(req.body);
      const session = await loginCloud(email, password);
      res.status(200).json({success:true, data:session});
    } catch (error) {handleError(error,res);}
  });
  authRouter.get('/session', async (req: Request, res: Response) => {
    try {
      // A verified token must still be checked against the actual Firebase user.
      const session = await currentCloudSession(tokenFrom(req));
      res.status(200).json({success:true, data:session});
    } catch (error) {handleError(error,res);}
  });
  // Firebase Client SDK refreshes the ID token before sending it here.
  // Never accept a UID, role or unverified refresh token supplied by the browser.
  authRouter.post('/refresh', async (req: Request, res: Response) => {
    try {
      const session = await currentCloudSession(tokenFrom(req), false, true);
      res.status(200).json({success: true, data: session});
    } catch (error) {handleError(error, res);}
  });
  authRouter.post('/logout', createAuthGuard(verifyFirebaseIdentity), async (req: Request, res: Response) => {
    try {
      await logoutCloud(tokenFrom(req));
      res.status(200).json({success:true, data:{loggedOut:true}});
    } catch (error) {handleError(error,res);}
  });
  return authRouter;
}

export const authRouter = createAuthRouter();
