const express = require('express');
const router = express.Router();
const { xdr, scValToNative } = require('@stellar/stellar-sdk');

const HORIZON = 'https://horizon-testnet.stellar.org';
const CONTRACT_ID = process.env.CONTRACT_ID;
const TARGET_FNS = new Set(['buy_listing', 'list_card', 'cancel_listing']);

function decodeFunctionName(parameters) {
    try {
        const val = xdr.ScVal.fromXDR(parameters?.[1]?.value, 'base64');
        return scValToNative(val);
    } catch { return null; }
}

function decodeAddress(param) {
    try { return String(scValToNative(xdr.ScVal.fromXDR(param.value, 'base64'))); }
    catch { return null; }
}

// GET /api/marketplace/history?address=G...&limit=50
router.get('/history', async (req, res) => {
    try {
        const { address, limit = 50 } = req.query;
        if (!address) return res.json({ success: true, trades: [] });

        const url = `${HORIZON}/accounts/${address}/operations?limit=200&order=desc&include_failed=false`;
        const resp = await fetch(url);
        if (!resp.ok) return res.json({ success: true, trades: [] });
        const data = await resp.json();

        const trades = [];
        const seen = new Set();

        for (const op of (data._embedded?.records ?? [])) {
            if (op.type !== 'invoke_host_function') continue;
            const params = op.parameters;
            if (!params || params.length < 2) continue;

            // Verify it's our contract
            const contractAddr = decodeAddress(params[0]);
            if (contractAddr !== CONTRACT_ID) continue;

            const fnName = decodeFunctionName(params);
            if (!fnName || !TARGET_FNS.has(fnName)) continue;

            const key = op.transaction_hash;
            if (seen.has(key)) continue;
            seen.add(key);

            trades.push({
                txHash: op.transaction_hash,
                type: fnName,
                account: op.source_account,
                timestamp: op.created_at,
            });

            if (trades.length >= Number(limit)) break;
        }

        res.json({ success: true, trades });
    } catch (err) {
        console.error('[marketplace/history]', err.message);
        res.json({ success: true, trades: [] });
    }
});

module.exports = router;
