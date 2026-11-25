import type { NextFunction, Request, Response } from 'express';
/** Authenticated identity MUST be supplied by a trusted server-side token verifier.
 * Never take role/userId from request.body, query, or an unverified token. */
export type VerifiedRole = 'reader'|'publisher'|'moderator';
export interface VerifiedIdentity { uid: string; role: VerifiedRole }
export type VerifySessionToken = (token: string) => Promise<VerifiedIdentity | null>;
export function createAuthGuard(verify: VerifySessionToken, requiredRole?: VerifiedRole) {
  return async (req:Request,res:Response,next:NextFunction):Promise<void> => {
    const header=req.headers.authorization;
    const token=header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if(!token) {res.status(401).json({success:false,error:{code:'AUTH_REQUIRED',message:'Sign-in is required.'}});return;}
    try {
      const identity=await verify(token);
      if(!identity || !identity.uid || !['reader','publisher','moderator'].includes(identity.role)) {
        res.status(401).json({success:false,error:{code:'AUTH_INVALID',message:'Invalid session.'}});return;
      }
      if(requiredRole && identity.role!==requiredRole) {
        res.status(403).json({success:false,error:{code:'FORBIDDEN',message:'Access is not authorized.'}});return;
      }
      res.locals.auth=identity;
      next();
    } catch (error) {
      if ((error as {code?: string}).code === 'ACCOUNT_RESTRICTED') {
        res.status(403).json({success:false,error:{code:'ACCOUNT_RESTRICTED',message:'This account is restricted or pending deletion.'}});return;
      }
      res.status(503).json({success:false,error:{code:'AUTH_UNAVAILABLE',message:'The authentication service is unavailable.'}});
    }
  };
}
