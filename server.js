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

if (!MONGO_URI) {
    console.error("❌ MONGO_URI পাওয়া যায়নি! Environment Variable চেক করুন।");
    process.exit(1);
}

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Atlas এর সাথে সংযোগ সফল!"))
    .catch(err => {
        console.error("❌ MongoDB কানেকশন এরর:", err);
        process.exit(1);
    });

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
    cheated: Boolean,
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
        let s = await Setting.findOne();
        if (!s) {
            s = await Setting.create({ subject: "সাধারণ পরীক্ষা", notice: "" });
        }
        res.json(s);
    } catch (err) {
        res.status(500).json({ error: "Settings load error" });
    }
});

// ২. অ্যাডমিন সেটিংস সেভ
app.post('/api/admin/save-settings', async (req, res) => {
    try {
        await Setting.findOneAndUpdate(
            {},
            { subject: req.body.subject, notice: req.body.notice },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Save failed" });
    }
});

// ৩. সব প্রশ্ন
app.get('/api/admin/questions', async (req, res) => {
    try {
        const qs = await Question.find().sort({ id: -1 });
        res.json(qs);
    } catch (err) {
        res.status(500).json({ error: "Question load error" });
    }
});

// ৪. প্রশ্ন সেভ/আপডেট
app.post('/api/admin/save', async (req, res) => {
    try {
        const { id, question, options, answer } = req.body;

        if (id) {
            await Question.findOneAndUpdate(
                { id: id },
                { question, options, answer }
            );
        } else {
            await Question.create({
                id: Date.now(),
                question,
                options,
                answer
            });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Save error" });
    }
});

// ৫. প্রশ্ন ডিলিট
app.delete('/api/admin/delete/:id', async (req, res) => {
    try {
        await Question.deleteOne({ id: req.params.id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Delete error" });
    }
});

// ৬. সব প্রশ্ন ডিলিট
app.delete('/api/admin/delete-all-questions', async (req, res) => {
    try {
        await Question.deleteMany({});
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Delete all error" });
    }
});

// ৭. পরীক্ষা সাবমিট
app.post('/api/submit-exam', async (req, res) => {
    try {
        const questions = await Question.find().sort({ id: 1 });
        const settings = await Setting.findOne();

        let score = 0;
        const { name, answers, cheated, duration } = req.body;

        if (!cheated) {
            questions.forEach((q, i) => {
                if (
                    answers[i] &&
                    String(q.answer).trim() === String(answers[i]).trim()
                ) {
                    score += 1;
                }
            });
        }

        await Result.create({
            name,
            subject: settings?.subject || "সাধারণ পরীক্ষা",
            score: cheated ? 0 : score,
            cheated,
            duration,
            date: new Date().toLocaleDateString('bn-BD'),
            time: new Date().toLocaleTimeString('bn-BD')
        });

        res.json({ success: true, score, cheated });

    } catch (err) {
        res.status(500).json({ error: "Submit error" });
    }
});

// ৮. রিপোর্ট
app.get('/api/admin/reports', async (req, res) => {
    try {
        const rs = await Result.find().sort({ _id: -1 });
        res.json(rs);
    } catch (err) {
        res.status(500).json({ error: "Report load error" });
    }
});

// ৯. রিপোর্ট রিসেট
app.delete('/api/admin/reset-reports', async (req, res) => {
    try {
        await Result.deleteMany({});
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Reset error" });
    }
});

// ১০. লিডারবোর্ড
app.get('/api/leaderboard', async (req, res) => {
    try {
        const leaderboard = await Result.find({ cheated: false })
            .sort({ score: -1 })
            .limit(10)
            .select('name score -_id');

        res.json(leaderboard);
    } catch (err) {
        res.status(500).json({ error: "Leaderboard error" });
    }
});

// ================= Server Start =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Server running on port " + PORT);
});