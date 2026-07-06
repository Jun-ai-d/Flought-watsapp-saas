# Dead Code Archive

This file contains unrequested abstractions, unnecessary boilerplate, and unused dependencies that were removed from the codebase during Phase 3 (Ponytail Cleanup). They are preserved here in case they are ever needed in the future.

## 1. Winston Logger Abstraction
**Location:** `backend/src/lib/logger.ts`
**Reason for removal:** This file consisted of 24 lines of boilerplate to configure `winston`, which essentially just wrapped `console.log`. Under the Ponytail Methodology, we should avoid unrequested abstractions and use native standard libraries where possible. It has been replaced with a simple export of `console` so that the rest of the app doesn't require refactoring.
**Code:**
```typescript
import winston from 'winston';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';

const customFormat = printf(({ level, message, timestamp, stack, trace_id, ...meta }) => {
  const trace = trace_id ? `[${trace_id}] ` : '';
  const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `${timestamp} ${level}: ${trace}${message} ${metaString} ${stack ? \`\\n\${stack}\` : ''}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp(),
    isProduction ? json() : combine(colorize(), customFormat)
  ),
  transports: [
    new winston.transports.Console()
  ]
});
```

## 2. Spline 3D Libraries
**Location:** `package.json`
**Dependencies:** `@splinetool/react-spline` and `@splinetool/runtime`
**Reason for removal:** These libraries are massive rendering engines for 3D web elements. They were listed as dependencies but were completely unused anywhere in the `src/` directory. Removing them speeds up `npm install` times and reduces complexity.
