// Dynamic API base URL helper
import { getActiveNetwork } from './networks';


export function apiUrl(path: string): string {
    return `${getActiveNetwork().apiBase}${path}`;
}


export function metadataUrl(path: string): string {
    return `${getActiveNetwork().metadataBase}${path}`;
}


export async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    // Throw on rate limit or server errors so blockchainCache preserves last good data
    if (res.status === 429) throw new Error('Rate limited — serving cached data');
    if (res.status >= 500) throw new Error(`Server error ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
        throw new Error(`API unavailable (got ${ct || 'no content-type'} instead of JSON)`);
    }
    return res.json();
}
