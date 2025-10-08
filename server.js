/**
 * server.js (updated - safer lowdb init + await before listen)
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;

// Data dir (Render mounts /data)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// LowDB setup
const adapter = new JSONFile(path.join(DATA_DIR, 'db.json'));
const db = new Low(adapter);

// safer init function
async function initDB() {
  try {
    // Try reading existing DB (may throw if file malformed)
    await db.read();
  } catch (readErr) {
    console.error('lowdb read error (will re-initialize):', readErr && readErr.message ? readErr.message : readErr);
    // if read fails (corrupted file etc.), ensure db.data has a fallback object
    db.data = {};
  }

  // Ensure default structure
  db.data = db.data || {
    posts: [],
    videos: [],
    photos: [],
    visitors: [],
    admin: { email: 'asadul43255@gmail.com', password: '2344329040@a' }
  };

  // Sanity: keep visitors length bounded to avoid huge db.json
  if (!Array.isArray(db.data.visitors)) db.data.visitors = [];

  try {
    await db.write();
  } catch (writeErr) {
    console.error('lowdb write error during init:', writeErr && writeErr.message ? writeErr.message : writeErr);
    // If write keeps failing, still continue but warn
  }
}

// Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, Date.now() + '-' + nanoid(6) + ext);
  }
});
const upload = multer({ storage });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'change-this-secret',
  resave: false,
  saveUninitialized: true
}));

// Visitor logging middleware (wrapped in try/catch to avoid crashing)
app.use(async (req, res, next) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    await db.read();
    if (!Array.isArray(db.data.visitors)) db.data.visitors = [];
    db.data.visitors.push({ ip, path: req.path, time: new Date().toISOString() });
    // keep visitor array bounded
    if (db.data.visitors.length > 5000) db.data.visitors.shift();
    await db.write();
  } catch (err) {
    console.error('Visitor logging failed:', err && err.message ? err.message : err);
    // Don't block the request on logging failure
  }
  next();
});

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.redirect('/admin/login');
}

// Routes (same as before)
app.get('/', async (req, res) => {
  await db.read();
  const videos = (db.data.videos || []).slice().reverse().filter(v => v.visible !== false);
  const photos = (db.data.photos || []).slice().reverse().filter(p => p.visible !== false);
  const posts = (db.data.posts || []).slice().reverse().filter(p => p.visible !== false);
  res.render('index', { videos, photos, posts, user: req.session.user || null });
});

app.get('/videos', async (req, res) => {
  await db.read();
  res.render('videos', { videos: (db.data.videos || []).slice().reverse() });
});
app.get('/photos', async (req, res) => {
  await db.read();
  res.render('photos', { photos: (db.data.photos || []).slice().reverse() });
});
app.get('/blog', async (req, res) => {
  await db.read();
  res.render('blog', { posts: (db.data.posts || []).slice().reverse() });
});

app.get('/post/:id', async (req, res) => {
  await db.read();
  const post = (db.data.posts || []).find(p => p.id === req.params.id);
  if (!post) return res.status(404).send('Not found');
  res.render('post', { post });
});

// Admin auth
app.get('/admin/login', (req, res) => res.render('login', { error: null }));
app.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  await db.read();
  const admin = db.data.admin || {};
  if (email === admin.email && password === admin.password) {
    req.session.authenticated = true;
    req.session.user = { email };
    res.redirect('/admin/dashboard');
  } else {
    res.render('login', { error: 'Invalid credentials' });
  }
});
app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Admin dashboard
app.get('/admin/dashboard', requireAuth, async (req, res) => {
  await db.read();
  res.render('admin', {
    posts: (db.data.posts || []).slice().reverse(),
    videos: (db.data.videos || []).slice().reverse(),
    photos: (db.data.photos || []).slice().reverse(),
    visitors: (db.data.visitors || []).slice().reverse(),
    admin: db.data.admin || { email: '', password: '' }
  });
});

// Create blog post
app.post('/admin/post/blog', requireAuth, upload.array('mediaFiles', 6), async (req, res) => {
  await db.read();
  const { title, content, mediaLinks } = req.body;
  const files = (req.files || []).map(f => ({ type: 'file', path: '/uploads/' + path.basename(f.path), originalname: f.originalname }));
  const links = mediaLinks ? (Array.isArray(mediaLinks) ? mediaLinks : [mediaLinks]).filter(Boolean).map(l => ({ type: 'link', url: l })) : [];
  db.data.posts = db.data.posts || [];
  db.data.posts.push({
    id: nanoid(),
    title: title || '',
    content: content || '',
    media: [...files, ...links],
    created_at: new Date().toISOString(),
    visible: true
  });
  await db.write();
  res.redirect('/admin/dashboard');
});

// Create video
app.post('/admin/post/video', requireAuth, upload.single('videoFile'), async (req, res) => {
  await db.read();
  const { title, videoLink } = req.body;
  const fileObj = req.file ? { type: 'file', path: '/uploads/' + path.basename(req.file.path), originalname: req.file.originalname } : null;
  const linkObj = videoLink ? { type: 'link', url: videoLink } : null;
  db.data.videos = db.data.videos || [];
  db.data.videos.push({
    id: nanoid(),
    title: title || '',
    media: [fileObj, linkObj].filter(Boolean),
    created_at: new Date().toISOString(),
    visible: true
  });
  await db.write();
  res.redirect('/admin/dashboard');
});

// Create photo
app.post('/admin/post/photo', requireAuth, upload.array('photoFiles', 12), async (req, res) => {
  await db.read();
  const { title, photoLinks } = req.body;
  const files = (req.files || []).map(f => ({ type: 'file', path: '/uploads/' + path.basename(f.path), originalname: f.originalname }));
  const links = photoLinks ? (Array.isArray(photoLinks) ? photoLinks : [photoLinks]).filter(Boolean).map(l => ({ type: 'link', url: l })) : [];
  db.data.photos = db.data.photos || [];
  db.data.photos.push({
    id: nanoid(),
    title: title || '',
    media: [...files, ...links],
    created_at: new Date().toISOString(),
    visible: true
  });
  await db.write();
  res.redirect('/admin/dashboard');
});

// Delete / toggle
app.post('/admin/item/:type/:id/delete', requireAuth, async (req, res) => {
  const { type, id } = req.params;
  await db.read();
  if (type === 'post') db.data.posts = (db.data.posts || []).filter(p => p.id !== id);
  if (type === 'video') db.data.videos = (db.data.videos || []).filter(p => p.id !== id);
  if (type === 'photo') db.data.photos = (db.data.photos || []).filter(p => p.id !== id);
  await db.write();
  res.redirect('/admin/dashboard');
});
app.post('/admin/item/:type/:id/toggle', requireAuth, async (req, res) => {
  const { type, id } = req.params;
  await db.read();
  const list = type === 'post' ? db.data.posts : type === 'video' ? db.data.videos : db.data.photos;
  const item = (list || []).find(i => i.id === id);
  if (item) item.visible = !item.visible;
  await db.write();
  res.redirect('/admin/dashboard');
});

// Update admin creds
app.post('/admin/settings/credentials', requireAuth, async (req, res) => {
  const { email, password } = req.body;
  await db.read();
  db.data.admin = db.data.admin || {};
  db.data.admin.email = email || db.data.admin.email;
  db.data.admin.password = password || db.data.admin.password;
  await db.write();
  res.redirect('/admin/dashboard');
});

// Visitors management
app.post('/admin/visitors/clear', requireAuth, async (req, res) => {
  await db.read();
  db.data.visitors = [];
  await db.write();
  res.redirect('/admin/dashboard');
});
app.post('/admin/visitor/:index/delete', requireAuth, async (req, res) => {
  const idx = parseInt(req.params.index, 10);
  await db.read();
  if (!isNaN(idx)) { (db.data.visitors || []).splice(idx, 1); await db.write(); }
  res.redirect('/admin/dashboard');
});

// Start server only after DB init completes
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on ${PORT}, data dir ${DATA_DIR}`);
  });
}).catch(err => {
  console.error('Failed to initialize DB, starting server anyway with empty DB:', err && err.message ? err.message : err);
  // still try to start server to inspect logs
  app.listen(PORT, () => {
    console.log(`Server running on ${PORT}, data dir ${DATA_DIR}`);
  });
});
