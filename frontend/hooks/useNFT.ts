import { useState, useCallback } from 'react';
import { readContract, callContract, waitForTransaction, STARTUPS } from '../lib/stellar';
import { CardData, Rarity } from '../types';
import { useWalletContext } from '../context/WalletContext';

const RARITY_MAP: Record<number, Rarity> = {
    0: Rarity.COMMON,
    1: Rarity.RARE,
    2: Rarity.EPIC,
    3: Rarity.LEGENDARY,
};

function contractCardToCardData(tokenId: number, raw: any): CardData {
    const startupId = Number(raw.startup_id ?? raw[0] ?? 0);
    const rarity = Number(raw.rarity ?? raw[1] ?? 0);
    const level = Number(raw.level ?? raw[2] ?? 1);
    const locked = Boolean(raw.locked ?? raw[3] ?? false);
    const startup = STARTUPS[startupId];
    return {
        tokenId,
        startupId,
        name: startup?.name || `Startup #${startupId}`,
        rarity: RARITY_MAP[rarity] ?? Rarity.COMMON,
        level,
        multiplier: level,
        isLocked: locked,
        image: `/images/${startupId}.png`,
        edition: 1,
    };
}

export function useNFT() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { cardRecords, refreshRecords, address } = useWalletContext();

    const getOwnedTokens = useCallback(async (addr: string): Promise<number[]> => {
        try {
            return await readContract<number[]>('get_cards_of', [addr]);
        } catch { return []; }
    }, []);

    const getCardInfo = useCallback(async (tokenId: number): Promise<CardData | null> => {
        try {
            const raw = await readContract('get_card', [tokenId]);
            if (!raw) return null;
            return contractCardToCardData(tokenId, raw);
        } catch { return null; }
    }, []);

    const getCards = useCallback(async (addr: string): Promise<CardData[]> => {
        try {
            const tokenIds = await readContract<number[]>('get_cards_of', [addr]);
            if (!tokenIds?.length) return [];
            const cards = await Promise.all(
                tokenIds.map(id => getCardInfo(id))
            );
            return cards.filter((c): c is CardData => c !== null);
        } catch { return []; }
    }, [getCardInfo]);

    const mergeCards = useCallback(async (
        signerOrAddress: any,
        tokenIds: [number, number, number]
    ): Promise<{ success: boolean; newTokenId?: number; error?: string }> => {
        setIsLoading(true);
        setError(null);
        try {
            // Handle both: mergeCards(signer, tokenIds) or mergeCards(address, tokenIds)
            const signerAddress = typeof signerOrAddress === 'string'
                ? signerOrAddress
                : (signerOrAddress?.address || address);
            if (!signerAddress) throw new Error('Wallet not connected');

            // Determine new startup_id: pick random from next rarity range
            const cardA = await getCardInfo(tokenIds[0]);
            if (!cardA) throw new Error('Card not found');
            const rarityNum = [Rarity.COMMON, Rarity.RARE, Rarity.EPIC, Rarity.LEGENDARY].indexOf(cardA.rarity);
            const ranges: Record<number, [number, number]> = { 0: [9, 13], 1: [6, 8], 2: [1, 5] };
            const [lo, hi] = ranges[rarityNum] || [1, 5];
            const newStartupId = lo + Math.floor(Math.random() * (hi - lo + 1));

            const hash = await callContract('merge_cards', [
                signerAddress,
                tokenIds[0],
                tokenIds[1],
                tokenIds[2],
                newStartupId,
            ], signerAddress);
            await waitForTransaction(hash);
            await refreshRecords();
            // Return placeholder newTokenId — actual ID is in the new cards list after refresh
            return { success: true, newTokenId: Date.now() };
        } catch (e: any) {
            const msg = e?.message || 'Merge failed';
            setError(msg);
            return { success: false, error: msg };
        } finally {
            setIsLoading(false);
        }
    }, [address, getCardInfo, refreshRecords]);

    const isLocked = useCallback(async (tokenId: number): Promise<boolean> => {
        const card = await getCardInfo(tokenId);
        return card?.isLocked ?? false;
    }, [getCardInfo]);

    const clearCache = useCallback(() => {}, []);
    const pushCardsToServer = useCallback(async () => {}, []);
    const updateServerCache = useCallback(async () => {}, []);
    const getCardInfoWithRetry = getCardInfo;

    return {
        isLoading,
        error,
        getOwnedTokens,
        getCardInfo,
        getCardInfoWithRetry,
        getCards,
        mergeCards,
        isLocked,
        clearCache,
        pushCardsToServer,
        updateServerCache,
    };
}

export function resetNFTModuleState() {}
