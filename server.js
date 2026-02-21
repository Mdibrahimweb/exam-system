const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ================= MongoDB Connection =================
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Atlas connected!"))
    .catch(err => console.error("❌ Connection error:", err));

// ================= Database Schemas =================
const Question = mongoose.model('Question', new mongoose.Schema({
    id: Number,
    question: String,
    options: [String],
    answer: String
}));

const Result = mongoose.model('Result', new mongoose.Schema({
    name: String,
    subject: String,
    score: Number,
    cheated: { type: Boolean, default: false },
    duration: Number,
    date: String,
    time: String
}));

const Setting = mongoose.model('Setting', new mongoose.Schema({
    subject: { type: String, default: "সাধারণ পরীক্ষা" },
    notice: { type: String, default: "" }
}));

// ================= API Routes =================

// ১. সেটিংস পাওয়া
app.get('/api/settings', async (req, res) => {
    try {
        let s = await Setting.findOne() || await Setting.create({ subject: "সাধারণ পরীক্ষা", notice: "" });
        res.json(s);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ২. সব প্রশ্ন লোড
app.get('/api/admin/questions', async (req, res) => {
    try {
        const qs = await Question.find().sort({ id: 1 });
        res.json(qs);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ৩. পরীক্ষা সাবমিট
app.post('/api/submit-exam', async (req, res) => {
    try {
        const questions = await Question.find().sort({ id: 1 });
        const settings = await Setting.findOne();
        let score = 0;
        const { name, answers, cheated, duration } = req.body;

        if (!cheated) {
            questions.forEach((q, i) => {
                if (answers[i] && String(q.answer).trim() === String(answers[i]).trim()) {
                    score += 1;
                }
            });
        }

        const newResult = await Result.create({
            name,
            subject: settings ? settings.subject : "সাধারণ পরীক্ষা",
            score: cheated ? 0 : score,
            cheated,
            duration,
            date: new Date().toLocaleDateString('bn-BD'),
            time: new Date().toLocaleTimeString('bn-BD')
        });

        res.json({ success: true, score: newResult.score, cheated });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ৪. লিডারবোর্ড (সবচেয়ে গুরুত্বপূর্ণ অংশ)
app.get('/api/leaderboard', async (req, res) => {
    try {
        // যারা চিটিং করেনি তাদের স্কোর অনুযায়ী সর্ট করা হয়েছে
        const leaderboard = await Result.find({ cheated: false })
            .sort({ score: -1, _id: 1 }) 
            .limit(10)
            .select('name score -_id');
        res.json(leaderboard);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ৫. অ্যাডমিন প্রশ্ন সেভ
app.post('/api/admin/save', async (req, res) => {
    const { id, question, options, answer } = req.body;
    if (id) {
        await Question.findOneAndUpdate({ id }, { question, options, answer });
    } else {
        await Question.create({ id: Date.now(), question, options, answer });
    }
    res.json({ success: true });
});

// ৬. অ্যাডমিন সেটিংস আপডেট
app.post('/api/admin/save-settings', async (req, res) => {
    await Setting.findOneAndUpdate({}, { subject: req.body.subject, notice: req.body.notice }, { upsert: true });
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));