import { useState, useCallback } from 'react';
import { readContract, callContract, waitForTransaction } from '../lib/stellar';
import { useWalletContext } from '../context/WalletContext';

export interface CardListing {
    seller: string;
    price: bigint;
    tokenId: number;
    listedAt: number;
}

export function useMarketplaceV2() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { refreshRecords, address } = useWalletContext();

    const getListing = useCallback(async (tokenId: number): Promise<CardListing | null> => {
        try {
            const raw = await readContract('get_listing', [tokenId]);
            if (!raw) return null;
            return {
                seller: String(raw.seller ?? raw[0] ?? ''),
                price: BigInt(raw.price ?? raw[1] ?? 0),
                tokenId: Number(raw.token_id ?? raw[2] ?? tokenId),
                listedAt: Number(raw.listed_at ?? raw[3] ?? 0),
            };
        } catch { return null; }
    }, []);

    const listCard = useCallback(async (
        signerAddress: string,
        tokenId: number,
        priceStroops: bigint
    ): Promise<{ success: boolean; error?: string }> => {
        setIsLoading(true);
        setError(null);
        try {
            const hash = await callContract('list_card', [signerAddress, tokenId, priceStroops], signerAddress);
            await waitForTransaction(hash);
            await refreshRecords();
            return { success: true };
        } catch (e: any) {
            const msg = e?.message || 'List failed';
            setError(msg);
            return { success: false, error: msg };
        } finally {
            setIsLoading(false);
        }
    }, [refreshRecords]);

    const cancelListing = useCallback(async (
        signerAddress: string,
        tokenId: number
    ): Promise<{ success: boolean; error?: string }> => {
        setIsLoading(true);
        setError(null);
        try {
            const hash = await callContract('cancel_listing', [signerAddress, tokenId], signerAddress);
            await waitForTransaction(hash);
            await refreshRecords();
            return { success: true };
        } catch (e: any) {
            const msg = e?.message || 'Cancel failed';
            setError(msg);
            return { success: false, error: msg };
        } finally {
            setIsLoading(false);
        }
    }, [refreshRecords]);

    const buyListing = useCallback(async (
        signerAddress: string,
        tokenId: number
    ): Promise<{ success: boolean; error?: string }> => {
        setIsLoading(true);
        setError(null);
        try {
            const hash = await callContract('buy_listing', [signerAddress, tokenId], signerAddress);
            await waitForTransaction(hash);
            await refreshRecords();
            return { success: true };
        } catch (e: any) {
            const msg = e?.message || 'Buy failed';
            setError(msg);
            return { success: false, error: msg };
        } finally {
            setIsLoading(false);
        }
    }, [refreshRecords]);

    // Fetch all active listings by scanning token IDs from backend
    const getActiveListings = useCallback(async (): Promise<(CardListing & { listingId: number })[]> => {
        try {
            const res = await fetch('/api/marketplace/listings').catch(() => null);
            if (res?.ok) {
                const data = await res.json();
                return (data.listings ?? []).map((l: any) => ({
                    ...l,
                    price: BigInt(l.price ?? '0'),
                }));
            }
            return [];
        } catch { return []; }
    }, []);

    // buyCard(tokenId, price) — alias for buyListing
    const buyCard = useCallback(async (
        tokenId: number | bigint,
        _price: bigint
    ): Promise<{ success: boolean; error?: string }> => {
        if (!address) return { success: false, error: 'Not connected' };
        return buyListing(address, Number(tokenId));
    }, [address, buyListing]);

    // Get listings for a specific seller (user's own listings)
    const getUserListings = useCallback(async (sellerAddress: string): Promise<(CardListing & { listingId: number })[]> => {
        const all = await getActiveListings();
        return all.filter(l => l.seller?.toLowerCase() === sellerAddress?.toLowerCase());
    }, [getActiveListings]);

    // Stubs for Aleo features not on Stellar
    const getMyBids = useCallback(async () => [], []);
    const getUserSoldItems = useCallback(async (addr?: string): Promise<any[]> => {
        try {
            const a = addr || address;
            if (!a) return [];
            const res = await fetch(`/api/marketplace/history?address=${a}&limit=50`);
            if (!res.ok) return [];
            const data = await res.json();
            return data.trades ?? [];
        } catch { return []; }
    }, [address]);
    const getActiveAuctions = useCallback(async () => [], []);
    const bidOnAuction = useCallback(async () => ({ success: false, error: 'Not supported' }), []);
    const finalizeAuction = useCallback(async () => ({ success: false, error: 'Not supported' }), []);
    const placeBid = useCallback(async () => ({ success: false, error: 'Not supported' }), []);
    const acceptBid = useCallback(async () => ({ success: false, error: 'Not supported' }), []);
    const getBidsForToken = useCallback(async () => [], []);
    const cancelBid = useCallback(async () => ({ success: false, error: 'Not supported' }), []);
    const listPack = useCallback(async (addr: string, tokenId: number, price: bigint) => listCard(addr, tokenId, price), [listCard]);
    const createAuction = useCallback(async () => ({ success: false, error: 'Not supported' }), []);
    const createPackAuction = useCallback(async () => ({ success: false, error: 'Not supported' }), []);
    const cancelPackListing = useCallback(async (addr: string, tokenId: number) => cancelListing(addr, tokenId), [cancelListing]);
    const buyPackListing = useCallback(async (addr: string, tokenId: number) => buyListing(addr, tokenId), [buyListing]);
    const cancelAuction = useCallback(async () => ({ success: false, error: 'Not supported' }), []);
    const getTokenStats = useCallback(async () => null, []);
    const getTokenSaleHistory = useCallback(async () => [], []);

    return {
        isLoading, loading: isLoading, error,
        getListing, getActiveListings, getUserListings,
        listCard, listPack, cancelListing, cancelPackListing,
        buyListing, buyCard, buyPackListing,
        getMyBids, getUserSoldItems, getActiveAuctions,
        bidOnAuction, finalizeAuction, placeBid, acceptBid,
        getBidsForToken, cancelBid, createAuction, createPackAuction,
        cancelAuction, getTokenStats, getTokenSaleHistory,
    };
}
