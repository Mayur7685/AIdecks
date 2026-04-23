const express = require('express');
const router = express.Router();
const { readContract } = require('../services/stellar');
const config = require('../config');

const RARITY_NAMES = ['Common', 'Rare', 'Epic', 'Legendary'];
const MULTIPLIERS = [1, 3, 5, 10];

// GET /api/cards/startup/:id
router.get('/startup/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const startup = config.STARTUPS.find(s => s.id === id);
  if (!startup) return res.status(404).json({ error: 'Invalid startup ID' });
  res.json({
    ...startup,
    rarityName: RARITY_NAMES[startup.rarity],
    baseMultiplier: MULTIPLIERS[startup.rarity],
  });
});

// GET /api/cards/total
router.get('/total', async (req, res) => {
  try {
    const total = await readContract('get_total_cards_minted', []);
    res.json({ total: Number(total ?? 0), max: 50000 });
  } catch {
    res.json({ total: 0, max: 50000 });
  }
});

// GET /api/cards/:tokenId — get card data
router.get('/:tokenId', async (req, res) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    const [card, owner] = await Promise.all([
      readContract('get_card', [tokenId]),
      readContract('get_card_owner', [tokenId]),
    ]);
    if (!card) return res.status(404).json({ error: 'Card not found' });
    const startupId = Number(card.startup_id ?? card[0] ?? 0);
    const rarity = Number(card.rarity ?? card[1] ?? 0);
    res.json({
      tokenId,
      owner,
      startupId,
      rarity,
      rarityName: RARITY_NAMES[rarity] || 'Common',
      level: Number(card.level ?? card[2] ?? 1),
      locked: Boolean(card.locked ?? card[3] ?? false),
      startupName: config.STARTUPS.find(s => s.id === startupId)?.name,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cards/owner/:address — get all cards for an address
router.get('/owner/:address', async (req, res) => {
  try {
    const tokenIds = await readContract('get_cards_of', [req.params.address]);
    res.json({ address: req.params.address, tokenIds: tokenIds ?? [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
