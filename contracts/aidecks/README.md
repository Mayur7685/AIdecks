# AIDecks Smart Contract

Soroban smart contract (Rust/WASM) powering the AIDecks fantasy AI trading card game on Stellar.

## Deployed Contract

| Network | Contract ID |
|---|---|
| Testnet | `CCIH2IGK6KAKRBTS4VNHAEHB4CK6OUIA3QWOCKEILVFFZ6V6N5XMITRG` |
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
    locked: bool,     // true when in tournament
}

TournamentData {
    registration_start: u64,  // unix timestamp
    start_time: u64,
    end_time: u64,
    status: u32,      // 0=Open 2=Finalized 3=Cancelled
    entry_count: u32,
    prize_pool: i128, // XLM stroops (remaining after auto-distribution)
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
- `TournamentPlayers(u32)` — Vec of all player addresses who entered
- `PlayerLineup(u32, Address)` — 5 card IDs entered in tournament
- `PlayerScore(u32, Address)` — calculated tournament score
- `StartupScores(u32)` — Vec<u64> of 19 scores for a tournament
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

**`merge_cards(player, token_a, token_b, token_c, new_startup_id)`**
- Burns 3 cards of the same rarity
- Mints 1 card of the next rarity tier
- Rarity ladder: Common → Rare → Epic → Legendary
- `new_startup_id` must match the target rarity range

**`upgrade_card(player, token_id, success: bool)`** *(admin only)*
- Admin rolls success probability server-side, then calls this
- Success rates: Level 1→2: 80%, 2→3: 70%, 3→4: 60%, 4→5: 50%
- On success: increments card level
- On failure: card is burned permanently

---

### `tournament.rs` — Tournament System

**`create_tournament(reg_start, start_time, end_time)`** *(admin only)*
- Creates a new tournament with timestamps
- Drains `PendingPrizePool` into the new tournament's prize pool

**`enter_tournament(player, tournament_id, card_ids: Vec<u32>)`**
- Player selects 5 cards for their lineup
- Cards are **locked** until tournament is finalized or cancelled
- Must be called during registration window (`reg_start ≤ now < start_time`)
- Player address tracked in `TournamentPlayers(tournament_id)`

**`finalize_tournament(tournament_id, scores: Vec<u64>)`** *(admin only)*
- Accepts 19 startup scores (one per AI company)
- Auto-calculates every player's score: Σ(startup_score × card_level) for 5 cards
- **Auto-distributes prizes in one transaction:**
  - 50% → 1st place player
  - 30% → 2nd place player
  - Remainder stays in `prize_pool` (carries forward to next tournament)
- Unlocks all players' cards
- Sets status = 2 (Finalized)

**`cancel_tournament(tournament_id)`** *(admin only)*
- Sets status = 3 (Cancelled)
- Players can then unlock their cards

**`distribute_prize(winner, amount, tournament_id)`** *(admin only)*
- Manual prize distribution for edge cases
- Transfers XLM from admin to winner, decrements `prize_pool`

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
| `get_card(token_id)` | `Option<CardData>` |
| `get_card_owner(token_id)` | `Option<Address>` |
| `get_cards_of(owner)` | `Vec<u32>` (token IDs) |
| `get_tournament(id)` | `Option<TournamentData>` |
| `get_tournament_players(tournament_id)` | `Vec<Address>` |
| `get_player_lineup(tournament_id, player)` | `Vec<u32>` |
| `get_player_score(tournament_id, player)` | `u64` |
| `get_startup_scores(tournament_id)` | `Option<StartupScores>` |
| `get_listing(token_id)` | `Option<CardListing>` |
| `get_pending_packs(player)` | `u32` |
| `get_open_requests(player)` | `u32` |
| `get_player_entered(tournament_id, player)` | `bool` |
| `get_next_tournament_id()` | `u32` |
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
cargo build --target wasm32v1-none --release

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
# 4 tests: initialize, buy+open pack, marketplace list+buy, tournament create+enter+finalize
```

---

## Security Notes

- Admin-only functions: `open_pack`, `upgrade_card`, `create_tournament`, `finalize_tournament`, `distribute_prize`, `cancel_tournament`, `set_pack_price`
- All user-facing functions use `address.require_auth()` — Freighter handles signing
- Cards locked during tournament entry — cannot be traded or upgraded until finalized/cancelled
- Prize auto-distribution happens atomically in `finalize_tournament` — no separate claim step needed
- Remaining prize pool carries forward to next tournament automatically
