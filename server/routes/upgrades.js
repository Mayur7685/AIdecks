const express = require('express');
const router = express.Router();
const { fulfillUpgrade } = require('../services/upgrade-fulfiller');

// POST /api/upgrades/fulfill
// Body: { playerAddress, tokenId, currentLevel }
router.post('/fulfill', async (req, res) => {
  try {
    const { playerAddress, tokenId, currentLevel } = req.body;
    if (!playerAddress || !tokenId || !currentLevel) {
      return res.status(400).json({ error: 'playerAddress, tokenId, currentLevel required' });
    }
    const result = await fulfillUpgrade(playerAddress, Number(tokenId), Number(currentLevel));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
