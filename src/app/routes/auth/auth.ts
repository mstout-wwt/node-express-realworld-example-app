import { expressjwt as jwt } from 'express-jwt';
import * as express from 'express';

export const getTokenFromHeaders = (req: express.Request): string | null => {
  const authorization = req.headers.authorization;
  if (!authorization) return null;

  const [scheme, token] = authorization.split(' ');
  if (['token', 'bearer', 'x-token'].includes(scheme?.toLowerCase()) && token) {
    return token;
  }
  return null;
};

const auth = {
  required: jwt({
    secret: process.env.JWT_SECRET || 'superSecret',
    getToken: getTokenFromHeaders,
    algorithms: ['HS256'],
  }),
  optional: jwt({
    secret: process.env.JWT_SECRET || 'superSecret',
    credentialsRequired: false,
    getToken: getTokenFromHeaders,
    algorithms: ['HS256'],
  }),
};

export default auth;
