import { useState, useEffect, useCallback, useMemo } from 'react';
import { getStellarBalance } from '../lib/stellar';

export function useBalance(address?: string) {
    const [balance, setBalance] = useState<bigint>(0n);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const formatted = useMemo(() => {
        const xlm = Number(balance) / 10_000_000;
        if (xlm === 0) return '0';
        if (xlm < 0.0001) return '<0.0001';
        return xlm.toFixed(4).replace(/\.?0+$/, '');
    }, [balance]);

    const refresh = useCallback(async () => {
        if (!address) return;
        setIsLoading(true);
        setError(null);
        try {
            setBalance(await getStellarBalance(address));
        } catch (e: any) {
            setError(e?.message || 'Failed to fetch balance');
        } finally {
            setIsLoading(false);
        }
    }, [address]);

    useEffect(() => {
        if (!address) { setBalance(0n); return; }
        refresh();
        const interval = setInterval(refresh, 15_000);
        return () => clearInterval(interval);
    }, [address, refresh]);

    return { balance, formatted, isLoading, error, refresh };
}
