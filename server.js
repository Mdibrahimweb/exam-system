const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- MongoDB Atlas Connection ---
const MONGO_URI = "mongodb+srv://icprinter20_db_user:Ibrahim92500@examsystem.ehvewzn.mongodb.net/examDB?retryWrites=true&w=majority&appName=examsystem"; 

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Atlas-এর সাথে সফলভাবে যুক্ত হয়েছে!"))
    .catch(err => console.error("❌ কানেকশনে সমস্যা:", err));

// --- Database Schemas ---
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
    cheated: Boolean,
    duration: Number,
    date: String,
    time: String
}));

const Setting = mongoose.model('Setting', new mongoose.Schema({
    subject: { type: String, default: "সাধারণ পরীক্ষা" },
    notice: { type: String, default: "" }
}));

// --- API Endpoints ---

// ১. সেটিংস পাওয়া (সাবজেক্ট ও নোটিশ)
app.get('/api/settings', async (req, res) => {
    let s = await Setting.findOne();
    if (!s) s = await Setting.create({ subject: "সাধারণ পরীক্ষা", notice: "" });
    res.json(s);
});

// ২. অ্যাডমিন সেটিংস সেভ করা
app.post('/api/admin/save-settings', async (req, res) => {
    await Setting.findOneAndUpdate({}, { subject: req.body.subject, notice: req.body.notice }, { upsert: true });
    res.json({ success: true });
});

// ৩. সব প্রশ্ন লোড করা
app.get('/api/admin/questions', async (req, res) => {
    const qs = await Question.find().sort({ id: -1 });
    res.json(qs);
});

// ৪. প্রশ্ন সেভ বা আপডেট
app.post('/api/admin/save', async (req, res) => {
    const { id, question, options, answer } = req.body;
    if (id) {
        await Question.findOneAndUpdate({ id: id }, { question, options, answer });
    } else {
        await Question.create({ id: Date.now(), question, options, answer });
    }
    res.json({ success: true });
});

// ৫. প্রশ্ন ডিলিট করা
app.delete('/api/admin/delete/:id', async (req, res) => {
    await Question.deleteOne({ id: req.params.id });
    res.json({ success: true });
});

// ৬. সব প্রশ্ন ডিলিট
app.delete('/api/admin/delete-all-questions', async (req, res) => {
    await Question.deleteMany({});
    res.json({ success: true });
});

// ৭. রেজাল্ট সাবমিট করা (ছাত্রদের জন্য)
app.post('/api/submit-exam', async (req, res) => {
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

    await Result.create({
        name,
        subject: settings.subject,
        score: cheated ? 0 : score,
        cheated,
        duration,
        date: new Date().toLocaleDateString('bn-BD'),
        time: new Date().toLocaleTimeString('bn-BD')
    });

    res.json({ success: true, score, cheated });
});

// ৮. সব রেজাল্ট রিপোর্ট দেখা
app.get('/api/admin/reports', async (req, res) => {
    const rs = await Result.find().sort({ _id: -1 });
    res.json(rs);
});

// ৯. রেজাল্ট লগ রিসেট করা
app.delete('/api/admin/reset-reports', async (req, res) => {
    await Result.deleteMany({});
    res.json({ success: true });
});

// ১০. লিডারবোর্ড
app.get('/api/leaderboard', async (req, res) => {
    const leaderboard = await Result.find({ cheated: false })
        .sort({ score: -1 })
        .limit(10)
        .select('name score -_id');
    res.json(leaderboard);
});

// --- Server Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 সার্ভার চালু হয়েছে: http://localhost:${PORT}`));