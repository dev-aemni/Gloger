require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');

const app = express();
// Dynamic port binding required by Render
const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.client_id;

const googleClient = new OAuth2Client(CLIENT_ID);

app.use(cors());
app.use(express.json());

const userLimits = new Map();

// Root route
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Gloger Backend Service Running' });
});

// Expose public OAuth Client ID to frontend
app.get('/api/config', (req, res) => {
  res.json({ clientId: process.env.client_id });
});


// Render & UptimeRobot Health Check Endpoint
app.get('/hc', (req, res) => {
  res.status(200).send('OK');
});

// Google Auth route
app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: 'Missing token' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const userId = payload.sub;
    const email = payload.email;

    if (!userLimits.has(userId)) {
      userLimits.set(userId, { remainingTokens: 100000 });
    }

    const userStats = userLimits.get(userId);

    return res.json({
      message: 'Auth successful',
      user: {
        id: userId,
        email: email,
        name: payload.name,
      },
      tokensRemaining: userStats.remainingTokens,
    });
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({ message: 'Invalid or expired Google Token' });
  }
});

app.listen(PORT, () => {
  console.log(`Gloger server listening on port ${PORT}`);
});
