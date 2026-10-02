import crypto from 'crypto';
import { pool } from './neon.js';
import {
  describeMongoError,
  getLiveParkingDocuments,
  getLiveSlotStatusMap,
  isMongoConfigured,
  upsertLiveParking,
  upsertLiveSlot,
  type LiveParkingDocument,
  type LiveSlotDocument,
} from './mongo.js';

export const SMART_PARKINGS = {
  NH: {
    pid: 'NH',
    name: 'Nandanvan House',
    uniqueParkingId: 'NH_PARKING',
    slotCount: 15,
    city: 'Nagpur',
    address: 'Nandanvan House',
  },
  X: {
    pid: 'X',
    name: 'X Parking',
    uniqueParkingId: 'X_PARKING',
    slotCount: 10,
    city: 'Nagpur',
    address: 'X Parking Lot',
  },
} as const;

type ParkingKey = keyof typeof SMART_PARKINGS;

export type SmartSlotRow = {
  id: string;
  slot_number: string;
  slot_type: string;
  status: string;
  parking_id: string;
  parking_name: string;
};

export class SmartParkingError extends Error {
  statusCode: number;
  neonUpdated: boolean;
  mongoUpdated: boolean;

  constructor(
    message: string,
    statusCode = 500,
    neonUpdated = false,
    mongoUpdated = false
  ) {
    super(message);
    this.name = 'SmartParkingError';
    this.statusCode = statusCode;
    this.neonUpdated = neonUpdated;
    this.mongoUpdated = mongoUpdated;
  }
}

export function parseSlotKey(raw: string): {
  pid: ParkingKey;
  sid: number;
  slotNumber: string;
} {
  const match = String(raw || '')
    .trim()
    .toUpperCase()
    .match(/^(NH|X)(\d+)$/);

  if (!match) {
    throw new SmartParkingError(
      `Invalid slot ID '${raw}'. Use NH1-NH15 or X1-X10.`,
      400
    );
  }

  const pid = match[1] as ParkingKey;
  const sid = Number(match[2]);
  const config = SMART_PARKINGS[pid];

  if (!Number.isInteger(sid) || sid < 1 || sid > config.slotCount) {
    throw new SmartParkingError(
      `Invalid slot ID '${raw}'. ${config.name} supports ${config.pid}1-${config.pid}${config.slotCount}.`,
      400
    );
  }

  return { pid, sid, slotNumber: `${pid}${sid}` };
}

async function findLocationByName(name: string) {
  const result = await pool.query(
    `
    SELECT id, name, total_slots, status
    FROM parking_locations
    WHERE LOWER(name) = LOWER($1)
    ORDER BY id
    LIMIT 1
    `,
    [name]
  );

  return result.rows[0] || null;
}

async function ensureLocation(config: (typeof SMART_PARKINGS)[ParkingKey]) {
  const existing = await findLocationByName(config.name);

  if (existing) {
    await pool.query(
      `
      UPDATE parking_locations
      SET total_slots = $1,
          status = 'active'
      WHERE id = $2
      `,
      [config.slotCount, existing.id]
    );
    return existing.id as string;
  }

  const locationId = crypto.randomUUID();

  await pool.query(
    `
    INSERT INTO parking_locations (
      id,
      name,
      address,
      city,
      latitude,
      longitude,
      total_slots,
      opening_time,
      closing_time,
      status
    )
    VALUES (
      $1, $2, $3, $4,
      21.1458, 79.0882,
      $5, '00:00', '23:59', 'active'
    )
    `,
    [locationId, config.name, config.address, config.city, config.slotCount]
  );

  return locationId;
}

async function ensureSlots(locationId: string, config: (typeof SMART_PARKINGS)[ParkingKey]) {
  for (let i = 1; i <= config.slotCount; i += 1) {
    const slotNumber = `${config.pid}${i}`;
    const existing = await pool.query(
      `
      SELECT id
      FROM parking_slots
      WHERE parking_id = $1
        AND UPPER(slot_number) = UPPER($2)
      LIMIT 1
      `,
      [locationId, slotNumber]
    );

    if (existing.rows.length > 0) {
      continue;
    }

    await pool.query(
      `
      INSERT INTO parking_slots (
        id,
        slot_number,
        slot_type,
        status,
        parking_id
      )
      VALUES ($1, $2, 'regular', 'available', $3)
      `,
      [crypto.randomUUID(), slotNumber, locationId]
    );
  }
}

export async function ensureSmartParkingLots(): Promise<void> {
  for (const config of Object.values(SMART_PARKINGS)) {
    const locationId = await ensureLocation(config);
    await ensureSlots(locationId, config);
  }

  console.log('✅ Smart parking lots ready: Nandanvan House (15) and X Parking (10)');
}

export async function getSmartParkingSlots(
  pid?: ParkingKey
): Promise<SmartSlotRow[]> {
  const names = pid
    ? [SMART_PARKINGS[pid].name]
    : Object.values(SMART_PARKINGS).map((item) => item.name);

  const result = await pool.query(
    `
    SELECT
      ps.id,
      ps.slot_number,
      ps.slot_type,
      ps.status,
      ps.parking_id,
      pl.name AS parking_name
    FROM parking_slots ps
    INNER JOIN parking_locations pl
      ON pl.id = ps.parking_id
    WHERE pl.name = ANY($1::text[])
    ORDER BY pl.name, ps.slot_number
    `,
    [names]
  );

  return result.rows;
}

function serializeFromRows(rows: SmartSlotRow[]) {
  const data: Record<string, any> = {};

  for (const config of Object.values(SMART_PARKINGS)) {
    const slots = rows
      .filter((row) => row.parking_name === config.name)
      .map((row) => {
        const parsed = parseSlotKey(row.slot_number);
        return {
          id: parsed.sid,
          slot_number: parsed.slotNumber,
          neon_slot_id: row.id,
          available: row.status === 'available',
          status: row.status,
        };
      })
      .sort((a, b) => a.id - b.id);

    const total = slots.length;
    const free = slots.filter((slot) => slot.available).length;

    data[config.pid] = {
      name: config.name,
      unique_parking_id: config.uniqueParkingId,
      slots,
      total,
      available: free,
      occupied: total - free,
    };
  }

  return data;
}

export async function getSmartParkingState() {
  const rows = await getSmartParkingSlots();
  return serializeFromRows(rows);
}

async function syncRowsToMongo(rows: SmartSlotRow[]): Promise<void> {
  if (!isMongoConfigured()) {
    throw new SmartParkingError(
      'MongoDB is not configured. Set MONGODB_URI.',
      503
    );
  }

  const grouped = new Map<ParkingKey, SmartSlotRow[]>();

  for (const config of Object.values(SMART_PARKINGS)) {
    grouped.set(
      config.pid,
      rows.filter((row) => row.parking_name === config.name)
    );
  }

  const fetchedAt = new Date();

  for (const config of Object.values(SMART_PARKINGS)) {
    const lotRows = grouped.get(config.pid) || [];
    const slots = lotRows.map((row) => {
      const parsed = parseSlotKey(row.slot_number);
      return {
        id: parsed.slotNumber,
        neon_slot_id: row.id,
        slot_number: parsed.slotNumber,
        available: row.status === 'available',
        status: row.status,
      };
    });

    const available = slots.filter((slot) => slot.available).length;
    const totalCapacity = slots.length;
    const parkingDoc: LiveParkingDocument = {
      unique_parking_id: config.uniqueParkingId,
      location: config.pid,
      display_name: config.name,
      total_capacity: totalCapacity,
      available,
      occupied: totalCapacity - available,
      slots,
      fetched_at: fetchedAt,
      source: 'smart_parking',
    };

    await upsertLiveParking(parkingDoc);

    for (const row of lotRows) {
      const parsed = parseSlotKey(row.slot_number);
      const slotDoc: LiveSlotDocument = {
        slot_key: parsed.slotNumber,
        unique_parking_id: config.uniqueParkingId,
        location: config.pid,
        display_name: config.name,
        neon_slot_id: row.id,
        neon_parking_id: row.parking_id,
        slot_number: parsed.slotNumber,
        slot_type: row.slot_type,
        available: row.status === 'available',
        status: row.status,
        fetched_at: fetchedAt,
        source: 'smart_parking',
      };
      await upsertLiveSlot(slotDoc);
    }
  }
}

export async function syncSmartParkingToMongo(): Promise<void> {
  const rows = await getSmartParkingSlots();
  try {
    await syncRowsToMongo(rows);
  } catch (error) {
    throw new SmartParkingError(
      `MongoDB synchronization failed: ${describeMongoError(error)}`,
      502,
      true,
      false
    );
  }
}

export async function syncSlotById(slotId: string): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }

  const result = await pool.query(
    `
    SELECT
      ps.id,
      ps.slot_number,
      ps.slot_type,
      ps.status,
      ps.parking_id,
      pl.name AS parking_name
    FROM parking_slots ps
    INNER JOIN parking_locations pl
      ON pl.id = ps.parking_id
    WHERE ps.id = $1
    LIMIT 1
    `,
    [slotId]
  );

  const row = result.rows[0] as SmartSlotRow | undefined;
  if (!row) {
    return;
  }

  const isSmartLot = Object.values(SMART_PARKINGS).some(
    (config) => config.name === row.parking_name
  );

  if (!isSmartLot) {
    return;
  }

  const pid = Object.values(SMART_PARKINGS).find(
    (config) => config.name === row.parking_name
  )?.pid;

  if (!pid) {
    return;
  }

  await syncRowsToMongo(await getSmartParkingSlots(pid));
}

async function updateNeonSlot(
  slotNumber: string,
  parkingName: string,
  status: 'available' | 'occupied'
): Promise<SmartSlotRow> {
  const result = await pool.query(
    `
    UPDATE parking_slots AS ps
    SET status = $1
    FROM parking_locations pl
    WHERE ps.parking_id = pl.id
      AND pl.name = $2
      AND UPPER(ps.slot_number) = UPPER($3)
    RETURNING
      ps.id,
      ps.slot_number,
      ps.slot_type,
      ps.status,
      ps.parking_id,
      pl.name AS parking_name
    `,
    [status, parkingName, slotNumber]
  );

  if (result.rows.length === 0) {
    throw new SmartParkingError(
      `Slot ${slotNumber} was not found at ${parkingName}.`,
      404
    );
  }

  return result.rows[0];
}

export async function setSmartSlotAvailability(
  slotKey: string,
  available: boolean
) {
  const parsed = parseSlotKey(slotKey);
  const config = SMART_PARKINGS[parsed.pid];
  const status = available ? 'available' : 'occupied';

  let neonRow: SmartSlotRow;
  try {
    neonRow = await updateNeonSlot(parsed.slotNumber, config.name, status);
  } catch (error) {
    if (error instanceof SmartParkingError) {
      throw error;
    }
    throw new SmartParkingError(
      `Neon update failed for ${parsed.slotNumber}: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
      503,
      false,
      false
    );
  }

  try {
    await syncRowsToMongo(await getSmartParkingSlots(parsed.pid));
  } catch (error) {
    throw new SmartParkingError(
      `Neon updated ${parsed.slotNumber}, but MongoDB synchronization failed: ${describeMongoError(error)}`,
      502,
      true,
      false
    );
  }

  return {
    success: true,
    neon_updated: true,
    mongo_updated: true,
    slot: {
      slot_key: parsed.slotNumber,
      status: neonRow.status,
      available: neonRow.status === 'available',
      neon_slot_id: neonRow.id,
    },
    parkings: await getSmartParkingState(),
  };
}

export async function toggleSmartSlot(slotKey: string) {
  const parsed = parseSlotKey(slotKey);
  const config = SMART_PARKINGS[parsed.pid];
  const current = await pool.query(
    `
    SELECT ps.status
    FROM parking_slots ps
    INNER JOIN parking_locations pl
      ON pl.id = ps.parking_id
    WHERE pl.name = $1
      AND UPPER(ps.slot_number) = UPPER($2)
    LIMIT 1
    `,
    [config.name, parsed.slotNumber]
  );

  if (current.rows.length === 0) {
    throw new SmartParkingError(
      `Slot ${parsed.slotNumber} was not found at ${config.name}.`,
      404
    );
  }

  const nextAvailable = current.rows[0].status !== 'available';
  return setSmartSlotAvailability(parsed.slotNumber, nextAvailable);
}

export async function resetSmartParking(pidRaw: string) {
  const pid = String(pidRaw || '').trim().toUpperCase() as ParkingKey;
  const config = SMART_PARKINGS[pid];

  if (!config) {
    throw new SmartParkingError(
      `Unknown parking location '${pidRaw}'. Use NH or X.`,
      404
    );
  }

  try {
    await pool.query(
      `
      UPDATE parking_slots AS ps
      SET status = 'available'
      FROM parking_locations pl
      WHERE ps.parking_id = pl.id
        AND pl.name = $1
      `,
      [config.name]
    );
  } catch (error) {
    throw new SmartParkingError(
      `Neon reset failed for ${config.name}: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
      503
    );
  }

  try {
    await syncRowsToMongo(await getSmartParkingSlots(pid));
  } catch (error) {
    throw new SmartParkingError(
      `Neon reset ${config.name}, but MongoDB synchronization failed: ${describeMongoError(error)}`,
      502,
      true,
      false
    );
  }

  return {
    success: true,
    neon_updated: true,
    mongo_updated: true,
    parkings: await getSmartParkingState(),
  };
}

export async function applySmartParkingSnapshot(payload: any) {
  if (!payload || typeof payload !== 'object') {
    throw new SmartParkingError('Invalid parking snapshot', 400);
  }

  for (const config of Object.values(SMART_PARKINGS)) {
    const lot = payload[config.pid];
    if (!lot || !Array.isArray(lot.slots)) {
      throw new SmartParkingError(
        `Missing parking location ${config.pid} in snapshot`,
        400
      );
    }

    for (const slot of lot.slots) {
      const slotNumber =
        typeof slot.slot_number === 'string'
          ? slot.slot_number
          : `${config.pid}${slot.id}`;
      const parsed = parseSlotKey(slotNumber);
      const available = Boolean(slot.available);
      await updateNeonSlot(
        parsed.slotNumber,
        config.name,
        available ? 'available' : 'occupied'
      );
    }
  }

  try {
    await syncSmartParkingToMongo();
  } catch (error) {
    if (error instanceof SmartParkingError) {
      throw error;
    }
    throw new SmartParkingError(
      `MongoDB synchronization failed: ${describeMongoError(error)}`,
      502,
      true,
      false
    );
  }

  return {
    success: true,
    neon_updated: true,
    mongo_updated: true,
    parkings: await getSmartParkingState(),
  };
}

export async function overlaySlotsWithMongo<T extends { id: string; slot_number: string; status: string }>(
  slots: T[]
): Promise<T[]> {
  if (!isMongoConfigured()) {
    return slots;
  }

  try {
    const live = await getLiveSlotStatusMap();
    return slots.map((slot) => {
      const byId = live.get(String(slot.id));
      const byKey = live.get(String(slot.slot_number).toUpperCase());
      const match = byId || byKey;
      if (!match) {
        return slot;
      }
      return {
        ...slot,
        status: match.status,
      };
    });
  } catch (error) {
    console.error(
      'Failed to overlay MongoDB slot status, using Neon values:',
      describeMongoError(error)
    );
    return slots;
  }
}

export async function overlayLocationsWithMongo<
  T extends { name: string; available_slots_count?: number }
>(locations: T[]): Promise<T[]> {
  if (!isMongoConfigured()) {
    return locations;
  }

  try {
    const docs = await getLiveParkingDocuments();
    const byName = new Map(
      docs.map((doc) => [doc.display_name, doc.available])
    );

    return locations.map((location) => {
      const available = byName.get(location.name);
      if (typeof available !== 'number') {
        return location;
      }
      return {
        ...location,
        available_slots_count: available,
      };
    });
  } catch (error) {
    console.error(
      'Failed to overlay MongoDB location counts, using Neon values:',
      describeMongoError(error)
    );
    return locations;
  }
}
