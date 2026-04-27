const express = require('express');
const router = express.Router();
const { readContract } = require('../services/stellar');
const config = require('../config');

const RARITY_NAMES = ['Common', 'Rare', 'Epic', 'Legendary'];

// GET /api/leaderboard/:tournamentId
router.get('/:tournamentId', async (req, res) => {
    try {
        const tid = Number(req.params.tournamentId);

        // Get all players who entered (on-chain)
        const players = await readContract('get_tournament_players', [tid]).catch(() => []);
        if (!players || players.length === 0) return res.json({ success: true, data: [] });

        // Fetch score + lineup for each player in parallel
        const entries = await Promise.all(
            players.map(async (address) => {
                const [score, lineupIds] = await Promise.all([
                    readContract('get_player_score', [tid, address]).catch(() => 0),
                    readContract('get_player_lineup', [tid, address]).catch(() => []),
                ]);

                // Fetch card details for each lineup card
                const lineup = await Promise.all(
                    (lineupIds || []).map(async (tokenId) => {
                        const card = await readContract('get_card', [tokenId]).catch(() => null);
                        if (!card) return null;
                        const startupId = Number(card.startup_id ?? 0);
                        const rarity = Number(card.rarity ?? 0);
                        return {
                            tokenId,
                            startupId,
                            name: config.STARTUPS.find(s => s.id === startupId)?.name || `AI #${startupId}`,
                            rarity: RARITY_NAMES[rarity] || 'Common',
                            level: Number(card.level ?? 1),
                        };
                    })
                );

                return {
                    rank: 0,
                    address,
                    score: Number(score ?? 0),
                    lineup: lineup.filter(Boolean),
                    lastUpdated: new Date().toISOString(),
                };
            })
        );

        const ranked = entries
            .sort((a, b) => b.score - a.score)
            .map((e, i) => ({ ...e, rank: i + 1 }));

        res.json({ success: true, data: ranked });
    } catch (err) {
        res.json({ success: true, data: [], error: err.message });
    }
});

// POST /api/leaderboard/:tournamentId/register — no-op, tracked on-chain
router.post('/:tournamentId/register', (req, res) => res.json({ success: true }));

module.exports = router;
