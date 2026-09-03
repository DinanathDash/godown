import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import apiRoutes from './routes';

const app = express();

app.use(helmet());
const allowedOrigins = env.CORS_ORIGINS.split(',').map((origin) =>
  origin.trim().replace(/\/$/, ''),
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));

app.use(
  pinoHttp({
    level: env.LOG_LEVEL,
    customSuccessMessage: (req, res) => {
      return `${req.method} ${req.url} [${res.statusCode}]`;
    },
    customErrorMessage: (req, res, err) => {
      return `${req.method} ${req.url} [${res.statusCode}] - ${err.message}`;
    },
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true, ignore: 'req,res,responseTime' } }
        : undefined,
  }),
);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

if (process.env.NODE_ENV !== 'test') {
  app.use('/api/auth/login', limiter);
}

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
