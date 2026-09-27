export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError'
