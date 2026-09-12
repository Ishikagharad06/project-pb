import express, { Request, Response } from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

import { db } from './src/db/store.js';

import {
  pool,
  testNeonConnection,
  testDatabaseTables,
  inspectParkingSlots,
  inspectParkingTables,
  inspectParkingData,
  ensurePaymentsTable,
  getNeonSlots,
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

console.log('DATABASE_URL loaded:', !!process.env.DATABASE_URL);

const app = express();
const PORT = 3000;

/*
 * IMPORTANT:
 * This is the Neon demo user currently used by the frontend.
 * It exists in the Neon users table.
 */
const DEFAULT_NEON_USER_ID =
  '8a1f636a-f688-4192-a9f9-41113a61761b';

app.use(express.json());

/* ============================================================
   CORS
============================================================ */

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  res.header(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

/* ============================================================
   GEMINI
============================================================ */

let aiClient: GoogleGenAI | null = null;

if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });
  } catch (err) {
    console.warn(
      'Failed to initialize GoogleGenAI client:',
      err
    );
  }
}

/* ============================================================
   CHAT INTENT
============================================================ */

const INTENT_KEYWORDS: Record<string, string[]> = {
  greeting: [
    'hi',
    'hello',
    'hey',
    'good morning',
    'good evening',
    'start'
  ],

  availability: [
    'vacant',
    'available',
    'free slot',
    'empty',
    'space',
    'parking spot',
    'any spot',
    'spots',
    'slot'
  ],

  booking: [
    'book',
    'reserve',
    'reservation',
    'park here'
  ],

  extension: [
    'extend',
    'more time',
    'add hour',
    'increase time'
  ],

  rates: [
    'price',
    'rate',
    'cost',
    'how much',
    'charges',
    'fee',
    'pricing'
  ],

  hours: [
    'open',
    'timing',
    'hours',
    'close',
    'schedule'
  ],

  payment: [
    'pay',
    'payment',
    'upi',
    'card',
    'cash',
    'fastag'
  ],

  cancellation: [
    'cancel',
    'refund'
  ],

  support: [
    'help',
    'contact',
    'support',
    'number',
    'phone'
  ]
};

function detectIntent(message: string): string {
  const text = message.toLowerCase();

  for (const [intent, keywords] of Object.entries(
    INTENT_KEYWORDS
  )) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return intent;
    }
  }

  return 'fallback';
}

function extractLocation(
  message: string
): string | undefined {
  const text = message.toLowerCase();

  for (const location of [
    'gate 1',
    'gate 2',
    'basement',
    'north',
    'south',
    'central'
  ]) {
    if (text.includes(location)) {
      return location;
    }
  }

  return undefined;
}

function extractSlotId(
  message: string
): string | undefined {
  const match = message.match(/\b([A-Za-z]\d)\b/);

  return match
    ? match[1].toUpperCase()
    : undefined;
}

function generateTemplateReply(
  intent: string,
  data: any
): string {
  if (intent === 'greeting') {
    return (
      "Hi there! 👋 Welcome to ParkBy Smart Parking Assistant. " +
      'I can help you find available spots, check prices, book a slot, ' +
      'or answer questions. How can I help you today?'
    );
  }

  if (intent === 'availability') {
    const slots = data.slots || [];

    if (slots.length === 0) {
      return 'Sorry, no vacant slots are available right now.';
    }

    const lines = slots.map(
      (s: any) =>
        `• ${s.slot_number} at ${
          s.parking_name || s.location_name
        } (₹${s.price_per_hr}/hr - ${String(
          s.slot_type
        ).toUpperCase()})`
    );

    return (
      `Here are the currently available slots:\n` +
      `${lines.join('\n')}\n\n` +
      'Would you like to book one?'
    );
  }

  if (intent === 'booking') {
    const result = data.booking_result;

    if (result && result.success) {
      return (
        `🎉 Success! Slot ${
          result.booking.slot_number
        } at ${
          result.booking.parking_name
        } has been booked.`
      );
    }

    return (
      `Sorry, I couldn't book that slot: ${
        result?.reason || 'slot is unavailable'
      }.`
    );
  }

  if (intent === 'extension') {
    const result = data.extension_result;

    if (result && result.success) {
      return (
        `⏰ Booking extended until ${
          new Date(
            result.booking.scheduled_end_time
          ).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })
        }. Total: ₹${
          result.booking.total_amount
        }.`
      );
    }

    return (
      `Could not extend booking: ${
        result?.reason || 'No active booking found'
      }.`
    );
  }

  if (
    [
      'rates',
      'hours',
      'payment',
      'cancellation',
      'support'
    ].includes(intent)
  ) {
    return (
      data.faq_answer ||
      "I don't have that information handy."
    );
  }

  return (
    "I'm not sure I understood that completely. " +
    "You can ask me about available parking slots, " +
    'prices, or bookings.'
  );
}

/* ============================================================
   AUTH
   NOTE:
   Existing authentication remains backed by local db.
   Pay & Park uses Neon.
============================================================ */

app.post('/api/auth/google', (req, res) => {
  const {
    email,
    name,
    avatarUrl
  } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({
      success: false,
      reason: 'Valid Gmail/Google email address is required'
    });
  }

  const result = db.googleAuthUser(
    email,
    name,
    avatarUrl
  );

  res.json({
    success: true,
    user: result.user,
    isNew: result.isNew,
    message: result.isNew
      ? 'Welcome to ParkBy! Your account has been created.'
      : `Welcome back, ${result.user.name}!`
  });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Successfully signed out'
  });
});

app.get('/api/users', (req, res) => {
  res.json({
    success: true,
    users: db.getUsers()
  });
});

app.post('/api/auth/signup', (req, res) => {
  const {
    name,
    email,
    password,
    role,
    phone
  } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      success: false,
      reason: 'Name and email are required'
    });
  }

  const result = db.registerUser(
    name,
    email,
    password,
    role,
    phone
  );

  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.post('/api/auth/login', (req, res) => {
  const {
    email,
    password
  } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      reason: 'Email is required'
    });
  }

  const result = db.loginUser(
    email,
    password
  );

  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

/* ============================================================
   HEALTH
============================================================ */

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Smart Parking Assistant Backend',
    database: 'Neon PostgreSQL'
  });
});

/* ============================================================
   NEON PARKING LOCATIONS
============================================================ */

app.get('/api/locations', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        pl.id,
        pl.name,
        pl.address,
        pl.city,
        pl.latitude,
        pl.longitude,
        pl.total_slots,
        pl.opening_time,
        pl.closing_time,
        pl.status,
        COUNT(ps.id) FILTER (
          WHERE ps.status = 'available'
        ) AS available_slots_count
      FROM parking_locations pl
      LEFT JOIN parking_slots ps
        ON ps.parking_id = pl.id
      GROUP BY pl.id
      ORDER BY pl.name
    `);

    res.json(
      result.rows.map(row => ({
        ...row,
        total_slots: Number(row.total_slots || 0),
        available_slots_count: Number(
          row.available_slots_count || 0
        )
      }))
    );
  } catch (error) {
    console.error(
      '❌ Failed to fetch Neon locations:',
      error
    );

    res.status(500).json({
      success: false,
      reason: 'Failed to fetch parking locations'
    });
  }
});

/* ============================================================
   NEON SLOTS
============================================================ */

app.get('/api/slots', async (req, res) => {
  try {
    const {
      location,
      type
    } = req.query;

    const slots = await getNeonSlots(
      location
        ? String(location)
        : undefined
    );

    const filteredSlots = type
      ? slots.filter(
          slot =>
            slot.slot_type === String(type)
        )
      : slots;

    res.json(filteredSlots);
  } catch (error) {
    console.error(
      '❌ Failed to fetch slots from Neon:',
      error
    );

    res.status(500).json({
      success: false,
      reason: 'Failed to fetch parking slots'
    });
  }
});

/* ============================================================
   SLOT CREATION
   Kept for existing UI compatibility.
============================================================ */

app.post('/api/slots', (req, res) => {
  const {
    parking_id,
    slot_number,
    slot_type,
    price_per_hr
  } = req.body;

  if (!parking_id || !slot_number) {
    return res.status(400).json({
      success: false,
      reason:
        'Parking location and slot number are required'
    });
  }

  const newSlot = db.addSlot({
    parking_id,
    slot_number,
    slot_type,
    price_per_hr:
      Number(price_per_hr) || 20
  });

  res.status(201).json({
    success: true,
    slot: newSlot
  });
});

app.get('/api/pricing', (req, res) => {
  res.json(db.getPricingRules());
});

/* ============================================================
   NEON BOOKINGS
============================================================ */

/*
 * This returns booking information in the shape expected
 * by ActiveBookings.tsx:
 *
 * slot_number
 * parking_name
 * vehicle_number
 * total_amount
 * scheduled_end_time
 * status
 */
app.get(
  '/api/bookings/my',
  async (req, res) => {
    try {
      await completeExpiredNeonBookings();

      const userId = req.query.user_id
        ? String(req.query.user_id)
        : DEFAULT_NEON_USER_ID;

      const bookings =
        await getNeonUserBookings(userId);

      const enrichedBookings =
        await Promise.all(
          bookings.map(async booking => {
            const details =
              await pool.query(
                `
                SELECT
                  b.id,
                  b.start_time,
                  b.scheduled_end_time,
                  b.actual_end_time,
                  b.status,
                  b.base_amount,
                  b.extension_amount,
                  b.total_amount,
                  b.parking_id,
                  b.slot_id,
                  b.user_id,
                  b.vehicle_id,

                  pl.name AS parking_name,
                  ps.slot_number,
                  ps.slot_type,
                  v.registration_number AS vehicle_number

                FROM bookings b

                LEFT JOIN parking_locations pl
                  ON b.parking_id = pl.id

                LEFT JOIN parking_slots ps
                  ON b.slot_id = ps.id

                LEFT JOIN vehicles v
                  ON b.vehicle_id = v.id

                WHERE b.id = $1
                `,
                [booking.id]
              );

            return details.rows[0] || booking;
          })
        );

      res.json(enrichedBookings);
    } catch (error) {
      console.error(
        '❌ Failed to fetch bookings from Neon:',
        error
      );

      res.status(500).json({
        success: false,
        reason: 'Failed to fetch bookings'
      });
    }
  }
);

/* ============================================================
   CREATE BOOKING
============================================================ */

app.post(
  '/api/bookings',
  async (req, res) => {
    try {
      const {
        slot_id,
        vehicle_number,
        duration,
        user_id
      } = req.body;

      if (!slot_id || !duration) {
        return res.status(400).json({
          success: false,
          reason:
            'slot_id and duration are required'
        });
      }

      const userId =
        user_id || DEFAULT_NEON_USER_ID;

      const slot =
        await getNeonSlotById(
          String(slot_id)
        );

      if (!slot) {
        return res.status(404).json({
          success: false,
          reason: 'Slot not found'
        });
      }

      if (slot.status !== 'available') {
        return res.status(400).json({
          success: false,
          reason:
            `Slot ${slot.slot_number} is not available`
        });
      }

      const hours = Number(duration);

      if (!Number.isFinite(hours) || hours <= 0) {
        return res.status(400).json({
          success: false,
          reason:
            'duration must be a positive number of hours'
        });
      }

      const pricePerHr =
        Number(slot.price_per_hr) || 0;

      const baseAmount =
        Math.round(
          pricePerHr *
            hours *
            100
        ) / 100;

      const now = new Date();

      const scheduledEnd =
        new Date(
          now.getTime() +
          hours *
            60 *
            60 *
            1000
        );

      /*
       * Create pending booking.
       * Vehicle must belong to this Neon user.
       */
      const booking =
        await createNeonBooking({
          id: crypto.randomUUID(),
          user_id: userId,
          parking_id: slot.parking_id,
          parking_name:
            slot.parking_name ||
            'ParkBy Hub',
          slot_id: slot.id,
          slot_number:
            slot.slot_number,
          vehicle_number:
            vehicle_number ||
            'UNKNOWN',
          start_time: now,
          scheduled_end_time:
            scheduledEnd,
          base_amount:
            baseAmount
        });

      /*
       * Reserve slot immediately.
       */
      await markSlotOccupied(
        slot.id
      );

      res.status(201).json({
        success: true,
        booking
      });
    } catch (error: any) {
      console.error(
        '❌ Failed to create booking:',
        error
      );

      /*
       * Vehicle does not exist for user.
       * Return 400 instead of 500.
       */
      if (
        error?.message?.includes(
          'Vehicle'
        ) &&
        error?.message?.includes(
          'not found for user'
        )
      ) {
        return res.status(400).json({
          success: false,
          reason: error.message
        });
      }

      res.status(500).json({
        success: false,
        reason:
          error?.message ||
          'Failed to create booking'
      });
    }
  }
);

/* ============================================================
   PAYMENT
============================================================ */

app.post(
  '/api/payments',
  async (req, res) => {
    try {
      const {
        booking_id,
        payment_method,
        user_id
      } = req.body;

      if (
        !booking_id ||
        !payment_method
      ) {
        return res.status(400).json({
          success: false,
          reason:
            'booking_id and payment_method are required'
        });
      }

      const booking =
        await getNeonBookingById(
          String(booking_id)
        );

      if (!booking) {
        return res.status(404).json({
          success: false,
          reason: 'Booking not found'
        });
      }

      if (
        booking.status !==
        'pending'
      ) {
        return res.status(400).json({
          success: false,
          reason:
            `Booking is already ${booking.status}`
        });
      }

      /*
       * DEMO PAYMENT
       * Always succeeds for the internship demo.
       */
      const paymentSucceeded = true;

      const transactionId =
        'TXN-' +
        crypto
          .randomUUID()
          .slice(0, 8)
          .toUpperCase();

      const payment =
        await createNeonPayment({
          id: crypto.randomUUID(),
          booking_id:
            booking.id,
          user_id:
            user_id ||
            booking.user_id,
          amount:
            Number(
              booking.total_amount
            ),
          payment_method,
          status:
            paymentSucceeded
              ? 'success'
              : 'failed',
          transaction_id:
            transactionId
        });

      if (!paymentSucceeded) {
        return res.status(402).json({
          success: false,
          reason: 'Payment failed',
          payment
        });
      }

      const activeBooking =
        await activateNeonBooking(
          booking.id
        );

      if (!activeBooking) {
        return res.status(400).json({
          success: false,
          reason:
            'Booking could not be activated'
        });
      }

      res.json({
        success: true,
        payment,
        booking: activeBooking
      });
    } catch (error: any) {
      console.error(
        '❌ Payment processing failed:',
        error
      );

      res.status(500).json({
        success: false,
        reason:
          error?.message ||
          'Payment processing failed'
      });
    }
  }
);

/* ============================================================
   EXTEND BOOKING
============================================================ */

app.post(
  '/api/bookings/extend',
  async (req, res) => {
    try {
      const {
        booking_id,
        hours
      } = req.body;

      if (!booking_id) {
        return res.status(400).json({
          success: false,
          reason:
            'booking_id is required'
        });
      }

      const additionalHours =
        hours
          ? Number(hours)
          : 1;

      if (
        !Number.isFinite(
          additionalHours
        ) ||
        additionalHours <= 0
      ) {
        return res.status(400).json({
          success: false,
          reason:
            'hours must be positive'
        });
      }

      const updated =
        await extendNeonBooking(
          String(booking_id),
          additionalHours
        );

      if (!updated) {
        return res.status(400).json({
          success: false,
          reason:
            'Active booking not found'
        });
      }

      res.json({
        success: true,
        booking: updated
      });
    } catch (error) {
      console.error(
        '❌ Failed to extend booking:',
        error
      );

      res.status(500).json({
        success: false,
        reason:
          'Failed to extend booking'
      });
    }
  }
);

/* ============================================================
   CANCEL BOOKING
============================================================ */

app.post(
  '/api/bookings/cancel',
  async (req, res) => {
    try {
      const {
        booking_id
      } = req.body;

      if (!booking_id) {
        return res.status(400).json({
          success: false,
          reason:
            'booking_id is required'
        });
      }

      const cancelled =
        await cancelNeonBooking(
          String(booking_id)
        );

      if (!cancelled) {
        return res.status(400).json({
          success: false,
          reason:
            'Booking not found or already finalized'
        });
      }

      res.json({
        success: true,
        booking: cancelled
      });
    } catch (error) {
      console.error(
        '❌ Failed to cancel booking:',
        error
      );

      res.status(500).json({
        success: false,
        reason:
          'Failed to cancel booking'
      });
    }
  }
);

/* ============================================================
   CHAT
============================================================ */

app.get(
  '/api/chat/history/:sessionId',
  (req, res) => {
    const conv =
      db.getOrCreateConversation(
        req.params.sessionId
      );

    res.json(conv.messages);
  }
);

const handleChat = async (
  req: Request,
  res: Response
) => {
  const {
    message,
    session_id =
      'session-default'
  } = req.body;

  if (
    !message ||
    typeof message !== 'string'
  ) {
    return res.status(400).json({
      error:
        'Message is required'
    });
  }

  db.addMessage(
    session_id,
    'user',
    message
  );

  const intent =
    detectIntent(message);

  const contextData: Record<
    string,
    any
  > = {};

  /*
   * Chat availability now uses Neon slots.
   */
  if (
    intent === 'availability' ||
    intent === 'greeting'
  ) {
    const neonSlots =
      await getNeonSlots();

    const available =
      neonSlots.filter(
        slot =>
          slot.status ===
          'available'
      );

    const location =
      extractLocation(message);

    contextData.slots =
      location
        ? available.filter(
            slot =>
              (
                slot.parking_name ||
                slot.location_name ||
                ''
              )
                .toLowerCase()
                .includes(
                  location
                )
          )
        : available;
  }

  /*
   * Chat booking remains the existing demo path.
   * Pay & Park UI uses the Neon endpoints above.
   */
  else if (
    intent === 'booking'
  ) {
    const slotId =
      extractSlotId(message);

    if (slotId) {
      contextData.booking_result =
        db.bookSlot(slotId);
    } else {
      contextData.booking_result = {
        success: false,
        reason:
          'Please specify a slot ID.'
      };
    }
  }

  else if (
    intent === 'extension'
  ) {
    const activeBk =
      db
        .getUserBookings()
        .find(
          b =>
            b.status ===
            'active'
        );

    const slotId =
      extractSlotId(message);

    const targetId =
      slotId ||
      (activeBk
        ? activeBk.id
        : undefined);

    if (targetId) {
      contextData.extension_result =
        db.extendBooking(
          targetId,
          1
        );
    } else {
      contextData.extension_result = {
        success: false,
        reason:
          'No active booking found.'
      };
    }
  }

  else if (
    [
      'rates',
      'hours',
      'payment',
      'cancellation',
      'support'
    ].includes(intent)
  ) {
    contextData.faq_answer =
      db.getFAQ(intent);

    contextData.pricing =
      db.getPricingRules();
  }

  /*
   * Chat context.
   */
  contextData.active_bookings =
    db
      .getUserBookings()
      .filter(
        b =>
          b.status ===
          'active'
      );

  contextData.all_locations =
    await getNeonSlots();

  let botReply = '';

  if (aiClient) {
    try {
      const systemInstruction =
        "You are ParkBy's Smart Parking AI Assistant. " +
        'Answer in 1-3 concise, friendly sentences. ' +
        'ONLY state facts based on the CONTEXT DATA. ' +
        'Never invent non-existent slots or prices.';

      const userPrompt =
        `User Query: "${message}"\n` +
        `Detected Intent: ${intent}\n` +
        `CONTEXT DATA: ${JSON.stringify(
          contextData
        )}`;

      const response =
        await aiClient.models.generateContent({
          model:
            'gemini-2.5-flash',

          contents:
            userPrompt,

          config: {
            systemInstruction,
            temperature: 0.3
          }
        });

      botReply =
        response.text ||
        generateTemplateReply(
          intent,
          contextData
        );
    } catch (err) {
      console.warn(
        'Gemini call failed, using template reply:',
        err
      );

      botReply =
        generateTemplateReply(
          intent,
          contextData
        );
    }
  } else {
    botReply =
      generateTemplateReply(
        intent,
        contextData
      );
  }

  db.addMessage(
    session_id,
    'ai',
    botReply,
    intent,
    contextData
  );

  return res.json({
    reply: botReply,
    intent,
    session_id,
    data: contextData
  });
};

app.post(
  '/chat',
  handleChat
);

app.post(
  '/api/chat',
  handleChat
);

/* ============================================================
   VITE
============================================================ */

async function startServer() {
  if (
    process.env.NODE_ENV !==
    'production'
  ) {
    const vite =
      await createViteServer({
        server: {
          middlewareMode: true
        },
        appType: 'spa'
      });

    app.use(
      vite.middlewares
    );
  } else {
    const distPath =
      path.join(
        process.cwd(),
        'dist'
      );

    app.use(
      express.static(
        distPath
      )
    );

    app.get(
      '*',
      (req, res) => {
        res.sendFile(
          path.join(
            distPath,
            'index.html'
          )
        );
      }
    );
  }

  app.listen(
    PORT,
    '0.0.0.0',
    () => {
      console.log(
        `Server listening at http://0.0.0.0:${PORT}`
      );
    }
  );
}

/* ============================================================
   STARTUP
============================================================ */

if (process.env.VERCEL) {
  // Vercel handles the serverless invocation itself.
  // Do not call app.listen() or run local startup checks here.
  const distPath = path.join(process.cwd(), 'dist');

  app.use(express.static(distPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // Local development: run database checks and start the Express server.
  testNeonConnection()
    .then(() => testDatabaseTables())
    .then(() => inspectParkingSlots())
    .then(() => inspectParkingTables())
    .then(() => inspectParkingData())
    .then(() => ensurePaymentsTable())
    .then(() => completeExpiredNeonBookings())
    .then(() => startServer())
    .then(() => {
      /*
       * Automatically release expired slots locally.
       */
      setInterval(() => {
        completeExpiredNeonBookings()
          .catch(err =>
            console.error(
              '❌ Failed to auto-complete expired bookings:',
              err
            )
          );
      }, 30_000);
    })
    .catch(error => {
      console.error(
        '❌ Database startup error:',
        error
      );

      process.exit(1);
    });
}

export default app;