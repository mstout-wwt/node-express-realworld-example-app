import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import auth from './auth';

const SECRET = process.env.JWT_SECRET || 'superSecret';

// ── Minimal test apps ──────────────────────────────────────────────────────────

function makeRequiredApp() {
  const app = express();
  app.get('/protected', auth.required, (req, res) => {
    res.json({ id: (req as any).auth?.user?.id });
  });
  return app;
}

function makeOptionalApp() {
  const app = express();
  app.get('/optional', auth.optional, (req, res) => {
    res.json({ id: (req as any).auth?.user?.id ?? null });
  });
  return app;
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function mintToken(userId: number, secret = SECRET): string {
  return jwt.sign({ user: { id: userId } }, secret, { algorithm: 'HS256', expiresIn: '60d' });
}

// ── auth.required ──────────────────────────────────────────────────────────────

describe('auth.required middleware', () => {
  const app = makeRequiredApp();

  it('returns 401 when no Authorization header is present', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization scheme is not Token or Bearer', async () => {
    const token = mintToken(42);
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Basic ${token}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 for a token signed with the wrong secret', async () => {
    const token = mintToken(42, 'wrongSecret');
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Token ${token}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed token string', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Token not.a.jwt');
    expect(res.status).toBe(401);
  });

  it('accepts a valid token with the "Token" scheme and exposes req.auth.user.id', async () => {
    const token = mintToken(7);
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Token ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(7);
  });

  it('accepts a valid token with the "Bearer" scheme', async () => {
    const token = mintToken(99);
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(99);
  });
});

// ── auth.optional ──────────────────────────────────────────────────────────────

describe('auth.optional middleware', () => {
  const app = makeOptionalApp();

  it('allows through a request with no Authorization header (id is null)', async () => {
    const res = await request(app).get('/optional');
    expect(res.status).toBe(200);
    expect(res.body.id).toBeNull();
  });

  it('still returns 401 for an invalid token', async () => {
    const token = mintToken(1, 'wrongSecret');
    const res = await request(app)
      .get('/optional')
      .set('Authorization', `Token ${token}`);
    expect(res.status).toBe(401);
  });

  it('populates req.auth when a valid token is supplied', async () => {
    const token = mintToken(5);
    const res = await request(app)
      .get('/optional')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(5);
  });
});
