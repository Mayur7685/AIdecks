import { useState, useCallback } from 'react';
import { readContract, callContract, waitForTransaction } from '../lib/stellar';

export interface Tournament {
    id: number;
    registrationStart: number;
    startTime: number;
    endTime: number;
    prizePool: bigint;
    entryCount: number;
    status: 'Created' | 'Active' | 'Finalized' | 'Cancelled';
}

const STATUS_MAP: Record<number, Tournament['status']> = {
    0: 'Created', 1: 'Active', 2: 'Finalized', 3: 'Cancelled',
};

function parseRawTournament(id: number, raw: any): Tournament {
    return {
        id,
        registrationStart: Number(raw.registration_start ?? raw[0] ?? 0),
        startTime: Number(raw.start_time ?? raw[1] ?? 0),
        endTime: Number(raw.end_time ?? raw[2] ?? 0),
        status: STATUS_MAP[Number(raw.status ?? raw[3] ?? 0)] ?? 'Created',
        entryCount: Number(raw.entry_count ?? raw[4] ?? 0),
        prizePool: BigInt(raw.prize_pool ?? raw[5] ?? 0),
    };
}

export function useTournament() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getTournament = useCallback(async (tournamentId: number): Promise<Tournament | null> => {
        try {
            const raw = await readContract('get_tournament', [tournamentId]);
            if (!raw) return null;
            return parseRawTournament(tournamentId, raw);
        } catch { return null; }
    }, []);

    const getActiveTournament = useCallback(async (): Promise<Tournament | null> => {
        try {
            const res = await fetch('/api/tournaments/active');
            const data = await res.json();
            if (!data.success || !data.data) return null;
            const d = data.data;
            return {
                id: d.id,
                registrationStart: d.registrationStart,
                startTime: d.startTime,
                endTime: d.endTime,
                prizePool: BigInt(Math.floor(parseFloat(d.prizePool || '0') * 10_000_000)),
                entryCount: d.entryCount,
                status: d.status === 'registration' ? 'Created'
                    : d.status === 'active' ? 'Active'
                    : d.status === 'finalized' ? 'Finalized' : 'Cancelled',
            };
        } catch { return null; }
    }, []);

    
    const enterTournament = useCallback(async (
        signerOrAddress: any,
        tournamentId: number,
        cardIdsOrCards: any[]
    ): Promise<{ success: boolean; txHash?: string; error?: string }> => {
        setIsLoading(true);
        setError(null);
        try {
            const signerAddress = typeof signerOrAddress === 'string'
                ? signerOrAddress : (signerOrAddress?.address || '');
            if (!signerAddress) throw new Error('Wallet not connected');
            // Accept both number[] and CardData[]
            const cardIds = cardIdsOrCards.map((c: any) =>
                typeof c === 'number' ? c : Number(c?.tokenId ?? c?.id ?? c)
            );
            if (cardIds.length !== 5) throw new Error('Must select exactly 5 cards');
            const hash = await callContract('enter_tournament', [
                signerAddress,
                tournamentId,
                cardIds,
            ], signerAddress);
            await waitForTransaction(hash);
            // Register player for leaderboard tracking
            const apiBase = (import.meta as any).env?.VITE_API_URL || '';
            fetch(`${apiBase}/api/leaderboard/${tournamentId}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: signerAddress }),
            }).catch(() => {});
            return { success: true, txHash: hash };
        } catch (e: any) {
            const msg = e?.message || 'Enter tournament failed';
            setError(msg);
            return { success: false, error: msg };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const calculateScore = useCallback(async (
        signerAddress: string,
        tournamentId: number
    ): Promise<{ success: boolean; score?: number; error?: string }> => {
        setIsLoading(true);
        setError(null);
        try {
            const hash = await callContract('calculate_score', [signerAddress, tournamentId], signerAddress);
            await waitForTransaction(hash);
            const score = await readContract<number>('get_player_score', [tournamentId, signerAddress]).catch(() => 0);
            return { success: true, score: Number(score) };
        } catch (e: any) {
            const msg = e?.message || 'Calculate score failed';
            setError(msg);
            return { success: false, error: msg };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const unlockCards = useCallback(async (
        signerOrAddress: any,
        tournamentId: number
    ): Promise<{ success: boolean; error?: string }> => {
        setIsLoading(true);
        setError(null);
        try {
            const signerAddress = typeof signerOrAddress === 'string'
                ? signerOrAddress : (signerOrAddress?.address || address || '');
            if (!signerAddress) throw new Error('Wallet not connected');
            const hash = await callContract('unlock_cards', [signerAddress, tournamentId], signerAddress);
            await waitForTransaction(hash);
            return { success: true };
        } catch (e: any) {
            const msg = e?.message || 'Unlock failed';
            setError(msg);
            return { success: false, error: msg };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const hasEntered = useCallback(async (tournamentId: number, addr: string): Promise<boolean> => {
        try {
            return await readContract<boolean>('get_player_entered', [tournamentId, addr]) ?? false;
        } catch { return false; }
    }, []);

    const getUserScore = useCallback(async (tournamentId: number, addr: string): Promise<number> => {
        try {
            return Number(await readContract<number>('get_player_score', [tournamentId, addr]) ?? 0);
        } catch { return 0; }
    }, []);


    const getActiveTournamentId = useCallback(async (): Promise<number> => {
        try { const t = await getActiveTournament(); return t?.id ?? 0; } catch { return 0; }
    }, [getActiveTournament]);

    const canRegister = useCallback(async (tournamentId: number): Promise<boolean> => {
        try {
            const t = await getTournament(tournamentId);
            if (!t) return false;
            const now = Math.floor(Date.now() / 1000);
            return t.status === 'Created' && now >= t.registrationStart && now < t.startTime;
        } catch { return false; }
    }, [getTournament]);

    const getUserScoreInfo = useCallback(async (tournamentId: number, addr: string) => {
        try {
            const score = await getUserScore(tournamentId, addr);
            const total = await readContract<any>('get_total_tournament_score', [tournamentId]).catch(() => 0);
            return { score: BigInt(score), prize: 0n, totalScore: BigInt(Number(total ?? 0)) };
        } catch { return null; }
    }, [getUserScore]);

    const getUserLineup = useCallback(async (tournamentId: number, addr: string) => {
        try {
            const cardIds = await readContract<number[]>('get_player_lineup', [tournamentId, addr]).catch(() => []);
            return { cardIds: cardIds ?? [], owner: addr, timestamp: 0, cancelled: false, claimed: false };
        } catch { return null; }
    }, []);

    const claimPrize = useCallback(async (_signer: any, _tournamentId: number) => {
        return { success: false, error: 'Prize distribution is handled by admin.' };
    }, []);


    const getNextTournamentId = useCallback(async (): Promise<number> => {
        try {
            for (let id = 50; id >= 1; id--) {
                const t = await readContract<any>('get_tournament', [id]).catch(() => null);
                if (t && Number(t.registration_start ?? 0n) > 0) return id + 1;
            }
            return 1;
        } catch { return 1; }
    }, []);

    return {
        isLoading,
        error,
        getTournament,
        getActiveTournament,
        getActiveTournamentId,
        getNextTournamentId,
        canRegister,
        getUserScoreInfo,
        getUserLineup,
        claimPrize,
        enterTournament,
        calculateScore,
        unlockCards,
        hasEntered,
        getUserScore,
        getMyScore: getUserScore,
    };
}

// Lineup persistence helpers (used by useTournamentHistory)
export function saveLineup(tournamentId: number, address: string, cardIds: number[]) {
    try { localStorage.setItem(`lineup:${tournamentId}:${address}`, JSON.stringify(cardIds)); } catch {}
}
export function loadLineup(tournamentId: number, address: string): number[] | null {
    try {
        const raw = localStorage.getItem(`lineup:${tournamentId}:${address}`);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}
export function clearLineup(tournamentId: number, address: string) {
    try { localStorage.removeItem(`lineup:${tournamentId}:${address}`); } catch {}
}
