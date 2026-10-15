import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { scriptInput, detectMime, ideaInput } from './validation.js';
import { approvedCoachEmail } from './coach-access.js';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export function createApp({ store, verifyToken, origins, coachEmails = [], rateLimits = true }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || origins.includes(origin));
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use((req, res, next) => {
    if (req.headers.origin && !origins.includes(req.headers.origin))
      return res.status(403).json({ error: 'This website is not allowed to use the API.' });
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '900kb' }));

  // Authentication alone does not grant coach access. Both checks happen on the server.
  const isCoach = (u) =>
    !!u && u.email_verified === true && approvedCoachEmail(u.email, coachEmails);
  async function identity(req, res, next) {
    const value = req.get('Authorization');
    req.user = null;
    if (value) {
      if (!value.startsWith('Bearer ')) return res.status(401).json({ error: 'Sign in again.' });
      try {
        req.user = await verifyToken(value.slice(7));
      } catch {
        return res.status(401).json({ error: 'Your sign-in expired. Please sign in again.' });
      }
    }
    next();
  }
  function coach(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Sign in as a coach.' });
    if (!isCoach(req.user))
      return res.status(403).json({ error: 'Your verified email needs coach approval.' });
    next();
  }
  const writes = rateLimits
    ? rateLimit({
        windowMs: 60 * 1000,
        limit: 30,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { error: 'Too many saves. Please wait a minute and try again.' },
      })
    : (req, res, next) => next();
  const uploads = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
  });

  // Public responses omit account IDs and the email of the last editor.
  function output(s, privateView = false) {
    const { authorId, updatedBy, ...rest } = s;
    return privateView ? { ...rest, updatedBy } : rest;
  }
  app.get('/health', async (req, res) => {
    try {
      await store.health();
      res.json({ ok: true });
    } catch (e) {
      console.error('Storage health check failed', e.code || e.message);
      res.status(503).json({ ok: false });
    }
  });
  app.use('/api', identity);
  app.get('/api/me', (req, res) =>
    res.json({
      authenticated: !!req.user,
      coach: isCoach(req.user),
      approved: !!req.user && approvedCoachEmail(req.user.email, coachEmails),
      email: req.user?.email || null,
    }),
  );
  app.get('/api/ideas', coach, async (req, res) => res.json(await store.listIdeas()));
  async function saveIdea(req, res) {
    const parsed = ideaInput.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message || 'Check the idea fields.' });
    if (req.params.id && (!uuid.test(req.params.id) || parsed.data.revision === undefined))
      return res.status(400).json({ error: 'Reload the idea before saving.' });
    res
      .status(req.params.id ? 200 : 201)
      .json(await store.saveIdea(req.params.id, parsed.data, req.user));
  }
  app.post('/api/ideas', coach, writes, saveIdea);
  app.patch('/api/ideas/:id', coach, writes, saveIdea);
  app.delete('/api/ideas/:id', coach, writes, async (req, res) => {
    if (!uuid.test(req.params.id) || !Number.isInteger(req.body?.revision) || req.body.revision < 0)
      return res.status(400).json({ error: 'Reload the idea before deleting.' });
    await store.removeIdea(req.params.id, req.body.revision, req.user);
    res.json({ deleted: true });
  });
  app.get('/api/scripts', async (req, res) =>
    res.json((await store.list('published')).map((s) => output(s))),
  );
  app.get('/api/drafts', coach, async (req, res) =>
    res.json((await store.list('draft')).map((s) => output(s, true))),
  );
  app.get('/api/archive', coach, async (req, res) =>
    res.json((await store.list('archived')).map((s) => output(s, true))),
  );
  app.patch('/api/scripts/:id/pin', coach, writes, async (req, res) => {
    if (!uuid.test(req.params.id) || typeof req.body?.urgent !== 'boolean' ||
        !Number.isInteger(req.body?.revision) || req.body.revision < 0)
      return res.status(400).json({ error: 'Reload the script before pinning it.' });
    const record = await store.setPinned(req.params.id, req.body.urgent, req.body.revision, req.user);
    res.json({ id: record.id, urgent: record.urgent, revision: record.revision });
  });
  app.patch('/api/scripts/:id/archive', coach, writes, async (req, res) => {
    if (!uuid.test(req.params.id) || typeof req.body?.archived !== 'boolean' ||
        !Number.isInteger(req.body?.revision) || req.body.revision < 0)
      return res.status(400).json({ error: 'Reload the script before archiving or restoring it.' });
    const record = await store.setArchived(req.params.id, req.body.archived, req.body.revision, req.user);
    res.json({ id: record.id, status: record.status, revision: record.revision });
  });
  app.get('/api/scripts/:id', async (req, res) => {
    if (!uuid.test(req.params.id)) return res.status(404).json({ error: 'Script not found.' });
    const s = await store.get(req.params.id);
    if (!s || s.status === 'deleted' || (s.status !== 'published' && !isCoach(req.user)))
      return res.status(404).json({ error: 'Script not found.' });
    res.json(output(s, s.status !== 'published'));
  });
  async function save(req, res) {
    const parsed = scriptInput.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message || 'Check the script fields.' });
    if (req.params.id && !uuid.test(req.params.id))
      return res.status(404).json({ error: 'Script not found.' });
    if (req.params.id && parsed.data.revision === undefined)
      return res.status(400).json({ error: 'Reload the script before saving.' });
    const record = await store.save(req.params.id, parsed.data, req.user);
    res
      .status(req.params.id ? 200 : 201)
      .json({ id: record.id, revision: record.revision, status: record.status });
  }
  app.post('/api/scripts', coach, writes, save);
  app.patch('/api/scripts/:id', coach, writes, save);
  app.delete('/api/scripts/:id', coach, writes, async (req, res) => {
    if (!uuid.test(req.params.id) || !Number.isInteger(req.body?.revision) || req.body.revision < 0)
      return res.status(400).json({ error: 'Reload the script before deleting.' });
    await store.remove(req.params.id, req.body.revision, req.user);
    res.json({ deleted: true });
  });
  app.post('/api/images', coach, writes, uploads.single('image'), async (req, res) => {
    if (!req.file?.buffer.length) return res.status(400).json({ error: 'Choose an image.' });
    const mime = detectMime(req.file.buffer);
    if (!mime)
      return res.status(400).json({ error: 'Choose a valid PNG, JPG, GIF or WebP image.' });
    res.status(201).json(await store.upload(req.file.buffer, mime, req.user));
  });
  app.get('/api/images/:id', async (req, res) => {
    if (!uuid.test(req.params.id)) return res.status(404).end();
    const image = await store.image(req.params.id);
    if (!image || (!image.publishedScriptIds?.length && !isCoach(req.user)))
      return res.status(404).end();
    res.type(image.mime);
    const stream = image.stream();
    stream.on('error', (e) => {
      console.error('Image read failed', e.code || e.message);
      if (!res.headersSent) res.status(503).end();
      else res.destroy();
    });
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  });
  app.get('/api/events', async (req, res) => {
    const scope = ['draft', 'archived'].includes(req.query.scope) ? req.query.scope : 'published';
    if (scope !== 'published' && !isCoach(req.user))
      return res.status(req.user ? 403 : 401).json({ error: 'Coach access required.' });
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    let stopped = false;
    const cleanup = () => {
      if (stopped) return;
      stopped = true;
      clearInterval(heartbeat);
      clearTimeout(expiry);
      unsubscribe();
    };
    const unsubscribe = store.subscribe(
      scope,
      () => {
        if (!stopped) res.write('data: {"type":"change"}\n\n');
      },
      () => {
        res.write('data: {"type":"unavailable"}\n\n');
        res.end();
      },
    );
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);
    const expiresIn = req.user?.exp
      ? Math.max(1000, req.user.exp * 1000 - Date.now())
      : 30 * 60 * 1000;
    const expiry = setTimeout(() => res.end(), Math.min(expiresIn, 30 * 60 * 1000));
    res.on('close', cleanup);
  });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof multer.MulterError)
      return res.status(400).json({
        error:
          error.code === 'LIMIT_FILE_SIZE'
            ? 'Choose an image smaller than 5 MB.'
            : 'Invalid image upload.',
      });
    if (error.type === 'entity.too.large')
      return res.status(413).json({ error: 'This script is too long.' });
    if (error instanceof SyntaxError && 'body' in error)
      return res.status(400).json({ error: 'Invalid request data.' });
    const status = error.status || 500;
    if (status >= 500) console.error('API operation failed', error.code || error.message);
    res.status(status).json({
      error: status >= 500 ? 'Couldn’t complete this request. Please try again.' : error.message,
    });
  });
  return app;
}
