import { useState, useCallback } from 'react';
import { readContract, callContract, waitForTransaction, STARTUPS } from '../lib/stellar';
import { STELLAR_ADMIN } from '../lib/networks';
import { useWalletContext } from '../context/WalletContext';

const API_URL = (import.meta as any).env?.VITE_API_URL || '';
function apiUrl(path: string) { return API_URL ? `${API_URL}${path}` : path; }

export const ADMIN_ADDRESSES = [STELLAR_ADMIN.toLowerCase()];
export function isAdmin(address: string | null): boolean {
    if (!address) return false;
    return ADMIN_ADDRESSES.includes(address.toLowerCase());
}

interface AdminStats {
    packsSold: number;
    packPrice: bigint;
    totalNFTs: number;
    activeTournamentId: number;
    nextTournamentId: number;
    rarityStats: { common: number; rare: number; epic: number; legendary: number };
    marketplaceVolume: bigint;
    marketplaceSales: number;
    royaltiesEarned: bigint;
    uniqueBuyers: number;
}

interface ContractBalances { nft: bigint; packOpener: bigint; tournament: bigint; }

interface TournamentData {
    id: number;
    registrationStart: number;
    startTime: number;
    endTime: number;
    prizePool: bigint;
    entryCount: number;
    status: number;
}

const NOT_SUPPORTED = 'Not applicable on Stellar';

export function useAdmin() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { address } = useWalletContext();

    const adminKey = () => localStorage.getItem('aidecks:admin-key') || '';

    const callBackend = async (path: string, body: any = {}) => {
        const res = await fetch(apiUrl(`/api/admin${path}`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey() },
            body: JSON.stringify(body),
        });
        return res.json();
    };

    const getContractBalances = useCallback(async (): Promise<ContractBalances> => {
        return { nft: 0n, packOpener: 0n, tournament: 0n };
    }, []);

    const getAdminStats = useCallback(async (): Promise<AdminStats> => {
        try {
            const [packsSold, packPrice, totalNFTs, nextTournamentId] = await Promise.all([
                readContract<any>('get_total_packs_sold', []).catch(() => 0),
                readContract<any>('get_pack_price', []).catch(() => 1000000),
                readContract<any>('get_total_cards_minted', []).catch(() => 0),
                readContract<any>('get_next_tournament_id', []).catch(() => 1),
            ]);
            return {
                packsSold: Number(packsSold ?? 0),
                packPrice: BigInt(packPrice ?? 1000000),
                totalNFTs: Number(totalNFTs ?? 0),
                activeTournamentId: Number(nextTournamentId ?? 1) - 1,
                nextTournamentId: Number(nextTournamentId ?? 1),
                rarityStats: { common: 0, rare: 0, epic: 0, legendary: 0 },
                marketplaceVolume: 0n,
                marketplaceSales: 0,
                royaltiesEarned: 0n,
                uniqueBuyers: 0,
            };
        } catch { return { packsSold: 0, packPrice: 1000000n, totalNFTs: 0, activeTournamentId: 0, nextTournamentId: 1, rarityStats: { common: 0, rare: 0, epic: 0, legendary: 0 }, marketplaceVolume: 0n, marketplaceSales: 0, royaltiesEarned: 0n, uniqueBuyers: 0 }; }
    }, []);

    const getTournaments = useCallback(async (): Promise<TournamentData[]> => {
        try {
            const res = await fetch(apiUrl('/api/tournaments'));
            const data = await res.json();
            if (!Array.isArray(data)) return [];
            return data.map((t: any) => ({
                id: t.id,
                registrationStart: Number(t.reg_height ?? t.registration_start ?? 0),
                startTime: Number(t.start_height ?? t.start_time ?? 0),
                endTime: Number(t.end_height ?? t.end_time ?? 0),
                prizePool: BigInt(t.prize_pool ?? 0),
                entryCount: Number(t.entry_count ?? 0),
                status: Number(t.status ?? 0),
            }));
        } catch { return []; }
    }, []);

    const setPackPrice = useCallback(async (_signer: any, newPrice: bigint) => {
        try {
            if (!address) return { success: false, error: 'Not connected' };
            // Force bigint so toScVal encodes as i128
            const hash = await callContract('set_pack_price', [BigInt(newPrice)], address);
            await waitForTransaction(hash);
            return { success: true };
        } catch (e: any) { return { success: false, error: e?.message }; }
    }, [address]);

    const createTournament = useCallback(async (
        _signer: any,
        registrationStart: number,
        startTime: number,
        endTime: number
    ) => {
        try {
            const res = await callBackend('/create-tournament', {
                reg_start: registrationStart,
                start_time: startTime,
                end_time: endTime,
            });
            return res;
        } catch (e: any) { return { success: false, error: e?.message }; }
    }, []);

    const finalizeTournament = useCallback(async (_signer: any, tournamentId: number, scores?: any[]) => {
        try {
            const s = (scores || []).map((p: any) => Number(p) || 0);
            if (s.length !== 19) return { success: false, error: '19 scores required' };
            const res = await callBackend('/finalize-tournament', { tournamentId, scores: s });
            return res;
        } catch (e: any) { return { success: false, error: e?.message }; }
    }, []);

    const finalizeWithPoints = useCallback(async (_signer: any, tournamentId: number, points: any[]) => {
        return finalizeTournament(_signer, tournamentId, points);
    }, [finalizeTournament]);

    const cancelTournament = useCallback(async (_signer: any, tournamentId: number) => {
        try {
            const res = await callBackend('/cancel-tournament', { tournamentId });
            return res;
        } catch (e: any) { return { success: false, error: e?.message }; }
    }, []);

    const distributePrize = useCallback(async (_signer: any, winner: string, amount: bigint, tournamentId: number) => {
        try {
            const res = await callBackend('/distribute-prize', { winner, amount: amount.toString(), tournamentId });
            return res;
        } catch (e: any) { return { success: false, error: e?.message }; }
    }, []);

    const setActiveTournament = useCallback(async () => ({ success: true }), []);
    const withdrawPackOpener = useCallback(async () => ({ error: NOT_SUPPORTED }), []);
    const pausePackOpener = useCallback(async () => ({ error: NOT_SUPPORTED }), []);
    const unpausePackOpener = useCallback(async () => ({ error: NOT_SUPPORTED }), []);
    const withdrawFromPrizePool = useCallback(async (
        _signer: any,
        tournamentId: number,
        amount: bigint,
        recipient: string
    ) => {
        try {
            const res = await callBackend('/distribute-prize', {
                tournamentId,
                winner: recipient,
                amount: amount.toString(),
            });
            return res;
        } catch (e: any) { return { success: false, error: e?.message }; }
    }, []);
    const emergencyWithdrawTournament = useCallback(async () => ({ error: NOT_SUPPORTED }), []);
    const pauseTournament = useCallback(async () => ({ error: NOT_SUPPORTED }), []);
    const unpauseTournament = useCallback(async () => ({ error: NOT_SUPPORTED }), []);

    return {
        isLoading, error,
        getContractBalances, getAdminStats, getTournaments,
        setPackPrice, setActiveTournament,
        withdrawPackOpener, pausePackOpener, unpausePackOpener,
        createTournament, finalizeTournament, finalizeWithPoints,
        cancelTournament, distributePrize,
        withdrawFromPrizePool, emergencyWithdrawTournament,
        pauseTournament, unpauseTournament,
    };
}
