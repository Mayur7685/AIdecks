#![no_std]
use soroban_sdk::{contracttype, Address, Vec};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct CardData {
    pub startup_id: u32,
    pub rarity: u32,  // 0=Common 1=Rare 2=Epic 3=Legendary
    pub level: u32,   // 1-5
    pub locked: bool,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct TournamentData {
    pub registration_start: u64,
    pub start_time: u64,
    pub end_time: u64,
    pub status: u32,  // 0=Open 2=Finalized 3=Cancelled
    pub entry_count: u32,
    pub prize_pool: i128,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct CardListing {
    pub seller: Address,
    pub price: i128,
    pub token_id: u32,
    pub listed_at: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct StartupScores {
    pub scores: Vec<u64>, // 19 entries, index 0 = startup_id 1
}

#[contracttype]
pub enum DataKey {
    Admin,
    XlmToken,
    PackPrice,
    TotalCardsMinted,
    TotalPacksSold,
    PendingPrizePool,
    NextTournamentId,
    Card(u32),
    CardOwner(u32),
    OwnerCards(Address),
    PendingPacks(Address),
    OpenRequests(Address),
    Tournament(u32),
    PlayerLineup(u32, Address),
    PlayerEntered(u32, Address),
    PlayerScore(u32, Address),
    PlayerScored(u32, Address),
    PrizeClaimed(u32, Address),
    TotalTournamentScore(u32),
    StartupScores(u32),
    Listing(u32),
    ReferrerOf(Address),
    ReferralCount(Address),
    ReferralEarnings(Address),
}

// Rarity constraints: startup_id 1-5=Legendary, 6-8=Epic, 9-13=Rare, 14-19=Common
pub fn expected_rarity(startup_id: u32) -> u32 {
    if startup_id <= 5 { 3 }
    else if startup_id <= 8 { 2 }
    else if startup_id <= 13 { 1 }
    else { 0 }
}
