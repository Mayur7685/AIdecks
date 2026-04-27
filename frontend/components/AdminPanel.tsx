import React, { useState, useEffect } from 'react';
import {
    Shield, DollarSign, Trophy, Settings, RefreshCw, AlertTriangle,
    Download, Plus, X, Check, Calendar, Users, Clock, Trash2, Database, Key
} from 'lucide-react';
import { useWalletContext } from '../context/WalletContext';
import { useAdmin, isAdmin, ContractBalances, AdminStats, TournamentData } from '../hooks/useAdmin';
import { useNFT } from '../hooks/useNFT';
import { formatXTZ } from '../lib/stellar';
import { apiUrl } from '../lib/api';
import { currencySymbol } from '../lib/networks';

const AdminPanel: React.FC = () => {
    const { address, getSigner, isConnected } = useWalletContext();
    const admin = useAdmin();
    const { clearCache: clearNFTCache } = useNFT();

    const [balances, setBalances] = useState<ContractBalances | null>(null);
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [tournaments, setTournaments] = useState<TournamentData[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [newPackPrice, setNewPackPrice] = useState('5');
    const [showCreateTournament, setShowCreateTournament] = useState(false);
    const [tournamentForm, setTournamentForm] = useState({ regStart: '', start: '', end: '' });

    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showPointsModal, setShowPointsModal] = useState<TournamentData | null>(null);
    const [pointsValues, setPointsValues] = useState<string[]>(Array(19).fill('0'));

    const [adminKey, setAdminKey] = useState(() => localStorage.getItem('adminKey') || '');
    const [dbActionLoading, setDbActionLoading] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<string | null>(null);
    const [waitlistEntries, setWaitlistEntries] = useState<{ id: number; email: string; wallet_address: string; created_at: string }[]>([]);
    const [waitlistLoading, setWaitlistLoading] = useState(false);

    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const startupNames = [
        'OpenAI', 'Anthropic', 'Google DeepMind', 'xAI', 'Midjourney',
        'Meta AI', 'Alibaba', 'Z AI', 'Cursor', 'Deepseek',
        'Windsurf', 'Antigravity', 'MiniMax', 'Mistral AI', 'Kiro',
        'Perplexity', 'Cohere', 'Moonshot AI', 'Sarvam AI'
    ];

    const userIsAdmin = isAdmin(address);

    const loadData = async () => {
        setIsRefreshing(true);
        const [b, s, t] = await Promise.all([
            admin.getContractBalances(),
            admin.getAdminStats(),
            admin.getTournaments()
        ]);
        setBalances(b);
        setStats(s);
        setTournaments(t);
        setIsRefreshing(false);
    };

    useEffect(() => { if (userIsAdmin) loadData(); }, [userIsAdmin]);

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const formatDate = (timestamp: number) => {
        if (!timestamp) return '-';
        return new Date(timestamp * 1000).toLocaleString('en-GB', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const getStatusInfo = (status: number) => {
        switch (status) {
            case 0: return { text: 'Created', color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10' };
            case 1: return { text: 'Active', color: 'text-green-600 dark:text-green-400 bg-green-500/10' };
            case 2: return { text: 'Finalized', color: 'text-gray-600 dark:text-gray-400 bg-gray-500/10' };
            case 3: return { text: 'Cancelled', color: 'text-red-600 dark:text-red-400 bg-red-500/10' };
            default: return { text: 'Unknown', color: 'text-gray-500 bg-gray-500/10' };
        }
    };

    const handleSetPackPrice = async () => {
        const signer = await getSigner();
        if (!signer) return;
        const price = parseFloat(newPackPrice);
        if (isNaN(price) || price <= 0) { showMessage('error', 'Invalid price'); return; }
        const priceStroops = BigInt(Math.floor(price * 10_000_000));
        const result = await admin.setPackPrice(signer, priceStroops);
        if (result.success) { showMessage('success', `Pack price set to ${price} ${currencySymbol()}`); loadData(); }
        else showMessage('error', result.error || 'Failed to set price');
    };

    const handleCreateTournament = async () => {
        const signer = await getSigner();
        if (!signer) return;
        const regStart = new Date(tournamentForm.regStart).getTime() / 1000;
        const start = new Date(tournamentForm.start).getTime() / 1000;
        const end = new Date(tournamentForm.end).getTime() / 1000;
        if (!regStart || !start || !end) { showMessage('error', 'Invalid dates'); return; }
        const result = await admin.createTournament(signer, regStart, start, end);
        if (result.success && result.tournamentId) {
            await admin.setActiveTournament(signer, result.tournamentId);
            showMessage('success', `Tournament #${result.tournamentId} created!`);
            setShowCreateTournament(false);
            loadData();
        } else showMessage('error', result.error || 'Failed to create tournament');
    };

    const handleCancelTournament = async (tournamentId: number) => {
        const signer = await getSigner();
        if (!signer) return;
        setActionLoading('cancel');
        const result = await admin.cancelTournament(signer, tournamentId);
        if (result.success) { clearNFTCache(); showMessage('success', `Tournament #${tournamentId} cancelled!`); loadData(); }
        else showMessage('error', result.error || 'Failed to cancel');
        setActionLoading(null);
    };

    const handleWithdrawFromTournament = async (tournament: TournamentData) => {
        const signer = await getSigner();
        if (!signer) return;
        setActionLoading('withdraw-' + tournament.id);
        const result = await admin.withdrawFromPrizePool(signer, tournament.id, tournament.prizePool, address || '');
        if (result.success) {
            showMessage('success', `Withdrew ${formatXTZ(tournament.prizePool)} ${currencySymbol()} from #${tournament.id}`);
            setTournaments(prev => prev.map(t => t.id === tournament.id ? { ...t, prizePool: 0n } : t));
            loadData();
        } else showMessage('error', result.error || 'Withdrawal failed');
        setActionLoading(null);
    };

    const handleFinalizeWithPoints = async () => {
        const signer = await getSigner();
        if (!signer || !showPointsModal) return;
        setActionLoading('finalize-points');
        try {
            const points = pointsValues.map(p => BigInt(parseInt(p) || 0));
            const result = await admin.finalizeWithPoints(signer, showPointsModal.id, points);
            if (result.success) {
                clearNFTCache();
                showMessage('success', `Tournament #${showPointsModal.id} finalized!`);
                setShowPointsModal(null);
                setPointsValues(Array(19).fill('0'));
                loadData();
            } else showMessage('error', result.error || 'Failed to finalize');
        } catch (e: any) { showMessage('error', e.message); }
        setActionLoading(null);
    };

    const handleDbAction = async (action: 'clear-news' | 'reset-scores') => {
        if (!adminKey.trim()) { showMessage('error', 'Enter admin key first'); return; }
        if (confirmAction !== action) { setConfirmAction(action); return; }
        setDbActionLoading(action);
        setConfirmAction(null);
        try {
            const res = await fetch(apiUrl(`/admin/${action}`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey.trim() },
            });
            const data = await res.json();
            if (data.success) showMessage('success', data.message);
            else showMessage('error', data.error || 'Action failed');
        } catch { showMessage('error', 'Network error'); }
        setDbActionLoading(null);
    };

    const loadWaitlist = async () => {
        if (!adminKey.trim()) { showMessage('error', 'Enter admin key first'); return; }
        setWaitlistLoading(true);
        try {
            const res = await fetch(apiUrl('/admin/waitlist'), { headers: { 'X-Admin-Key': adminKey.trim() } });
            const data = await res.json();
            if (data.success) { setWaitlistEntries(data.data); showMessage('success', `Loaded ${data.total} entries`); }
            else showMessage('error', data.error || 'Failed to load waitlist');
        } catch { showMessage('error', 'Network error'); }
        setWaitlistLoading(false);
    };

    const downloadWaitlistTxt = () => {
        if (!waitlistEntries.length) return;
        const lines = waitlistEntries.map((e, i) => `${i + 1}\t${e.email}\t${e.wallet_address}\t${e.created_at}`);
        const blob = new Blob([`#\tEmail\tWallet\tDate\n${lines.join('\n')}`], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `waitlist-${new Date().toISOString().split('T')[0]}.txt`; a.click();
        URL.revokeObjectURL(url);
    };

    if (!isConnected || !userIsAdmin) return null;

    return (
        <>
            <div className="animate-[fadeInUp_0.5s_ease-out]">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-500/10 dark:bg-red-500/20 rounded-xl">
                            <Shield className="w-8 h-8 text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white">Admin Panel</h2>
                            <p className="text-gray-500 text-sm font-mono">{address?.slice(0, 10)}...</p>
                        </div>
                    </div>
                    <button onClick={loadData} disabled={isRefreshing}
                        className="p-2 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                        <RefreshCw className={`w-5 h-5 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Message */}
                {message && (
                    <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
                        message.type === 'success'
                            ? 'bg-green-50 dark:bg-green-500/20 border border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400'
                            : 'bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400'
                    }`}>
                        {message.type === 'success' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                        {message.text}
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-4">
                        <p className="text-gray-500 text-xs uppercase mb-1">Packs Sold</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white font-mono">{stats?.packsSold || 0}</p>
                    </div>
                    <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-4">
                        <p className="text-gray-500 text-xs uppercase mb-1">Pack Price</p>
                        <p className="text-2xl font-bold text-yc-aleo font-mono">
                            {stats ? formatXTZ(stats.packPrice) : '5'} {currencySymbol()}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-4">
                        <p className="text-gray-500 text-xs uppercase mb-1">Total NFTs</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white font-mono">{stats?.totalNFTs || 0}</p>
                    </div>
                    <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-4">
                        <p className="text-gray-500 text-xs uppercase mb-1">Active Tournament</p>
                        <p className="text-2xl font-bold text-yc-green font-mono">#{stats?.activeTournamentId || 0}</p>
                    </div>
                </div>

                {/* Contract Info */}
                <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-6 mb-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-yc-green" />
                        Contract Info
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 dark:bg-black/50 rounded-lg p-4">
                            <p className="text-gray-500 text-xs mb-1">Contract ID</p>
                            <p className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all">
                                {import.meta.env.VITE_CONTRACT_ID || 'Not configured'}
                            </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-black/50 rounded-lg p-4">
                            <p className="text-gray-500 text-xs mb-1">Admin Address</p>
                            <p className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all">
                                {address}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Actions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

                    {/* Set Pack Price */}
                    <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-6">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <Settings className="w-4 h-4" /> Pack Price
                        </h3>
                        <label className="text-gray-500 dark:text-gray-400 text-sm mb-2 block">Price ({currencySymbol()})</label>
                        <div className="flex gap-2">
                            <input type="number" value={newPackPrice} onChange={(e) => setNewPackPrice(e.target.value)}
                                className="flex-1 bg-gray-50 dark:bg-black border border-gray-200 dark:border-[#333] rounded-lg px-4 py-2 text-gray-900 dark:text-white font-mono"
                                placeholder="5" />
                            <button onClick={handleSetPackPrice} disabled={admin.isLoading}
                                className="bg-yc-aleo hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold disabled:opacity-50">
                                Set
                            </button>
                        </div>
                    </div>

                    {/* Create Tournament */}
                    <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-6">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <Trophy className="w-4 h-4" /> Create Tournament
                        </h3>
                        {!showCreateTournament ? (
                            <button onClick={() => setShowCreateTournament(true)}
                                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                                <Plus className="w-5 h-5" /> New Tournament
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-900 dark:text-white font-bold text-sm">New Tournament</span>
                                    <button onClick={() => setShowCreateTournament(false)}>
                                        <X className="w-4 h-4 text-gray-500" />
                                    </button>
                                </div>
                                <div>
                                    <label className="text-gray-500 dark:text-gray-400 text-xs">Registration Start</label>
                                    <input type="datetime-local" value={tournamentForm.regStart}
                                        onChange={(e) => setTournamentForm({ ...tournamentForm, regStart: e.target.value })}
                                        className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded px-3 py-2 text-gray-900 dark:text-white text-sm" />
                                </div>
                                <div>
                                    <label className="text-gray-500 dark:text-gray-400 text-xs">Start Time</label>
                                    <input type="datetime-local" value={tournamentForm.start}
                                        onChange={(e) => setTournamentForm({ ...tournamentForm, start: e.target.value })}
                                        className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded px-3 py-2 text-gray-900 dark:text-white text-sm" />
                                </div>
                                <div>
                                    <label className="text-gray-500 dark:text-gray-400 text-xs">End Time</label>
                                    <input type="datetime-local" value={tournamentForm.end}
                                        onChange={(e) => setTournamentForm({ ...tournamentForm, end: e.target.value })}
                                        className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded px-3 py-2 text-gray-900 dark:text-white text-sm" />
                                </div>
                                <button onClick={handleCreateTournament} disabled={admin.isLoading}
                                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black py-2 rounded-lg font-bold disabled:opacity-50">
                                    {admin.isLoading ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Admin Key */}
                <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-6 mb-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Key className="w-5 h-5 text-yc-aleo" />
                        Admin Key
                    </h3>
                    <input type="password" value={adminKey}
                        onChange={(e) => { setAdminKey(e.target.value); localStorage.setItem('adminKey', e.target.value); }}
                        placeholder="Enter admin API key"
                        className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-[#333] rounded-lg px-4 py-2 text-gray-900 dark:text-white font-mono text-sm" />
                    <p className="text-gray-400 text-xs mt-2">Required for database operations and waitlist access</p>
                </div>

                {/* Database Management */}
                <div className="bg-white dark:bg-[#121212] border border-red-200 dark:border-red-500/30 rounded-xl p-6 mb-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Database className="w-5 h-5 text-red-500" />
                        Database Management
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button onClick={() => handleDbAction('clear-news')}
                            disabled={dbActionLoading === 'clear-news'}
                            className={`py-3 rounded-lg font-bold transition-all ${
                                confirmAction === 'clear-news'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/30'
                            } disabled:opacity-50`}>
                            {dbActionLoading === 'clear-news' ? 'Clearing...' : confirmAction === 'clear-news' ? 'Click Again to Confirm' : 'Clear News Feed'}
                        </button>
                        <button onClick={() => handleDbAction('reset-scores')}
                            disabled={dbActionLoading === 'reset-scores'}
                            className={`py-3 rounded-lg font-bold transition-all ${
                                confirmAction === 'reset-scores'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/30'
                            } disabled:opacity-50`}>
                            {dbActionLoading === 'reset-scores' ? 'Resetting...' : confirmAction === 'reset-scores' ? 'Click Again to Confirm' : 'Reset Leaderboard'}
                        </button>
                    </div>
                </div>

                {/* Waitlist */}
                <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Users className="w-5 h-5 text-yc-green" />
                            Waitlist ({waitlistEntries.length})
                        </h3>
                        <div className="flex gap-2">
                            <button onClick={loadWaitlist} disabled={waitlistLoading}
                                className="bg-yc-aleo hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                                {waitlistLoading ? 'Loading...' : 'Load'}
                            </button>
                            {waitlistEntries.length > 0 && (
                                <button onClick={downloadWaitlistTxt}
                                    className="bg-yc-green hover:bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                                    <Download className="w-4 h-4" /> Export
                                </button>
                            )}
                        </div>
                    </div>
                    {waitlistEntries.length > 0 && (
                        <div className="max-h-60 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-gray-50 dark:bg-black/50">
                                    <tr className="text-left text-gray-500 text-xs">
                                        <th className="p-2">#</th>
                                        <th className="p-2">Email</th>
                                        <th className="p-2">Wallet</th>
                                        <th className="p-2">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {waitlistEntries.map((e, i) => (
                                        <tr key={e.id} className="border-t border-gray-100 dark:border-white/5">
                                            <td className="p-2 text-gray-500">{i + 1}</td>
                                            <td className="p-2 text-gray-900 dark:text-white font-mono text-xs">{e.email}</td>
                                            <td className="p-2 text-gray-700 dark:text-gray-300 font-mono text-xs">{e.wallet_address?.slice(0, 8)}...</td>
                                            <td className="p-2 text-gray-500 text-xs">{new Date(e.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Tournament List */}
                <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yc-aleo" />
                        Tournaments ({tournaments.length})
                    </h3>
                    {tournaments.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No tournaments yet</p>
                    ) : (
                        <div className="space-y-4">
                            {tournaments.map((t) => {
                                const status = getStatusInfo(t.status);
                                return (
                                    <div key={t.id} className="bg-gray-50 dark:bg-black/50 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg font-black text-gray-900 dark:text-white">#{t.id}</span>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${status.color}`}>{status.text}</span>
                                            </div>
                                            <span className="text-sm font-mono text-yc-green font-bold">
                                                {formatXTZ(t.prizePool)} {currencySymbol()}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 mb-3">
                                            <div><span className="block text-gray-400">Reg Start</span>{formatDate(t.registrationStart)}</div>
                                            <div><span className="block text-gray-400">Start</span>{formatDate(t.startTime)}</div>
                                            <div><span className="block text-gray-400">End</span>{formatDate(t.endTime)}</div>
                                        </div>
                                        {t.status < 2 && (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleCancelTournament(t.id)}
                                                    disabled={actionLoading === 'cancel'}
                                                    className="flex-1 bg-red-50 dark:bg-red-500/20 hover:bg-red-500 text-red-600 dark:text-red-400 hover:text-white py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50">
                                                    {actionLoading === 'cancel' ? 'Cancelling...' : 'Cancel'}
                                                </button>
                                                <button onClick={() => { setShowPointsModal(t); setPointsValues(Array(19).fill('0')); }}
                                                    disabled={actionLoading?.startsWith('finalize')}
                                                    className="flex-1 bg-green-50 dark:bg-green-500/20 hover:bg-green-500 text-green-600 dark:text-green-400 hover:text-white py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50">
                                                    Finalize & Pay
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>

            {/* Finalize & Pay Modal */}
            {showPointsModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                Finalize & Pay Tournament #{showPointsModal.id}
                            </h3>
                            <button onClick={() => setShowPointsModal(null)}>
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <p className="text-gray-500 text-sm mb-4">
                            Enter scores for each AI startup. Prize: 50% → 1st, 30% → 2nd, rest stays in pool.
                        </p>
                        <div className="space-y-2 mb-6">
                            {startupNames.map((name, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="text-sm text-gray-700 dark:text-gray-300 w-36 shrink-0">{name}</span>
                                    <input type="number" min="0" value={pointsValues[i]}
                                        onChange={(e) => {
                                            const v = [...pointsValues];
                                            v[i] = e.target.value;
                                            setPointsValues(v);
                                        }}
                                        className="flex-1 bg-gray-50 dark:bg-black border border-gray-200 dark:border-[#333] rounded-lg px-3 py-1.5 text-gray-900 dark:text-white font-mono text-sm" />
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowPointsModal(null)}
                                className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 font-bold">
                                Cancel
                            </button>
                            <button onClick={handleFinalizeWithPoints}
                                disabled={actionLoading === 'finalize-points'}
                                className="flex-1 py-3 rounded-xl bg-yc-aleo hover:bg-orange-600 text-white font-bold transition-all disabled:opacity-50">
                                {actionLoading === 'finalize-points' ? 'Finalizing...' : 'Finalize & Pay (50/30/rest)'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AdminPanel;
