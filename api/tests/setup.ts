import 'dotenv/config';
import { afterAll, vi } from 'vitest';

// Set consistent defaults for test env. Individual tests can override via module mocks when needed.
process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = 'http://localhost:5173';
process.env.JWT_SECRET = 'x'.repeat(32);
process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
process.env.GOOGLE_CLIENT_ID = 'client-id';
process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
process.env.TWILIO_SID = 'AC123456789012345678901234567890';
process.env.TWILIO_AUTH_TOKEN = 'twilio-token';
process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+19000000000';
process.env.URL = 'http://localhost:3000';
process.env.RATE_LIMIT_MAX = '100';
process.env.RATE_LIMIT_TIME_WINDOW = '1000';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.S3_BUCKET_NAME = 'test-bucket';

// Avoid hitting the real Google OIDC discovery endpoint during tests.
vi.mock('openid-client', () => {
  const discovery = vi.fn(async (_issuer: URL, clientId: string) => ({
    authorization_endpoint: 'https://example.com/oauth2/v2/auth',
    token_endpoint: 'https://example.com/oauth2/v2/token',
    issuer: 'https://example.com',
    jwks_uri: 'https://example.com/.well-known/jwks.json',
    response_types_supported: ['code'],
    id_token_signing_alg_values_supported: ['RS256'],
    code_challenge_methods_supported: ['S256'],
    client_id: clientId,
  }));

  const buildAuthorizationUrl = vi.fn(
    () => new URL('https://example.com/oauth2/v2/auth?state=state&nonce=nonce')
  );

  const authorizationCodeGrant = vi.fn(async () => ({
    claims: () => ({
      sub: 'google-user',
      email: 'tester@example.com',
      email_verified: true,
      name: 'Test User',
      picture: 'https://example.com/avatar.png',
    }),
  }));

  return {
    __esModule: true,
    discovery,
    buildAuthorizationUrl,
    authorizationCodeGrant,
    randomState: vi.fn(() => 'state'),
    randomNonce: vi.fn(() => 'nonce'),
    ClientSecretPost: vi.fn(() => ({ type: 'client_secret_post' })),
  };
});

afterAll(async () => {
  const tasks: Array<Promise<unknown>> = [];

  try {
    const { closeDb } = await import('../src/db/client.js');
    tasks.push(closeDb());
  } catch {
    // Ignore: DB client was never initialised.
  }

  if (tasks.length > 0) await Promise.allSettled(tasks);
});
