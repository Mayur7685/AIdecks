const express = require('express');
const router = express.Router();
const { readContract } = require('../services/stellar');

// GET /api/marketplace/listings
router.get('/listings', async (req, res) => {
  try {
    const totalCards = await readContract('get_total_cards_minted', []).catch(() => 0);
    const total = Number(totalCards ?? 0);
    if (total === 0) return res.json({ success: true, listings: [] });

    const start = Math.max(1, total - 200);
    const checks = [];
    for (let id = start; id <= total; id++) {
      checks.push(
        readContract('get_listing', [id]).then(l => {
          if (!l) return null;
          return {
            listingId: id,
            tokenId: Number(l.token_id ?? id),
            seller: String(l.seller ?? ''),
            price: String(l.price ?? '0'),   // stringify BigInt for JSON
            listedAt: Number(l.listed_at ?? 0),
          };
        }).catch(() => null)
      );
    }
    const results = await Promise.all(checks);
    const listings = results.filter(Boolean);
    res.json({ success: true, listings });
  } catch (err) {
    console.error('[marketplace/listings]', err.message);
    res.json({ success: true, listings: [] });
  }
});

module.exports = router;
