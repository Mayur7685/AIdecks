use soroban_sdk::{symbol_short, Address, Env, Vec};
use crate::types::{CardData, DataKey, expected_rarity};

pub fn mint_card(env: &Env, player: &Address, startup_id: u32, rarity: u32) -> u32 {
    let token_id: u32 = env.storage().instance()
        .get(&DataKey::TotalCardsMinted).unwrap_or(0u32) + 1;

    env.storage().persistent().set(&DataKey::Card(token_id), &CardData {
        startup_id,
        rarity,
        level: 1,
        locked: false,
    });
    env.storage().persistent().set(&DataKey::CardOwner(token_id), player);

    let mut cards: Vec<u32> = env.storage().persistent()
        .get(&DataKey::OwnerCards(player.clone()))
        .unwrap_or(Vec::new(env));
    cards.push_back(token_id);
    env.storage().persistent().set(&DataKey::OwnerCards(player.clone()), &cards);

    env.storage().instance().set(&DataKey::TotalCardsMinted, &token_id);

    env.events().publish(
        (symbol_short!("mint"), player.clone()),
        (token_id, startup_id, rarity),
    );
    token_id
}

pub fn transfer_card_internal(env: &Env, from: &Address, to: &Address, token_id: u32) {
    let owner: Address = env.storage().persistent().get(&DataKey::CardOwner(token_id)).unwrap();
    assert_eq!(owner, *from, "not owner");

    let card: CardData = env.storage().persistent().get(&DataKey::Card(token_id)).unwrap();
    assert!(!card.locked, "card is locked");

    // remove from sender's list
    let mut from_cards: Vec<u32> = env.storage().persistent()
        .get(&DataKey::OwnerCards(from.clone())).unwrap_or(Vec::new(env));
    let idx = from_cards.iter().position(|id| id == token_id);
    if let Some(i) = idx { from_cards.remove(i as u32); }
    env.storage().persistent().set(&DataKey::OwnerCards(from.clone()), &from_cards);

    // add to receiver's list
    let mut to_cards: Vec<u32> = env.storage().persistent()
        .get(&DataKey::OwnerCards(to.clone())).unwrap_or(Vec::new(env));
    to_cards.push_back(token_id);
    env.storage().persistent().set(&DataKey::OwnerCards(to.clone()), &to_cards);

    env.storage().persistent().set(&DataKey::CardOwner(token_id), to);

    env.events().publish(
        (symbol_short!("transfer"), from.clone()),
        (token_id, to.clone()),
    );
}

pub fn transfer_card(env: Env, from: Address, to: Address, token_id: u32) {
    from.require_auth();
    transfer_card_internal(&env, &from, &to, token_id);
}

pub fn merge_cards(env: Env, player: Address, token_a: u32, token_b: u32, token_c: u32, new_startup_id: u32) {
    player.require_auth();

    let ca: CardData = env.storage().persistent().get(&DataKey::Card(token_a)).unwrap();
    let cb: CardData = env.storage().persistent().get(&DataKey::Card(token_b)).unwrap();
    let cc: CardData = env.storage().persistent().get(&DataKey::Card(token_c)).unwrap();

    assert_eq!(ca.rarity, cb.rarity, "rarity mismatch");
    assert_eq!(cb.rarity, cc.rarity, "rarity mismatch");
    assert!(ca.rarity < 3, "legendary cannot merge");
    assert!(!ca.locked && !cb.locked && !cc.locked, "card locked");

    // verify ownership
    let oa: Address = env.storage().persistent().get(&DataKey::CardOwner(token_a)).unwrap();
    let ob: Address = env.storage().persistent().get(&DataKey::CardOwner(token_b)).unwrap();
    let oc: Address = env.storage().persistent().get(&DataKey::CardOwner(token_c)).unwrap();
    assert_eq!(oa, player); assert_eq!(ob, player); assert_eq!(oc, player);

    let new_rarity = ca.rarity + 1;
    assert_eq!(expected_rarity(new_startup_id), new_rarity, "wrong startup for rarity");

    // burn the 3 cards
    for &tid in &[token_a, token_b, token_c] {
        env.storage().persistent().remove(&DataKey::Card(tid));
        env.storage().persistent().remove(&DataKey::CardOwner(tid));
        let mut cards: Vec<u32> = env.storage().persistent()
            .get(&DataKey::OwnerCards(player.clone())).unwrap_or(Vec::new(&env));
        let idx = cards.iter().position(|id| id == tid);
        if let Some(i) = idx { cards.remove(i as u32); }
        env.storage().persistent().set(&DataKey::OwnerCards(player.clone()), &cards);
    }

    let new_id = mint_card(&env, &player, new_startup_id, new_rarity);
    env.events().publish((symbol_short!("merge"), player), (token_a, token_b, token_c, new_id));
}

pub fn upgrade_card(env: Env, player: Address, token_id: u32, success: bool) {
    // admin-only: called by backend after rolling success probability
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();

    let owner: Address = env.storage().persistent().get(&DataKey::CardOwner(token_id)).unwrap();
    assert_eq!(owner, player, "not owner");

    let mut card: CardData = env.storage().persistent().get(&DataKey::Card(token_id)).unwrap();
    assert!(!card.locked, "card locked");
    assert!(card.level < 5, "already max level");

    if success {
        card.level += 1;
        env.storage().persistent().set(&DataKey::Card(token_id), &card);
        env.events().publish((symbol_short!("upgrade"), player), (token_id, card.level));
    } else {
        // burn on failure
        env.storage().persistent().remove(&DataKey::Card(token_id));
        env.storage().persistent().remove(&DataKey::CardOwner(token_id));
        let mut cards: Vec<u32> = env.storage().persistent()
            .get(&DataKey::OwnerCards(player.clone())).unwrap_or(Vec::new(&env));
        let idx = cards.iter().position(|id| id == token_id);
        if let Some(i) = idx { cards.remove(i as u32); }
        env.storage().persistent().set(&DataKey::OwnerCards(player.clone()), &cards);
        env.events().publish((symbol_short!("upg_burn"), player), token_id);
    }
}
