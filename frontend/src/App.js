import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:5000/api/expenses';
const AUTH_URL = 'http://localhost:5000/api/auth';
const PROFILE_URL = 'http://localhost:5000/api/profile';
const CURRENCY = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const categories = ['Food & Dining', 'Housing & Utilities', 'Transportation', 'Subscriptions', 'Health', 'Other'];

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
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(Boolean(session));
  const [period, setPeriod] = useState('month');
  const [activeView, setActiveView] = useState('overview');
  const [notice, setNotice] = useState('');
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
      const response = await axios.post(API_URL, payload, { headers: { Authorization: `Bearer ${session.token}` } });
      setEntries([response.data, ...entries]);
      setFormData({ ...formData, description: '', amount: '' });
      setNotice('Transaction saved');
    } catch (error) {
      console.error('Error saving entry:', error.response?.data || error);
    }
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

  // Calculations
  const periodEntries = useMemo(() => entries.filter((item) => (
    period === 'month' ? item.date?.startsWith(currentMonth) : item.date?.startsWith(currentYear)
  )), [entries, period]);
  const totalSpent = periodEntries.filter(item => item.type !== 'income').reduce((sum, item) => sum + Number(item.amount), 0);
  const totalIncome = periodEntries.filter(item => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0);
  const budget = period === 'month' ? budgets.monthly : budgets.annual;
  const remaining = budget - totalSpent;
  const progress = budget ? Math.min((totalSpent / budget) * 100, 100) : 0;
  const categoryTotals = categories.map((category) => ({
    category,
    amount: periodEntries.filter(item => item.category === category && item.type !== 'income').reduce((sum, item) => sum + Number(item.amount), 0)
  })).filter(item => item.amount > 0).sort((a, b) => b.amount - a.amount);
  const topCategory = categoryTotals[0];
  const savingsProgress = savings.target ? Math.min((savings.current / savings.target) * 100, 100) : 0;

  if (authLoading) return <div className="auth-loading">Loading your private tracker...</div>;
  if (!session) return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand auth-brand"><span className="brand-mark">JFT</span><span>JNX Finance Tracker</span></div>
        <p className="eyebrow">PRIVATE FINANCE, YOUR WAY</p>
        <h1>{authMode === 'login' ? 'Welcome back.' : 'Start your private tracker.'}</h1>
        <p className="auth-subtitle">Your expenses, budgets, savings, and notes stay separated in your account.</p>
        <form className="auth-form" onSubmit={handleAuth}>
          {authMode === 'signup' && <label>Full name<input aria-label="Full name" type="text" value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} required /></label>}
          <label>Email address<input aria-label="Email address" type="email" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} required /></label>
          <label>Password<input aria-label="Password" type="password" minLength="8" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} required /><small>Use at least 8 characters.</small></label>
          {authError && <p className="auth-error" role="alert">{authError}</p>}
          <button className="primary-button auth-button" type="submit">{authMode === 'login' ? 'Log in' : 'Create account'} <span>→</span></button>
        </form>
        <button className="auth-switch" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }}>{authMode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in'}</button>
      </section>
      <aside className="auth-aside"><span className="auth-aside-mark">JFT</span><h2>Your money should feel like yours.</h2><p>One calm place for the choices, goals, and details that make up your financial life.</p></aside>
    </main>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">JFT</span><span>JNX Finance Tracker</span></div>
        <p className="sidebar-caption">Your money, made visible.</p>
        <nav className="nav-list" aria-label="Main navigation">
          <button className={activeView === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('overview')}>◈ <span>Overview</span></button>
          <button className={activeView === 'transactions' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('transactions')}>↗ <span>Transactions</span></button>
          <button className={activeView === 'budgets' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('budgets')}>▣ <span>Budgets</span></button>
        </nav>
        <div className="sidebar-footer"><span className="status-dot" /> Connected to your tracker</div>
      </aside>

      <main className="main-content">
        <header className="page-header"><div><p className="eyebrow">PERSONAL FINANCE / {currentYear}</p><h1>Welcome, {session.user.name}.</h1><p className="subtitle">A clear view of where your money is going.</p></div><div className="header-actions"><div className="date-chip">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</div><button className="logout-button" onClick={logout}>Log out</button></div></header>
        {notice && <div className="toast" role="status">✓ {notice}</div>}

        <div className="period-switcher"><span>Showing</span><button className={period === 'month' ? 'selected' : ''} onClick={() => setPeriod('month')}>This month</button><button className={period === 'year' ? 'selected' : ''} onClick={() => setPeriod('year')}>This year</button></div>

        <section className="metric-grid">
          <div className="metric-card accent"><div className="metric-label">{period === 'month' ? 'Monthly' : 'Annual'} budget <span>↗</span></div><div className="metric-value">{formatCurrency(budget)}</div><div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div><div className="metric-foot"><span>{Math.round(progress)}% used</span><span>{formatCurrency(Math.max(remaining, 0))} left</span></div></div>
          <div className="metric-card"><div className="metric-label">Total spent <span className="pink-icon">↓</span></div><div className="metric-value">{formatCurrency(totalSpent)}</div><div className="metric-foot muted">Across {periodEntries.length} entries</div></div>
          <div className="metric-card"><div className="metric-label">Income recorded <span className="green-icon">↑</span></div><div className="metric-value">{formatCurrency(totalIncome)}</div><div className="metric-foot muted">This {period === 'month' ? 'month' : 'year'}</div></div>
        </section>

        <div className="content-grid">
          <section className="panel budget-panel"><div className="panel-heading"><div><p className="eyebrow">PLAN AHEAD</p><h2>Budget targets</h2></div><span className="panel-symbol">◎</span></div><form onSubmit={saveBudgets} className="budget-form"><label>Monthly budget<input type="number" min="0" step="0.01" placeholder={budgets.monthly} value={budgetForm.monthly} onChange={e => setBudgetForm({ ...budgetForm, monthly: e.target.value })} /></label><label>Annual budget<input type="number" min="0" step="0.01" placeholder={budgets.annual} value={budgetForm.annual} onChange={e => setBudgetForm({ ...budgetForm, annual: e.target.value })} /></label><button className="primary-button" type="submit">Save targets <span>→</span></button></form></section>
          <section className="panel analysis-panel"><div className="panel-heading"><div><p className="eyebrow">SPENDING ANALYSIS</p><h2>Where it goes</h2></div><span className="panel-symbol">◌</span></div>{categoryTotals.length ? <div className="category-list">{categoryTotals.map(item => <div className="category-row" key={item.category}><div className="category-meta"><span>{item.category}</span><strong>{formatCurrency(item.amount)}</strong></div><div className="category-track"><div style={{ width: `${(item.amount / totalSpent) * 100}%` }} /></div></div>)}</div> : <div className="empty-state">Add a transaction to see your spending patterns.</div>}<p className="analysis-note">{topCategory ? <><strong>{topCategory.category}</strong> is your largest spending category.</> : 'Your analysis will appear here.'}</p></section>
        </div>

        <div className="content-grid personal-tools-grid">
          <section className="panel savings-panel"><div className="panel-heading"><div><p className="eyebrow">BUILD YOUR BUFFER</p><h2>Savings</h2></div><span className="panel-symbol">＋</span></div><div className="savings-summary"><strong>{formatCurrency(savings.current)}</strong><span>of {formatCurrency(savings.target)} goal</span></div><div className="progress-track savings-track"><div className="progress-fill" style={{ width: `${savingsProgress}%` }} /></div><form onSubmit={saveSavings} className="budget-form savings-form"><label>Saved so far<input aria-label="Saved so far" type="number" min="0" step="0.01" placeholder={savings.current || '0'} value={savingsForm.current} onChange={e => setSavingsForm({ ...savingsForm, current: e.target.value })} /></label><label>Savings goal<input aria-label="Savings goal" type="number" min="0" step="0.01" placeholder={savings.target || '0'} value={savingsForm.target} onChange={e => setSavingsForm({ ...savingsForm, target: e.target.value })} /></label><button className="primary-button" type="submit">Update savings <span>→</span></button></form></section>
          <section className="panel notes-panel"><div className="panel-heading"><div><p className="eyebrow">PERSONAL SPACE</p><h2>Notes</h2></div><span className="panel-symbol">✎</span></div><form onSubmit={saveNotes}><textarea aria-label="Finance notes" className="notes-input" placeholder="Write a reminder, goal, or money thought..." value={notesForm} onChange={e => setNotesForm(e.target.value)} /><button className="primary-button notes-button" type="submit">Update notes <span>→</span></button></form></section>
        </div>

        <section className="panel transactions-panel"><div className="section-heading"><div><p className="eyebrow">ACTIVITY</p><h2>Recent transactions</h2></div><button className="text-button" onClick={() => setActiveView('transactions')}>View all →</button></div><form onSubmit={handleSubmit} className="entry-form"><input aria-label="Description" type="text" placeholder="What did you spend on?" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required /><input aria-label="Amount" type="number" min="0" step="0.01" placeholder="Amount" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required /><select aria-label="Category" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>{categories.map(category => <option key={category}>{category}</option>)}</select><input aria-label="Date" type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required /><button className="primary-button" type="submit">+ Add entry</button></form><div className="table-wrap"><table><thead><tr><th>DATE</th><th>DESCRIPTION</th><th>CATEGORY</th><th>AMOUNT</th><th /></tr></thead><tbody>{entries.slice(0, 8).map(item => <tr key={item._id}><td>{item.date}</td><td className="description-cell">{item.description}</td><td><span className="category-pill">{item.category}</span></td><td className={item.type === 'income' ? 'income-text' : 'expense-text'}>{item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}</td><td><button className="delete-button" onClick={() => handleDelete(item._id)} aria-label={`Delete ${item.description}`}>×</button></td></tr>)}</tbody></table>{!entries.length && <div className="empty-state">No transactions yet. Add your first entry above.</div>}</div></section>
      </main>
    </div>
  );
}

export default App;