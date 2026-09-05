import { ParkingLocation, ParkingSlot, Vehicle, PricingRule, Booking, ChatConversation, ChatMessage, UserAccount, UserRole, SlotType } from '../types.js';

class ParkingDatabase {
  private users: (UserAccount & { password?: string })[] = [
    {
      id: 'user-demo',
      name: 'Keshav Gupta',
      email: 'keshavgupta5060@gmail.com',
      role: 'admin',
      phone: '+91-9876543210',
      wallet_balance: 450,
      password: 'password123'
    }
  ];
  private locations: ParkingLocation[] = [
    {
      id: 'loc-gate1',
      name: 'Gate 1 Plaza',
      address: 'North Entrance, Main Boulevard',
      city: 'Metro City',
      latitude: 18.5204,
      longitude: 73.8567,
      total_slots: 25,
      opening_time: '00:00',
      closing_time: '23:59',
      status: 'active'
    },
    {
      id: 'loc-gate2',
      name: 'Gate 2 Executive',
      address: 'South Gate, Tech Park Road',
      city: 'Metro City',
      latitude: 18.5215,
      longitude: 73.8580,
      total_slots: 30,
      opening_time: '00:00',
      closing_time: '23:59',
      status: 'active'
    },
    {
      id: 'loc-basement',
      name: 'Basement Level B1 & B2',
      address: 'Underground Parking Hub, Central Tower',
      city: 'Metro City',
      latitude: 18.5190,
      longitude: 73.8550,
      total_slots: 50,
      opening_time: '00:00',
      closing_time: '23:59',
      status: 'active'
    }
  ];

  private slots: ParkingSlot[] = [
    { id: 'slot-A1', parking_id: 'loc-gate1', parking_name: 'Gate 1 Plaza', location_name: 'Gate 1', slot_number: 'A1', slot_type: 'regular', status: 'occupied', price_per_hr: 20 },
    { id: 'slot-A2', parking_id: 'loc-gate1', parking_name: 'Gate 1 Plaza', location_name: 'Gate 1', slot_number: 'A2', slot_type: 'regular', status: 'available', price_per_hr: 20 },
    { id: 'slot-A3', parking_id: 'loc-gate1', parking_name: 'Gate 1 Plaza', location_name: 'Gate 1', slot_number: 'A3', slot_type: 'ev', status: 'available', price_per_hr: 25 },
    
    { id: 'slot-B1', parking_id: 'loc-gate2', parking_name: 'Gate 2 Executive', location_name: 'Gate 2', slot_number: 'B1', slot_type: 'regular', status: 'available', price_per_hr: 25 },
    { id: 'slot-B2', parking_id: 'loc-gate2', parking_name: 'Gate 2 Executive', location_name: 'Gate 2', slot_number: 'B2', slot_type: 'regular', status: 'occupied', price_per_hr: 25 },
    { id: 'slot-B3', parking_id: 'loc-gate2', parking_name: 'Gate 2 Executive', location_name: 'Gate 2', slot_number: 'B3', slot_type: 'disabled', status: 'available', price_per_hr: 20 },

    { id: 'slot-C1', parking_id: 'loc-basement', parking_name: 'Basement Level B1 & B2', location_name: 'Basement', slot_number: 'C1', slot_type: 'regular', status: 'available', price_per_hr: 15 },
    { id: 'slot-C2', parking_id: 'loc-basement', parking_name: 'Basement Level B1 & B2', location_name: 'Basement', slot_number: 'C2', slot_type: 'regular', status: 'available', price_per_hr: 15 },
    { id: 'slot-C3', parking_id: 'loc-basement', parking_name: 'Basement Level B1 & B2', location_name: 'Basement', slot_number: 'C3', slot_type: 'ev', status: 'available', price_per_hr: 18 }
  ];

  private vehicles: Vehicle[] = [
    { id: 'veh-1', user_id: 'user-demo', registration_number: 'MH12AB1234', vehicle_type: 'car', model: 'Honda City', color: 'Pearl White' },
    { id: 'veh-2', user_id: 'user-demo', registration_number: 'MH12EV9999', vehicle_type: 'ev', model: 'Tata Nexon EV', color: 'Teal Blue' }
  ];

  private pricing: PricingRule[] = [
    { id: 'p1', parking_id: 'loc-gate1', parking_name: 'Gate 1 Plaza', vehicle_type: 'car', hourly_rate: 20, daily_rate: 150 },
    { id: 'p2', parking_id: 'loc-gate2', parking_name: 'Gate 2 Executive', vehicle_type: 'car', hourly_rate: 25, daily_rate: 180 },
    { id: 'p3', parking_id: 'loc-basement', parking_name: 'Basement Level B1 & B2', vehicle_type: 'car', hourly_rate: 15, daily_rate: 100 },
    { id: 'p4', parking_id: 'loc-gate1', parking_name: 'Gate 1 Plaza', vehicle_type: 'ev', hourly_rate: 25, daily_rate: 200 },
    { id: 'p5', parking_id: 'loc-basement', parking_name: 'Basement Level B1 & B2', vehicle_type: 'bike', hourly_rate: 10, daily_rate: 60 }
  ];

  private faqs: Record<string, string> = {
    rates: "Parking rates range from ₹15/hr in the Basement to ₹25/hr at Gate 2, depending on vehicle type and location.",
    hours: "All ParkBy parking locations are open 24/7 with round-the-clock security and automated barrier access.",
    payment: "We accept UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, Fastag, and cash at the entry gate.",
    cancellation: "You can cancel any booking free of charge up to 15 minutes before your scheduled start time.",
    support: "You can contact our 24/7 hotline at +91-1800-PARKBY or reach out via the chat assistant!"
  };

  private bookings: Booking[] = [
    {
      id: 'bk-101',
      user_id: 'user-demo',
      parking_id: 'loc-gate1',
      parking_name: 'Gate 1 Plaza',
      slot_id: 'slot-A1',
      slot_number: 'A1',
      vehicle_number: 'MH12AB1234',
      start_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      scheduled_end_time: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
      status: 'active',
      base_amount: 40,
      extension_amount: 0,
      total_amount: 40,
      created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString()
    }
  ];

  private conversations: Map<string, ChatConversation> = new Map();

  constructor() {
    // Initialize default session
    const defaultSessionId = 'session-default';
    this.conversations.set(defaultSessionId, {
      id: defaultSessionId,
      user_id: 'user-demo',
      title: 'Parking Help',
      created_at: new Date().toISOString(),
      messages: [
        {
          id: 'msg-1',
          conversation_id: defaultSessionId,
          sender: 'ai',
          message: 'Hi! 👋 I am your Smart Parking Assistant. Ask me about parking availability, rates, or bookings!',
          created_at: new Date().toISOString()
        }
      ]
    });
  }

  // Auth Methods
  googleAuthUser(email: string, name?: string, avatarUrl?: string): { success: boolean; user: UserAccount; isNew: boolean } {
    const cleanEmail = email.trim().toLowerCase();
    let existingIndex = this.users.findIndex(u => u.email.toLowerCase() === cleanEmail);

    if (existingIndex !== -1) {
      // User exists in database
      const existing = this.users[existingIndex];
      if (name && (!existing.name || existing.name === cleanEmail.split('@')[0])) {
        existing.name = name;
      }
      if (avatarUrl) {
        existing.avatar_url = avatarUrl;
      }
      existing.auth_provider = 'google';

      const { password: _, ...userWithoutPass } = existing;
      return { success: true, user: userWithoutPass, isNew: false };
    }

    // New user - add to database
    const displayName = name || cleanEmail.split('@')[0].replace('.', ' ').replace(/\b\w/g, c => c.toUpperCase());
    const isKeshav = cleanEmail.includes('keshavgupta5060') || cleanEmail.includes('admin');

    const newUser: UserAccount & { password?: string } = {
      id: 'usr-g-' + Date.now(),
      name: displayName,
      email: cleanEmail,
      role: isKeshav ? 'admin' : 'user',
      phone: '',
      wallet_balance: 500, // Welcome ₹500 bonus for new Google users!
      avatar_url: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanEmail}`,
      auth_provider: 'google'
    };

    this.users.push(newUser);
    const { password: _, ...userWithoutPass } = newUser;
    return { success: true, user: userWithoutPass, isNew: true };
  }

  getUsers(): UserAccount[] {
    return this.users.map(({ password: _, ...user }) => user);
  }

  registerUser(name: string, email: string, password?: string, role: UserRole = 'user', phone?: string): { success: boolean; user?: UserAccount; reason?: string } {
    const existing = this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return { success: false, reason: 'An account with this email address already exists.' };
    }

    const newUser: UserAccount & { password?: string } = {
      id: 'usr-' + Date.now(),
      name,
      email: email.toLowerCase(),
      role,
      phone: phone || '',
      wallet_balance: 500, // Welcome bonus!
      password: password || 'password',
      auth_provider: 'email'
    };

    this.users.push(newUser);
    const { password: _, ...userWithoutPass } = newUser;
    return { success: true, user: userWithoutPass };
  }

  loginUser(email: string, password?: string): { success: boolean; user?: UserAccount; reason?: string } {
    const user = this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return { success: false, reason: 'No account found with this email. Please sign up.' };
    }

    if (password && user.password && user.password !== password) {
      return { success: false, reason: 'Invalid password. Please try again.' };
    }

    const { password: _, ...userWithoutPass } = user;
    return { success: true, user: userWithoutPass };
  }

  // Locations
  getLocations(): ParkingLocation[] {
    return this.locations.map(loc => {
      const avail = this.slots.filter(s => s.parking_id === loc.id && s.status === 'available').length;
      return { ...loc, available_slots_count: avail };
    });
  }

  addLocation(data: { name: string; address: string; city?: string; total_slots?: number; opening_time?: string; closing_time?: string }): ParkingLocation {
    const newLoc: ParkingLocation = {
      id: 'loc-' + Date.now(),
      name: data.name,
      address: data.address,
      city: data.city || 'Metro City',
      latitude: 18.5200 + (Math.random() - 0.5) * 0.05,
      longitude: 73.8500 + (Math.random() - 0.5) * 0.05,
      total_slots: data.total_slots || 20,
      opening_time: data.opening_time || '00:00',
      closing_time: data.closing_time || '23:59',
      status: 'active'
    };

    this.locations.push(newLoc);
    return newLoc;
  }

  // Slots
  getSlots(locationFilter?: string, typeFilter?: string): ParkingSlot[] {
    let result = [...this.slots];
    if (locationFilter) {
      const query = locationFilter.toLowerCase();
      result = result.filter(s =>
        s.slot_number.toLowerCase().includes(query) ||
        (s.location_name && s.location_name.toLowerCase().includes(query)) ||
        (s.parking_name && s.parking_name.toLowerCase().includes(query))
      );
    }
    if (typeFilter) {
      result = result.filter(s => s.slot_type === typeFilter);
    }
    return result;
  }

  addSlot(data: { parking_id: string; slot_number: string; slot_type?: SlotType; price_per_hr?: number }): ParkingSlot {
    const loc = this.locations.find(l => l.id === data.parking_id);
    const newSlot: ParkingSlot = {
      id: 'slot-' + Date.now(),
      parking_id: data.parking_id,
      parking_name: loc ? loc.name : 'Parking Hub',
      location_name: loc ? loc.name : 'Parking Hub',
      slot_number: data.slot_number.toUpperCase(),
      slot_type: data.slot_type || 'regular',
      status: 'available',
      price_per_hr: data.price_per_hr || 20
    };

    this.slots.push(newSlot);
    return newSlot;
  }

  getAvailableSlots(locationFilter?: string): ParkingSlot[] {
    return this.getSlots(locationFilter).filter(s => s.status === 'available');
  }

  // Bookings
  bookSlot(slotQuery: string, vehicleNo: string = 'MH12AB1234', durationHours: number = 2): { success: boolean; booking?: Booking; reason?: string } {
    const slot = this.slots.find(s =>
      s.id.toLowerCase() === slotQuery.toLowerCase() ||
      s.slot_number.toLowerCase() === slotQuery.toLowerCase()
    );

    if (!slot) {
      return { success: false, reason: `Slot '${slotQuery}' not found.` };
    }

    if (slot.status !== 'available') {
      return { success: false, reason: `Slot '${slot.slot_number}' is currently occupied or unavailable.` };
    }

    // Mark slot as occupied
    slot.status = 'occupied';

    const now = new Date();
    const endTime = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
    const amount = slot.price_per_hr * durationHours;

    const newBooking: Booking = {
      id: 'bk-' + Math.floor(1000 + Math.random() * 9000),
      user_id: 'user-demo',
      parking_id: slot.parking_id,
      parking_name: slot.parking_name || slot.location_name || 'ParkBy Hub',
      slot_id: slot.id,
      slot_number: slot.slot_number,
      vehicle_number: vehicleNo,
      start_time: now.toISOString(),
      scheduled_end_time: endTime.toISOString(),
      status: 'active',
      base_amount: amount,
      extension_amount: 0,
      total_amount: amount,
      created_at: now.toISOString()
    };

    this.bookings.unshift(newBooking);
    return { success: true, booking: newBooking };
  }

  extendBooking(bookingId: string, additionalHours: number = 1): { success: boolean; booking?: Booking; reason?: string } {
    const bk = this.bookings.find(b => b.id === bookingId || b.slot_number === bookingId);
    if (!bk || bk.status !== 'active') {
      return { success: false, reason: 'Active booking not found.' };
    }

    const currentEnd = new Date(bk.scheduled_end_time);
    const newEnd = new Date(currentEnd.getTime() + additionalHours * 60 * 60 * 1000);
    const slot = this.slots.find(s => s.id === bk.slot_id);
    const addAmount = (slot ? slot.price_per_hr : 20) * additionalHours;

    bk.scheduled_end_time = newEnd.toISOString();
    bk.extension_amount += addAmount;
    bk.total_amount = bk.base_amount + bk.extension_amount;

    return { success: true, booking: bk };
  }

  cancelBooking(bookingId: string): { success: boolean; reason?: string } {
    const bk = this.bookings.find(b => b.id === bookingId || b.slot_number === bookingId);
    if (!bk) return { success: false, reason: 'Booking not found.' };
    if (bk.status === 'cancelled') return { success: false, reason: 'Booking is already cancelled.' };

    bk.status = 'cancelled';
    bk.actual_end_time = new Date().toISOString();

    // Free up slot
    const slot = this.slots.find(s => s.id === bk.slot_id);
    if (slot) slot.status = 'available';

    return { success: true };
  }

  getUserBookings(): Booking[] {
    return this.bookings;
  }

  // Pricing & FAQs
  getPricingRules(): PricingRule[] {
    return this.pricing;
  }

  getFAQ(topic: string): string | undefined {
    return this.faqs[topic.toLowerCase()];
  }

  // Chat memory
  getOrCreateConversation(sessionId: string): ChatConversation {
    let conv = this.conversations.get(sessionId);
    if (!conv) {
      conv = {
        id: sessionId,
        user_id: 'user-demo',
        title: 'Parking Chat',
        created_at: new Date().toISOString(),
        messages: []
      };
      this.conversations.set(sessionId, conv);
    }
    return conv;
  }

  addMessage(sessionId: string, sender: 'user' | 'ai', message: string, intent?: string, data?: any): ChatMessage {
    const conv = this.getOrCreateConversation(sessionId);
    const msg: ChatMessage = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      conversation_id: sessionId,
      sender,
      message,
      created_at: new Date().toISOString(),
      intent,
      data
    };
    conv.messages.push(msg);
    return msg;
  }
}

export const db = new ParkingDatabase();
