const crypto = require('crypto');
const { nativeToScVal, Address, xdr } = require('@stellar/stellar-sdk');
const { invokeContract, readContract } = require('./stellar');
const config = require('../config');

/**
 * Generate 5 random cards.
 * Distribution: 70% Common (14-19), 25% Rare (9-13), 5% Epic (6-8)
 */
function generatePackCards() {
  const cards = [];
  for (let i = 0; i < 5; i++) {
    const roll = crypto.randomInt(100);
    let startupId, rarity;
    if (roll < config.RARITY_THRESHOLDS.COMMON) {
      rarity = 0;
      startupId = 14 + crypto.randomInt(6);
    } else if (roll < config.RARITY_THRESHOLDS.RARE) {
      rarity = 1;
      startupId = 9 + crypto.randomInt(5);
    } else {
      rarity = 2;
      startupId = 6 + crypto.randomInt(3);
    }
    cards.push({ startup_id: startupId, rarity });
  }
  return cards;
}

/**
 * Fulfill a pack opening for a player.
 * Checks open_requests > 0, generates random cards, calls open_pack on-chain.
 */
async function fulfillOpenPack(playerAddress) {
  if (!playerAddress || !playerAddress.startsWith('G')) {
    return { success: false, output: 'Invalid Stellar address' };
  }

  // Check open_requests
  const requests = await readContract('get_open_requests', [playerAddress]).catch(() => 0);
  if (!requests || requests < 1) {
    return { success: false, output: 'No pending open request. Player must call request_open_pack first.' };
  }

  const cards = generatePackCards();
  console.log(`[pack-fulfiller] Fulfilling pack for ${playerAddress}:`, cards);

  // Encode cards as Vec<(u32, u32)>
  const cardsScVal = xdr.ScVal.scvVec(
    cards.map(c =>
      xdr.ScVal.scvVec([
        nativeToScVal(c.startup_id, { type: 'u32' }),
        nativeToScVal(c.rarity, { type: 'u32' }),
      ])
    )
  );

  const result = await invokeContract('open_pack', [
    new Address(playerAddress).toScVal(),
    cardsScVal,
  ]);

  return {
    success: true,
    txId: result.txId,
    cards: cards.map(c => ({
      startup_id: c.startup_id,
      rarity: c.rarity,
      startup_name: config.STARTUPS.find(s => s.id === c.startup_id)?.name,
    })),
  };
}

module.exports = { fulfillOpenPack, generatePackCards };
