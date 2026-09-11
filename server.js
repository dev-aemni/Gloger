require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.client_id;
const MONGO_URI = process.env.mongodb;

const googleClient = new OAuth2Client(CLIENT_ID);

app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// User Database Schema
const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  name: String,
  tokensRemaining: { type: Number, default: 1000000 }, // 1 Million starting CLI tokens
  apiKey: { type: String, unique: true },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Routes
app.get('/hc', (req, res) => res.status(200).send('OK'));

app.get('/api/config', (req, res) => {
  res.json({ clientId: CLIENT_ID });
});

// Google Authentication Route (Creates/Updates User in MongoDB)
app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: 'Missing token' });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name;

    // Find user or create if new
    let user = await User.findOne({ googleId });
    if (!user) {
      const apiKey = 'glg_' + crypto.randomBytes(24).toString('hex');
      user = new User({ googleId, email, name, apiKey });
      await user.save();
    }

    return res.json({
      message: 'Auth successful',
      user: {
        id: user.googleId,
        email: user.email,
        name: user.name,
        apiKey: user.apiKey
      },
      tokensRemaining: user.tokensRemaining
    });
  } catch (error) {
    console.error('Auth error:', error.message);
    return res.status(401).json({ message: 'Invalid Google Token' });
  }
});

// CLI Route: Verify Live Token Balance
app.get('/api/cli/balance', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ message: 'Missing API Key' });

  const user = await User.findOne({ apiKey });
  if (!user) return res.status(401).json({ message: 'Invalid API Key' });

  res.json({
    email: user.email,
    tokensRemaining: user.tokensRemaining
  });
});

// CLI Route: Deduct used tokens from Code Agents
app.post('/api/cli/consume', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const { tokensUsed } = req.body;

  if (!apiKey) return res.status(401).json({ message: 'Missing API Key' });
  if (!tokensUsed || typeof tokensUsed !== 'number') return res.status(400).json({ message: 'Invalid token usage amount' });

  const user = await User.findOne({ apiKey });
  if (!user) return res.status(401).json({ message: 'Invalid API Key' });

  user.tokensRemaining = Math.max(0, user.tokensRemaining - tokensUsed);
  user.updatedAt = Date.now();
  await user.save();

  res.json({
    success: true,
    tokensRemaining: user.tokensRemaining
  });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
