import { Request, Response, NextFunction } from 'express';

export default function rateLimiter(req: Request, res: Response, next: NextFunction) {
  // Basic rate limiting - can be enhanced
  next();
}
