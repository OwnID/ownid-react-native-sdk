import type { LoginPayload } from '@ownid/react-native-core';

export type DemoSession = Readonly<{
  token: string;
  loginId: string;
}>;

export type DemoUser = Readonly<{
  email: string;
  name: string | null;
}>;

export function sessionFromLoginPayload(payload: LoginPayload): DemoSession {
  const sessionPayload = typeof payload.data === 'string' || isRecord(payload.data) ? payload.data : payload;
  const value = typeof sessionPayload === 'string' ? parseJson(sessionPayload) : sessionPayload;

  if (!isRecord(value) || typeof value.token !== 'string') {
    throw invalidSession();
  }

  return { token: value.token, loginId: payload.metadata.loginId };
}

export async function loadProfile(baseUrl: string, session: DemoSession, signal: AbortSignal): Promise<DemoUser> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}profile`, {
      headers: { Authorization: `Bearer ${session.token}` },
      signal,
    });
  } catch (cause) {
    if (signal.aborted) throw cause;
    throw Object.assign(new Error('Demo Identity profile request failed.'), { cause });
  }

  if (!response.ok) throw new Error(`Demo Identity profile request failed (HTTP ${response.status}).`);

  let value: unknown;
  try {
    value = (await response.json()) as unknown;
  } catch {
    throw invalidProfile();
  }

  if (
    !isRecord(value) ||
    typeof value.email !== 'string' ||
    (value.name !== undefined && value.name !== null && typeof value.name !== 'string')
  ) {
    throw invalidProfile();
  }

  return Object.freeze({ email: value.email, name: value.name ?? null });
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw invalidSession();
  }
}

function invalidSession(): Error {
  return new Error('Demo Identity returned an invalid session.');
}

function invalidProfile(): Error {
  return new Error('Demo Identity returned an invalid profile.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
