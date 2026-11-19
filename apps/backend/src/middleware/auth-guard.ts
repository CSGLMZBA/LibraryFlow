import type { NextFunction, Request, Response } from 'express';
/** Authenticated identity MUST be supplied by a trusted server-side token verifier.
 * Never take role/userId from request.body, query, or an unverified token. */
export type VerifiedRole = 'reader'|'publisher'|'moderator';
export interface VerifiedIdentity { uid: string; role: VerifiedRole }
export type VerifySessionToken = (token: string) => Promise<VerifiedIdentity | null>;
export function createAuthGuard(verify: VerifySessionToken, requiredRole?: VerifiedRole) {
  return async (req:Request,res:Response,next:NextFunction):Promise<void> => {
    const header=req.headers.authorization;
    const token=header?.startsWith('Bearer ') ? header.slice(7) : '';
    if(!token) {res.status(401).json({success:false,error:{code:'UNAUTHENTICATED',message:'Sign-in is required.'}});return;}
    try {
      const identity=await verify(token);
      if(!identity || !identity.uid || !['reader','publisher','moderator'].includes(identity.role)) {
        res.status(401).json({success:false,error:{code:'UNAUTHENTICATED',message:'Invalid session.'}});return;
      }
      if(requiredRole && identity.role!==requiredRole) {
        res.status(403).json({success:false,error:{code:'FORBIDDEN',message:'Acceso no autorizado.'}});return;
      }
      res.locals.auth=identity;
      next();
    } catch {
      res.status(401).json({success:false,error:{code:'UNAUTHENTICATED',message:'The session could not be validated.'}});
    }
  };
}
