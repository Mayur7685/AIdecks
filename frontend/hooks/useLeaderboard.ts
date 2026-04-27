import { useState, useEffect, useRef } from 'react';
import { apiUrl, fetchJson } from '../lib/api';

export interface LeaderboardEntry {
    rank: number;
    address: string;
    score: number;
    lastUpdated: string;
    username?: string | null;
    avatar?: string | null;
}

export interface PlayerRank {
    rank: number;
    score: number;
    address: string;
}

export interface DailyScore {
    startup: string;
    points: number;
    tweetsAnalyzed: number;
    events: any[];
}

export interface TournamentStats {
    total_players: number;
    avg_score: number;
    max_score: number;
    min_score: number;
}

/**
 * Hook to fetch leaderboard data.
 * Uses stale-while-revalidate: shows existing data during refetch, no loading flicker.
 */
export function useLeaderboard(tournamentId: number | null, _limit: number = 100) {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!tournamentId) return;
        setLoading(true);
        fetchJson(apiUrl(`/leaderboard/${tournamentId}`))
            .then(data => {
                const entries = Array.isArray(data?.data) ? data.data : [];
                setLeaderboard(entries);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [tournamentId]);

    return { leaderboard, loading, error };
}

/**
 * Hook to fetch player's rank.
 */
export function usePlayerRank(_tournamentId: number | null, _playerAddress: string | null) {
    
    return { rank: null as PlayerRank | null, loading: false, error: null as string | null };
}

/**
 * Hook to fetch daily scores.
 */
export function useDailyScores(tournamentId: number | null, date: string) {
    const [scores, setScores] = useState<DailyScore[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const hasFetched = useRef(false);

    useEffect(() => {
        if (!tournamentId || !date) return;
        hasFetched.current = false;

        const fetchScores = async () => {
            if (!hasFetched.current) setLoading(true);
            setError(null);

            try {
                const data = await fetchJson(apiUrl(`/daily-scores/${tournamentId}/${date}`));

                if (data.success) {
                    setScores(data.data);
                } else {
                    setError(data.message || 'Failed to fetch scores');
                }
            } catch (err) {
                setError('Network error');
            } finally {
                hasFetched.current = true;
                setLoading(false);
            }
        };

        fetchScores();
    }, [tournamentId, date]);

    return { scores, loading, error };
}

/**
 * Hook to fetch tournament stats.
 */
export function useTournamentStats(tournamentId: number | null) {
    const [stats, setStats] = useState<TournamentStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const hasFetched = useRef(false);

    useEffect(() => {
        if (!tournamentId) return;
        hasFetched.current = false;

        const fetchStats = async () => {
            if (!hasFetched.current) setLoading(true);

            try {
                const data = await fetchJson(apiUrl(`/stats/${tournamentId}`));

                if (data.success) {
                    setStats(data.data);
                    setError(null);
                } else if (!hasFetched.current) {
                    setError(data.message || 'Failed to fetch stats');
                }
            } catch (err) {
                if (!hasFetched.current) {
                    setError('Network error');
                }
            } finally {
                hasFetched.current = true;
                setLoading(false);
            }
        };

        fetchStats();

        const interval = setInterval(fetchStats, 60000);
        return () => clearInterval(interval);
    }, [tournamentId]);

    return { stats, loading, error };
}
