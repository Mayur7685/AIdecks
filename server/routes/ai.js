const express = require('express');
const router = express.Router();
const { generateRecommendation } = require('../services/ai-recommender');
const { getAggregatedScores } = require('../services/daily-scorer');

/**
 * If `startupScores` is omitted we aggregate the last 10 days of stored daily
 * scores from disk.
 */
router.post('/card-recommendation', async (req, res) => {
    try {
        const { address, cards, startupScores } = req.body || {};

        if (!address || typeof address !== 'string') {
            return res.status(400).json({ success: false, error: 'address required' });
        }
        if (!/^[GC][A-Z0-9]{54,}$/.test(address)) {
            return res.status(400).json({ success: false, error: 'invalid Stellar address' });
        }
        if (!Array.isArray(cards)) {
            return res.status(400).json({ success: false, error: 'cards array required' });
        }
        if (cards.length > 50) {
            return res.status(400).json({ success: false, error: 'cards array must have length <= 50' });
        }
        for (let i = 0; i < cards.length; i++) {
            const c = cards[i];
            if (!c || typeof c !== 'object') {
                return res.status(400).json({ success: false, error: `cards[${i}] must be an object` });
            }
            if (!Number.isInteger(c.startupId) || c.startupId < 1 || c.startupId > 19) {
                return res.status(400).json({ success: false, error: `cards[${i}].startupId must be integer 1..19` });
            }
            if (!Number.isInteger(c.level) || c.level < 1 || c.level > 5) {
                return res.status(400).json({ success: false, error: `cards[${i}].level must be integer 1..5` });
            }
        }

        // Fall back to backend-stored daily activity when frontend omits it.
        let scores = startupScores;
        if (!scores || typeof scores !== 'object') {
            scores = getAggregatedScores(10);
        }

        const recommendation = await generateRecommendation(cards, scores);
        return res.json({ success: true, data: recommendation });
    } catch (error) {
        console.error('[AI Recommender] Endpoint error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
