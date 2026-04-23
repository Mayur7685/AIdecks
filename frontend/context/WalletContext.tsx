import React, { createContext, useContext, ReactNode, useEffect, useState, useCallback } from 'react';
import freighterApi from '@stellar/freighter-api';
import { getStellarBalance, readContract, formatXLM } from '../lib/stellar';
import { getActiveNetwork } from '../lib/networks';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WalletContextType {
    isConnected: boolean;
    address: string | null;
    balance: bigint;
    balanceLoading: boolean;
    chainId: number | null;
    isCorrectChain: boolean;
    isConnecting: boolean;
    hasSavedWallet: boolean;
    error: string | null;
    connect: () => Promise<void>;
    connectRiseWallet: () => Promise<void>;
    disconnect: () => void;
    switchChain: () => Promise<void>;
    getSigner: () => Promise<string | null>;
    signMessage: (message: string) => Promise<string | null>;
    refreshBalance: () => void;
    formatAddress: (address: string) => string;
    formatBalance: (stroops: bigint, decimals?: number) => string;
    walletProvider: null;
    // Stellar: cards are public — just token IDs
    cardRecords: number[];
    packRecords: number;   // pending pack count
    refreshRecords: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatBalance(stroops: bigint, decimals = 4): string {
    const xlm = Number(stroops) / 10_000_000;
    return xlm.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
    const [address, setAddress] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [balance, setBalance] = useState<bigint>(0n);
    const [balanceLoading, setBalanceLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cardRecords, setCardRecords] = useState<number[]>([]);
    const [packRecords, setPackRecords] = useState<number>(0);

    const [hasSavedWallet, setHasSavedWallet] = useState(
        typeof window !== 'undefined' ? !!localStorage.getItem('aidecks:wallet') : false
    );

    const connect = useCallback(async () => {
        setIsConnecting(true);
        setError(null);
        try {
            const { isConnected } = await freighterApi.isConnected();
            if (!isConnected) throw new Error('Freighter wallet not installed. Get it at freighter.app');

            await freighterApi.requestAccess();
            const { address } = await freighterApi.getAddress();
            setAddress(address);
            setIsConnected(true);
            setHasSavedWallet(true);
            localStorage.setItem('aidecks:wallet', 'freighter');
        } catch (e: any) {
            setError(e?.message || 'Failed to connect');
            setHasSavedWallet(false);
            localStorage.removeItem('aidecks:wallet');
        } finally {
            setIsConnecting(false);
        }
    }, []);

    const connectRiseWallet = connect; // alias

    const disconnect = useCallback(() => {
        setAddress(null);
        setIsConnected(false);
        setBalance(0n);
        setCardRecords([]);
        setPackRecords(0);
        setHasSavedWallet(false);
        localStorage.removeItem('aidecks:wallet');
    }, []);

    const refreshBalance = useCallback(async () => {
        if (!address) return;
        setBalanceLoading(true);
        try {
            const bal = await getStellarBalance(address);
            setBalance(bal);
        } catch { /* keep previous */ }
        finally { setBalanceLoading(false); }
    }, [address]);

    // Fetch card token IDs and pending packs from contract (public state)
    const refreshRecords = useCallback(async () => {
        if (!address) return;
        try {
            const [cards, packs] = await Promise.all([
                readContract<any>('get_cards_of', [address]).catch(() => []),
                readContract<any>('get_pending_packs', [address]).catch(() => 0),
            ]);
            console.log('[WalletContext] refreshRecords:', { cards, packs, packsNum: Number(packs) });
            setCardRecords(Array.isArray(cards) ? cards : []);
            setPackRecords(Number(packs ?? 0));
        } catch (e) {
            console.error('[WalletContext] refreshRecords error:', e);
        }
    }, [address]);

    // Auto-connect if previously connected
    useEffect(() => {
        if (hasSavedWallet) connect().catch(() => {});
    }, []);

    // Balance + records polling
    useEffect(() => {
        if (!address) return;
        refreshBalance();
        refreshRecords();
        const balInterval = setInterval(refreshBalance, 15_000);
        const recInterval = setInterval(refreshRecords, 30_000);
        return () => { clearInterval(balInterval); clearInterval(recInterval); };
    }, [address, refreshBalance, refreshRecords]);

    const getSigner = useCallback(async () => {
        if (!address) return null;
        // Return an object that looks like an ethers signer for component compat
        return {
            address,
            getAddress: async () => address,
            _isStellarSigner: true,
        };
    }, [address]);

    const signMessage = useCallback(async (_message: string): Promise<string | null> => {
        // Freighter doesn't expose signMessage directly; return null
        return null;
    }, []);

    const switchChain = useCallback(async () => {
        // Stellar has no chain switching — always testnet
    }, []);

    const net = getActiveNetwork();

    return (
        <WalletContext.Provider value={{
            isConnected,
            address,
            balance,
            balanceLoading,
            chainId: net.chainId,
            isCorrectChain: true,
            isConnecting,
            hasSavedWallet,
            error,
            connect,
            connectRiseWallet,
            disconnect,
            switchChain,
            getSigner,
            signMessage,
            refreshBalance,
            formatAddress,
            formatBalance,
            walletProvider: null,
            cardRecords,
            packRecords,
            refreshRecords,
        }}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWalletContext(): WalletContextType {
    const ctx = useContext(WalletContext);
    if (!ctx) throw new Error('useWalletContext must be used inside WalletProvider');
    return ctx;
}

export default WalletContext;
