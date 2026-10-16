import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.mjs';
import { errorHandler, notFoundHandler } from './middleware/error-handler.mjs';
import { requestContext } from './middleware/request-context.mjs';
import { authRouter } from './routes/auth.routes.mjs';
import { companyRouter } from './routes/company.routes.mjs';
import { healthRouter } from './routes/health.routes.mjs';
import { recommendationRouter } from './routes/recommendation.routes.mjs';
import { matchRouter } from './routes/match.routes.mjs';
import { aiRequirementsRouter } from './routes/ai-requirements.routes.mjs';
import { tagRouter } from './routes/tag.routes.mjs';
import { torRouter } from './routes/tor.routes.mjs';
import { thumbnailRouter } from './routes/thumbnail.routes.mjs';

export const app = express();

app.disable('x-powered-by');
// Behind Google Cloud's load balancer, trust the proxy so request.ip is the real
// client address (used only as a hashed value in audit logs).
app.set('trust proxy', env.nodeEnv === 'production' ? 1 : false);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.frontendOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    const error = new Error('This website is not allowed to call the API.');
    error.status = 403;
    error.code = 'CORS_ORIGIN_DENIED';
    callback(error);
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(requestContext);

app.get('/api', (request, response) => {
  response.json({
    service: 'TOR Software API',
    status: 'running',
    requestId: request.requestId
  });
});

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/companies', companyRouter);
app.use('/api/recommendations', recommendationRouter);
app.use('/api/matches', matchRouter);
app.use('/api/ai', aiRequirementsRouter);
app.use('/api/tags', tagRouter);
app.use('/api/tors', torRouter);
app.use('/api/thumbnail', thumbnailRouter);
app.use(notFoundHandler);
app.use(errorHandler);

