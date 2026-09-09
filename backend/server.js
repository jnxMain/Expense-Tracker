const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dns = require('dns');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const Expense = require('./models/Expense');
const User = require('./models/User');
const Profile = require('./models/Profile');
const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'development-only-change-this-secret';

app.use(cors());
app.use(express.json());
mongoose.connection.on('connected', () => console.log('✅ Mongoose connected to DB Cluster'));
mongoose.connection.on('error', (err) => console.error('❌ Mongoose connection error:', err.message));
mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log('MongoDB Connected Successfully'))
    .catch(err => console.error('MongoDB Connection Error:', err.message));

const createToken = (user) => jwt.sign({ id: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email });

const requireAuth = (req, res, next) => {
    const token = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    try {
        req.userId = jwt.verify(token, JWT_SECRET).id;
        next();
    } catch {
        return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
};

app.post('/api/auth/signup', async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');
        if (!name || !email || password.length < 8) return res.status(400).json({ error: 'Name, email, and a password of at least 8 characters are required' });
        if (await User.findOne({ email })) return res.status(409).json({ error: 'An account with this email already exists' });
        const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
        const profile = await Profile.create({ user: user._id });
        res.status(201).json({ token: createToken(user), user: publicUser(user), profile });
    } catch (err) {
        res.status(500).json({ error: 'Unable to create account' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password' });
        const profile = await Profile.findOneAndUpdate({ user: user._id }, { $setOnInsert: { user: user._id } }, { new: true, upsert: true });
        res.json({ token: createToken(user), user: publicUser(user), profile });
    } catch (err) {
        res.status(500).json({ error: 'Unable to log in' });
    }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) return res.status(401).json({ error: 'Account not found' });
    res.json({ user: publicUser(user), profile: await Profile.findOne({ user: user._id }) });
});

app.get('/api/profile', requireAuth, async (req, res) => {
    res.json(await Profile.findOne({ user: req.userId }));
});

app.put('/api/profile', requireAuth, async (req, res) => {
    const updates = {};
    if (req.body.budgets) {
        if (Number.isFinite(Number(req.body.budgets.monthly))) updates['budgets.monthly'] = Number(req.body.budgets.monthly);
        if (Number.isFinite(Number(req.body.budgets.annual))) updates['budgets.annual'] = Number(req.body.budgets.annual);
    }
    if (req.body.savings) {
        if (Number.isFinite(Number(req.body.savings.current))) updates['savings.current'] = Number(req.body.savings.current);
        if (Number.isFinite(Number(req.body.savings.target))) updates['savings.target'] = Number(req.body.savings.target);
    }
    if (req.body.income && Number.isFinite(Number(req.body.income.current))) updates['income.current'] = Number(req.body.income.current);
    if (typeof req.body.notes === 'string') updates.notes = req.body.notes.slice(0, 5000);
    const profile = await Profile.findOneAndUpdate({ user: req.userId }, { $set: updates, $setOnInsert: { user: req.userId } }, { new: true, upsert: true });
    res.json(profile);
});

app.get('/api/expenses', requireAuth, async (req, res) => {
    try { res.json(await Expense.find({ user: req.userId }).sort({ createdAt: -1 })); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/expenses', requireAuth, async (req, res) => {
    try { res.json(await Expense.create({ ...req.body, user: req.userId })); }
    catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/expenses/:id', requireAuth, async (req, res) => {
    try {
        const updated = await Expense.findOneAndUpdate(
            { _id: req.params.id, user: req.userId },
            { $set: req.body },
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ error: 'Transaction not found' });
        res.json(updated);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/expenses/:id', requireAuth, async (req, res) => {
    try {
        const result = await Expense.deleteOne({ _id: req.params.id, user: req.userId });
        if (!result.deletedCount) return res.status(404).json({ error: 'Transaction not found' });
        res.json({ message: 'Entry deleted successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
