import React, { useEffect, useState } from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';

import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { ParkingFinder } from './components/ParkingFinder';
import { ActiveBookings } from './components/ActiveBookings';
import { ChatWidget } from './components/ChatWidget';
import { ProfileModal } from './components/ProfileModal';
import { NotificationsModal } from './components/NotificationsModal';
import { QuickBookModal } from './components/QuickBookModal';
import { AuthModal } from './components/AuthModal';
import { AddLocationSlotModal } from './components/AddLocationSlotModal';
import { Footer } from './components/Footer';

import {
  ParkingLocation,
  ParkingSlot,
  Booking,
  UserAccount,
} from './types';

import { API_BASE_URL } from './apiConfig';

export default function App() {
  // -----------------------------
  // Main application state
  // -----------------------------
  const [activeTab, setActiveTab] = useState<string>('about');

  const [locations, setLocations] = useState<ParkingLocation[]>([]);
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // -----------------------------
  // Current user
  // -----------------------------
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const savedUser = localStorage.getItem('parkby_user');

    if (savedUser) {
      try {
        return JSON.parse(savedUser) as UserAccount;
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('parkby_user');
      }
    }

    return {
      // Matches the seeded demo user's id in the Neon `users` table
      // (see database/seed.sql). Bookings are saved against this id.
      id: '8a1f636a-f688-4192-a9f9-41113a61761b',
name: 'Keshav Gupta',
email: 'keshavgupt03@gmail.com',
      role: 'admin',
      phone: '+91-9876543210',
      wallet_balance: 500,
      auth_provider: 'google',
    };
  });

  // -----------------------------
  // Modal states
  // -----------------------------
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] =
    useState<boolean>(false);
  const [isQuickBookOpen, setIsQuickBookOpen] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isAddLocationSlotOpen, setIsAddLocationSlotOpen] =
    useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);

  // -----------------------------
  // Authentication
  // -----------------------------
  const handleUserAuthSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    localStorage.setItem('parkby_user', JSON.stringify(user));
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    setCurrentUser(null);
    localStorage.removeItem('parkby_user');
  };

  // -----------------------------
  // Fetch locations, slots,
  // and bookings
  // -----------------------------
  const fetchData = async () => {
    try {
      setIsLoading(true);

      const [locationsResponse, slotsResponse, bookingsResponse] =
        await Promise.all([
          fetch(`${API_BASE_URL}/api/locations`),
          fetch(`${API_BASE_URL}/api/slots`),
          fetch(`${API_BASE_URL}/api/bookings/my?user_id=${encodeURIComponent(currentUser?.id || 'usr-demo')}`)
        ]);

      if (locationsResponse.ok) {
        const locationsData = await locationsResponse.json();
        setLocations(locationsData);
      } else {
        console.error(
          'Failed to fetch locations:',
          locationsResponse.status
        );
      }

      if (slotsResponse.ok) {
        const slotsData = await slotsResponse.json();
        setSlots(slotsData);
      } else {
        console.error('Failed to fetch slots:', slotsResponse.status);
      }

      if (bookingsResponse.ok) {
        const bookingsData = await bookingsResponse.json();
        setBookings(bookingsData);
      } else {
        console.error(
          'Failed to fetch bookings:',
          bookingsResponse.status
        );
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // -----------------------------
  // Initial data load
  // -----------------------------
  useEffect(() => {
    fetchData();

    const interval = setInterval(() => {
      fetchData();
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // -----------------------------
  // Book parking slot
  // -----------------------------
const handleBookSlot = async (
  slotId: string,
  vehicleNo: string,
  duration: number
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slot_id: slotId,
        vehicle_number: vehicleNo,
        duration,
        user_id: currentUser?.id || 'usr-demo',
      }),
    });

    const data = await response.json();

    console.log('BOOKING RESPONSE:', response.status, data);

    if (!response.ok) {
      throw new Error(
        data.reason ||
          data.error ||
          'Failed to create booking'
      );
    }

    await fetchData();
  } catch (error) {
    console.error('Booking error:', error);
    throw error;
  }
};

    
  // -----------------------------
  // Extend booking
  // -----------------------------
  const handleExtendBooking = async (
    bookingId: string,
    hours: number
  ) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/bookings/extend/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            booking_id: bookingId,
            hours,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
  console.error('BOOKING API ERROR:', response.status, data);

  throw new Error(
    JSON.stringify(data)
  );
}

      await fetchData();
    } catch (error) {
      console.error('Extend booking error:', error);
      throw error;
    }
  };

  // -----------------------------
  // Cancel booking
  // -----------------------------
  const handleCancelBooking = async (bookingId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/bookings/cancel/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            booking_id: bookingId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.reason ||
            data.error ||
            'Failed to cancel booking'
        );
      }

      await fetchData();
    } catch (error) {
      console.error('Cancel booking error:', error);
      throw error;
    }
  };

  // -----------------------------
  // Active booking count
  // -----------------------------
  const activeBookingsCount = bookings.filter(
    (booking) => booking.status === 'active'
  ).length;

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-sans flex flex-col antialiased">

      {/* Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenChat={() => setIsChatOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenNotifications={() =>
          setIsNotificationsOpen(true)
        }
        onOpenQuickBook={() =>
          setIsQuickBookOpen(true)
        }
        onOpenAddLocationSlot={() =>
          setIsAddLocationSlotOpen(true)
        }
        activeBookingCount={activeBookingsCount}
      />

      {/* Main Content */}
      <main className="flex-grow py-6">

        {/* About */}
        {activeTab === 'about' && (
          <HeroSection
            onExploreClick={() =>
              setActiveTab('finder')
            }
            onOpenChat={() =>
              setIsChatOpen(true)
            }
          />
        )}

        {/* Parking Finder */}
        {activeTab === 'finder' && (
          <ParkingFinder
            locations={locations}
            slots={slots}
            onBookSlot={handleBookSlot}
            onOpenAddLocationSlot={() =>
              setIsAddLocationSlotOpen(true)
            }
            isLoading={isLoading}
          />
        )}

        {/* Active Bookings */}
        {activeTab === 'bookings' && (
          <ActiveBookings
            bookings={bookings}
            onExtendBooking={handleExtendBooking}
            onCancelBooking={handleCancelBooking}
          />
        )}

      </main>

      {/* About Page Chat */}
      {activeTab === 'about' && (
        <section className="max-w-4xl mx-auto px-4 w-full py-12">

          <div className="text-center mb-6">

            <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
              <Sparkles className="w-6 h-6 text-[#66daba]" />

              Interactive Smart Parking AI Assistant
            </h2>

            <p className="text-sm text-[#bccac3]">
              Ask questions about real-time slot availability,
              rates, or make instant reservations
            </p>

          </div>

          <ChatWidget
            isOpen={true}
            onBookingSuccess={fetchData}
          />

        </section>
      )}

      {/* Floating Chat Button */}
      {!isChatOpen && activeTab !== 'about' && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-50 bg-[#1a3d8f] hover:bg-[#254cb3] text-white p-4 rounded-full shadow-2xl flex items-center gap-2 font-bold text-sm uppercase tracking-wider transition-all hover:scale-105 border border-white/20"
        >
          <MessageSquare className="w-6 h-6 text-white" />

          <span className="hidden sm:inline">
            Ask Assistant
          </span>
        </button>
      )}

      {/* Floating Chat */}
      {isChatOpen && activeTab !== 'about' && (
        <ChatWidget
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          isFloating={true}
          onBookingSuccess={fetchData}
        />
      )}

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleUserAuthSuccess}
        onLogout={handleLogout}
        currentUser={currentUser}
      />

      {/* Add Location & Slot Modal */}
      <AddLocationSlotModal
        isOpen={isAddLocationSlotOpen}
        onClose={() =>
          setIsAddLocationSlotOpen(false)
        }
        locations={locations}
        onRefreshData={fetchData}
      />

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() =>
          setIsProfileOpen(false)
        }
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Notifications */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() =>
          setIsNotificationsOpen(false)
        }
        activeBookingCount={activeBookingsCount}
      />

      {/* Quick Book */}
      <QuickBookModal
        isOpen={isQuickBookOpen}
        onClose={() =>
          setIsQuickBookOpen(false)
        }
        slots={slots}
        onBookSlot={handleBookSlot}
      />
      {/* Footer */}
      <Footer />
    </div>
  );
}
