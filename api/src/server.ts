import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { auth } from './auth.js';
import { router } from './routes.js';

const app = express();
// Behind the vite proxy / nginx / tunnel: trust the first proxy hop so the rate
// limiter keys on each USER's IP instead of one shared bucket for everybody.
app.set('trust proxy', 1);
app.use(helmet());

const origins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : false }));

app.use(express.json({ limit: '1mb' }));

// Health is public and UNMETERED (nginx / Azure Monitor probe it constantly —
// it must not burn the rate budget or start failing under load).
app.get('/health', (_req, res) => res.json({ ok: true }));

app.use(rateLimit({ windowMs: 60_000, max: 120 }));
app.use(auth);
app.use('/api', router);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'internal' });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`Read API listening on :${port}`));
