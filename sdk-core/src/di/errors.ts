import type { DiErrorCode, DiErrorInput, DependencyPathItem } from './contracts';

export class DiError extends Error {
  readonly code: DiErrorCode;
  readonly requestScope: string;
  readonly path: readonly DependencyPathItem[];
  readonly underlyingCause?: unknown;

  constructor(message: string, input: DiErrorInput) {
    super(message);
    this.name = 'DiError';
    this.code = input.code;
    this.requestScope = input.requestScope;
    this.path = input.path;
    this.underlyingCause = input.underlyingCause;
  }
}
