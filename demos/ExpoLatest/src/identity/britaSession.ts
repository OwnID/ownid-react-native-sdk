import type { LoginPayload } from '@ownid/react-native-core';

export type BritaUser = Readonly<{
  email: string;
  firstName: string | null;
  lastName: string | null;
}>;

export type BritaSession = Readonly<{
  token: string;
  user: BritaUser;
}>;

export async function createBritaSession(payload: LoginPayload, currentUserUrl: string, signal: AbortSignal): Promise<BritaSession> {
  if (typeof payload.token !== 'string' || payload.token.trim().length === 0) throw invalidSession();

  let response: Response;
  try {
    response = await fetch(currentUserUrl, {
      headers: { Authorization: `Bearer ${payload.token}` },
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error('Brita session creation failed.', { cause: error });
  }

  if (!response.ok) throw new Error(`Brita session creation failed (HTTP ${response.status}).`);

  let value: unknown;
  try {
    value = (await response.json()) as unknown;
  } catch {
    throw invalidUser();
  }

  if (!isRecord(value) || !isRecord(value.user) || typeof value.user.email !== 'string' || value.user.email.trim().length === 0) {
    throw invalidUser();
  }
  const firstName = optionalString(value.user.firstName);
  const lastName = optionalString(value.user.lastName);
  const user = Object.freeze({ email: value.user.email, firstName, lastName });
  return Object.freeze({ token: payload.token, user });
}

function optionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw invalidUser();
  return value;
}

function invalidSession(): Error {
  return new Error('Brita returned an invalid session.');
}

function invalidUser(): Error {
  return new Error('Brita returned an invalid current user.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
