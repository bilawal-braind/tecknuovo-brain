import type { Request, Response, NextFunction } from 'express';

// Pluggable auth. AUTH_MODE=token (dev) checks a shared bearer token.
// AUTH_MODE=entra validates the user's Entra ID access token (enable once the app registration exists).
export function auth(req: Request, res: Response, next: NextFunction) {
  const mode = process.env.AUTH_MODE || 'token';

  if (mode === 'token') {
    const header = req.header('authorization') || '';
    const token = header.replace(/^Bearer\s+/i, '');
    if (token && token === process.env.API_TOKEN) return next();
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (mode === 'entra') {
    // TODO: validate JWT via Microsoft JWKS — check signature, issuer (tenant), audience,
    // then attach req.user (oid, roles) for row-level authorisation. Wire when the app reg is ready.
    return res.status(501).json({ error: 'entra auth not yet configured' });
  }

  return res.status(401).json({ error: 'unauthorized' });
}
