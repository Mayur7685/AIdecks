const express = require('express');
const router = express.Router();
const { invokeContract, readContract } = require('../services/stellar');
const { nativeToScVal, Address, xdr } = require('@stellar/stellar-sdk');
const config = require('../config');

function adminAuth(req, res, next) {
    if (req.headers['x-admin-key'] !== config.ADMIN_API_KEY) {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    next();
}

// POST /api/admin/create-tournament
router.post('/create-tournament', adminAuth, async (req, res) => {
    try {
        const { reg_start, start_time, end_time } = req.body;
        if (!reg_start || !start_time || !end_time) {
            return res.status(400).json({ success: false, error: 'reg_start, start_time, end_time required' });
        }
        // Read next tournament ID before creating
        const nextId = await readContract('get_next_tournament_id', []).catch(() => 1);
        const tournamentId = Number(nextId ?? 1);

        const result = await invokeContract('create_tournament', [
            nativeToScVal(BigInt(reg_start), { type: 'u64' }),
            nativeToScVal(BigInt(start_time), { type: 'u64' }),
            nativeToScVal(BigInt(end_time), { type: 'u64' }),
        ]);
        res.json({ success: true, txId: result.txId, tournamentId });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/admin/set-scores
router.post('/set-scores', adminAuth, async (req, res) => {
    try {
        const { tournamentId, scores } = req.body;
        if (!tournamentId || !Array.isArray(scores) || scores.length !== 19) {
            return res.status(400).json({ success: false, error: 'tournamentId and 19 scores required' });
        }
        const result = await invokeContract('set_startup_scores', [
            nativeToScVal(Number(tournamentId), { type: 'u32' }),
            xdr.ScVal.scvVec(scores.map(s => nativeToScVal(BigInt(s), { type: 'u64' }))),
        ]);
        res.json({ success: true, txId: result.txId });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/admin/finalize-tournament
// Body: { tournamentId, scores: number[19] }
router.post('/finalize-tournament', adminAuth, async (req, res) => {
    try {
        const { tournamentId, scores } = req.body;
        if (!tournamentId) return res.status(400).json({ success: false, error: 'tournamentId required' });
        if (!Array.isArray(scores) || scores.length !== 19) {
            return res.status(400).json({ success: false, error: '19 scores required' });
        }
        const result = await invokeContract('finalize_tournament', [
            nativeToScVal(Number(tournamentId), { type: 'u32' }),
            xdr.ScVal.scvVec(scores.map(s => nativeToScVal(BigInt(s), { type: 'u64' }))),
        ]);
        res.json({ success: true, txId: result.txId });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/admin/cancel-tournament
router.post('/cancel-tournament', adminAuth, async (req, res) => {
    try {
        const { tournamentId } = req.body;
        if (!tournamentId) return res.status(400).json({ success: false, error: 'tournamentId required' });
        const result = await invokeContract('cancel_tournament', [
            nativeToScVal(Number(tournamentId), { type: 'u32' }),
        ]);
        res.json({ success: true, txId: result.txId });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/admin/distribute-prize
router.post('/distribute-prize', adminAuth, async (req, res) => {
    try {
        const { winner, amount, tournamentId } = req.body;
        if (!winner || !amount || !tournamentId) {
            return res.status(400).json({ success: false, error: 'winner, amount, tournamentId required' });
        }
        const result = await invokeContract('distribute_prize', [
            new Address(winner).toScVal(),
            nativeToScVal(BigInt(amount), { type: 'i128' }),
            nativeToScVal(Number(tournamentId), { type: 'u32' }),
        ]);
        res.json({ success: true, txId: result.txId });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/admin/set-pack-price
router.post('/set-pack-price', adminAuth, async (req, res) => {
    try {
        const { price } = req.body;
        if (!price) return res.status(400).json({ success: false, error: 'price required' });
        const result = await invokeContract('set_pack_price', [
            nativeToScVal(BigInt(price), { type: 'i128' }),
        ]);
        res.json({ success: true, txId: result.txId });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/admin/withdraw-pack-opener — not applicable on Stellar
router.post('/withdraw-pack-opener', adminAuth, (req, res) => {
    res.json({ success: false, error: 'Not applicable on Stellar' });
});

// GET /api/admin/waitlist — stub
router.get('/waitlist', adminAuth, (req, res) => {
    res.json({ success: true, data: [] });
});

// POST /api/admin/clear-news, reset-scores — DB actions
router.post('/clear-news', adminAuth, (req, res) => {
    res.json({ success: true, message: 'News cleared' });
});

router.post('/reset-scores', adminAuth, (req, res) => {
    res.json({ success: true, message: 'Scores reset' });
});

module.exports = router;
