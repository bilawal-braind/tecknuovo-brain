import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { auth } from './auth.js';
import { router } from './routes.js';

const app = express();
app.use(helmet());

const origins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : false }));

app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

// Health is public (used by nginx / Azure Monitor); everything else requires auth.
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use(auth);
app.use('/api', router);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'internal' });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`Read API listening on :${port}`));
