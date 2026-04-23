require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5170,
  ADMIN_SECRET_KEY: process.env.ADMIN_SECRET_KEY,
  ADMIN_PUBLIC_KEY: process.env.ADMIN_PUBLIC_KEY,
  CONTRACT_ID: process.env.CONTRACT_ID,
  SOROBAN_RPC_URL: process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
  NETWORK_PASSPHRASE: process.env.NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  ADMIN_API_KEY: process.env.ADMIN_API_KEY,

  // 19 AI companies/tools
  STARTUPS: [
    { id: 1,  name: 'OpenAI',          rarity: 3 },
    { id: 2,  name: 'Anthropic',       rarity: 3 },
    { id: 3,  name: 'Google DeepMind', rarity: 3 },
    { id: 4,  name: 'xAI',             rarity: 3 },
    { id: 5,  name: 'Midjourney',      rarity: 3 },
    { id: 6,  name: 'Meta AI',         rarity: 2 },
    { id: 7,  name: 'Alibaba',         rarity: 2 },
    { id: 8,  name: 'Z AI',            rarity: 2 },
    { id: 9,  name: 'Cursor',          rarity: 1 },
    { id: 10, name: 'Deepseek',        rarity: 1 },
    { id: 11, name: 'Windsurf',        rarity: 1 },
    { id: 12, name: 'Antigravity',     rarity: 1 },
    { id: 13, name: 'MiniMax',         rarity: 1 },
    { id: 14, name: 'Mistral AI',      rarity: 0 },
    { id: 15, name: 'Kiro',            rarity: 0 },
    { id: 16, name: 'Perplexity',      rarity: 0 },
    { id: 17, name: 'Cohere',          rarity: 0 },
    { id: 18, name: 'Moonshot AI',     rarity: 0 },
    { id: 19, name: 'Sarvam AI',       rarity: 0 },
  ],

  RARITY_THRESHOLDS: { COMMON: 70, RARE: 95 },
  UPGRADE_CHANCES: { 1: 8000, 2: 7000, 3: 6000, 4: 5000 },
};
