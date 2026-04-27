const {readContract} = require('./services/stellar');
(async () => {
  const now = Math.floor(Date.now() / 1000);
  let mostRecent = null;
  for (let id = 1; id <= 10; id++) {
    const t = await readContract('get_tournament', [id]).catch(() => null);
    console.log('id', id, t ? 'HAS DATA' : 'NULL');
    if (!t) break;
    const regStart = Number(BigInt(t.registration_start ?? 0));
    console.log('  regStart:', regStart);
    if (regStart === 0) { console.log('  breaking - regStart=0'); break; }
    const startTime = Number(BigInt(t.start_time ?? 0));
    const endTime = Number(BigInt(t.end_time ?? 0));
    const status = Number(t.status ?? 0);
    const prizePool = Number(BigInt(t.prize_pool ?? 0));
    const statusStr = status === 0
      ? (now < startTime ? 'registration' : now < endTime ? 'active' : 'ended')
      : status === 2 ? 'finalized' : 'cancelled';
    console.log('  status:', statusStr, 'endTime:', endTime, 'now:', now);
    const shaped = { id, registrationStart: regStart, startTime, endTime, status: statusStr, entryCount: Number(t.entry_count ?? 0), prizePool: (prizePool / 10_000_000).toFixed(2) };
    mostRecent = shaped;
    if (statusStr === 'registration' || statusStr === 'active') {
      console.log('RETURNING ACTIVE:', id);
      break;
    }
  }
  console.log('FINAL mostRecent:', mostRecent);
})();
