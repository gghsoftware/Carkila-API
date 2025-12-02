// app.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// -------- ENV & CLIENT SETUP --------
if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY is not set in your .env file.');
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const PORT = process.env.PORT || 4000;
// Support both MONGODB_URI and MONGO_URI just in case
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'fixif-dev-secret-change-me';

console.log('DEBUG: MONGODB_URI present?', !!MONGODB_URI);

// -------- EXPRESS APP --------
const app = express();
app.use(cors());
app.use(express.json());

// If you ever want to serve static files (HTML) from a /public folder:
// const path = require('path');
// app.use(express.static(path.join(__dirname, 'public')));

// -------- MONGODB (ATLAS) CONNECTION --------
if (!MONGODB_URI) {
  console.warn(
    '⚠️  MONGODB_URI/MONGO_URI is not set in .env. Skipping Mongo connection, auth will NOT work.'
  );
} else {
  mongoose
    .connect(MONGODB_URI, {
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    })
    .then(() => console.log('✅ MongoDB connected'))
    .catch((err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });
}

// -------- USER MODEL --------
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

// -------- JWT HELPER: GENERATE TOKEN --------
function generateToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// -------- AUTH MIDDLEWARE (PROTECT ROUTES) --------
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email }
    next();
  } catch (err) {
    console.error('❌ JWT verify error:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// ===========================
//  AI SYSTEM INSTRUCTIONS
// ===========================
const baseInstructions = `
You are an expert automotive diagnostic AI that assists a repair shop service advisor.

Your job:
- Turn raw customer and vehicle data into a clear, structured PRELIMINARY diagnosis.
- Write in clear, non-scary language but do NOT hide serious safety issues.
- Assume this is for a workshop in the Philippines.

INPUT:
You will receive a single JSON object:
{
  "customer": {...},
  "vehicle": {...},
  "complaint": {...},
  "preferences": {...}
}

OUTPUT:
Return ONLY valid JSON (no markdown, no extra text) in this exact structure:

{
  "summary": "Short summary for the repair order in 1-3 sentences.",
  "probableCauses": [
    {
      "title": "Short cause name",
      "likelihood": "high | medium | low",
      "explanation": "1-3 sentence explanation in layman's terms"
    }
  ],
  "immediateChecks": [
    "Short checklist item for quick checks or safe DIY tips"
  ],
  "recommendedActions": [
    "Recommended workshop-level diagnostic or repair actions, in order"
  ],
  "safetyNotes": [
    "Specific safety warnings or notes if the car may be unsafe to drive"
  ],
  "partsNeeded": [
    {
      "partName": "Likely part or assembly (e.g. 'front brake pads', 'radiator cap')",
      "oemOrAftermarket": "OEM | aftermarket ok | unspecified",
      "urgency": "required before releasing vehicle | recommended soon | optional",
      "notes": "Important notes (e.g. 'replace in pairs', 'requires fluid flush', 'special tools needed')"
    }
  ]
}

Rules:
- Include 2–6 probableCauses when possible.
- Include 3–8 recommendedActions when possible.
- If uncertain about exact parts, list generic components and clearly say that final confirmation requires physical inspection.
- Respect any preferences.tone, preferences.detailLevel, and preferences.language if provided.
`;

// ===========================
//  HEALTH CHECK
// ===========================
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Vehicle AI Diagnosis API is running',
    model: MODEL,
  });
});

// ===========================
//  AUTH ROUTES
// ===========================

// REGISTER
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: 'Name, email, and password are required.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email is already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      passwordHash,
    });

    const token = generateToken(user);

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error('🔥 [AUTH ERROR] /api/auth/register', err);
    return res.status(500).json({ error: 'Failed to register user.' });
  }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(401)
        .json({ error: 'Invalid email or password.' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res
        .status(401)
        .json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user);

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error('🔥 [AUTH ERROR] /api/auth/login', err);
    return res.status(500).json({ error: 'Failed to log in.' });
  }
});

// CURRENT USER
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name email');
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error('🔥 [AUTH ERROR] /api/auth/me', err);
    return res.status(500).json({ error: 'Failed to load user.' });
  }
});

// LOGOUT (stateless)
app.post('/api/auth/logout', authMiddleware, (req, res) => {
  // With JWT we don't store sessions, so we just reply OK.
  // Frontend will remove the token from localStorage.
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// ===========================
//  MAIN AI ROUTE (PROTECTED)
// ===========================
app.post('/api/diagnose', authMiddleware, async (req, res) => {
  try {
    const { customer, vehicle, complaint, preferences } = req.body || {};

    // --- Minimal validation ---
    if (!complaint || !complaint.symptoms || !complaint.symptoms.trim()) {
      return res.status(400).json({
        error: 'Missing required field: complaint.symptoms',
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error:
          'Server is missing OPENAI_API_KEY. Please configure it on the backend.',
      });
    }

    const prefs = {
      tone:
        preferences?.tone ||
        'friendly, professional automotive service advisor',
      detailLevel: preferences?.detailLevel || 'normal',
      language: preferences?.language || 'English',
    };

    const inputPayload = {
      customer: {
        fullName: customer?.fullName || '',
        phonePrimary: customer?.phonePrimary || '',
        phoneAlternate: customer?.phoneAlternate || '',
        email: customer?.email || '',
        address: customer?.address || '',
        preferredContactMethod: customer?.preferredContactMethod || '',
      },
      vehicle: {
        year: vehicle?.year || '',
        make: vehicle?.make || '',
        model: vehicle?.model || '',
        vin: vehicle?.vin || '',
        plate: vehicle?.plate || '',
        mileage: vehicle?.mileage || '',
        engineOrTransmission: vehicle?.engineOrTransmission || '',
        color: vehicle?.color || '',
        dropOffDateTime: vehicle?.dropOffDateTime || '',
      },
      complaint: {
        symptoms: complaint?.symptoms || '',
        additionalNotes: complaint?.additionalNotes || '',
      },
      preferences: prefs,
      userId: req.user?.id || null,
    };

    // OPENAI CHAT COMPLETION
    const completion = await client.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: baseInstructions,
        },
        {
          role: 'user',
          content:
            'Here is the intake payload as JSON. ' +
            'Generate ONLY the diagnosis JSON object as specified in the instructions (no extra text).\n\n' +
            JSON.stringify(inputPayload, null, 2),
        },
      ],
    });

    const rawText =
      completion.choices?.[0]?.message?.content?.trim() || '';

    if (!rawText) {
      console.error(
        '❌ Empty completion from OpenAI:',
        JSON.stringify(completion, null, 2)
      );
      return res.status(500).json({
        error: 'AI returned an empty response.',
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('❌ JSON parse error:', parseErr);
      console.error('↪ Raw model output:', rawText);

      return res.status(200).json({
        customer: inputPayload.customer,
        vehicle: inputPayload.vehicle,
        complaint: inputPayload.complaint,
        ai: null,
        rawText,
        warning:
          'AI did not return valid JSON. Check rawText and/or tighten the instructions.',
      });
    }

    // Successful structured result
    return res.status(200).json({
      customer: inputPayload.customer,
      vehicle: inputPayload.vehicle,
      complaint: inputPayload.complaint,
      ai: parsed,
      meta: {
        model: MODEL,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('🔥 [AI ERROR] /api/diagnose');
    console.error('Status:', err.status || err.statusCode || 'n/a');
    console.error('Message:', err.message);

    let message = 'Internal server error while generating AI diagnosis';

    if (err.status === 401 || err.status === 403) {
      message =
        'OpenAI authentication failed. Check your OPENAI_API_KEY value on the server.';
    }

    return res.status(500).json({
      error: message,
      details: err.message,
    });
  }
});

// -------- START SERVER --------
app.listen(PORT, () => {
  console.log(`🚗 Vehicle AI Diagnosis API listening on port ${PORT}`);
});
