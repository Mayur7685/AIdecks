use soroban_sdk::{symbol_short, token, Address, Env};
use crate::types::{CardData, CardListing, DataKey};
use crate::card::transfer_card_internal;

pub fn list_card(env: Env, seller: Address, token_id: u32, price: i128) {
    seller.require_auth();
    assert!(price > 0, "price must be positive");

    let owner: Address = env.storage().persistent().get(&DataKey::CardOwner(token_id)).unwrap();
    assert_eq!(owner, seller, "not owner");

    let mut card: CardData = env.storage().persistent().get(&DataKey::Card(token_id)).unwrap();
    assert!(!card.locked, "card is locked");

    card.locked = true;
    env.storage().persistent().set(&DataKey::Card(token_id), &card);

    env.storage().persistent().set(&DataKey::Listing(token_id), &CardListing {
        seller: seller.clone(),
        price,
        token_id,
        listed_at: env.ledger().timestamp(),
    });

    env.events().publish((symbol_short!("listed"), seller), (token_id, price));
}

pub fn cancel_listing(env: Env, seller: Address, token_id: u32) {
    seller.require_auth();

    let listing: CardListing = env.storage().persistent()
        .get(&DataKey::Listing(token_id)).unwrap();
    assert_eq!(listing.seller, seller, "not seller");

    let mut card: CardData = env.storage().persistent().get(&DataKey::Card(token_id)).unwrap();
    card.locked = false;
    env.storage().persistent().set(&DataKey::Card(token_id), &card);

    env.storage().persistent().remove(&DataKey::Listing(token_id));

    env.events().publish((symbol_short!("unlist"), seller), token_id);
}

pub fn buy_listing(env: Env, buyer: Address, token_id: u32) {
    buyer.require_auth();

    let listing: CardListing = env.storage().persistent()
        .get(&DataKey::Listing(token_id)).unwrap();
    assert_ne!(buyer, listing.seller, "cannot buy own listing");

    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    let xlm_token: Address = env.storage().instance().get(&DataKey::XlmToken).unwrap();
    let xlm = token::Client::new(&env, &xlm_token);

    let fee = listing.price / 25; // 4%
    let seller_amount = listing.price - fee;

    xlm.transfer(&buyer, &listing.seller, &seller_amount);
    xlm.transfer(&buyer, &admin, &fee);

    // unlock before transfer
    let mut card: CardData = env.storage().persistent().get(&DataKey::Card(token_id)).unwrap();
    card.locked = false;
    env.storage().persistent().set(&DataKey::Card(token_id), &card);

    env.storage().persistent().remove(&DataKey::Listing(token_id));

    transfer_card_internal(&env, &listing.seller, &buyer, token_id);

    env.events().publish((symbol_short!("sale"), buyer), (token_id, listing.price));
}
