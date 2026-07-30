import path from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isTest } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.routes.js';
import { catalogRouter } from './routes/catalog.routes.js';
import { meRouter } from './routes/me.routes.js';
import { plannerRouter } from './routes/planner.routes.js';
import { itinerariesRouter } from './routes/itineraries.routes.js';
import { adminRouter } from './routes/admin.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  if (!isTest) app.use(morgan('dev'));

  // Uploaded images are served read-only; nothing here is executable.
  app.use(
    '/uploads',
    express.static(path.resolve(env.UPLOAD_DIR), {
      index: false,
      dotfiles: 'deny',
      maxAge: '7d',
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'sufara-api', routing: env.ROUTING_PROVIDER });
  });

  const v1 = express.Router();
  v1.use('/auth', authRouter);
  v1.use('/', catalogRouter);
  v1.use('/me', meRouter);
  v1.use('/planner', plannerRouter);
  v1.use('/itineraries', itinerariesRouter);
  v1.use('/admin', adminRouter);

  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
