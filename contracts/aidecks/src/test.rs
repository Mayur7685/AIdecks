#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token, Address, Env, Vec,
};

use crate::{UnicornX, UnicornXClient};

fn setup(env: &Env) -> (UnicornXClient, Address, Address, Address) {
    let contract_id = env.register_contract(None, UnicornX);
    let client = UnicornXClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let player = Address::generate(env);

    let xlm_id = env.register_stellar_asset_contract_v2(admin.clone()).address();

    env.mock_all_auths();
    let xlm = token::StellarAssetClient::new(env, &xlm_id);
    xlm.mint(&player, &100_000_000i128);
    xlm.mint(&admin, &100_000_000i128);

    client.initialize(&admin, &xlm_id, &1_000_000i128);

    (client, admin, player, xlm_id)
}

// Test 1: Initialize sets correct pack price and zero counters
#[test]
fn test_initialize_and_pack_price() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, _player, _xlm) = setup(&env);

    assert_eq!(client.get_pack_price(), 1_000_000i128);
    assert_eq!(client.get_total_cards_minted(), 0u32);
    assert_eq!(client.get_total_packs_sold(), 0u32);
}

// Test 2: Buy pack → request open → admin fulfills → player owns 5 cards
#[test]
fn test_buy_and_open_pack() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, player, _xlm) = setup(&env);

    client.buy_pack(&player, &None, &None);
    assert_eq!(client.get_pending_packs(&player), 1u32);
    assert_eq!(client.get_total_packs_sold(), 1u32);

    client.request_open_pack(&player);
    assert_eq!(client.get_pending_packs(&player), 0u32);
    assert_eq!(client.get_open_requests(&player), 1u32);

    let cards = Vec::from_array(
        &env,
        [(14u32, 0u32), (15u32, 0u32), (16u32, 0u32), (9u32, 1u32), (6u32, 2u32)],
    );
    client.open_pack(&player, &cards);

    assert_eq!(client.get_cards_of(&player).len(), 5u32);
    assert_eq!(client.get_total_cards_minted(), 5u32);
    assert_eq!(client.get_open_requests(&player), 0u32);
}

// Test 3: List card on marketplace → buyer purchases → ownership transfers
#[test]
fn test_marketplace_list_and_buy() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, player, xlm_id) = setup(&env);

    let buyer = Address::generate(&env);
    let xlm = token::StellarAssetClient::new(&env, &xlm_id);
    xlm.mint(&buyer, &100_000_000i128);

    let cards = Vec::from_array(
        &env,
        [(14u32, 0u32), (15u32, 0u32), (16u32, 0u32), (17u32, 0u32), (18u32, 0u32)],
    );
    client.buy_pack(&player, &None, &None);
    client.request_open_pack(&player);
    client.open_pack(&player, &cards);

    let token_id = client.get_cards_of(&player).get(0).unwrap();

    client.list_card(&player, &token_id, &2_000_000i128);
    let listing = client.get_listing(&token_id).unwrap();
    assert_eq!(listing.seller, player);
    assert_eq!(listing.price, 2_000_000i128);

    client.buy_listing(&buyer, &token_id);
    assert_eq!(client.get_card_owner(&token_id), Some(buyer));
    assert!(client.get_listing(&token_id).is_none());
}

// Test 4: Create tournament → player enters → admin finalizes with scores → prizes distributed
#[test]
fn test_tournament_create_enter_finalize() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, player, xlm_id) = setup(&env);

    let player2 = Address::generate(&env);
    let xlm = token::StellarAssetClient::new(&env, &xlm_id);
    xlm.mint(&player2, &100_000_000i128);

    // Give both players 5 cards each (startup_id, rarity) — must match expected_rarity
    // IDs 1-5=Legendary(3), 6-8=Epic(2), 9-13=Rare(1), 14-19=Common(0)
    let cards1 = Vec::from_array(&env, [(14u32,0u32),(15u32,0u32),(16u32,0u32),(9u32,1u32),(6u32,2u32)]);
    let cards2 = Vec::from_array(&env, [(17u32,0u32),(18u32,0u32),(19u32,0u32),(10u32,1u32),(7u32,2u32)]);

    client.buy_pack(&player, &None, &None);
    client.request_open_pack(&player);
    client.open_pack(&player, &cards1);

    client.buy_pack(&player2, &None, &None);
    client.request_open_pack(&player2);
    client.open_pack(&player2, &cards2);

    // Create tournament with reg_start=0, start=1, end=2
    env.ledger().set_timestamp(0);
    client.create_tournament(&0u64, &1u64, &2u64);
    let t = client.get_tournament(&1u32).unwrap();
    assert_eq!(t.status, 0u32);

    // Enter during registration window (timestamp=0, reg_start=0, start=1)
    let lineup1 = client.get_cards_of(&player);
    let lineup2 = client.get_cards_of(&player2);
    client.enter_tournament(&player, &1u32, &lineup1);
    client.enter_tournament(&player2, &1u32, &lineup2);

    let players = client.get_tournament_players(&1u32);
    assert_eq!(players.len(), 2u32);

    // Advance time past end_time for finalize
    env.ledger().set_timestamp(3);

    // Admin finalizes with 19 startup scores
    let scores = Vec::from_array(&env, [
        100u64, 90u64, 80u64, 70u64, 60u64,
        50u64, 40u64, 30u64, 20u64, 10u64,
        5u64, 4u64, 3u64, 2u64, 1u64,
        0u64, 0u64, 0u64, 0u64,
    ]);
    client.finalize_tournament(&1u32, &scores);

    let t = client.get_tournament(&1u32).unwrap();
    assert_eq!(t.status, 2u32); // Finalized
}
