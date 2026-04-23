use soroban_sdk::{symbol_short, token, Address, Env, Vec};
use crate::types::{CardData, DataKey, StartupScores, TournamentData};

pub fn create_tournament(env: Env, reg_start: u64, start_time: u64, end_time: u64) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();

    assert!(start_time > reg_start && end_time > start_time, "invalid times");

    let next_id: u32 = env.storage().instance().get(&DataKey::NextTournamentId).unwrap_or(1);
    let pending: i128 = env.storage().instance().get(&DataKey::PendingPrizePool).unwrap_or(0);

    env.storage().persistent().set(&DataKey::Tournament(next_id), &TournamentData {
        registration_start: reg_start,
        start_time,
        end_time,
        status: 0,
        entry_count: 0,
        prize_pool: pending,
    });

    env.storage().instance().set(&DataKey::PendingPrizePool, &0i128);
    env.storage().instance().set(&DataKey::NextTournamentId, &(next_id + 1));

    env.events().publish((symbol_short!("tourn_new"), admin), next_id);
}

pub fn enter_tournament(env: Env, player: Address, tournament_id: u32, card_ids: Vec<u32>) {
    player.require_auth();
    assert_eq!(card_ids.len(), 5, "must provide 5 cards");

    let mut t: TournamentData = env.storage().persistent()
        .get(&DataKey::Tournament(tournament_id)).unwrap();
    assert_eq!(t.status, 0, "tournament not open");
    let now = env.ledger().timestamp();
    assert!(now >= t.registration_start && now < t.start_time, "not in registration window");

    let entered_key = DataKey::PlayerEntered(tournament_id, player.clone());
    assert!(!env.storage().persistent().has(&entered_key), "already entered");

    // verify ownership and lock cards
    for tid in card_ids.iter() {
        let owner: Address = env.storage().persistent().get(&DataKey::CardOwner(tid)).unwrap();
        assert_eq!(owner, player, "not owner");
        let mut card: CardData = env.storage().persistent().get(&DataKey::Card(tid)).unwrap();
        assert!(!card.locked, "card already locked");
        card.locked = true;
        env.storage().persistent().set(&DataKey::Card(tid), &card);
    }

    env.storage().persistent().set(&entered_key, &true);
    env.storage().persistent().set(&DataKey::PlayerLineup(tournament_id, player.clone()), &card_ids);

    t.entry_count += 1;
    env.storage().persistent().set(&DataKey::Tournament(tournament_id), &t);

    env.events().publish((symbol_short!("tourn_ent"), player), tournament_id);
}

pub fn set_startup_scores(env: Env, tournament_id: u32, scores: Vec<u64>) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();

    assert_eq!(scores.len(), 19, "must provide 19 scores");

    let t: TournamentData = env.storage().persistent()
        .get(&DataKey::Tournament(tournament_id)).unwrap();
    assert_eq!(t.status, 0, "tournament not open");
    assert!(env.ledger().timestamp() >= t.start_time, "tournament not started");

    env.storage().persistent().set(&DataKey::StartupScores(tournament_id), &StartupScores { scores });

    env.events().publish((symbol_short!("scores"), admin), tournament_id);
}

pub fn calculate_score(env: Env, player: Address, tournament_id: u32) {
    player.require_auth();

    let t: TournamentData = env.storage().persistent()
        .get(&DataKey::Tournament(tournament_id)).unwrap();
    assert_eq!(t.status, 0, "tournament not open");
    assert!(env.ledger().timestamp() >= t.start_time, "tournament not started");

    let entered_key = DataKey::PlayerEntered(tournament_id, player.clone());
    assert!(env.storage().persistent().has(&entered_key), "not entered");

    let scored_key = DataKey::PlayerScored(tournament_id, player.clone());
    assert!(!env.storage().persistent().has(&scored_key), "already scored");

    let lineup: Vec<u32> = env.storage().persistent()
        .get(&DataKey::PlayerLineup(tournament_id, player.clone())).unwrap();
    let startup_scores: StartupScores = env.storage().persistent()
        .get(&DataKey::StartupScores(tournament_id)).unwrap();

    let mut total: u64 = 0;
    for tid in lineup.iter() {
        let card: CardData = env.storage().persistent().get(&DataKey::Card(tid)).unwrap();
        let idx = (card.startup_id - 1) as usize;
        let base_score = startup_scores.scores.get(idx as u32).unwrap_or(0);
        total += base_score * card.level as u64;
    }

    env.storage().persistent().set(&DataKey::PlayerScore(tournament_id, player.clone()), &total);
    env.storage().persistent().set(&scored_key, &true);

    let prev_total: u64 = env.storage().persistent()
        .get(&DataKey::TotalTournamentScore(tournament_id)).unwrap_or(0);
    env.storage().persistent().set(&DataKey::TotalTournamentScore(tournament_id), &(prev_total + total));

    env.events().publish((symbol_short!("score"), player), (tournament_id, total));
}

pub fn finalize_tournament(env: Env, tournament_id: u32) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();

    let mut t: TournamentData = env.storage().persistent()
        .get(&DataKey::Tournament(tournament_id)).unwrap();
    assert_eq!(t.status, 0, "already finalized");
    assert!(env.ledger().timestamp() >= t.end_time, "tournament not ended");

    t.status = 2;
    env.storage().persistent().set(&DataKey::Tournament(tournament_id), &t);

    env.events().publish((symbol_short!("tourn_fin"), admin), tournament_id);
}

pub fn distribute_prize(env: Env, winner: Address, amount: i128, tournament_id: u32) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();

    let mut t: TournamentData = env.storage().persistent()
        .get(&DataKey::Tournament(tournament_id)).unwrap();
    assert_eq!(t.status, 2, "tournament not finalized");
    assert!(t.prize_pool >= amount, "insufficient prize pool");

    let scored_key = DataKey::PlayerScored(tournament_id, winner.clone());
    assert!(env.storage().persistent().has(&scored_key), "player did not score");

    let claimed_key = DataKey::PrizeClaimed(tournament_id, winner.clone());
    assert!(!env.storage().persistent().has(&claimed_key), "already claimed");

    let xlm_token: Address = env.storage().instance().get(&DataKey::XlmToken).unwrap();
    let xlm = token::Client::new(&env, &xlm_token);
    xlm.transfer(&admin, &winner, &amount);

    t.prize_pool -= amount;
    env.storage().persistent().set(&DataKey::Tournament(tournament_id), &t);
    env.storage().persistent().set(&claimed_key, &true);

    env.events().publish((symbol_short!("prize"), winner), (tournament_id, amount));
}

pub fn unlock_cards(env: Env, player: Address, tournament_id: u32) {
    player.require_auth();

    let t: TournamentData = env.storage().persistent()
        .get(&DataKey::Tournament(tournament_id)).unwrap();
    assert!(t.status == 2 || t.status == 3, "tournament not finalized/cancelled");

    let lineup: Vec<u32> = env.storage().persistent()
        .get(&DataKey::PlayerLineup(tournament_id, player.clone())).unwrap();

    for tid in lineup.iter() {
        let mut card: CardData = env.storage().persistent().get(&DataKey::Card(tid)).unwrap();
        card.locked = false;
        env.storage().persistent().set(&DataKey::Card(tid), &card);
    }

    env.events().publish((symbol_short!("unlock"), player), tournament_id);
}

pub fn cancel_tournament(env: Env, tournament_id: u32) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();

    let mut t: TournamentData = env.storage().persistent()
        .get(&DataKey::Tournament(tournament_id)).unwrap();
    assert_eq!(t.status, 0, "already finalized/cancelled");

    t.status = 3;
    env.storage().persistent().set(&DataKey::Tournament(tournament_id), &t);

    env.events().publish((symbol_short!("tourn_can"), admin), tournament_id);
}
