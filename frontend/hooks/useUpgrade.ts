import { useState, useCallback } from 'react';
import { callContract, waitForTransaction } from '../lib/stellar';
import { useWalletContext } from '../context/WalletContext';

const API_URL = ((import.meta as any).env?.VITE_API_URL || '').replace(/\/api$/, '');
function apiUrl(path: string) { return API_URL ? `${API_URL}${path}` : path; }

const DEFAULT_CHANCES: Record<number, number> = { 1: 80, 2: 70, 3: 60, 4: 50 };

export interface UpgradeResult {
    success: boolean;
    burned?: boolean;
    newLevel?: number;
    txHash?: string;
    error?: string;
}

export function useUpgrade() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState('');
    const { refreshRecords } = useWalletContext();

    const getUpgradeConfig = useCallback(async () => {
        return { chances: DEFAULT_CHANCES };
    }, []);

    const upgradeCard = useCallback(async (
        signerOrCard: any,
        tokenIdOrCard?: any,
        currentLevelArg?: number
    ): Promise<UpgradeResult> => {
        setIsLoading(true);
        setError(null);
        setStatusMessage('Requesting upgrade...');
        try {
            // Handle both signatures:
            // Old: upgradeCard(signer, cardObject)
            // New: upgradeCard(signerAddress, tokenId, currentLevel)
            let signerAddress: string;
            let tokenId: number;
            let currentLevel: number;

            if (typeof signerOrCard === 'object' && signerOrCard?.address) {
                // Old signature: (signer, cardObject)
                signerAddress = signerOrCard.address;
                const card = tokenIdOrCard;
                tokenId = card?.tokenId ?? card?.id ?? 0;
                currentLevel = card?.level ?? card?.multiplier ?? 1;
            } else if (typeof signerOrCard === 'string') {
                signerAddress = signerOrCard;
                tokenId = typeof tokenIdOrCard === 'object' ? (tokenIdOrCard?.tokenId ?? 0) : (tokenIdOrCard ?? 0);
                currentLevel = currentLevelArg ?? (typeof tokenIdOrCard === 'object' ? (tokenIdOrCard?.level ?? 1) : 1);
            } else {
                throw new Error('Invalid signer');
            }

            const res = await fetch(apiUrl('/api/upgrades/fulfill'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerAddress: signerAddress, tokenId, currentLevel }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Upgrade failed');

            setStatusMessage(data.message || 'Upgrade complete');
            await refreshRecords();
            return { success: true, burned: !data.upgraded, newLevel: data.newLevel, txHash: data.txId };
        } catch (e: any) {
            const msg = e?.message || 'Upgrade failed';
            setError(msg);
            return { success: false, error: msg };
        } finally {
            setIsLoading(false);
        }
    }, [refreshRecords]);

    return { isLoading, error, statusMessage, getUpgradeConfig, upgradeCard };
}
