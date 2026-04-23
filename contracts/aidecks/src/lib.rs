#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, Vec};

mod types;
mod card;
mod pack;
mod tournament;
mod marketplace;

use types::{CardData, CardListing, DataKey, TournamentData};

#[contract]
pub struct UnicornX;

#[contractimpl]
impl UnicornX {
    // ── Admin setup ──────────────────────────────────────────────────
    pub fn initialize(env: Env, admin: Address, xlm_token: Address, pack_price: i128) {
        assert!(!env.storage().instance().has(&DataKey::Admin), "already initialized");
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::XlmToken, &xlm_token);
        env.storage().instance().set(&DataKey::PackPrice, &pack_price);
        env.storage().instance().set(&DataKey::TotalCardsMinted, &0u32);
        env.storage().instance().set(&DataKey::TotalPacksSold, &0u32);
        env.storage().instance().set(&DataKey::PendingPrizePool, &0i128);
        env.storage().instance().set(&DataKey::NextTournamentId, &1u32);
    }

    pub fn set_pack_price(env: Env, new_price: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        assert!(new_price > 0, "price must be positive");
        env.storage().instance().set(&DataKey::PackPrice, &new_price);
    }

    // ── Pack buy/open ────────────────────────────────────────────────
    pub fn buy_pack(env: Env, buyer: Address, referrer: Option<Address>, tournament_id: Option<u32>) {
        pack::buy_pack(env, buyer, referrer, tournament_id);
    }

    pub fn request_open_pack(env: Env, player: Address) {
        pack::request_open_pack(env, player);
    }

    pub fn open_pack(env: Env, player: Address, cards: Vec<(u32, u32)>) {
        pack::open_pack(env, player, cards);
    }

    // ── Card operations ──────────────────────────────────────────────
    pub fn transfer_card(env: Env, from: Address, to: Address, token_id: u32) {
        card::transfer_card(env, from, to, token_id);
    }

    pub fn merge_cards(env: Env, player: Address, token_a: u32, token_b: u32, token_c: u32, new_startup_id: u32) {
        card::merge_cards(env, player, token_a, token_b, token_c, new_startup_id);
    }

    pub fn upgrade_card(env: Env, player: Address, token_id: u32, success: bool) {
        card::upgrade_card(env, player, token_id, success);
    }

    // ── Tournament ───────────────────────────────────────────────────
    pub fn create_tournament(env: Env, reg_start: u64, start_time: u64, end_time: u64) {
        tournament::create_tournament(env, reg_start, start_time, end_time);
    }

    pub fn enter_tournament(env: Env, player: Address, tournament_id: u32, card_ids: Vec<u32>) {
        tournament::enter_tournament(env, player, tournament_id, card_ids);
    }

    pub fn set_startup_scores(env: Env, tournament_id: u32, scores: Vec<u64>) {
        tournament::set_startup_scores(env, tournament_id, scores);
    }

    pub fn calculate_score(env: Env, player: Address, tournament_id: u32) {
        tournament::calculate_score(env, player, tournament_id);
    }

    pub fn finalize_tournament(env: Env, tournament_id: u32) {
        tournament::finalize_tournament(env, tournament_id);
    }

    pub fn distribute_prize(env: Env, winner: Address, amount: i128, tournament_id: u32) {
        tournament::distribute_prize(env, winner, amount, tournament_id);
    }

    pub fn unlock_cards(env: Env, player: Address, tournament_id: u32) {
        tournament::unlock_cards(env, player, tournament_id);
    }

    pub fn cancel_tournament(env: Env, tournament_id: u32) {
        tournament::cancel_tournament(env, tournament_id);
    }

    // ── Marketplace ──────────────────────────────────────────────────
    pub fn list_card(env: Env, seller: Address, token_id: u32, price: i128) {
        marketplace::list_card(env, seller, token_id, price);
    }

    pub fn cancel_listing(env: Env, seller: Address, token_id: u32) {
        marketplace::cancel_listing(env, seller, token_id);
    }

    pub fn buy_listing(env: Env, buyer: Address, token_id: u32) {
        marketplace::buy_listing(env, buyer, token_id);
    }

    // ── Read-only ────────────────────────────────────────────────────
    pub fn get_card(env: Env, token_id: u32) -> CardData {
        env.storage().persistent().get(&DataKey::Card(token_id)).unwrap()
    }

    pub fn get_card_owner(env: Env, token_id: u32) -> Address {
        env.storage().persistent().get(&DataKey::CardOwner(token_id)).unwrap()
    }

    pub fn get_cards_of(env: Env, owner: Address) -> Vec<u32> {
        env.storage().persistent().get(&DataKey::OwnerCards(owner)).unwrap_or(Vec::new(&env))
    }

    pub fn get_tournament(env: Env, id: u32) -> TournamentData {
        env.storage().persistent().get(&DataKey::Tournament(id)).unwrap()
    }

    pub fn get_listing(env: Env, token_id: u32) -> Option<CardListing> {
        env.storage().persistent().get(&DataKey::Listing(token_id))
    }

    pub fn get_pending_packs(env: Env, player: Address) -> u32 {
        env.storage().persistent().get(&DataKey::PendingPacks(player)).unwrap_or(0)
    }

    pub fn get_open_requests(env: Env, player: Address) -> u32 {
        env.storage().persistent().get(&DataKey::OpenRequests(player)).unwrap_or(0)
    }

    pub fn get_referral_earnings(env: Env, referrer: Address) -> i128 {
        env.storage().persistent().get(&DataKey::ReferralEarnings(referrer)).unwrap_or(0)
    }

    pub fn get_total_cards_minted(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::TotalCardsMinted).unwrap_or(0)
    }

    pub fn get_total_packs_sold(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::TotalPacksSold).unwrap_or(0)
    }

    pub fn get_pack_price(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::PackPrice).unwrap_or(0)
    }
}
