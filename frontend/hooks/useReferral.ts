import { useState, useCallback, useEffect } from 'react';
import { readContract, formatXLM } from '../lib/stellar';
import { useWalletContext } from '../context/WalletContext';

export function useReferral() {
    const { address, isConnected } = useWalletContext();
    const [referralStats, setReferralStats] = useState({ count: 0, totalEarned: '0' });

    const getReferralLink = useCallback(() => {
        if (!address) return '';
        return `${window.location.origin}?ref=${address}`;
    }, [address]);

    const checkReferralFromURL = useCallback(() => {
        const params = new URLSearchParams(window.location.search);
        const ref = params.get('ref');
        if (ref && ref.startsWith('G') && ref.length >= 56) {
            if (!localStorage.getItem('aidecks_referrer')) {
                localStorage.setItem('aidecks_referrer', ref);
            }
            return ref;
        }
        return localStorage.getItem('aidecks_referrer');
    }, []);

    const fetchReferralStats = useCallback(async () => {
        if (!address) return;
        try {
            const [count, earned] = await Promise.all([
                readContract<number>('get_referral_count', [address]).catch(() => 0),
                readContract<number>('get_referral_earnings', [address]).catch(() => 0),
            ]);
            setReferralStats({
                count: Number(count ?? 0),
                totalEarned: formatXLM(BigInt(earned ?? 0)),
            });
        } catch { /* keep previous */ }
    }, [address]);

    useEffect(() => {
        if (isConnected && address) {
            checkReferralFromURL();
            fetchReferralStats();
        }
    }, [isConnected, address, checkReferralFromURL, fetchReferralStats]);

    return { getReferralLink, referralStats, fetchReferralStats };
}
