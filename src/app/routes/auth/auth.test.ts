import { getTokenFromHeaders } from './auth';
import * as express from 'express';

function makeRequest(authorization?: string): express.Request {
  return {
    headers: authorization ? { authorization } : {},
  } as express.Request;
}

describe('getTokenFromHeaders', () => {
  test('returns the JWT string for Token scheme', () => {
    const req = makeRequest('Token eyJhbGciOiJIUzI1NiJ9.payload.sig');
    expect(getTokenFromHeaders(req)).toBe('eyJhbGciOiJIUzI1NiJ9.payload.sig');
  });

  test('returns the JWT string for Bearer scheme', () => {
    const req = makeRequest('Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig');
    expect(getTokenFromHeaders(req)).toBe('eyJhbGciOiJIUzI1NiJ9.payload.sig');
  });

  test('returns the JWT string for X-Token scheme', () => {
    const req = makeRequest('X-Token eyJhbGciOiJIUzI1NiJ9.payload.sig');
    expect(getTokenFromHeaders(req)).toBe('eyJhbGciOiJIUzI1NiJ9.payload.sig');
  });

  test('returns null for an unsupported scheme (Basic)', () => {
    const req = makeRequest('Basic dXNlcjpwYXNz');
    expect(getTokenFromHeaders(req)).toBeNull();
  });

  test('returns null when Authorization header is absent', () => {
    const req = makeRequest();
    expect(getTokenFromHeaders(req)).toBeNull();
  });

  test('returns the JWT string for lowercase token scheme', () => {
    const req = makeRequest('token eyJhbGciOiJIUzI1NiJ9.payload.sig');
    expect(getTokenFromHeaders(req)).toBe('eyJhbGciOiJIUzI1NiJ9.payload.sig');
  });

  test('returns the JWT string for lowercase bearer scheme', () => {
    const req = makeRequest('bearer eyJhbGciOiJIUzI1NiJ9.payload.sig');
    expect(getTokenFromHeaders(req)).toBe('eyJhbGciOiJIUzI1NiJ9.payload.sig');
  });

  test('returns the JWT string for lowercase x-token scheme', () => {
    const req = makeRequest('x-token eyJhbGciOiJIUzI1NiJ9.payload.sig');
    expect(getTokenFromHeaders(req)).toBe('eyJhbGciOiJIUzI1NiJ9.payload.sig');
  });

  test('returns the JWT string for mixed case schemes', () => {
    const req1 = makeRequest('BEARER eyJhbGciOiJIUzI1NiJ9.payload.sig');
    expect(getTokenFromHeaders(req1)).toBe('eyJhbGciOiJIUzI1NiJ9.payload.sig');

    const req2 = makeRequest('X-TOKEN eyJhbGciOiJIUzI1NiJ9.payload.sig');
    expect(getTokenFromHeaders(req2)).toBe('eyJhbGciOiJIUzI1NiJ9.payload.sig');

    const req3 = makeRequest('ToKeN eyJhbGciOiJIUzI1NiJ9.payload.sig');
    expect(getTokenFromHeaders(req3)).toBe('eyJhbGciOiJIUzI1NiJ9.payload.sig');
  });
});
