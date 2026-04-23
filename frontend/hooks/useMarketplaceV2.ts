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
                return data.listings ?? [];
            }
            return [];
        } catch { return []; }
    }, []);

    // buyCard(listingId, price) — alias for buyListing using tokenId as listingId
    const buyCard = useCallback(async (
        tokenId: number | bigint,
        _price: bigint
    ): Promise<{ success: boolean; error?: string }> => {
        if (!address) return { success: false, error: 'Not connected' };
        return buyListing(address, Number(tokenId));
    }, [address, buyListing]);

    return { isLoading, error, getListing, getActiveListings, listCard, cancelListing, buyListing, buyCard };
}
