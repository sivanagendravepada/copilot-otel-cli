import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';
import { BackendError, validateToken } from '../lib/backend-client.js';

const BACKEND = 'http://backend.test';

const server = setupServer(
  http.post(`${BACKEND}/cli/validate-token`, async ({ request }) => {
    const auth = request.headers.get('authorization');
    if (auth === 'Bearer good') {
      return HttpResponse.json({ ok: true, username: 'alice', userId: 'u_1' });
    }
    if (auth === 'Bearer slow') {
      await delay(500);
      return HttpResponse.json({ ok: true, username: 'slow', userId: 'u_2' });
    }
    return new HttpResponse(null, { status: 401 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('backend-client.validateToken', () => {
  it('returns parsed response on 200', async () => {
    const res = await validateToken({ backend: BACKEND, token: 'good' });
    expect(res).toEqual({ ok: true, username: 'alice', userId: 'u_1' });
  });

  it('throws BackendError(unauthorized) on 401', async () => {
    await expect(validateToken({ backend: BACKEND, token: 'bad' })).rejects.toMatchObject({
      name: 'BackendError',
      code: 'unauthorized',
      status: 401,
    });
  });

  it('throws BackendError(timeout) when the request exceeds the timeout', async () => {
    await expect(
      validateToken({ backend: BACKEND, token: 'slow', timeoutMs: 50 }),
    ).rejects.toMatchObject({ name: 'BackendError', code: 'timeout' });
  });

  it('BackendError instances are catchable as such', async () => {
    try {
      await validateToken({ backend: BACKEND, token: 'bad' });
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(BackendError);
    }
  });
});
