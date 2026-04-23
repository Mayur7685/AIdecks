const crypto = require('crypto');
const { Address, nativeToScVal } = require('@stellar/stellar-sdk');
const { invokeContract } = require('./stellar');
const config = require('../config');

function rollUpgrade(currentLevel) {
  const chance = config.UPGRADE_CHANCES[currentLevel];
  if (!chance) return false;
  return crypto.randomInt(10000) < chance;
}

/**
 * Fulfill an upgrade request.
 * Admin rolls success/failure and calls upgrade_card on-chain.
 */
async function fulfillUpgrade(playerAddress, tokenId, currentLevel) {
  const success = rollUpgrade(currentLevel);

  const result = await invokeContract('upgrade_card', [
    new Address(playerAddress).toScVal(),
    nativeToScVal(tokenId, { type: 'u32' }),
    nativeToScVal(success),
  ]);

  return {
    ...result,
    upgraded: success,
    newLevel: success ? currentLevel + 1 : null,
    message: success
      ? `Upgrade successful! Level ${currentLevel} → ${currentLevel + 1}`
      : `Upgrade failed! Card burned. (${(config.UPGRADE_CHANCES[currentLevel] || 0) / 100}% chance)`,
  };
}

module.exports = { fulfillUpgrade, rollUpgrade };
