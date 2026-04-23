export interface NetworkConfig {
    id: string;
    name: string;
    shortName: string;
    chainId: number;
    rpcUrl: string;
    explorerUrl: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    contracts: {
        UnicornX_NFT: string;
        PackNFT: string;
        PackOpener: string;
        TournamentManager: string;
        MarketplaceV2: string;
        TokenLeagues: string;
    };
    apiBase: string;
    packPrice: bigint;
    icon: string;
    deployed: boolean;
    contractId: string;
    adminAddress: string;
}

export const STELLAR_CONTRACT_ID = (import.meta as any).env?.VITE_CONTRACT_ID || '';
export const STELLAR_ADMIN = (import.meta as any).env?.VITE_ADMIN_ADDRESS || '';
export const STELLAR_RPC_URL = (import.meta as any).env?.VITE_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
export const STELLAR_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
export const STELLAR_HORIZON_URL = 'https://horizon-testnet.stellar.org';

export const NETWORKS: Record<string, NetworkConfig> = {
    stellar: {
        id: 'stellar',
        name: 'Stellar Testnet',
        shortName: 'XLM',
        chainId: 1,
        rpcUrl: STELLAR_RPC_URL,
        explorerUrl: 'https://stellar.expert/explorer/testnet',
        nativeCurrency: { name: 'Lumens', symbol: 'XLM', decimals: 7 },
        contracts: {
            UnicornX_NFT: STELLAR_CONTRACT_ID,
            PackNFT: STELLAR_CONTRACT_ID,
            PackOpener: STELLAR_CONTRACT_ID,
            TournamentManager: STELLAR_CONTRACT_ID,
            MarketplaceV2: STELLAR_CONTRACT_ID,
            TokenLeagues: STELLAR_CONTRACT_ID,
        },
        apiBase: '/api',
        packPrice: 1_000_000n, // 0.1 XLM in stroops
        icon: '',
        deployed: true,
        contractId: STELLAR_CONTRACT_ID,
        adminAddress: STELLAR_ADMIN,
    },
};

let _activeId = 'stellar';

export function getActiveNetwork(): NetworkConfig {
    return NETWORKS[_activeId] || NETWORKS.stellar;
}

export function setActiveNetwork(id: string) {
    if (!NETWORKS[id]) return;
    _activeId = id;
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('aidecks:network', id);
    }
}

export function getActiveNetworkId(): string { return _activeId; }

export function getAllNetworks(): NetworkConfig[] {
    return Object.values(NETWORKS);
}

export function currencySymbol(): string {
    return getActiveNetwork().nativeCurrency.symbol;
}
