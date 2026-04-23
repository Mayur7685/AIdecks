const express = require('express');
const router = express.Router();
const { readContract } = require('../services/stellar');
const config = require('../config');

// GET /api/marketplace/listings
// Scans recent token IDs for active listings
router.get('/listings', async (req, res) => {
  try {
    const totalCards = await readContract('get_total_cards_minted', []).catch(() => 0);
    const listings = [];
    // Scan last 200 token IDs for active listings
    const start = Math.max(1, Number(totalCards) - 200);
    const checks = [];
    for (let id = start; id <= Number(totalCards); id++) {
      checks.push(
        readContract('get_listing', [id]).then(l => {
          if (!l) return null;
          return {
            listingId: id,
            tokenId: id,
            seller: String(l.seller ?? l[0] ?? ''),
            price: BigInt(l.price ?? l[1] ?? 0),
            listedAt: Number(l.listed_at ?? l[3] ?? 0),
          };
        }).catch(() => null)
      );
    }
    const results = await Promise.all(checks);
    results.forEach(l => l && listings.push(l));
    res.json({ success: true, listings });
  } catch (err) {
    res.json({ success: true, listings: [] });
  }
});

module.exports = router;
