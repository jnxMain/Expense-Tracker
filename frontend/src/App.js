import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import './App.css';

const localApiBase = `http://${window.location.hostname}:5000/api`;
const renderApiBase = 'https://expense-tracker-backend-1-zs7r.onrender.com/api';
const API_BASE_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? renderApiBase : localApiBase);
const API_URL = `${API_BASE_URL}/expenses`;
const AUTH_URL = `${API_BASE_URL}/auth`;
const PROFILE_URL = `${API_BASE_URL}/profile`;
const CURRENCY = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const BRAND_NAME = 'JET';
const categories = ['Food & Dining', 'Housing & Utilities', 'Transportation', 'Subscriptions', 'Health', 'Allowance', 'Work', 'Personal', 'Other'];

const formatCurrency = (value) => CURRENCY.format(value || 0);
const currentMonth = new Date().toISOString().slice(0, 7);
const currentYear = new Date().getFullYear().toString();

function App() {
  const [entries, setEntries] = useState([]);
  const [budgets, setBudgets] = useState({ monthly: 15000, annual: 180000 });
  const [budgetForm, setBudgetForm] = useState({ monthly: '', annual: '' });
  const [savings, setSavings] = useState({ current: 0, target: 0 });
  const [savingsForm, setSavingsForm] = useState({ current: '', target: '' });
  const [notesForm, setNotesForm] = useState('');
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('jft-session')) || null; } catch { return null; }
  });
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(Boolean(session));
  const [period, setPeriod] = useState('month');
  const [activeView, setActiveView] = useState('overview');
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [dateSort, setDateSort] = useState('newest');
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const holdTimer = useRef(null);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'Food & Dining',
    type: 'expense',
    date: new Date().toISOString().split('T')[0]
  });
  const applyProfile = (profile) => {
    if (!profile) return;
    setBudgets(profile.budgets || { monthly: 15000, annual: 180000 });
    setSavings(profile.savings || { current: 0, target: 0 });
    setNotesForm(profile.notes || '');
  };

  const fetchEntries = async (token = session?.token) => {
    try {
      const response = await axios.get(API_URL, { headers: { Authorization: `Bearer ${token}` } });
      setEntries(response.data);
    } catch (error) {
      console.error('Error fetching data from MongoDB:', error);
    }
  };

  const logout = () => {
    localStorage.removeItem('jft-session');
    setSession(null);
    setEntries([]);
  };

  useEffect(() => {
    if (!session?.token) {
      setAuthLoading(false);
      return;
    }
    const restoreSession = async () => {
      try {
        const response = await axios.get(`${AUTH_URL}/me`, { headers: { Authorization: `Bearer ${session.token}` } });
        const profile = response.data.profile;
        setBudgets(profile?.budgets || { monthly: 15000, annual: 180000 });
        setSavings(profile?.savings || { current: 0, target: 0 });
        setNotesForm(profile?.notes || '');
        const entriesResponse = await axios.get(API_URL, { headers: { Authorization: `Bearer ${session.token}` } });
        setEntries(entriesResponse.data);
      } catch {
        localStorage.removeItem('jft-session');
        setSession(null);
        setEntries([]);
      } finally {
        setAuthLoading(false);
      }
    };
    restoreSession();
  }, [session?.token]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const response = await axios.post(`${AUTH_URL}/${authMode}`, authForm);
      const nextSession = { token: response.data.token, user: response.data.user };
      localStorage.setItem('jft-session', JSON.stringify(nextSession));
      setSession(nextSession);
      applyProfile(response.data.profile);
      await fetchEntries(response.data.token);
    } catch (error) {
      setAuthError(error.response?.data?.error || 'Unable to connect to the account service');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
      description: formData.description,
      amount: Number(formData.amount), // Ensure numerical parsing
      category: formData.category,
      type: formData.type || 'expense',
      date: formData.date
    };

    try {
      const request = editingId
        ? axios.put(`${API_URL}/${editingId}`, payload, { headers: { Authorization: `Bearer ${session.token}` } })
        : axios.post(API_URL, payload, { headers: { Authorization: `Bearer ${session.token}` } });
      const response = await request;
      setEntries(editingId ? entries.map(entry => entry._id === editingId ? response.data : entry) : [response.data, ...entries]);
      setEditingId(null);
      setFormData({ ...formData, description: '', amount: '' });
      setNotice(editingId ? 'Transaction updated' : 'Transaction saved');
    } catch (error) {
      console.error('Error saving entry:', error.response?.data || error);
    }
  };

  const startEditing = (entry) => {
    setEditingId(entry._id);
    setFormData({ description: entry.description, amount: entry.amount, category: entry.category, type: entry.type || 'expense', date: entry.date });
    document.querySelector('.transactions-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setFormData({ ...formData, description: '', amount: '' });
  };

  const updateProfile = async (data) => {
    const response = await axios.put(PROFILE_URL, data, { headers: { Authorization: `Bearer ${session.token}` } });
    applyProfile(response.data);
  };

  const saveBudgets = async (e) => {
    e.preventDefault();
    const nextBudgets = {
      monthly: Number(budgetForm.monthly) || budgets.monthly,
      annual: Number(budgetForm.annual) || budgets.annual
    };
    setBudgets(nextBudgets);
    await updateProfile({ budgets: nextBudgets });
    setBudgetForm({ monthly: '', annual: '' });
    setNotice('Budget targets updated');
  };

  const saveSavings = async (e) => {
    e.preventDefault();
    const nextSavings = {
      current: Number(savingsForm.current) || savings.current,
      target: Number(savingsForm.target) || savings.target
    };
    setSavings(nextSavings);
    await updateProfile({ savings: nextSavings });
    setSavingsForm({ current: '', target: '' });
    setNotice('Savings updated');
  };

  const saveNotes = async (e) => {
    e.preventDefault();
    await updateProfile({ notes: notesForm });
    setNotice('Notes updated');
  };

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = setTimeout(() => setNotice(''), 2400);
    return () => clearTimeout(timeout);
  }, [notice]);

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/${id}`, { headers: { Authorization: `Bearer ${session.token}` } });
      setEntries(entries.filter(entry => entry._id !== id));
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  const requestDelete = (entry) => setDeleteCandidate(entry);

  const sortedEntries = useMemo(() => [...entries].sort((first, second) => {
    const firstTime = new Date(first.date).getTime();
    const secondTime = new Date(second.date).getTime();
    return dateSort === 'newest' ? secondTime - firstTime : firstTime - secondTime;
  }), [entries, dateSort]);

  const toggleDateSort = () => {
    setDateSort(current => current === 'newest' ? 'oldest' : 'newest');
    setNotice(`Sorted by date: ${dateSort === 'newest' ? 'oldest first' : 'newest first'}`);
  };

  const startRowHold = () => {
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(toggleDateSort, 600);
  };

  const cancelRowHold = () => clearTimeout(holdTimer.current);

  // Calculations
  const periodEntries = useMemo(() => entries.filter((item) => (
    period === 'month' ? item.date?.startsWith(currentMonth) : item.date?.startsWith(currentYear)
  )), [entries, period]);
  const totalSpent = periodEntries.filter(item => item.type !== 'income').reduce((sum, item) => sum + Number(item.amount), 0);
  const budget = period === 'month' ? budgets.monthly : budgets.annual;
  const remaining = budget - totalSpent;
  const progress = budget ? Math.min((totalSpent / budget) * 100, 100) : 0;
  const categoryTotals = categories.map((category) => ({
    category,
    amount: periodEntries.filter(item => item.category === category && item.type !== 'income').reduce((sum, item) => sum + Number(item.amount), 0)
  })).filter(item => item.amount > 0).sort((a, b) => b.amount - a.amount);
  const topCategory = categoryTotals[0];
  const savingsProgress = savings.target ? Math.min((savings.current / savings.target) * 100, 100) : 0;
  const categoryChart = categoryTotals.slice(0, 4).map((item, index, visibleCategories) => {
    const start = visibleCategories.slice(0, index).reduce((sum, category) => sum + (category.amount / totalSpent) * 100, 0);
    const end = start + (item.amount / totalSpent) * 100;
    const colors = ['#8568d8', '#2996c4', '#2fa98a', '#e5a84b'];
    return `${colors[index]} ${start}% ${end}%`;
  }).join(', ');

  if (authLoading) return <div className="auth-loading">Loading your private tracker...</div>;
  if (!session) return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand auth-brand"><img className="brand-logo" src="/jet-logo.jpg" alt="JET logo" /><span>JNX Expense Tracker</span></div>
        <p className="eyebrow">Sign in</p>
        <h1>{authMode === 'login' ? 'Welcome back.' : 'Start tracking.'}</h1>
        <p className="auth-subtitle">Keep your spending, budgets, and goals in one calm place.</p>
        <form className="auth-form" onSubmit={handleAuth}>
          {authMode === 'signup' && <label>Full name<input aria-label="Full name" type="text" value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} required /></label>}
          <label>Email address<input aria-label="Email address" type="email" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} required /></label>
          <label>Password<div className="password-field"><input aria-label="Password" type={passwordVisible ? 'text' : 'password'} minLength="8" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} required /><button className="password-toggle" type="button" onClick={() => setPasswordVisible(current => !current)} aria-label={passwordVisible ? 'Hide password' : 'Show password'}>{passwordVisible ? 'Hide' : 'Show'}</button></div><small>Use at least 8 characters.</small></label>
          {authError && <p className="auth-error" role="alert">{authError}</p>}
          <button className="primary-button auth-button" type="submit">{authMode === 'login' ? 'Log in' : 'Create account'} <span>→</span></button>
        </form>
        <button className="auth-switch" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); setPasswordVisible(false); }}>{authMode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in'}</button>
      </section>
      <aside className="auth-aside"><span className="auth-aside-mark">{BRAND_NAME}</span><h2>Simple money habits.</h2><p>Track what matters without the noise.</p></aside>
    </main>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><img className="brand-logo" src="/jet-logo.jpg" alt="JET logo" /><span>JNX Expense Tracker</span></div>
        <p className="sidebar-caption">Money, simplified.</p>
        <nav className="nav-list" aria-label="Main navigation">
          <button className={activeView === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('overview')}>◈ <span>Overview</span></button>
          <button className={activeView === 'transactions' ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveView('transactions'); setShowAllTransactions(true); }}>↗ <span>Activity</span></button>
          <button className={activeView === 'budgets' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('budgets')}>▣ <span>Budget</span></button>
        </nav>
        <div className="sidebar-footer"><span className="status-dot" /> Live</div>
      </aside>

      <main className="main-content">
        <header className="page-header"><div><p className="eyebrow">{currentYear}</p><h1>Hi, {session.user.name}!</h1><p className="subtitle mobile-date">▣ {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p><p className="subtitle desktop-subtitle">Your month at a glance.</p></div><div className="header-actions"><div className="date-chip">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div><button className="logout-button" onClick={logout}><span aria-hidden="true">↪</span> Log out</button></div></header>
        {notice && <div className="toast" role="status">✓ {notice}</div>}

        <div className="period-switcher"><span>View</span><button className={period === 'month' ? 'selected' : ''} onClick={() => setPeriod('month')}>Month</button><button className={period === 'year' ? 'selected' : ''} onClick={() => setPeriod('year')}>Year</button></div>

        <section className="metric-grid">
          <div className="metric-card accent"><div className="metric-label">{period === 'month' ? 'Monthly' : 'Annual'} Budget: <span className="settings-symbol">⚙</span></div><div className="metric-value">{formatCurrency(budget)}</div><div className="budget-card-detail"><div className="budget-donut" style={{ '--progress': `${progress}%` }}><strong>{Math.round(progress)}%</strong></div><div><strong>Targets</strong><div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div><div className="metric-foot"><span>{formatCurrency(Math.max(remaining, 0))} left</span><span>{Math.round(progress)}% used</span></div></div></div></div>
          <div className="metric-card"><div className="metric-label">Spent <span className="pink-icon">↓</span></div><div className="metric-value">{formatCurrency(totalSpent)}</div><div className="metric-foot muted">{periodEntries.length} entries</div></div>
        </section>

        <div className="content-grid">
          <section className="panel budget-panel"><div className="panel-heading"><div><p className="eyebrow">BUDGET</p><h2>Targets</h2></div><span className="panel-symbol">◎</span></div><form onSubmit={saveBudgets} className="budget-form"><label>Monthly<input type="number" min="0" step="0.01" placeholder={budgets.monthly} value={budgetForm.monthly} onChange={e => setBudgetForm({ ...budgetForm, monthly: e.target.value })} /></label><label>Annual<input type="number" min="0" step="0.01" placeholder={budgets.annual} value={budgetForm.annual} onChange={e => setBudgetForm({ ...budgetForm, annual: e.target.value })} /></label><button className="primary-button" type="submit">Save <span>→</span></button></form></section>
          <section className="panel analysis-panel"><div className="panel-heading"><div><p className="eyebrow">SPEND</p><h2>Spending Breakdown</h2></div><button className="text-button" type="button" onClick={() => { setActiveView('transactions'); setShowAllTransactions(true); }}>View Details</button></div>{categoryTotals.length ? <><div className="mobile-chart-row"><div className="spending-donut" style={{ background: `conic-gradient(${categoryChart || '#dbe3e2 0 100%'})` }} /><div className="chart-legend">{categoryTotals.slice(0, 3).map((item, index) => <div key={item.category}><i className={`legend-color legend-${index}`} /><span>{item.category}:<br /><strong>{formatCurrency(item.amount)}</strong></span></div>)}</div></div><div className="category-list">{categoryTotals.map(item => <div className="category-row" key={item.category}><div className="category-meta"><span>{item.category}</span><strong>{formatCurrency(item.amount)}</strong></div><div className="category-track"><div style={{ width: `${(item.amount / totalSpent) * 100}%` }} /></div></div>)}</div></> : <div className="empty-state">Add a transaction to see spending.</div>}<p className="analysis-note">{topCategory ? <><strong>{topCategory.category}</strong> is the biggest spend.</> : 'Your breakdown will show here.'}</p></section>
        </div>

        <div className="content-grid personal-tools-grid">
          <section className="panel savings-panel"><div className="panel-heading"><div><p className="eyebrow">GOAL</p><h2>Savings</h2></div><span className="panel-symbol">＋</span></div><div className="savings-summary"><strong>{formatCurrency(savings.current)}</strong><span>of {formatCurrency(savings.target)}</span></div><div className="progress-track savings-track"><div className="progress-fill" style={{ width: `${savingsProgress}%` }} /></div><form onSubmit={saveSavings} className="budget-form savings-form"><label>Saved<input aria-label="Saved so far" type="number" min="0" step="0.01" placeholder={savings.current || '0'} value={savingsForm.current} onChange={e => setSavingsForm({ ...savingsForm, current: e.target.value })} /></label><label>Goal<input aria-label="Savings goal" type="number" min="0" step="0.01" placeholder={savings.target || '0'} value={savingsForm.target} onChange={e => setSavingsForm({ ...savingsForm, target: e.target.value })} /></label><button className="primary-button" type="submit">Update <span>→</span></button></form></section>
          <section className="panel notes-panel"><div className="panel-heading"><div><p className="eyebrow">NOTES</p><h2>Quick notes</h2></div><span className="panel-symbol">✎</span></div><form onSubmit={saveNotes}><textarea aria-label="Finance notes" className="notes-input" placeholder="Reminders or goals..." value={notesForm} onChange={e => setNotesForm(e.target.value)} /><button className="primary-button notes-button" type="submit">Save <span>→</span></button></form></section>
        </div>

        <section className="panel transactions-panel"><div className="section-heading"><div><p className="eyebrow">ACTIVITY</p><h2>{showAllTransactions ? 'All Transactions' : 'Recent'}</h2></div><div className="activity-actions"><button className="sort-button" type="button" onClick={toggleDateSort}>Date: {dateSort}</button><button className="text-button" type="button" onClick={() => setShowAllTransactions(current => !current)}>{showAllTransactions ? 'View less ↑' : 'View all →'}</button></div></div><form onSubmit={handleSubmit} className="entry-form"><input aria-label="Description" type="text" placeholder="What was it?" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required /><input aria-label="Amount" type="number" min="0" step="0.01" placeholder="Amount" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required /><select aria-label="Category" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>{categories.map(category => <option key={category}>{category}</option>)}</select><input aria-label="Date" type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required /><button className="primary-button" type="submit">{editingId ? (formData.type === 'income' ? 'Update Income' : 'Update Expense') : '+ Add'}</button>{editingId && <button className="secondary-button" type="button" onClick={cancelEditing}>Cancel</button>}</form><div className="table-wrap"><table><thead><tr><th>DATE</th><th>DESCRIPTION</th><th>CATEGORY</th><th>AMOUNT</th><th>ACTIONS</th></tr></thead><tbody>{(showAllTransactions ? sortedEntries : sortedEntries.slice(0, 8)).map(item => <tr key={item._id} onMouseDown={startRowHold} onMouseUp={cancelRowHold} onMouseLeave={cancelRowHold} onTouchStart={startRowHold} onTouchEnd={cancelRowHold} onTouchCancel={cancelRowHold}><td>{item.date}</td><td className="description-cell">{item.description}</td><td><span className="category-pill">{item.category}</span></td><td className={item.type === 'income' ? 'income-text' : 'expense-text'}>{item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}</td><td className="row-actions"><button className="edit-button" type="button" onClick={() => startEditing(item)} aria-label={`Edit ${item.description}`}>Edit</button><button className="delete-button" type="button" onClick={() => requestDelete(item)} aria-label={`Delete ${item.description}`}>×</button></td></tr>)}</tbody></table>{!entries.length && <div className="empty-state">No entries yet.</div>}</div></section>

        {deleteCandidate && <div className="confirm-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDeleteCandidate(null); }}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title"><p className="eyebrow">CONFIRM ACTION</p><h2 id="delete-title">Delete this transaction?</h2><p><strong>{deleteCandidate.description}</strong> will be permanently removed.</p><div className="confirm-actions"><button className="secondary-button" type="button" onClick={() => setDeleteCandidate(null)}>Cancel</button><button className="danger-button" type="button" onClick={() => { handleDelete(deleteCandidate._id); setDeleteCandidate(null); }}>Delete</button></div></section></div>}
      </main>
    </div>
  );
}

export default App;