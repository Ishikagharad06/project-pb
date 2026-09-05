export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  wallet_balance: number;
  avatar_url?: string;
  auth_provider?: 'email' | 'google';
}

export type UserRole = 'user' | 'admin';
export type SlotType = 'regular' | 'ev' | 'disabled';
export type SlotStatus = 'available' | 'occupied' | 'maintenance';
export type VehicleType = 'car' | 'bike' | 'ev' | 'suv';
export type BookingStatus = 'pending' | 'active' | 'completed' | 'cancelled' | 'expired';

export interface ParkingLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  total_slots: number;
  opening_time: string;
  closing_time: string;
  status: 'active' | 'inactive';
  available_slots_count?: number;
}

export interface ParkingSlot {
  id: string;
  parking_id: string;
  parking_name?: string;
  location_name?: string;
  slot_number: string;
  slot_type: SlotType;
  status: SlotStatus;
  price_per_hr: number;
}

export interface Vehicle {
  id: string;
  user_id: string;
  registration_number: string;
  vehicle_type: VehicleType;
  model: string;
  color: string;
}

export interface PricingRule {
  id: string;
  parking_id: string;
  parking_name: string;
  vehicle_type: VehicleType;
  hourly_rate: number;
  daily_rate: number;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  payment_method: string;
  payment_status: string;
  transaction_id?: string;
  paid_at?: string;
  booking_id: string;
  user_id: string;
}

export interface Booking {
  id: string;
  user_id: string;
  parking_id: string;
  parking_name: string;
  slot_id: string;
  slot_number: string;
  vehicle_number: string;
  start_time: string;
  scheduled_end_time: string;
  actual_end_time?: string;
  status: BookingStatus;
  base_amount: number;
  extension_amount: number;
  total_amount: number;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender: 'user' | 'ai';
  message: string;
  created_at: string;
  intent?: string;
  data?: any;
}

export interface ChatConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  messages: ChatMessage[];
}

export interface ChatRequest {
  message: string;
  session_id?: string;
  user_id?: string;
}

export interface ChatResponse {
  reply: string;
  intent: string;
  session_id: string;
  data?: any;
}
