const express = require('express');
const router = express.Router();
const { readContract, invokeContract } = require('../services/stellar');
const { Address, nativeToScVal } = require('@stellar/stellar-sdk');
const config = require('../config');

function adminAuth(req, res, next) {
  if (req.headers['x-admin-key'] !== config.ADMIN_API_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
}

// GET /api/tournaments — list all tournaments
router.get('/', async (req, res) => {
  try {
    const out = [];
    for (let id = 1; id <= 20; id++) {
      const t = await readContract('get_tournament', [id]).catch(() => null);
      if (!t) continue;
      out.push({
        id,
        status: Number(t.status ?? t[3] ?? 0n),
        prize_pool: Number(BigInt(t.prize_pool ?? 0)),
        entry_count: Number(t.entry_count ?? t[4] ?? 0n),
        reg_height: Number(t.registration_start ?? t[0] ?? 0n),
        start_height: Number(t.start_time ?? t[1] ?? 0n),
        end_height: Number(t.end_time ?? t[2] ?? 0n),
      });
    }
    res.json(out);
  } catch (err) {
    res.json([]);
  }
});

// GET /api/tournaments/active
router.get('/active', async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    let mostRecent = null;
    for (let id = 1; id <= 50; id++) {
      const t = await readContract('get_tournament', [id]).catch(() => null);
      if (!t) break;
      const regStart = Number(t.registration_start ?? 0n);
      if (regStart === 0) break;
      const startTime = Number(t.start_time ?? 0n);
      const endTime = Number(t.end_time ?? 0n);
      const status = Number(t.status ?? 0n);
      const entryCount = Number(t.entry_count ?? 0n);
      const prizePool = Number(BigInt(t.prize_pool ?? 0));
      const statusStr = status === 0
        ? (now < startTime ? 'registration' : now < endTime ? 'active' : 'ended')
        : status === 2 ? 'finalized' : 'cancelled';
      const shaped = {
        id, registrationStart: regStart, startTime, endTime,
        status: statusStr, entryCount,
        prizePool: (prizePool / 10_000_000).toFixed(2),
      };
      mostRecent = shaped;
      if (statusStr === 'registration' || statusStr === 'active') {
        return res.json({ success: true, data: shaped });
      }
    }
    res.json({ success: true, data: mostRecent });
  } catch (err) {
    console.error('[tournaments/active]', err.message);
    res.json({ success: false, data: null, error: err.message });
  }
});

// GET /api/tournaments/:id
router.get('/:id', async (req, res) => {
  try {
    const t = await readContract('get_tournament', [Number(req.params.id)]);
    if (!t) return res.status(404).json({ error: 'Not found' });
    res.json({ id: Number(req.params.id), ...t });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tournaments/:id/set-scores — admin sets startup scores on-chain
router.post('/:id/set-scores', adminAuth, async (req, res) => {
  try {
    const { scores } = req.body; // array of 19 numbers
    if (!Array.isArray(scores) || scores.length !== 19) {
      return res.status(400).json({ error: '19 scores required' });
    }
    const result = await invokeContract('set_startup_scores', [
      nativeToScVal(Number(req.params.id), { type: 'u32' }),
      nativeToScVal(scores.map(s => BigInt(s))),
    ]);
    res.json({ success: true, txId: result.txId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tournaments/:id/finalize — admin finalizes
router.post('/:id/finalize', adminAuth, async (req, res) => {
  try {
    const result = await invokeContract('finalize_tournament', [
      nativeToScVal(Number(req.params.id), { type: 'u32' }),
    ]);
    res.json({ success: true, txId: result.txId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tournaments/:id/distribute-prize
// Body: { winner, amount }
router.post('/:id/distribute-prize', adminAuth, async (req, res) => {
  try {
    const { winner, amount } = req.body;
    const result = await invokeContract('distribute_prize', [
      new Address(winner).toScVal(),
      nativeToScVal(BigInt(amount)),
      nativeToScVal(Number(req.params.id), { type: 'u32' }),
    ]);
    res.json({ success: true, txId: result.txId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tournaments/create — admin creates tournament
// Body: { reg_start, start_time, end_time } (unix timestamps)
router.post('/create', adminAuth, async (req, res) => {
  try {
    const { reg_start, start_time, end_time } = req.body;
    const result = await invokeContract('create_tournament', [
      nativeToScVal(BigInt(reg_start)),
      nativeToScVal(BigInt(start_time)),
      nativeToScVal(BigInt(end_time)),
    ]);
    res.json({ success: true, txId: result.txId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
