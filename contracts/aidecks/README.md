# AIDecks Smart Contract

Soroban smart contract (Rust/WASM) powering the AIDecks fantasy AI trading card game on Stellar.

## Deployed Contract

| Network | Contract ID |
|---|---|
| Testnet | `CCSL4SAOMLL42F5HSYABSQXA7KXKXJY4OMDPRM5TXQI7VJ6JS7FNMX5G` |
| Admin | `GCXKQ77XJHWKDGZ5ENGPSJEM22XZVRVYI5WO6JBCIHZGTS7TLSRV6SWW` |

---

## Architecture

All state is **public** on Stellar — no ZK proofs, no private records. Card ownership is tracked in persistent storage as a simple `Map<token_id, owner_address>`.

Payments use **XLM** via the Stellar Asset Contract (SAC). Auth is handled by Soroban's host-managed `address.require_auth()`.

---

## Contract Modules

### `types.rs` — Data Structures

```rust
CardData {
    startup_id: u32,  // 1-19 (maps to AI company)
    rarity: u32,      // 0=Common 1=Rare 2=Epic 3=Legendary
    level: u32,       // 1-5 (upgrade level)
    locked: bool,     // true when in tournament or listed
}

TournamentData {
    registration_start: u64,  // unix timestamp
    start_time: u64,
    end_time: u64,
    status: u32,      // 0=Open 2=Finalized 3=Cancelled
    entry_count: u32,
    prize_pool: i128, // XLM stroops
}

CardListing {
    seller: Address,
    price: i128,      // XLM stroops
    token_id: u32,
    listed_at: u64,
}
```

**Storage keys (`DataKey` enum):**
- `Card(u32)` — card metadata by token ID
- `CardOwner(u32)` — owner address by token ID
- `OwnerCards(Address)` — list of token IDs owned by address
- `PendingPacks(Address)` — unopened pack count
- `OpenRequests(Address)` — pending open requests (awaiting admin fulfillment)
- `Tournament(u32)` — tournament data
- `PlayerLineup(u32, Address)` — 5 card IDs entered in tournament
- `PlayerScore(u32, Address)` — calculated tournament score
- `Listing(u32)` — marketplace listing by token ID
- `ReferralEarnings(Address)` — total XLM earned from referrals

---

### `pack.rs` — Pack System

**`buy_pack(buyer, referrer?, tournament_id?)`**
- Buyer calls this, signs with Freighter
- Splits XLM payment:
  - 10% → admin (platform fee)
  - 10% → referrer (if provided)
  - 80% → tournament prize pool (or `PendingPrizePool` if no active tournament)
- Increments `PendingPacks(buyer)` by 1

**`request_open_pack(player)`**
- Player calls this to consume 1 pending pack
- Decrements `PendingPacks`, increments `OpenRequests`
- Backend server polls `OpenRequests` and fulfills with random cards

**`open_pack(player, cards: Vec<(startup_id, rarity)>)`** *(admin only)*
- Admin calls after generating 5 random cards server-side
- Mints 5 cards to player
- Pack distribution: 70% Common, 25% Rare, 5% Epic, 0% Legendary (Legendary via merge only)

---

### `card.rs` — Card Operations

**`transfer_card(from, to, token_id)`**
- Transfers ownership, updates `OwnerCards` lists for both addresses
- Card must not be locked

**`merge_cards(player, token_a, token_b, token_c, new_startup_id)`**
- Burns 3 cards of the same rarity
- Mints 1 card of the next rarity tier
- Rarity ladder: Common → Rare → Epic → Legendary
- `new_startup_id` must match the target rarity range

**`upgrade_card(player, token_id, success: bool)`** *(admin only)*
- Admin rolls success probability server-side, then calls this
- Success rates: Level 1→2: 80%, 2→3: 70%, 3→4: 60%, 4→5: 50%
- On success: increments card level
- On failure: **card is burned permanently**

---

### `tournament.rs` — Tournament System

**`create_tournament(reg_start, start_time, end_time)`** *(admin only)*
- Creates a new tournament with timestamps
- Drains `PendingPrizePool` into the new tournament's prize pool

**`enter_tournament(player, tournament_id, card_ids: Vec<u32>)`**
- Player selects 5 cards for their lineup
- Cards are **locked** (cannot be traded/upgraded) until tournament ends
- Must be called during registration window

**`set_startup_scores(tournament_id, scores: Vec<u64>)`** *(admin only)*
- Admin publishes 19 scores (one per AI company) after scoring period
- Scores are based on Twitter/X activity aggregated by the backend

**`calculate_score(player, tournament_id)`**
- Player calls this after scores are published
- Score = Σ (startup_score[i] × card_level[i]) for all 5 cards
- Stored in `PlayerScore(tournament_id, player)`

**`finalize_tournament(tournament_id)`** *(admin only)*
- Marks tournament as finalized (status = 2)
- Must be called after `end_time`

**`distribute_prize(winner, amount, tournament_id)`** *(admin only)*
- Transfers XLM from admin to winner
- Decrements `prize_pool`
- Marks `PrizeClaimed(tournament_id, winner)`

**`unlock_cards(player, tournament_id)`**
- Player calls after tournament is finalized or cancelled
- Unlocks all 5 lineup cards

**`cancel_tournament(tournament_id)`** *(admin only)*
- Sets status = 3 (Cancelled)
- Players can then unlock their cards

---

### `marketplace.rs` — P2P Marketplace

**`list_card(seller, token_id, price)`**
- Locks card and creates a `CardListing`
- Price in XLM stroops

**`cancel_listing(seller, token_id)`**
- Removes listing, unlocks card

**`buy_listing(buyer, token_id)`**
- Atomic purchase:
  - 96% of price → seller
  - 4% → admin (platform fee)
- Transfers card ownership to buyer

---

## Read-Only Functions

| Function | Returns |
|---|---|
| `get_card(token_id)` | `CardData` |
| `get_card_owner(token_id)` | `Address` |
| `get_cards_of(owner)` | `Vec<u32>` (token IDs) |
| `get_tournament(id)` | `TournamentData` |
| `get_listing(token_id)` | `Option<CardListing>` |
| `get_pending_packs(player)` | `u32` |
| `get_open_requests(player)` | `u32` |
| `get_referral_earnings(referrer)` | `i128` |
| `get_total_cards_minted()` | `u32` |
| `get_total_packs_sold()` | `u32` |
| `get_pack_price()` | `i128` |

---

## AI Company → Startup ID Mapping

| ID | Company | Rarity |
|---|---|---|
| 1 | OpenAI | Legendary |
| 2 | Anthropic | Legendary |
| 3 | Google DeepMind | Legendary |
| 4 | xAI | Legendary |
| 5 | Midjourney | Legendary |
| 6 | Meta AI | Epic |
| 7 | Alibaba | Epic |
| 8 | Z AI | Epic |
| 9 | Cursor | Rare |
| 10 | Deepseek | Rare |
| 11 | Windsurf | Rare |
| 12 | Antigravity | Rare |
| 13 | MiniMax | Rare |
| 14 | Mistral AI | Common |
| 15 | Kiro | Common |
| 16 | Perplexity | Common |
| 17 | Cohere | Common |
| 18 | Moonshot AI | Common |
| 19 | Sarvam AI | Common |

---

## Build & Deploy

```bash
# Install target
rustup target add wasm32v1-none

# Build
stellar contract build
# Output: target/wasm32v1-none/release/aidecks.wasm

# Deploy to testnet
stellar contract deploy \
  --wasm target/wasm32v1-none/release/aidecks.wasm \
  --source admin \
  --network testnet

# Initialize
stellar contract invoke \
  --id $CONTRACT_ID --source admin --network testnet \
  -- initialize \
  --admin $ADMIN_ADDRESS \
  --xlm_token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC \
  --pack_price 1000000
```

## Run Tests

```bash
cargo test
```

---

## Security Notes

- Admin key is required for: `open_pack`, `upgrade_card`, `create_tournament`, `set_startup_scores`, `finalize_tournament`, `distribute_prize`, `cancel_tournament`, `set_pack_price`
- All user-facing functions use `address.require_auth()` — Freighter handles signing
- Cards are locked during tournament entry and marketplace listings to prevent double-use
- Prize funds are held in admin's XLM balance and tracked in `prize_pool` mapping
