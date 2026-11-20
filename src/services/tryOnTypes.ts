export type TryOnErrorCode =
  | 'missing-key'
  | 'timeout'
  | 'network'
  | 'http'
  | 'billing'
  | 'invalid-response';

export class TryOnError extends Error {
  readonly code: TryOnErrorCode;
  readonly status?: number;

  constructor(message: string, code: TryOnErrorCode, status?: number) {
    super(message);
    this.name = 'TryOnError';
    this.code = code;
    this.status = status;
  }
}
