use soroban_sdk::{symbol_short, token, Address, Env, Vec};
use crate::types::{DataKey, expected_rarity};
use crate::card::mint_card;

pub fn buy_pack(env: Env, buyer: Address, referrer: Option<Address>, tournament_id: Option<u32>) {
    buyer.require_auth();

    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    let xlm_token: Address = env.storage().instance().get(&DataKey::XlmToken).unwrap();
    let price: i128 = env.storage().instance().get(&DataKey::PackPrice).unwrap();

    let has_ref = referrer.as_ref().map(|r| r != &buyer && r != &admin).unwrap_or(false);
    let platform_share = price / 10;
    let referral_share: i128 = if has_ref { price / 10 } else { 0 };
    let prize_share = price - platform_share - referral_share;

    let xlm = token::Client::new(&env, &xlm_token);
    xlm.transfer(&buyer, &admin, &(platform_share + prize_share));
    if has_ref {
        xlm.transfer(&buyer, referrer.as_ref().unwrap(), &referral_share);
    }

    // increment pending packs
    let pending: u32 = env.storage().persistent()
        .get(&DataKey::PendingPacks(buyer.clone())).unwrap_or(0);
    env.storage().persistent().set(&DataKey::PendingPacks(buyer.clone()), &(pending + 1));

    // track total packs sold
    let sold: u32 = env.storage().instance().get(&DataKey::TotalPacksSold).unwrap_or(0);
    env.storage().instance().set(&DataKey::TotalPacksSold, &(sold + 1));

    // credit prize pool
    if let Some(tid) = tournament_id {
        let key = DataKey::Tournament(tid);
        if env.storage().persistent().has(&key) {
            let mut t: crate::types::TournamentData = env.storage().persistent().get(&key).unwrap();
            if t.status == 0 && env.ledger().timestamp() < t.end_time {
                t.prize_pool += prize_share;
                env.storage().persistent().set(&key, &t);
            } else {
                accrue_pending_prize(&env, prize_share);
            }
        } else {
            accrue_pending_prize(&env, prize_share);
        }
    } else {
        accrue_pending_prize(&env, prize_share);
    }

    // referral tracking
    if has_ref {
        let ref_addr = referrer.as_ref().unwrap();
        if !env.storage().persistent().has(&DataKey::ReferrerOf(buyer.clone())) {
            env.storage().persistent().set(&DataKey::ReferrerOf(buyer.clone()), ref_addr);
            let rc: u32 = env.storage().persistent()
                .get(&DataKey::ReferralCount(ref_addr.clone())).unwrap_or(0);
            env.storage().persistent().set(&DataKey::ReferralCount(ref_addr.clone()), &(rc + 1));
        }
        let earned: i128 = env.storage().persistent()
            .get(&DataKey::ReferralEarnings(ref_addr.clone())).unwrap_or(0);
        env.storage().persistent()
            .set(&DataKey::ReferralEarnings(ref_addr.clone()), &(earned + referral_share));
    }

    env.events().publish((symbol_short!("pack_buy"), buyer), price);
}

fn accrue_pending_prize(env: &Env, amount: i128) {
    let ppp: i128 = env.storage().instance().get(&DataKey::PendingPrizePool).unwrap_or(0);
    env.storage().instance().set(&DataKey::PendingPrizePool, &(ppp + amount));
}

pub fn request_open_pack(env: Env, player: Address) {
    player.require_auth();
    let pending: u32 = env.storage().persistent()
        .get(&DataKey::PendingPacks(player.clone())).unwrap_or(0);
    assert!(pending >= 1, "no pending packs");
    env.storage().persistent().set(&DataKey::PendingPacks(player.clone()), &(pending - 1));

    let requests: u32 = env.storage().persistent()
        .get(&DataKey::OpenRequests(player.clone())).unwrap_or(0);
    env.storage().persistent().set(&DataKey::OpenRequests(player.clone()), &(requests + 1));

    env.events().publish((symbol_short!("pack_req"), player), ());
}

// cards: Vec of (startup_id, rarity) — admin provides 5 entries
pub fn open_pack(env: Env, player: Address, cards: Vec<(u32, u32)>) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();

    assert_eq!(cards.len(), 5, "must provide 5 cards");

    let requests: u32 = env.storage().persistent()
        .get(&DataKey::OpenRequests(player.clone())).unwrap_or(0);
    assert!(requests >= 1, "no open request");
    env.storage().persistent().set(&DataKey::OpenRequests(player.clone()), &(requests - 1));

    for (startup_id, rarity) in cards.iter() {
        assert!(startup_id >= 1 && startup_id <= 19, "invalid startup_id");
        assert_eq!(expected_rarity(startup_id), rarity, "wrong rarity for startup");
        mint_card(&env, &player, startup_id, rarity);
    }

    env.events().publish((symbol_short!("pack_open"), player), ());
}
