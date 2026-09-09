const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    budgets: { monthly: { type: Number, default: 15000 }, annual: { type: Number, default: 180000 } },
    savings: { current: { type: Number, default: 0 }, target: { type: Number, default: 0 } },
    income: { current: { type: Number, default: 0 } },
    notes: { type: String, default: '', maxlength: 5000 }
}, { timestamps: true });

module.exports = mongoose.model('Profile', ProfileSchema);