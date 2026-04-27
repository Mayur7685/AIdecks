import { useState, useCallback } from 'react';
import { callContract, waitForTransaction, readContract } from '../lib/stellar';
import { CardData, Rarity } from '../types';
import { useWalletContext } from '../context/WalletContext';

const API_URL = ((import.meta as any).env?.VITE_API_URL || '').replace(/\/api$/, '');
function apiUrl(path: string) { return API_URL ? `${API_URL}${path}` : path; }

const RARITY_MAP: Record<number, Rarity> = {
    0: Rarity.COMMON, 1: Rarity.RARE, 2: Rarity.EPIC, 3: Rarity.LEGENDARY,
};

export function usePacks() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState('');
    const { address, refreshRecords, packRecords } = useWalletContext();

    const getPackPrice = useCallback(async (): Promise<bigint> => {
        try {
            const price = await readContract<number>('get_pack_price', []);
            return BigInt(price ?? 1_000_000);
        } catch { return 1_000_000n; }
    }, []);

    const getPendingPacks = useCallback(async (addr: string): Promise<number> => {
        try {
            const r = await readContract<any>('get_pending_packs', [addr]);
            return Number(r ?? 0);
        } catch { return 0; }
    }, []);

    const buyPack = useCallback(async (
        signerOrAddress: any,
        referrerOrCount?: any,
        tournamentId?: number
    ): Promise<{ success: boolean; txHash?: string; packTokenIds?: number[]; error?: string }> => {
        setIsLoading(true);
        setError(null);
        setStatusMessage('Buying pack...');
        try {
            // Handle old Aleo signature: buyPack(signer, packCount)
            // New signature: buyPack(signerAddress, referrer?, tournamentId?)
            const signerAddress = typeof signerOrAddress === 'string'
                ? signerOrAddress
                : (signerOrAddress?.address || address);
            if (!signerAddress) throw new Error('Wallet not connected');

            // If second arg is a number (packCount from old signature), ignore it
            const referrer = typeof referrerOrCount === 'string' ? referrerOrCount : undefined;

            const hash = await callContract('buy_pack', [
                signerAddress,
                referrer ?? null,
                null,  // always null — no active tournament yet
            ], signerAddress);
            setStatusMessage('Confirming transaction...');
            await waitForTransaction(hash);
            await refreshRecords();
            setStatusMessage('Pack purchased!');
            return { success: true, txHash: hash, packTokenIds: [] };
        } catch (e: any) {
            const msg = e?.message || 'Buy pack failed';
            setError(msg);
            return { success: false, error: msg };
        } finally {
            setIsLoading(false);
        }
    }, [address, refreshRecords]);

    const requestOpenPack = useCallback(async (
        signerAddress: string
    ): Promise<{ success: boolean; txHash?: string; error?: string }> => {
        setIsLoading(true);
        setError(null);
        setStatusMessage('Requesting pack open...');
        try {
            const hash = await callContract('request_open_pack', [signerAddress], signerAddress);
            await waitForTransaction(hash);
            setStatusMessage('Pack open requested! Waiting for cards...');
            return { success: true, txHash: hash };
        } catch (e: any) {
            const msg = e?.message || 'Request open pack failed';
            setError(msg);
            return { success: false, error: msg };
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Poll backend to fulfill the open request and return the minted cards
    const pollForCards = useCallback(async (
        playerAddress: string,
        timeoutMs = 120_000
    ): Promise<CardData[]> => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            await new Promise(r => setTimeout(r, 5000));
            try {
                const res = await fetch(apiUrl(`/api/packs/status/${playerAddress}`));
                const data = await res.json();
                if (data.success && data.cards?.length) {
                    await refreshRecords();
                    return data.cards.map((c: any) => ({
                        tokenId: c.token_id,
                        startupId: c.startup_id,
                        name: c.startup_name || `Startup #${c.startup_id}`,
                        rarity: RARITY_MAP[c.rarity] ?? Rarity.COMMON,
                        level: 1,
                        multiplier: 1,
                        isLocked: false,
                        image: `/images/${c.startup_id}.png`,
                        edition: 1,
                    }));
                }
            } catch { /* retry */ }
        }
        return [];
    }, [refreshRecords]);


    const openPack = useCallback(async (
        signer: any,
        _packTokenId: number
    ): Promise<{ success: boolean; cards?: CardData[]; error?: string; rawError?: string }> => {
        setIsLoading(true);
        setError(null);
        try {
            const signerAddress = signer?.address || (typeof signer === 'string' ? signer : address);
            if (!signerAddress) throw new Error('Wallet not connected');

            setStatusMessage('Requesting pack open...');
            const hash = await callContract('request_open_pack', [signerAddress], signerAddress);
            await waitForTransaction(hash);

            setStatusMessage('Minting cards...');
            const res = await fetch(apiUrl('/api/packs/fulfill-open'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player: signerAddress }),
            });
            const data = await res.json();
            if (!data.success) return { success: false, error: data.error || 'Failed to mint cards' };

            const cards: CardData[] = (data.cards || []).map((c: any, i: number) => ({
                tokenId: Date.now() + i,
                startupId: c.startup_id,
                name: c.startup_name || `Startup #${c.startup_id}`,
                rarity: ([Rarity.COMMON, Rarity.RARE, Rarity.EPIC, Rarity.LEGENDARY] as Rarity[])[c.rarity] ?? Rarity.COMMON,
                level: 1,
                multiplier: 1,
                isLocked: false,
                image: `/images/${c.startup_id}.png`,
                edition: 0,
            }));

            await refreshRecords();
            setStatusMessage('');
            return { success: true, cards };
        } catch (e: any) {
            const msg = e?.message || 'Failed to open pack';
            setError(msg);
            return { success: false, error: msg, rawError: String(e) };
        } finally {
            setIsLoading(false);
        }
    }, [address, refreshRecords]);

    const batchOpenPacks = useCallback(async (
        signer: any,
        packTokenIds: number[]
    ): Promise<{ success: boolean; cards?: CardData[]; error?: string }> => {
        const allCards: CardData[] = [];
        for (const id of packTokenIds) {
            const res = await openPack(signer, id);
            if (!res.success) return res;
            if (res.cards) allCards.push(...res.cards);
        }
        return { success: true, cards: allCards };
    }, [openPack]);

    const getUserPacks = useCallback(async (addr: string): Promise<number[]> => {
        try {
            const count = await readContract<any>('get_pending_packs', [addr]);
            const n = Number(count ?? 0);
            return Array.from({ length: n }, (_, i) => i + 1);
        } catch { return []; }
    }, []);

    return {
        isLoading,
        error,
        statusMessage,
        pendingPacks: packRecords,
        getPackPrice,
        getPendingPacks,
        getUserPacks,
        buyPack,
        openPack,
        batchOpenPacks,
        requestOpenPack,
        pollForCards,
    };
}
