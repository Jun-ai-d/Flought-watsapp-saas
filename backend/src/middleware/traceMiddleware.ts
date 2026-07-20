import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      traceId: string;
    }
  }
}

// H-7 Fix: validate the supplied trace ID is a proper UUID before trusting it.
// Accepting arbitrary strings enables log injection attacks.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const traceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const supplied = req.headers['x-trace-id'] as string | undefined;
  const traceId = (supplied && UUID_REGEX.test(supplied)) ? supplied : uuidv4();
  req.traceId = traceId;
  res.setHeader('x-trace-id', traceId);
  next();
};
