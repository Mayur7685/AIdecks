# AIDecks

Fantasy AI Trading Card Game on Stellar. Collect, upgrade, merge, and battle with NFT cards representing the world's top AI companies — OpenAI, Anthropic, xAI, Cursor, Deepseek, and more.

**Demo Video:** [https://youtu.be/DQXrrWuChuc](https://youtu.be/DQXrrWuChuc)

## How It Works

1. **Buy packs** (0.1 XLM) → get 5 random cards
2. **Upgrade** cards Level 1–5 (higher level = bigger score multiplier)
3. **Merge** 3 same-rarity cards → 1 higher-rarity card (only way to get Legendary)
4. **Enter tournaments** — pick 5 cards, score based on real Twitter/X activity of each AI company
5. **Trade** on the marketplace — list, buy, sell cards P2P

## Card Tiers

| Rarity | Companies | Pack Drop Rate |
|---|---|---|
| Legendary | OpenAI, Anthropic, Google DeepMind, xAI, Midjourney | 0% (merge only) |
| Epic | Meta AI, Alibaba, Z AI | 5% |
| Rare | Cursor, Deepseek, Windsurf, Antigravity, MiniMax | 25% |
| Common | Mistral AI, Kiro, Perplexity, Cohere, Moonshot AI, Sarvam AI | 70% |

## Scoring

Each day, AI companies are scored based on their Twitter/X activity:
- Model releases, funding rounds, product launches → high points
- General engagement → base points
- **Card score = company points × card level**
- Tournament score = sum of all 5 cards' daily scores

## Stack

| Layer | Tech |
|---|---|
| Smart Contract | Rust → WASM → Soroban (Stellar) |
| Backend | Node.js / Express |
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Wallet | Freighter |
| AI Recommendations | OpenRouter (Gemini Flash, Llama, Mistral) |
| Scoring Data | twitterapi.io |

## Contract

| | |
|---|---|
| **Testnet ID** | `CCSL4SAOMLL42F5HSYABSQXA7KXKXJY4OMDPRM5TXQI7VJ6JS7FNMX5G` |
| **Admin** | `GCXKQ77XJHWKDGZ5ENGPSJEM22XZVRVYI5WO6JBCIHZGTS7TLSRV6SWW` |
| **Explorer** | [stellar.expert/testnet](https://stellar.expert/explorer/testnet/contract/CCSL4SAOMLL42F5HSYABSQXA7KXKXJY4OMDPRM5TXQI7VJ6JS7FNMX5G) |

See [`contracts/aidecks/README.md`](contracts/aidecks/README.md) for full contract documentation.

## Project Structure

```
unicornx-stellar/
├── contracts/aidecks/     # Soroban smart contract (Rust)
│   ├── src/
│   │   ├── lib.rs         # Entry point
│   │   ├── types.rs       # Data structures & storage keys
│   │   ├── card.rs        # Mint, transfer, merge, upgrade
│   │   ├── pack.rs        # Buy, request open, open pack
│   │   ├── tournament.rs  # Create, enter, score, finalize
│   │   └── marketplace.rs # List, cancel, buy
│   └── README.md
├── server/                # Node.js backend
│   ├── services/
│   │   ├── stellar.js     # Soroban RPC client
│   │   ├── pack-fulfiller.js
│   │   ├── upgrade-fulfiller.js
│   │   ├── ai-recommender.js
│   │   └── daily-scorer.js
│   ├── routes/            # Express API routes
│   └── jobs/
│       └── twitter-league-scorer.mjs
└── frontend/              # React app
    ├── lib/
    │   ├── stellar.ts     # Contract client + formatting
    │   └── networks.ts    # Network config
    ├── context/
    │   └── WalletContext.tsx  # Freighter integration
    ├── hooks/             # useNFT, usePacks, useTournament, etc.
    └── components/        # UI components (unchanged from original)
```

## Quick Start

### Prerequisites
- [Rust](https://rustup.rs) + `rustup target add wasm32v1-none`
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli) — `cargo install stellar-cli --features opt`
- [Freighter wallet](https://freighter.app) browser extension
- Node.js 18+

### 1. Contract (already deployed — skip if using existing)

```bash
cd contracts/aidecks
stellar contract build
stellar contract deploy \
  --wasm target/wasm32v1-none/release/aidecks.wasm \
  --source admin --network testnet
stellar contract invoke --id $CONTRACT_ID --source admin --network testnet \
  -- initialize \
  --admin $ADMIN_ADDRESS \
  --xlm_token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC \
  --pack_price 1000000
```

### 2. Backend

```bash
cd server
cp .env.example .env
# Fill in CONTRACT_ID, ADMIN_SECRET_KEY, ADMIN_PUBLIC_KEY
npm install
npm start
# Runs on http://localhost:5170
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# Fill in VITE_CONTRACT_ID, VITE_ADMIN_ADDRESS
npm install
npm run dev
# Runs on http://localhost:5171
```

## Environment Variables

**`server/.env`**
```
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NETWORK_PASSPHRASE=Test SDF Network ; September 2015
CONTRACT_ID=CCSL4SAOMLL42F5HSYABSQXA7KXKXJY4OMDPRM5TXQI7VJ6JS7FNMX5G
ADMIN_SECRET_KEY=S...
ADMIN_PUBLIC_KEY=GCXKQ77XJHWKDGZ5ENGPSJEM22XZVRVYI5WO6JBCIHZGTS7TLSRV6SWW
PORT=5170
ADMIN_API_KEY=your-secret-key
OPENROUTER_API_KEY=sk-or-...       # AI card recommendations
TWITTERAPI_IO_KEY=your-key         # Live scoring data
```

**`frontend/.env`**
```
VITE_CONTRACT_ID=CCSL4SAOMLL42F5HSYABSQXA7KXKXJY4OMDPRM5TXQI7VJ6JS7FNMX5G
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_ADMIN_ADDRESS=GCXKQ77XJHWKDGZ5ENGPSJEM22XZVRVYI5WO6JBCIHZGTS7TLSRV6SWW
VITE_API_URL=http://localhost:5170
```

## Admin Panel

Connect Freighter with the admin wallet — an **Admin** tab appears automatically in the nav. From there you can:
- Create and manage tournaments
- Set startup scores on-chain
- Distribute prizes
- View contract stats

## API Reference

| Endpoint | Description |
|---|---|
| `GET /api/info` | Contract stats (packs sold, cards minted) |
| `GET /api/packs/price` | Current pack price |
| `POST /api/packs/fulfill-open` | Admin: mint cards for player |
| `POST /api/upgrades/fulfill` | Admin: execute upgrade |
| `GET /api/tournaments/active` | Active tournament info |
| `POST /api/tournaments/create` | Admin: create tournament |
| `POST /api/tournaments/:id/set-scores` | Admin: publish startup scores |
| `POST /api/tournaments/:id/finalize` | Admin: finalize tournament |
| `POST /api/tournaments/:id/distribute-prize` | Admin: pay winner |
| `GET /api/marketplace/listings` | Active card listings |
| `GET /api/startups/scores/latest` | Latest daily scores |
| `POST /api/ai/card-recommendation` | AI lineup suggestion |

## License

MIT
