import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv'
import User from './models/users.js';
import Post from './models/posts.js';
import crypto from 'crypto';
dotenv.config();
const app = express();
app.use(express.json());
await mongoose.connect(process.env.DATABASE_URL);

app.post('/users/register', async (req, res) => {
    const { userName, email, password } = req.body;

    if (!userName || !email || !password) {
        return res.status(400).json({ error: 'userName, email, and password are required.' });
    }
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            userName,
            email,
            password: hashedPassword
        });
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.post('/users/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }
        const randomString = crypto.randomBytes(16).toString('hex');
        const apiKey = `mern-${user._id}-${user.email}-${randomString}`;
        res.status(200).json({ apiKey });

    } catch (err) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

const authenticateApiKey = async (apiKey) => {
    const apiKeyParts = apiKey.split('-');
    if (apiKeyParts.length !== 4) {
        return null;
    }

    const [prefix, userId, email, randomString] = apiKeyParts;

    if (prefix !== 'mern') {
        return null;
    }

    try {
        const user = await User.findOne({ _id: userId, email });
        if (!user) {
            return null;
        }
        return user;
    } catch (err) {
        return null;
    }
};

app.post('/posts', async (req, res) => {
    const { content } = req.body;
    const apiKey = req.query.apiKey;

    if (!apiKey) {
        return res.status(401).json({ error: 'apiKey is required for authentication.' });
    }
    const user = await authenticateApiKey(apiKey);
    if (!user) {
        return res.status(403).json({ error: 'Invalid or unauthorized apiKey.' });
    }
    if (!content) {
        return res.status(400).json({ error: 'Content is required.' });
    }
    try {
        const newPost = new Post({
            userId: user._id,
            content,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
        await newPost.save();

        res.status(201).json({ message: 'Post created successfully.', post: newPost });

    } catch (err) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});


const PORT = process.env.PORT || 2000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
