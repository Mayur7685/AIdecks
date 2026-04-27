import {
    Contract,
    rpc as SorobanRpc,
    Networks,
    TransactionBuilder,
    nativeToScVal,
    scValToNative,
    BASE_FEE,
    Horizon,
    xdr,
    Address,
} from '@stellar/stellar-sdk';
import freighterApi from '@stellar/freighter-api';
import { STELLAR_CONTRACT_ID, STELLAR_RPC_URL, STELLAR_NETWORK_PASSPHRASE, STELLAR_ADMIN, STELLAR_HORIZON_URL } from './networks';

export const CHAIN_NAME = 'Stellar Testnet';
export const EXPLORER_URL = 'https://stellar.expert/explorer/testnet';

// Startup data (same 19 YC startups)
export const STARTUPS: Record<number, { name: string; rarity: string; multiplier: number }> = {
    1:  { name: 'OpenAI',          rarity: 'Legendary', multiplier: 10 },
    2:  { name: 'Anthropic',       rarity: 'Legendary', multiplier: 10 },
    3:  { name: 'Google DeepMind', rarity: 'Legendary', multiplier: 10 },
    4:  { name: 'xAI',             rarity: 'Legendary', multiplier: 10 },
    5:  { name: 'Midjourney',      rarity: 'Legendary', multiplier: 10 },
    6:  { name: 'Meta AI',         rarity: 'Epic',      multiplier: 5  },
    7:  { name: 'Alibaba',         rarity: 'Epic',      multiplier: 5  },
    8:  { name: 'Z AI',            rarity: 'Epic',      multiplier: 5  },
    9:  { name: 'Cursor',          rarity: 'Rare',      multiplier: 3  },
    10: { name: 'Deepseek',        rarity: 'Rare',      multiplier: 3  },
    11: { name: 'Windsurf',        rarity: 'Rare',      multiplier: 3  },
    12: { name: 'Antigravity',     rarity: 'Rare',      multiplier: 3  },
    13: { name: 'MiniMax',         rarity: 'Rare',      multiplier: 3  },
    14: { name: 'Mistral AI',      rarity: 'Common',    multiplier: 1  },
    15: { name: 'Kiro',            rarity: 'Common',    multiplier: 1  },
    16: { name: 'Perplexity',      rarity: 'Common',    multiplier: 1  },
    17: { name: 'Cohere',          rarity: 'Common',    multiplier: 1  },
    18: { name: 'Moonshot AI',     rarity: 'Common',    multiplier: 1  },
    19: { name: 'Sarvam AI',       rarity: 'Common',    multiplier: 1  },
};

// ── RPC / Horizon clients ─────────────────────────────────────────────────────
const rpc = new SorobanRpc.Server(STELLAR_RPC_URL);
const horizon = new Horizon.Server(STELLAR_HORIZON_URL);

// ── Contract call helpers ─────────────────────────────────────────────────────

/**
 * Simulate a read-only contract call. No signing required.
 */
export async function readContract<T = any>(functionName: string, args: any[] = []): Promise<T> {
    const account = await rpc.getAccount(STELLAR_ADMIN);
    const contract = new Contract(STELLAR_CONTRACT_ID);
    const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    })
        .addOperation(contract.call(functionName, ...args.map(toScVal)))
        .setTimeout(30)
        .build();

    const result = await rpc.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(result)) {
        throw new Error(`readContract(${functionName}): ${result.error}`);
    }
    return result.result ? scValToNative(result.result.retval) as T : (null as T);
}

/**
 * Build, sign with Freighter, and submit a contract call.
 */
export async function callContract(functionName: string, args: any[], signerAddress: string): Promise<string> {
    console.log(`[callContract] ${functionName}`, args.map(a => `${typeof a}:${String(a).slice(0,20)}`));
    const account = await rpc.getAccount(signerAddress);
    const contract = new Contract(STELLAR_CONTRACT_ID);
    const scArgs = args.map(toScVal);
    const tx = new TransactionBuilder(account, {
        fee: '1000000', // high fee to avoid insufficient fee errors
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    })
        .addOperation(contract.call(functionName, ...scArgs))
        .setTimeout(60)
        .build();

    let prepared: any;
    try {
        prepared = await rpc.prepareTransaction(tx);
    } catch (e: any) {
        console.error(`[callContract] prepareTransaction failed for ${functionName}:`, e?.message || e);
        throw new Error(e?.message || `Contract call failed: ${functionName}`);
    }
    const signResult = await freighterApi.signTransaction(prepared.toXDR(), {
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    });
    const signedXdr = typeof signResult === 'string' ? signResult : signResult.signedTxXdr;

    const result = await rpc.sendTransaction(
        TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK_PASSPHRASE)
    );
    if (result.status === 'ERROR') {
        throw new Error(`callContract(${functionName}) failed: ${JSON.stringify(result.errorResult)}`);
    }
    return result.hash;
}

/**
 * Poll for transaction confirmation. Returns when SUCCESS or throws on FAILED.
 */
export async function waitForTransaction(hash: string): Promise<void> {
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const status = await rpc.getTransaction(hash);
        if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) return;
        if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
            throw new Error(`Transaction ${hash} failed on-chain`);
        }
    }
}

// ── Balance ───────────────────────────────────────────────────────────────────

export async function getStellarBalance(address: string): Promise<bigint> {
    try {
        const account = await horizon.loadAccount(address);
        const xlm = account.balances.find(b => b.asset_type === 'native');
        return BigInt(Math.floor(parseFloat(xlm?.balance || '0') * 10_000_000));
    } catch {
        return 0n;
    }
}

// ── Formatting ────────────────────────────────────────────────────────────────

/** Format XLM stroops (7 decimals) */
export function formatXLM(stroops: bigint | number | null | undefined): string {
    if (stroops == null) return '0.0000';
    try {
        const n = Number(stroops);
        if (Number.isNaN(n)) return '0.0000';
        return (n / 10_000_000).toFixed(4);
    } catch { return '0.0000'; }
}

export function parseXLM(xlm: string): bigint {
    const n = parseFloat(xlm);
    if (Number.isNaN(n)) return 0n;
    return BigInt(Math.floor(n * 10_000_000));
}

// Alias for backward compat with hooks that call formatXTZ
export const formatXTZ = formatXLM;
export const parseXTZ = parseXLM;

// ethers compat shim (used by some UI components)
export const ethers = {
    formatEther: (val: any) => formatXLM(val),
    parseEther: (val: string) => parseXLM(val),
    ZeroAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    BrowserProvider: class { async getSigner() { return null; } },
    JsonRpcProvider: class {},
    Contract: class {},
    formatUnits: (val: any, _d?: any) => formatXLM(val),
    parseUnits: (val: string, _d?: any) => parseXLM(val),
};

// ── ScVal conversion helper ───────────────────────────────────────────────────

function toScVal(value: any): ReturnType<typeof nativeToScVal> {
    if (value === null || value === undefined) return xdr.ScVal.scvVoid();
    if (value && typeof value === 'object' && value._arm !== undefined) return value;
    if (typeof value === 'string' && (value.startsWith('G') || value.startsWith('C')) && value.length >= 56) {
        return nativeToScVal(value, { type: 'address' });
    }
    if (typeof value === 'bigint') return nativeToScVal(value, { type: 'i128' });
    // Array of numbers → Vec<u32>
    if (Array.isArray(value)) {
        return xdr.ScVal.scvVec(value.map(v =>
            typeof v === 'number' ? nativeToScVal(v, { type: 'u32' }) : toScVal(v)
        ));
    }
    if (typeof value === 'number' && Number.isInteger(value)) {
        return nativeToScVal(value, { type: 'u32' });
    }
    if (typeof value === 'string') {
        // Non-address string — encode as bytes/symbol
        return nativeToScVal(value, { type: 'string' });
    }
    return nativeToScVal(value);
}

// ── Legacy contract stubs (keep hook imports working) ────────────────────────

export function getNFTContract(_?: any) { return {}; }
export function getPackNFTContract(_?: any) { return {}; }
export function getPackOpenerContract(_?: any) { return {}; }
export function getTournamentContract(_?: any) { return {}; }
export function getMarketplaceV2Contract(_?: any) { return {}; }
export function getTokenLeaguesContract(_?: any) { return {}; }
export function getProvider() { return null; }
export function getReadProvider() { return null; }
export function getActiveContracts() { return getActiveContractsInner(); }

function getActiveContractsInner() {
    return {
        UnicornX_NFT: STELLAR_CONTRACT_ID,
        PackNFT: STELLAR_CONTRACT_ID,
        PackOpener: STELLAR_CONTRACT_ID,
        TournamentManager: STELLAR_CONTRACT_ID,
        MarketplaceV2: STELLAR_CONTRACT_ID,
        TokenLeagues: STELLAR_CONTRACT_ID,
    };
}

export const CONTRACTS = getActiveContractsInner();

export const NFT_ABI: any[] = [];
export const PACK_NFT_ABI: any[] = [];
export const PACK_OPENER_ABI: any[] = [];
export const TOURNAMENT_ABI: any[] = [];
export const MARKETPLACE_V2_ABI: any[] = [];
export const TOKEN_LEAGUES_ABI: any[] = [];

export function safeBigInt(val: any, fallback = 0n): bigint {
    if (val == null || val === '') return fallback;
    try { return BigInt(val); } catch { return fallback; }
}
