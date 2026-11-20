import express, { Express } from 'express';
import { registerAiRoutes } from './routes/ai.js';
import { registerCommerceRoutes } from './routes/commerce.js';
import { registerNotificationRoutes } from './routes/notifications.js';
import { registerPodcastRoutes } from './routes/podcast.js';

/**
 * Builds the Express app that serves every /api route. Shared by the long-running
 * Node server (server.ts) and the Vercel serverless function (api/index.ts).
 */
export function createApiApp(): Express {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  registerCommerceRoutes(app);
  registerAiRoutes(app);
  registerPodcastRoutes(app);
  registerNotificationRoutes(app);

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      ai: Boolean(process.env.GEMINI_API_KEY),
      email: Boolean(process.env.RESEND_API_KEY),
    });
  });

  return app;
}
