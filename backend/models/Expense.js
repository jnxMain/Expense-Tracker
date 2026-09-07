const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    type: { type: String, default: 'expense' },
    date: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Expense', ExpenseSchema);
