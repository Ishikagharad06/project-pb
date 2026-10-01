import 'dotenv/config';
import { MongoClient, Db, Collection, MongoServerError } from 'mongodb';

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || '';
const DB_NAME = process.env.MONGODB_DB_NAME || 'parkby';
const SLOT_COLLECTION = 'parking_slots';
const STATUS_COLLECTION = 'parking_status';
const MONGO_SERVER_SELECTION_MS = 15000;

export type LiveSlotDocument = {
  slot_key: string;
  unique_parking_id: string;
  location: string;
  display_name: string;
  neon_slot_id: string;
  neon_parking_id: string;
  slot_number: string;
  slot_type: string;
  available: boolean;
  status: string;
  fetched_at: Date;
  source: string;
};

export type LiveParkingDocument = {
  unique_parking_id: string;
  location: string;
  display_name: string;
  total_capacity: number;
  available: number;
  occupied: number;
  slots: Array<{
    id: string;
    neon_slot_id: string;
    slot_number: string;
    available: boolean;
    status: string;
  }>;
  fetched_at: Date;
  source: string;
};

let client: MongoClient | null = null;
let connectPromise: Promise<MongoClient> | null = null;

export function isMongoConfigured(): boolean {
  return Boolean(MONGO_URI);
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!MONGO_URI) {
    throw new Error('MONGODB_URI is missing');
  }

  if (client) {
    return client;
  }

  if (!connectPromise) {
    connectPromise = (async () => {
      const nextClient = new MongoClient(MONGO_URI, {
        serverSelectionTimeoutMS: MONGO_SERVER_SELECTION_MS,
        connectTimeoutMS: 15000,
        socketTimeoutMS: 15000,
        retryWrites: true,
      });
      await nextClient.connect();
      await nextClient.db('admin').command({ ping: 1 });
      client = nextClient;
      console.log('✅ MongoDB connected successfully');
      return nextClient;
    })().catch((error) => {
      connectPromise = null;
      throw error;
    });
  }

  return connectPromise;
}

export async function getMongoDb(): Promise<Db> {
  const mongoClient = await getMongoClient();
  return mongoClient.db(DB_NAME);
}

async function slotCollection(): Promise<Collection<LiveSlotDocument>> {
  return (await getMongoDb()).collection<LiveSlotDocument>(SLOT_COLLECTION);
}

async function statusCollection(): Promise<Collection<LiveParkingDocument>> {
  return (await getMongoDb()).collection<LiveParkingDocument>(STATUS_COLLECTION);
}

export async function ensureMongoIndexes(): Promise<void> {
  const slots = await slotCollection();
  const status = await statusCollection();

  try {
    await slots.deleteMany({
      $or: [
        { slot_key: null },
        { slot_key: { $exists: false } },
        { neon_slot_id: null },
        { neon_slot_id: { $exists: false } },
      ],
    });
    await status.deleteMany({
      $or: [
        { unique_parking_id: null },
        { unique_parking_id: { $exists: false } },
      ],
    });
  } catch (cleanErr) {
    console.warn('MongoDB cleanup warning:', cleanErr);
  }

  await slots.createIndex({ slot_key: 1 }, { unique: true });
  await slots.createIndex({ neon_slot_id: 1 }, { unique: true });
  await status.createIndex({ unique_parking_id: 1 }, { unique: true });
}

export async function testMongoConnection(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error('MONGODB_URI is missing');
  }

  await getMongoClient();
  await ensureMongoIndexes();
}

export function describeMongoError(error: unknown): string {
  if (error instanceof MongoServerError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown MongoDB error';
}

export async function upsertLiveSlot(doc: LiveSlotDocument): Promise<void> {
  const collection = await slotCollection();
  await collection.updateOne(
    { slot_key: doc.slot_key },
    { $set: doc },
    { upsert: true }
  );
}

export async function upsertLiveParking(doc: LiveParkingDocument): Promise<void> {
  const collection = await statusCollection();
  await collection.updateOne(
    { unique_parking_id: doc.unique_parking_id },
    { $set: doc },
    { upsert: true }
  );
}

export async function getLiveParkingDocuments(): Promise<LiveParkingDocument[]> {
  const collection = await statusCollection();
  return collection.find({}).toArray();
}

export async function getLiveSlotStatusMap(): Promise<
  Map<string, { status: string; available: boolean; slot_key: string }>
> {
  const collection = await slotCollection();
  const docs = await collection.find({}).toArray();
  const map = new Map<
    string,
    { status: string; available: boolean; slot_key: string }
  >();

  for (const doc of docs) {
    const payload = {
      status: doc.status,
      available: doc.available,
      slot_key: doc.slot_key,
    };
    map.set(String(doc.neon_slot_id), payload);
    map.set(doc.slot_key.toUpperCase(), payload);
  }

  return map;
}
