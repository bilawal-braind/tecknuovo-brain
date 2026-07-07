import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

// Pluggable auth.
//   AUTH_MODE=token (dev)  -> shared bearer token (no per-user identity, full access).
//   AUTH_MODE=entra (prod) -> validates the user's Microsoft (Entra) sign-in token,
//                             confirms it's a TN account, and attaches req.user so the
//                             routes can scope data to what that person is allowed to see.
const TENANT = process.env.ENTRA_TENANT_ID || '';
// The dashboard signs in as this app, so the id_token's audience is the client id.
const AUDIENCE = process.env.ENTRA_CLIENT_ID || process.env.ENTRA_API_AUDIENCE || '';
const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || 'tecknuovo.com').toLowerCase();
const ISSUER = `https://login.microsoftonline.com/${TENANT}/v2.0`;
const JWKS = TENANT
  ? createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${TENANT}/discovery/v2.0/keys`))
  : null;

export type AuthedUser = { email: string; oid?: string; name?: string };

export async function auth(req: Request, res: Response, next: NextFunction) {
  const mode = process.env.AUTH_MODE || 'token';

  if (mode === 'token') {
    const token = (req.header('authorization') || '').replace(/^Bearer\s+/i, '');
    if (token && token === process.env.API_TOKEN) return next();
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (mode === 'entra') {
    if (!JWKS || !TENANT || !AUDIENCE) {
      return res.status(500).json({ error: 'entra not configured (set ENTRA_TENANT_ID + ENTRA_CLIENT_ID)' });
    }
    try {
      const token = (req.header('authorization') || '').replace(/^Bearer\s+/i, '');
      if (!token) return res.status(401).json({ error: 'unauthorized' });
      const { payload } = await jwtVerify(token, JWKS, { issuer: ISSUER, audience: AUDIENCE });
      const email = String(payload.email || payload.preferred_username || '').toLowerCase();
      // Belt-and-braces: the single-tenant app already blocks non-TN accounts; we double-check the domain.
      if (!email || !email.endsWith('@' + ALLOWED_DOMAIN)) {
        return res.status(403).json({ error: 'not a Tecknuovo account' });
      }
      (req as Request & { user?: AuthedUser }).user = {
        email,
        oid: typeof payload.oid === 'string' ? payload.oid : undefined,
        name: typeof payload.name === 'string' ? payload.name : undefined,
      };
      return next();
    } catch (e) {
      // Log the real reason (e.g. "unexpected 'aud' claim value", "exp claim timestamp check failed")
      // so token issues are diagnosable from the API console.
      console.warn('[auth] token rejected:', e instanceof Error ? e.message : String(e));
      return res.status(401).json({ error: 'invalid or expired token' });
    }
  }

  return res.status(401).json({ error: 'unauthorized' });
}
