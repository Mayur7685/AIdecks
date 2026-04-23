const express = require('express');
const router = express.Router();
const { fulfillOpenPack } = require('../services/pack-fulfiller');
const { readContract } = require('../services/stellar');

// POST /api/packs/fulfill-open
router.post('/fulfill-open', async (req, res) => {
  try {
    const { player } = req.body;
    if (!player || !player.startsWith('G')) {
      return res.status(400).json({ error: 'Valid Stellar address required' });
    }
    const result = await fulfillOpenPack(player);
    if (result.success) {
      res.json({ success: true, txId: result.txId, cards: result.cards });
    } else {
      res.status(500).json({ success: false, error: result.output });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/packs/status/:address — poll for fulfilled cards
router.get('/status/:address', async (req, res) => {
  try {
    const requests = await readContract('get_open_requests', [req.params.address]).catch(() => 0);
    // If open_requests dropped to 0, cards were minted — frontend should refresh
    res.json({ success: true, fulfilled: !requests || requests === 0, cards: [] });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// GET /api/packs/price
router.get('/price', async (req, res) => {
  try {
    const price = await readContract('get_pack_price', []);
    res.json({ price: Number(price ?? 1000000), priceXlm: Number(price ?? 1000000) / 10_000_000 });
  } catch {
    res.json({ price: 1000000, priceXlm: 0.1 });
  }
});

// GET /api/packs/sold
router.get('/sold', async (req, res) => {
  try {
    const sold = await readContract('get_total_packs_sold', []);
    res.json({ sold: Number(sold ?? 0), max: 10000 });
  } catch {
    res.json({ sold: 0, max: 10000 });
  }
});

module.exports = router;
