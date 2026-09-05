import express, { Request, Response } from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { db } from './src/db/store.js';
import {
  testNeonConnection,
  testDatabaseTables,
  inspectParkingSlots,
  inspectParkingTables,
  inspectParkingData
} from './src/db/neon.js';
import { getNeonSlots } from './src/db/neon.js';
import {
  ensurePaymentsTable,
  getNeonSlotById,
  markSlotOccupied,
  createNeonBooking,
  getNeonBookingById,
  createNeonPayment,
  activateNeonBooking,
  extendNeonBooking,
  cancelNeonBooking,
  getNeonUserBookings,
  completeExpiredNeonBookings
} from './src/db/neon.js';


dotenv.config();
console.log("DATABASE_URL loaded:", !!process.env.DATABASE_URL);

const app = express();
const PORT = 3000;

app.use(express.json());

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Initialize Gemini Client
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  } catch (err) {
    console.warn('Failed to initialize GoogleGenAI client:', err);
  }
}

// Intent Detection Keywords
const INTENT_KEYWORDS: Record<string, string[]> = {
  greeting: ['hi', 'hello', 'hey', 'good morning', 'good evening', 'start'],
  availability: ['vacant', 'available', 'free slot', 'empty', 'space', 'parking spot', 'any spot', 'spots', 'slot'],
  booking: ['book', 'reserve', 'reservation', 'park here'],
  extension: ['extend', 'more time', 'add hour', 'increase time'],
  rates: ['price', 'rate', 'cost', 'how much', 'charges', 'fee', 'pricing'],
  hours: ['open', 'timing', 'hours', 'close', 'schedule'],
  payment: ['pay', 'payment', 'upi', 'card', 'cash', 'fastag'],
  cancellation: ['cancel', 'refund'],
  support: ['help', 'contact', 'support', 'number', 'phone']
};

function detectIntent(message: string): string {
  const text = message.toLowerCase();
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return intent;
    }
  }
  return 'fallback';
}

function extractLocation(message: string): string | undefined {
  const text = message.toLowerCase();
  for (const loc of ['gate 1', 'gate 2', 'basement', 'north', 'south', 'central']) {
    if (text.includes(loc)) return loc;
  }
  return undefined;
}

function extractSlotId(message: string): string | undefined {
  const match = message.match(/\b([A-Za-z]\d)\b/);
  return match ? match[1].toUpperCase() : undefined;
}

// Helper template generator when Gemini API is offline or unconfigured
function generateTemplateReply(intent: string, data: any): string {
  if (intent === 'greeting') {
    return "Hi there! 👋 Welcome to ParkBy Smart Parking Assistant. I can help you find available spots, check prices, book a slot, or answer questions. How can I help you today?";
  }
  if (intent === 'availability') {
    const slots = data.slots || [];
    if (slots.length === 0) {
      return "Sorry, no vacant slots are available for that location right now. Please check back shortly.";
    }
    const lines = slots.map((s: any) => `• ${s.slot_number} at ${s.location_name || s.parking_name} (₹${s.price_per_hr}/hr - ${s.slot_type.toUpperCase()})`);
    return `Here are the currently available vacant slots:\n${lines.join('\n')}\n\nWould you like to book one? (e.g. "Book slot A2")`;
  }
  if (intent === 'booking') {
    const result = data.booking_result;
    if (result && result.success) {
      return `🎉 Success! Slot ${result.booking.slot_number} at ${result.booking.parking_name} has been booked for vehicle ${result.booking.vehicle_number}. Total amount: ₹${result.booking.total_amount}.`;
    }
    return `Sorry, I couldn't book that slot: ${result?.reason || 'slot is unavailable'}. Try another slot like A2, B1, or C1!`;
  }
  if (intent === 'extension') {
    const result = data.extension_result;
    if (result && result.success) {
      return `⏰ Extended! Booking for slot ${result.booking.slot_number} is now extended until ${new Date(result.booking.scheduled_end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Total: ₹${result.booking.total_amount}.`;
    }
    return `Could not extend booking: ${result?.reason || 'No active booking found'}.`;
  }
  if (['rates', 'hours', 'payment', 'cancellation', 'support'].includes(intent)) {
    return data.faq_answer || "I don't have that info handy — please visit our help center or contact support.";
  }
  return "I'm not sure I understood that completely. You can ask me about parking availability (e.g., 'vacant spots near Gate 1'), rates, or instant bookings!";
}

// Auth Endpoints
app.post('/api/auth/google', (req, res) => {
  const { email, name, avatarUrl } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, reason: 'Valid Gmail/Google email address is required' });
  }

  const result = db.googleAuthUser(email, name, avatarUrl);
  res.json({
    success: true,
    user: result.user,
    isNew: result.isNew,
    message: result.isNew
      ? `Welcome to ParkBy! Your account has been created and saved to the database with ₹500 welcome bonus.`
      : `Welcome back, ${result.user.name}!`
  });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Successfully signed out' });
});

app.get('/api/users', (req, res) => {
  res.json({ success: true, users: db.getUsers() });
});

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password, role, phone } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, reason: 'Name and email are required' });
  }
  const result = db.registerUser(name, email, password, role, phone);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, reason: 'Email is required' });
  }
  const result = db.loginUser(email, password);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Smart Parking Assistant Backend' });
});

app.get('/api/locations', (req, res) => {
  res.json(db.getLocations());
});

app.post('/api/locations', (req, res) => {
  const { name, address, city, total_slots, opening_time, closing_time } = req.body;
  if (!name || !address) {
    return res.status(400).json({ success: false, reason: 'Location name and address are required' });
  }
  const newLocation = db.addLocation({ name, address, city, total_slots: Number(total_slots) || 20, opening_time, closing_time });
  res.status(201).json({ success: true, location: newLocation });
});

app.get('/api/slots', async (req, res) => {
  try {
    const { location, type } = req.query;

    const slots = await getNeonSlots(
      location ? String(location) : undefined
    );

    const filteredSlots = type
      ? slots.filter(slot => slot.slot_type === String(type))
      : slots;

    res.json(filteredSlots);
  } catch (error) {
    console.error('❌ Failed to fetch slots from Neon:', error);
    res.status(500).json({
      success: false,
      reason: 'Failed to fetch parking slots'
    });
  }
});

app.post('/api/slots', (req, res) => {
  const { parking_id, slot_number, slot_type, price_per_hr } = req.body;
  if (!parking_id || !slot_number) {
    return res.status(400).json({ success: false, reason: 'Parking location and slot number are required' });
  }
  const newSlot = db.addSlot({
    parking_id,
    slot_number,
    slot_type,
    price_per_hr: Number(price_per_hr) || 20
  });
  res.status(201).json({ success: true, slot: newSlot });
});

app.get('/api/pricing', (req, res) => {
  res.json(db.getPricingRules());
});

// ------------------------------------------------------------------
// Pay & Park flow (Neon-backed). These replace the old in-memory
// booking endpoints. The chatbot's own booking demo (db.bookSlot,
// used inside handleChat below) is untouched and keeps using the
// in-memory store — the two are independent code paths.
// ------------------------------------------------------------------

app.get('/api/bookings/my', async (req, res) => {
  try {
    await completeExpiredNeonBookings();
    const { user_id } = req.query;
    const bookings = await getNeonUserBookings(user_id ? String(user_id) : undefined);
    res.json(bookings);
  } catch (error) {
    console.error('❌ Failed to fetch bookings from Neon:', error);
    res.status(500).json({ success: false, reason: 'Failed to fetch bookings' });
  }
});

// Step 1: reserve a slot and create a 'pending' booking (not active/paid yet).
app.post('/api/bookings', async (req, res) => {
  try {
    const { slot_id, vehicle_number, duration, user_id } = req.body;
    if (!slot_id || !duration) {
      return res.status(400).json({ success: false, reason: 'slot_id and duration are required' });
    }

    const slot = await getNeonSlotById(String(slot_id));
    if (!slot) {
      return res.status(404).json({ success: false, reason: 'Slot not found' });
    }
    if (slot.status !== 'available') {
      return res.status(400).json({ success: false, reason: `Slot ${slot.slot_number} is not available` });
    }

    const hours = Number(duration);
    if (!hours || hours <= 0) {
      return res.status(400).json({ success: false, reason: 'duration must be a positive number of hours' });
    }

    const pricePerHr = Number(slot.price_per_hr) || 0;
    const baseAmount = Math.round(pricePerHr * hours * 100) / 100;
    const now = new Date();
    const scheduledEnd = new Date(now.getTime() + hours * 60 * 60 * 1000);

    const booking = await createNeonBooking({
      id: crypto.randomUUID(),
      user_id: user_id || 'usr-demo',
      parking_id: slot.parking_id,
      parking_name: slot.parking_name || 'ParkBy Hub',
      slot_id: slot.id,
      slot_number: slot.slot_number,
      vehicle_number: vehicle_number || 'UNKNOWN',
      start_time: now,
      scheduled_end_time: scheduledEnd,
      base_amount: baseAmount
    });

    // Reserve the slot immediately so it can't be double-booked while payment is pending.
    await markSlotOccupied(slot.id);

    res.status(201).json({ success: true, booking });
  } catch (error) {
    console.error('❌ Failed to create booking:', error);
    res.status(500).json({ success: false, reason: 'Failed to create booking' });
  }
});

// Step 2: mock/demo payment. Creates a payments row, and only on success
// flips the booking from 'pending' to 'active'.
app.post('/api/payments', async (req, res) => {
  try {
    const { booking_id, payment_method, user_id } = req.body;
    if (!booking_id || !payment_method) {
      return res.status(400).json({ success: false, reason: 'booking_id and payment_method are required' });
    }

    const booking = await getNeonBookingById(String(booking_id));
    if (!booking) {
      return res.status(404).json({ success: false, reason: 'Booking not found' });
    }
    if (booking.status !== 'pending') {
      return res.status(400).json({ success: false, reason: `Booking is already ${booking.status}` });
    }

    // ---- MOCK PAYMENT GATEWAY ----
    // Always succeeds in this demo. Swap this block for a real gateway
    // (Razorpay/Stripe/etc.) later; everything downstream stays the same.
    const paymentSucceeded = true;
    const transactionId = 'TXN-' + crypto.randomUUID().slice(0, 8).toUpperCase();

    const payment = await createNeonPayment({
      id: crypto.randomUUID(),
      booking_id: booking.id,
      user_id: user_id || booking.user_id,
      amount: booking.total_amount,
      payment_method,
      status: paymentSucceeded ? 'success' : 'failed',
      transaction_id: transactionId
    });

    if (!paymentSucceeded) {
      return res.status(402).json({ success: false, reason: 'Payment failed', payment });
    }

    const activeBooking = await activateNeonBooking(booking.id);
    res.json({ success: true, payment, booking: activeBooking });
  } catch (error) {
    console.error('❌ Payment processing failed:', error);
    res.status(500).json({ success: false, reason: 'Payment processing failed' });
  }
});

app.post('/api/bookings/extend', async (req, res) => {
  try {
    const { booking_id, hours } = req.body;
    if (!booking_id) {
      return res.status(400).json({ success: false, reason: 'booking_id is required' });
    }
    const updated = await extendNeonBooking(String(booking_id), hours ? Number(hours) : 1);
    if (!updated) {
      return res.status(400).json({ success: false, reason: 'Active booking not found' });
    }
    res.json({ success: true, booking: updated });
  } catch (error) {
    console.error('❌ Failed to extend booking:', error);
    res.status(500).json({ success: false, reason: 'Failed to extend booking' });
  }
});

app.post('/api/bookings/cancel', async (req, res) => {
  try {
    const { booking_id } = req.body;
    if (!booking_id) {
      return res.status(400).json({ success: false, reason: 'booking_id is required' });
    }
    const cancelled = await cancelNeonBooking(String(booking_id));
    if (!cancelled) {
      return res.status(400).json({ success: false, reason: 'Booking not found or already finalized' });
    }
    res.json({ success: true, booking: cancelled });
  } catch (error) {
    console.error('❌ Failed to cancel booking:', error);
    res.status(500).json({ success: false, reason: 'Failed to cancel booking' });
  }
});

app.get('/api/chat/history/:sessionId', (req, res) => {
  const conv = db.getOrCreateConversation(req.params.sessionId);
  res.json(conv.messages);
});

// Chat Processor Core (Handles both /chat and /api/chat)
const handleChat = async (req: Request, res: Response) => {
  const { message, session_id = 'session-default' } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Record user message
  db.addMessage(session_id, 'user', message);

  const intent = detectIntent(message);
  const contextData: Record<string, any> = {};

  if (intent === 'availability' || intent === 'greeting') {
    const loc = extractLocation(message);
    contextData.slots = db.getAvailableSlots(loc);
  } else if (intent === 'booking') {
    const slotId = extractSlotId(message);
    if (slotId) {
      contextData.booking_result = db.bookSlot(slotId);
    } else {
      contextData.booking_result = { success: false, reason: "Please specify a slot ID (e.g., A2, B1, C1)" };
    }
  } else if (intent === 'extension') {
    const slotId = extractSlotId(message);
    const activeBk = db.getUserBookings().find(b => b.status === 'active');
    const targetId = slotId || (activeBk ? activeBk.id : undefined);
    if (targetId) {
      contextData.extension_result = db.extendBooking(targetId, 1);
    } else {
      contextData.extension_result = { success: false, reason: "No active booking found to extend." };
    }
  } else if (['rates', 'hours', 'payment', 'cancellation', 'support'].includes(intent)) {
    contextData.faq_answer = db.getFAQ(intent);
    contextData.pricing = db.getPricingRules();
  }

  // Include active bookings and available locations in context
  contextData.active_bookings = db.getUserBookings().filter(b => b.status === 'active');
  contextData.all_locations = db.getLocations();

  let botReply = '';

  // Use Gemini if available
  if (aiClient) {
    try {
      const systemInstruction =
        "You are ParkBy's Smart Parking AI Assistant. Answer questions in 1-3 concise, friendly sentences. " +
        "ONLY state facts based on the CONTEXT DATA below. Never invent non-existent slots or prices. " +
        "If a slot booking was made, congratulate the user and give them clear summary details.";

      const userPrompt =
        `User Query: "${message}"\n` +
        `Detected Intent: ${intent}\n` +
        `CONTEXT DATA: ${JSON.stringify(contextData)}`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction,
          temperature: 0.3
        }
      });

      botReply = response.text || generateTemplateReply(intent, contextData);
    } catch (err) {
      console.warn('Gemini call failed, using template reply:', err);
      botReply = generateTemplateReply(intent, contextData);
    }
  } else {
    botReply = generateTemplateReply(intent, contextData);
  }

  // Save AI message to history
  db.addMessage(session_id, 'ai', botReply, intent, contextData);

  return res.json({
    reply: botReply,
    intent,
    session_id,
    data: contextData
  });
};

app.post('/chat', handleChat);
app.post('/api/chat', handleChat);

// Setup Vite Development Middleware or Static Production Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening at http://0.0.0.0:${PORT}`);
  });
}

testNeonConnection()
  .then(() => testDatabaseTables())
  .then(() => inspectParkingSlots())
  .then(() => inspectParkingTables())
  .then(() => inspectParkingData())
  .then(() => ensurePaymentsTable())
  .then(() => startServer())
  .then(() => {
    // Auto-expire bookings whose scheduled time has passed, freeing their slots.
    setInterval(() => {
      completeExpiredNeonBookings().catch(err =>
        console.error('❌ Failed to auto-complete expired bookings:', err)
      );
    }, 30_000);
  })
  .catch((error) => {
    console.error('❌ Database startup error:', error);
    process.exit(1);
  });
