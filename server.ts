import express, { Request, Response } from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
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

console.log(
  'DATABASE_URL exists:',
  !!process.env.DATABASE_URL
);

const app = express();
const PORT = 3000;

const DEFAULT_NEON_USER_ID =
  '8a1f636a-f688-4192-a9f9-41113a61761b';

app.use(express.json());

/* ============================================================
   CORS
============================================================ */

app.use((req, res, next) => {
  res.header(
    'Access-Control-Allow-Origin',
    '*'
  );

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
  } catch (error) {
    console.warn(
      'Failed to initialize Gemini:',
      error
    );
  }
}

/* ============================================================
   HELPERS
============================================================ */

function resolveUserId(
  value: unknown
): string {
  if (
    typeof value === 'string' &&
    value.trim()
  ) {
    return value.trim();
  }

  return DEFAULT_NEON_USER_ID;
}

async function getNeonUser(
  userId: string
) {
  const result = await pool.query(
    `
    SELECT
      id,
      full_name,
      email,
      role
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

/* ============================================================
   AUTH
============================================================ */

app.post(
  '/api/auth/google',
  async (req, res) => {
    try {
      const {
        email,
        name,
        avatarUrl
      } = req.body;

      if (
        !email ||
        typeof email !== 'string'
      ) {
        return res.status(400).json({
          success: false,
          reason:
            'Valid email address is required'
        });
      }

      const result =
        db.googleAuthUser(
          email,
          name,
          avatarUrl
        );

      if (!result.success) {
        return res.status(400).json(result);
      }

      /*
       * Match Google user with Neon user
       * using email.
       */
      const neonResult =
        await pool.query(
          `
          SELECT
            id,
            full_name,
            email,
            role
          FROM users
          WHERE LOWER(email) = LOWER($1)
          LIMIT 1
          `,
          [email]
        );

      if (
        neonResult.rows.length > 0
      ) {
        result.user = {
          ...result.user,
          id:
            neonResult.rows[0].id,
          role:
            neonResult.rows[0].role
        };
      }

      res.json(result);
    } catch (error) {
      console.error(
        'Google auth error:',
        error
      );

      res.status(500).json({
        success: false,
        reason:
          'Google authentication failed'
      });
    }
  }
);

app.post(
  '/api/auth/logout',
  (req, res) => {
    res.json({
      success: true,
      message:
        'Successfully signed out'
    });
  }
);

app.get(
  '/api/users',
  (req, res) => {
    res.json({
      success: true,
      users: db.getUsers()
    });
  }
);

app.post(
  '/api/auth/signup',
  async (req, res) => {
    try {
      const {
        name,
        email,
        password,
        role,
        phone
      } = req.body;

      if (
        !name ||
        !email
      ) {
        return res.status(400).json({
          success: false,
          reason:
            'Name and email are required'
        });
      }

      /*
       * Existing local signup.
       */
      const result =
        db.registerUser(
          name,
          email,
          password,
          role,
          phone
        );

      if (
        !result.success ||
        !result.user
      ) {
        return res.status(400).json(result);
      }

      /*
       * Check whether this account already
       * exists in Neon.
       */
      const neonResult =
        await pool.query(
          `
          SELECT
            id,
            full_name,
            email,
            role
          FROM users
          WHERE LOWER(email) = LOWER($1)
          LIMIT 1
          `,
          [email]
        );

      let neonUser;

      if (neonResult.rows.length > 0) {
        /*
         * User already exists in Neon.
         */
        neonUser =
          neonResult.rows[0];
      } else {
        /*
         * User does not exist in Neon.
         * Create them automatically.
         */
        const newNeonId =
          crypto.randomUUID();

        const createResult =
          await pool.query(
            `
            INSERT INTO users (
              id,
              full_name,
              email,
              password_hash,
              role,
              created_at,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              'user',
              NOW(),
              NOW()
            )
            RETURNING
              id,
              full_name,
              email,
              role
            `,
            [
              newNeonId,
              name,
              email,
              password || ''
            ]
          );

        neonUser =
          createResult.rows[0];

        console.log(
          `Created Neon user automatically: ${neonUser.email} (${neonUser.id})`
        );
      }

      /*
       * Return the Neon ID to the frontend.
       */
      const user = {
        ...result.user,
        id: neonUser.id,
        role: neonUser.role
      };

      return res.json({
        success: true,
        user
      });

    } catch (error) {
      console.error(
        'Signup error:',
        error
      );

      return res.status(500).json({
        success: false,
        reason:
          'Signup failed'
      });
    }
  }
);

/*
 * LOGIN
 *
 * Local DB checks the password.
 * Neon supplies the ID + role used by Pay & Park.
 */
app.post(
  '/api/auth/login',
  async (req, res) => {
    try {
      const {
        email,
        password
      } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          reason:
            'Email is required'
        });
      }

      /*
       * Existing local authentication.
       */
      const result =
        db.loginUser(
          email,
          password
        );

      if (
        !result.success ||
        !result.user
      ) {
        return res.status(400).json(result);
      }

      /*
       * Find the same account in Neon.
       */
      /*
 * Find the same account in Neon.
 * If it does not exist, create it automatically.
 */
let neonResult = await pool.query(
  `
  SELECT
    id,
    full_name,
    email,
    role
  FROM users
  WHERE LOWER(email) = LOWER($1)
  LIMIT 1
  `,
  [email]
);

let neonUser;

if (neonResult.rows.length === 0) {
  // Create a new Neon user automatically
  const newNeonId = crypto.randomUUID();

  const createResult = await pool.query(
    `
    INSERT INTO users (
      id,
      full_name,
      email,
      password_hash,
      role,
      created_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      'user',
      NOW(),
      NOW()
    )
    RETURNING
      id,
      full_name,
      email,
      role
    `,
    [
      newNeonId,
      result.user.name,
      result.user.email,
      password || ''
    ]
  );

  neonUser = createResult.rows[0];

  console.log(
    `Created Neon user automatically: ${neonUser.email} (${neonUser.id})`
  );
} else {
  neonUser = neonResult.rows[0];
}

/*
 * Use the Neon ID in the logged-in frontend user.
 */
const user = {
  ...result.user,
  id: neonUser.id,
  role: neonUser.role
};

return res.json({
  success: true,
  user
});
    } catch (error) {
      console.error(
        'Login error:',
        error
      );

      res.status(500).json({
        success: false,
        reason:
          'Login failed'
      });
    }
  }
);

/* ============================================================
   HEALTH
============================================================ */

app.get(
  '/api/health',
  (req, res) => {
    res.json({
      status: 'ok',
      service:
        'Smart Parking Assistant Backend',
      database:
        'Neon PostgreSQL'
    });
  }
);

/* ============================================================
   LOCATIONS
============================================================ */

app.get(
  '/api/locations',
  async (req, res) => {
    try {
      const result =
        await pool.query(`
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
          total_slots:
            Number(
              row.total_slots || 0
            ),
          available_slots_count:
            Number(
              row.available_slots_count ||
              0
            )
        }))
      );
    } catch (error) {
      console.error(
        'Failed to fetch locations:',
        error
      );

      res.status(500).json({
        success: false,
        reason:
          'Failed to fetch parking locations'
      });
    }
  }
);

/* ============================================================
   SLOTS
============================================================ */

app.get(
  '/api/slots',
  async (req, res) => {
    try {
      const {
        location,
        type
      } = req.query;

      const slots =
        await getNeonSlots(
          location
            ? String(location)
            : undefined
        );

      const filtered =
        type
          ? slots.filter(
              slot =>
                slot.slot_type ===
                String(type)
            )
          : slots;

      res.json(filtered);
    } catch (error) {
      console.error(
        'Failed to fetch slots:',
        error
      );

      res.status(500).json({
        success: false,
        reason:
          'Failed to fetch parking slots'
      });
    }
  }
);

/* ============================================================
   LOCAL COMPATIBILITY ROUTES
============================================================ */

app.post(
  '/api/slots',
  (req, res) => {
    const {
      parking_id,
      slot_number,
      slot_type,
      price_per_hr
    } = req.body;

    if (
      !parking_id ||
      !slot_number
    ) {
      return res.status(400).json({
        success: false,
        reason:
          'Parking location and slot number are required'
      });
    }

    const newSlot =
      db.addSlot({
        parking_id,
        slot_number,
        slot_type,
        price_per_hr:
          Number(
            price_per_hr
          ) || 20
      });

    res.status(201).json({
      success: true,
      slot: newSlot
    });
  }
);

app.get(
  '/api/pricing',
  (req, res) => {
    res.json(
      db.getPricingRules()
    );
  }
);

/* ============================================================
   MY BOOKINGS
============================================================ */

app.get(
  '/api/bookings/my',
  async (req, res) => {
    try {
      /*
       * Clean expired bookings first.
       */
      await completeExpiredNeonBookings();

      const userId =
        resolveUserId(
          req.query.user_id
        );

      /*
       * Verify user exists in Neon.
       */
      const user =
        await getNeonUser(
          userId
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          reason:
            'Neon user not found'
        });
      }

      /*
       * IMPORTANT:
       * This returns ONLY this user's bookings.
       */
      const bookings =
        await getNeonUserBookings(
          userId
        );

      const enrichedBookings =
        await Promise.all(
          bookings.map(
            async booking => {
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

                    v.registration_number
                      AS vehicle_number

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

              return (
                details.rows[0] ||
                booking
              );
            }
          )
        );

      res.json(
        enrichedBookings
      );
    } catch (error) {
      console.error(
        'Failed to fetch my bookings:',
        error
      );

      res.status(500).json({
        success: false,
        reason:
          'Failed to fetch bookings'
      });
    }
  }
);

/* ============================================================
   ADMIN — ALL BOOKINGS
============================================================ */

app.get(
  '/api/admin/bookings',
  async (req, res) => {
    try {
      const adminUserId =
        resolveUserId(
          req.query.user_id
        );

      const admin =
        await getNeonUser(
          adminUserId
        );

      if (!admin) {
        return res.status(404).json({
          success: false,
          reason:
            'Admin user not found'
        });
      }

      /*
       * Role comes from Neon.
       */
      if (
        String(
          admin.role
        ).toLowerCase() !==
        'admin'
      ) {
        return res.status(403).json({
          success: false,
          reason:
            'Admin access required'
        });
      }

      /*
       * No user filter = ALL bookings.
       */
      const bookings =
        await getNeonUserBookings();

      res.json({
        success: true,
        bookings
      });
    } catch (error) {
      console.error(
        'Failed to fetch admin bookings:',
        error
      );

      res.status(500).json({
        success: false,
        reason:
          'Failed to fetch admin bookings'
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

      if (
        !slot_id ||
        !duration
      ) {
        return res.status(400).json({
          success: false,
          reason:
            'slot_id and duration are required'
        });
      }

      const userId =
        resolveUserId(
          user_id
        );

      /*
       * Verify user.
       */
      const user =
        await getNeonUser(
          userId
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          reason:
            'Neon user not found'
        });
      }

      if (
        !vehicle_number ||
        typeof vehicle_number !==
          'string' ||
        !vehicle_number.trim()
      ) {
        return res.status(400).json({
          success: false,
          reason:
            'Vehicle number is required'
        });
      }

      const slot =
        await getNeonSlotById(
          String(slot_id)
        );

      if (!slot) {
        return res.status(404).json({
          success: false,
          reason:
            'Slot not found'
        });
      }

      if (
        slot.status !==
        'available'
      ) {
        return res.status(400).json({
          success: false,
          reason:
            `Slot ${slot.slot_number} is not available`
        });
      }

      const hours =
        Number(duration);

      if (
        !Number.isFinite(hours) ||
        hours <= 0
      ) {
        return res.status(400).json({
          success: false,
          reason:
            'duration must be positive'
        });
      }

      const pricePerHr =
        Number(
          slot.price_per_hr
        ) || 0;

      const baseAmount =
        Math.round(
          pricePerHr *
            hours *
            100
        ) / 100;

      const now =
        new Date();

      const scheduledEnd =
        new Date(
          now.getTime() +
          hours *
            60 *
            60 *
            1000
        );

      /*
       * createNeonBooking:
       * - finds vehicle
       * - creates vehicle if needed
       * - creates booking
       */
      const booking =
        await createNeonBooking({
          id:
            crypto.randomUUID(),

          user_id:
            userId,

          parking_id:
            slot.parking_id,

          parking_name:
            slot.parking_name ||
            'ParkBy Hub',

          slot_id:
            slot.id,

          slot_number:
            slot.slot_number,

          vehicle_number:
            vehicle_number
              .trim()
              .toUpperCase(),

          start_time:
            now,

          scheduled_end_time:
            scheduledEnd,

          base_amount:
            baseAmount
        });

      /*
       * Reserve slot.
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
        'Failed to create booking:',
        error
      );

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
          reason:
            'Booking not found'
        });
      }

      /*
       * Ownership check.
       */
      if (
        user_id &&
        String(user_id) !==
          String(booking.user_id)
      ) {
        return res.status(403).json({
          success: false,
          reason:
            'You cannot pay for another user\'s booking'
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
       * Demo payment gateway.
       */
      const paymentSucceeded =
        true;

      const transactionId =
        'TXN-' +
        crypto
          .randomUUID()
          .slice(0, 8)
          .toUpperCase();

      const payment =
        await createNeonPayment({
          id:
            crypto.randomUUID(),

          booking_id:
            booking.id,

          user_id:
            booking.user_id,

          amount:
            Number(
              booking.total_amount
            ),

          payment_method:
            payment_method,

          status:
            paymentSucceeded
              ? 'success'
              : 'failed',

          transaction_id:
            transactionId
        });

      if (
        !paymentSucceeded
      ) {
        return res.status(402).json({
          success: false,
          reason:
            'Payment failed',
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
        booking:
          activeBooking
      });
    } catch (error: any) {
      console.error(
        'Payment error:',
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
        hours,
        user_id
      } = req.body;

      if (!booking_id) {
        return res.status(400).json({
          success: false,
          reason:
            'booking_id is required'
        });
      }

      const booking =
        await getNeonBookingById(
          String(booking_id)
        );

      if (!booking) {
        return res.status(404).json({
          success: false,
          reason:
            'Booking not found'
        });
      }

      /*
       * Ownership check.
       */
      if (
        user_id &&
        String(user_id) !==
          String(booking.user_id)
      ) {
        return res.status(403).json({
          success: false,
          reason:
            'You cannot extend another user\'s booking'
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
        booking:
          updated
      });
    } catch (error) {
      console.error(
        'Extend booking error:',
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
        booking_id,
        user_id
      } = req.body;

      if (!booking_id) {
        return res.status(400).json({
          success: false,
          reason:
            'booking_id is required'
        });
      }

      const booking =
        await getNeonBookingById(
          String(booking_id)
        );

      if (!booking) {
        return res.status(404).json({
          success: false,
          reason:
            'Booking not found'
        });
      }

      /*
       * Ownership check.
       */
      if (
        user_id &&
        String(user_id) !==
          String(booking.user_id)
      ) {
        return res.status(403).json({
          success: false,
          reason:
            'You cannot cancel another user\'s booking'
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
        booking:
          cancelled
      });
    } catch (error) {
      console.error(
        'Cancel booking error:',
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

const INTENT_KEYWORDS: Record<
  string,
  string[]
> = {
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

function detectIntent(
  message: string
): string {
  const text =
    message.toLowerCase();

  for (
    const [
      intent,
      keywords
    ] of Object.entries(
      INTENT_KEYWORDS
    )
  ) {
    if (
      keywords.some(
        keyword =>
          text.includes(
            keyword
          )
      )
    ) {
      return intent;
    }
  }

  return 'fallback';
}

function extractLocation(
  message: string
): string | undefined {
  const text =
    message.toLowerCase();

  for (
    const location of [
      'gate 1',
      'gate 2',
      'basement',
      'north',
      'south',
      'central'
    ]
  ) {
    if (
      text.includes(
        location
      )
    ) {
      return location;
    }
  }

  return undefined;
}

function extractSlotId(
  message: string
): string | undefined {
  const match =
    message.match(
      /\b([A-Za-z]\d)\b/
    );

  return match
    ? match[1].toUpperCase()
    : undefined;
}

function generateTemplateReply(
  intent: string,
  data: any
): string {
  if (
    intent ===
    'greeting'
  ) {
    return (
      "Hi there! 👋 Welcome to ParkBy Smart Parking Assistant. " +
      'I can help you find available spots, check prices, book a slot, ' +
      'or answer questions. How can I help you today?'
    );
  }

  if (
    intent ===
    'availability'
  ) {
    const slots =
      data.slots || [];

    if (
      slots.length === 0
    ) {
      return (
        'Sorry, no vacant slots are available right now.'
      );
    }

    const lines =
      slots.map(
        (slot: any) =>
          `• ${slot.slot_number} at ${
            slot.parking_name ||
            slot.location_name ||
            'ParkBy'
          } (₹${
            slot.price_per_hr
          }/hr - ${String(
            slot.slot_type
          ).toUpperCase()})`
      );

    return (
      'Here are the currently available slots:\n' +
      lines.join('\n') +
      '\n\nWould you like to book one?'
    );
  }

  if (
    intent ===
    'booking'
  ) {
    const result =
      data.booking_result;

    if (
      result &&
      result.success
    ) {
      return (
        `🎉 Success! Slot ${
          result.booking.slot_number
        } has been booked.`
      );
    }

    return (
      `Sorry, I couldn't book that slot: ${
        result?.reason ||
        'slot is unavailable'
      }.`
    );
  }

  if (
    intent ===
    'extension'
  ) {
    const result =
      data.extension_result;

    if (
      result &&
      result.success
    ) {
      return (
        `⏰ Booking extended successfully.`
      );
    }

    return (
      `Could not extend booking: ${
        result?.reason ||
        'No active booking found'
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
    'You can ask me about available parking slots, prices, or bookings.'
  );
}

app.get(
  '/api/chat/history/:sessionId',
  (req, res) => {
    const conversation =
      db.getOrCreateConversation(
        req.params.sessionId
      );

    res.json(
      conversation.messages
    );
  }
);

const handleChat = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      message,
      session_id =
        'session-default'
    } = req.body;

    if (
      !message ||
      typeof message !==
        'string'
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

    if (
      intent ===
        'availability' ||
      intent ===
        'greeting'
    ) {
      const slots =
        await getNeonSlots();

      const available =
        slots.filter(
          slot =>
            slot.status ===
            'available'
        );

      const location =
        extractLocation(
          message
        );

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
    } else if (
      intent ===
      'booking'
    ) {
      const slotId =
        extractSlotId(
          message
        );

      if (slotId) {
        contextData.booking_result =
          db.bookSlot(
            slotId
          );
      } else {
        contextData.booking_result = {
          success: false,
          reason:
            'Please specify a slot ID.'
        };
      }
    } else if (
      intent ===
      'extension'
    ) {
      const active =
        db
          .getUserBookings()
          .find(
            booking =>
              booking.status ===
              'active'
          );

      const slotId =
        extractSlotId(
          message
        );

      const targetId =
        slotId ||
        (
          active
            ? active.id
            : undefined
        );

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
    } else if (
      [
        'rates',
        'hours',
        'payment',
        'cancellation',
        'support'
      ].includes(intent)
    ) {
      contextData.faq_answer =
        db.getFAQ(
          intent
        );

      contextData.pricing =
        db.getPricingRules();
    }

    contextData.active_bookings =
      db
        .getUserBookings()
        .filter(
          booking =>
            booking.status ===
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
          'Only state facts based on the provided context. ' +
          'Never invent slots or prices.';

        const userPrompt =
          `User Query: "${message}"\n` +
          `Detected Intent: ${intent}\n` +
          `CONTEXT DATA: ${JSON.stringify(
            contextData
          )}`;

        const response =
          await aiClient.models.generateContent(
            {
              model:
                'gemini-2.5-flash',

              contents:
                userPrompt,

              config: {
                systemInstruction,
                temperature: 0.3
              }
            }
          );

        botReply =
          response.text ||
          generateTemplateReply(
            intent,
            contextData
          );
      } catch (error) {
        console.warn(
          'Gemini failed, using template:',
          error
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

    res.json({
      reply:
        botReply,
      intent,
      session_id,
      data:
        contextData
    });
  } catch (error) {
    console.error(
      'Chat error:',
      error
    );

    res.status(500).json({
      error:
        'Chat request failed'
    });
  }
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
   START SERVER
============================================================ */

async function startServer() {
  if (
    process.env.NODE_ENV !==
    'production'
  ) {
    const {
      createServer:
        createViteServer
    } = await import(
      'vite'
    );

    const vite =
      await createViteServer({
        server: {
          middlewareMode:
            true
        },
        appType:
          'spa'
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
        `Server listening at http://localhost:${PORT}`
      );
    }
  );
}

/* ============================================================
   LOCAL / VERCEL STARTUP
============================================================ */

if (process.env.VERCEL) {
  /*
   * Vercel deployment.
   *
   * No local app.listen().
   * No 30-second background interval.
   */

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
} else {
  /*
   * Local development.
   */

  testNeonConnection()

    .then(() =>
      testDatabaseTables()
    )

    .then(() =>
      inspectParkingSlots()
    )

    .then(() =>
      inspectParkingTables()
    )

    .then(() =>
      inspectParkingData()
    )

    .then(() =>
      ensurePaymentsTable()
    )

    .then(() =>
      completeExpiredNeonBookings()
    )

    .then(() =>
      startServer()
    )

    .then(() => {
      /*
       * Check every 30 seconds and release
       * expired slots.
       */
      setInterval(() => {
        completeExpiredNeonBookings()
          .catch(error =>
            console.error(
              'Auto-completion error:',
              error
            )
          );
      }, 30_000);
    })

    .catch(error => {
      console.error(
        'Database startup error:',
        error
      );

      process.exit(1);
    });
}

export default app;