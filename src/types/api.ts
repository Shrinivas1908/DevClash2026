export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiEnvelope<T> {
  data: T;
  error: string | null;
  status: number;
}
