const {
  rpc: SorobanRpc,
  TransactionBuilder,
  Networks,
  Contract,
  Keypair,
  nativeToScVal,
  scValToNative,
  Address,
  xdr,
  BASE_FEE,
} = require('@stellar/stellar-sdk');

const config = require('../config');

const server = new SorobanRpc.Server(config.SOROBAN_RPC_URL);
const adminKeypair = Keypair.fromSecret(config.ADMIN_SECRET_KEY);
const contract = new Contract(config.CONTRACT_ID);

function toScVal(value) {
  if (value === null || value === undefined) return xdr.ScVal.scvVoid();
  if (value && typeof value === 'object' && value._arm !== undefined) return value;
  if (typeof value === 'string' && (value.startsWith('G') || value.startsWith('C')) && value.length >= 56)
    return nativeToScVal(value, { type: 'address' });
  if (typeof value === 'bigint') return nativeToScVal(value, { type: 'i128' });
  if (typeof value === 'number' && Number.isInteger(value)) return nativeToScVal(value, { type: 'u32' });
  return nativeToScVal(value);
}

/**
 * Simulate a read-only contract call and return the decoded result.
 */
async function readContract(functionName, args = []) {
  const account = await server.getAccount(adminKeypair.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(functionName, ...args.map(toScVal)))
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(result)) {
    throw new Error(`readContract ${functionName} failed: ${result.error}`);
  }
  return result.result ? scValToNative(result.result.retval) : null;
}

/**
 * Build, sign, and submit a contract invocation. Returns tx hash.
 */
async function invokeContract(functionName, args = []) {
  const account = await server.getAccount(adminKeypair.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(functionName, ...args.map(toScVal)))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(adminKeypair);

  const result = await server.sendTransaction(prepared);
  if (result.status === 'ERROR') {
    throw new Error(`invokeContract ${functionName} failed: ${JSON.stringify(result.errorResult)}`);
  }

  // Poll for confirmation
  const hash = result.hash;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const status = await server.getTransaction(hash);
    if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return { success: true, txId: hash, result: status };
    }
    if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`tx ${hash} failed on-chain`);
    }
  }
  // Timed out but broadcast succeeded
  return { success: true, txId: hash, result: null };
}

/**
 * Get latest ledger sequence (analogous to block height).
 */
async function getLedgerSequence() {
  const info = await server.getLatestLedger();
  return info.sequence;
}

module.exports = { readContract, invokeContract, getLedgerSequence };
