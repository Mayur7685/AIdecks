const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const config = require('./config');

const app = express();

const ALLOWED_ORIGINS = [
  'http://localhost:5171',
  'http://localhost:5170',
  'http://localhost:5173',
  'https://stellar.aidecks.fun',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());

// ── In-memory user store ──────────────────────────────────────────────────
const userStore = new Map();

app.get('/api/users/:address', (req, res) => {
  const addr = req.params.address;
  const cached = userStore.get(addr);
  if (cached) return res.json({ success: true, data: cached });
  res.json({ success: false, data: null });
});

app.post('/api/users/register', (req, res) => {
  const { address, username, avatar, referrer } = req.body || {};
  if (!address) return res.json({ success: false, error: 'address required' });
  const isNew = !userStore.has(address);
  const profile = {
    address,
    username: username || address.slice(0, 12),
    avatar: avatar || null,
    referrer: referrer || null,
    createdAt: isNew ? Date.now() : (userStore.get(address)?.createdAt || Date.now()),
  };
  userStore.set(address, profile);
  res.json({ success: true, data: profile, isNew });
});

app.put('/api/users/:address', (req, res) => {
  const { address } = req.params;
  const { username, avatar } = req.body || {};
  const existing = userStore.get(address) || { address };
  const updated = { ...existing, username: username || existing.username, avatar: avatar || existing.avatar };
  userStore.set(address, updated);
  res.json({ success: true, data: updated });
});

// Routes registered before the catch-all active endpoint

// ── Contracts info ────────────────────────────────────────────────────────
app.get('/api/contracts', (req, res) => {
  res.json({
    contractId: config.CONTRACT_ID,
    network: 'testnet',
    admin: config.ADMIN_PUBLIC_KEY,
  });
});

// ── Leaderboard stub ──────────────────────────────────────────────────────
app.get('/api/leaderboard/:tournamentId', (req, res) => {
  res.json({ success: true, data: [] });
});

// ── Top startups ──────────────────────────────────────────────────────────
function topStartupsHandler(req, res) {
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit) || 5));
  const days = Math.max(1, Math.min(30, parseInt(req.query.days) || 10));
  const { getAggregatedScores } = require('./services/daily-scorer');
  const agg = getAggregatedScores(days);
  const ranked = config.STARTUPS
    .map(s => ({ name: s.name, points: Number(agg[`s${s.id}`] || 0) }))
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
  res.json({ success: true, data: ranked });
}
app.get('/api/top-startups', topStartupsHandler);
app.get('/api/top-startups/:tournamentId', topStartupsHandler);

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api', require('./routes/feed'));
app.use('/api/packs', require('./routes/packs'));
app.use('/api/upgrades', require('./routes/upgrades'));
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/cards', require('./routes/cards'));
app.use('/api/startups', require('./routes/startups'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/marketplace', require('./routes/marketplace'));

// ── Health / Info ─────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', contractId: config.CONTRACT_ID, network: 'testnet' });
});

app.get('/api/info', async (req, res) => {
  try {
    const [packsSold, totalCards, packPrice] = await Promise.all([
      readContract('get_total_packs_sold', []).catch(() => 0),
      readContract('get_total_cards_minted', []).catch(() => 0),
      readContract('get_pack_price', []).catch(() => 1000000),
    ]);
    res.json({
      contractId: config.CONTRACT_ID,
      network: 'testnet',
      packsSold: Number(packsSold ?? 0),
      totalCards: Number(totalCards ?? 0),
      packPrice: `${Number(packPrice ?? 1000000) / 10_000_000} XLM`,
      maxPacks: 10000,
      maxCards: 50000,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Daily scorer cron ─────────────────────────────────────────────────────
const { runDailyScorer, getLatestScores, todayKey } = require('./services/daily-scorer');

cron.schedule('10 0 * * *', async () => {
  try {
    console.log('[cron] Running daily scorer at', new Date().toISOString());
    await runDailyScorer();
  } catch (err) {
    console.error('[cron] Daily scorer failed:', err.message);
  }
}, { timezone: 'UTC' });

(async () => {
  try {
    const latest = getLatestScores();
    if (latest.date !== todayKey()) {
      console.log('[startup] No entry for today — running daily scorer in background');
      runDailyScorer().catch(err => console.error('[startup] Scorer failed:', err.message));
    }
  } catch { /* noop */ }
})();

app.listen(config.PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║         AIDecks Backend                     ║
╠══════════════════════════════════════════════════════╣
║  Port:       ${config.PORT}                                  ║
║  Contract:   ${config.CONTRACT_ID?.slice(0,20)}...  ║
║  Network:    Stellar Testnet                         ║
╚══════════════════════════════════════════════════════╝
  `);
});
