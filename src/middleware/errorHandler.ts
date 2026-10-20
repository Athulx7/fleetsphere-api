import type { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const errorObj = err instanceof Error ? err : new Error(String(err));

  // Log detailed error server-side
  console.error(`[API Error] ${req.method} ${req.url}:`, errorObj.message);
  if (errorObj.stack) {
    console.error(errorObj.stack);
  }

  // Sanitized client response: never expose stack traces, connection strings, credentials
  res.status(500).json({
    success: false,
    message: 'An unexpected internal server error occurred. Please contact support.',
    error: process.env.NODE_ENV === 'development' ? errorObj.message : undefined,
  });
}
