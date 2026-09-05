import React, { useState } from 'react';
import { MessageSquare, Car, MapPin, Clock, ShieldCheck, User, Bell, Menu, X, Plus, LogIn, Building2 } from 'lucide-react';
import { UserAccount } from '../types.js';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: UserAccount | null;
  onOpenAuth: () => void;
  onOpenChat: () => void;
  onOpenProfile: () => void;
  onOpenNotifications: () => void;
  onOpenQuickBook: () => void;
  onOpenAddLocationSlot: () => void;
  activeBookingCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onOpenAuth,
  onOpenChat,
  onOpenProfile,
  onOpenNotifications,
  onOpenQuickBook,
  onOpenAddLocationSlot,
  activeBookingCount
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-4 z-40 flex items-center justify-between w-full px-4 md:px-8 max-w-7xl mx-auto">
      <div className="bg-[#131b2e]/90 backdrop-blur-xl rounded-full px-6 py-3 border border-white/10 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] w-full flex items-center justify-between">
        <div className="flex items-center gap-8">
          <button onClick={() => setActiveTab('about')} className="flex items-center gap-2 font-headline-lg text-2xl font-bold text-[#66daba] hover:opacity-90 transition-opacity">
            <Car className="w-7 h-7 text-[#66daba]" />
            <span>ParkBy</span>
          </button>
          
          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={() => setActiveTab('finder')}
              className={`text-xs font-bold tracking-wider uppercase transition-all pb-1 ${
                activeTab === 'finder'
                  ? 'text-[#66daba] border-b-2 border-[#66daba]'
                  : 'text-[#bccac3] hover:text-[#66daba]'
              }`}
            >
              Parking Finder
            </button>
            
            <button
              onClick={() => setActiveTab('bookings')}
              className={`text-xs font-bold tracking-wider uppercase transition-all pb-1 flex items-center gap-1.5 ${
                activeTab === 'bookings'
                  ? 'text-[#66daba] border-b-2 border-[#66daba]'
                  : 'text-[#bccac3] hover:text-[#66daba]'
              }`}
            >
              My Bookings
              {activeBookingCount > 0 && (
                <span className="bg-[#66daba] text-[#00382c] text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {activeBookingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('about')}
              className={`text-xs font-bold tracking-wider uppercase transition-all pb-1 ${
                activeTab === 'about'
                  ? 'text-[#66daba] border-b-2 border-[#66daba]'
                  : 'text-[#bccac3] hover:text-[#66daba]'
              }`}
            >
              About Us
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Admin shortcut button */}
          <button
            onClick={onOpenAddLocationSlot}
            className="hidden xl:flex items-center gap-1 bg-[#171f33] border border-white/10 text-[#bccac3] hover:text-white px-3 py-2 rounded-full text-xs font-bold uppercase transition-colors"
            title="Add Location or Slot"
          >
            <Building2 className="w-4 h-4 text-[#66daba]" />
            <span>+ Location / Slot</span>
          </button>

          <button
            onClick={onOpenChat}
            className="flex items-center gap-2 bg-[#171f33] border border-[#66daba]/30 text-[#66daba] px-4 py-2 rounded-full hover:bg-[#66daba]/10 transition-colors text-xs font-bold tracking-wider uppercase"
          >
            <MessageSquare className="w-4 h-4 text-[#66daba]" />
            <span className="hidden sm:inline">AI Assistant</span>
          </button>

          <button
            onClick={onOpenNotifications}
            className="flex text-[#bccac3] hover:text-[#66daba] p-2 transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#66daba] rounded-full ring-2 ring-[#131b2e]"></span>
          </button>

          {/* User Sign In / Profile Button */}
          {currentUser ? (
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-2 text-[#bccac3] hover:text-[#66daba] p-1.5 transition-colors bg-[#171f33] rounded-full border border-white/10 pr-3"
              title="User Profile"
            >
              <div className="w-7 h-7 rounded-full bg-[#1a3d8f] text-[#66daba] flex items-center justify-center font-bold text-xs border border-white/20">
                {currentUser.name.substring(0, 2).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-white hidden lg:inline max-w-[100px] truncate">
                {currentUser.name.split(' ')[0]}
              </span>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 bg-[#171f33] hover:bg-[#222a3d] border border-white/10 text-white px-3.5 py-2 rounded-full text-xs font-bold uppercase transition-colors"
            >
              <LogIn className="w-4 h-4 text-[#66daba]" />
              <span className="hidden sm:inline">Sign In / Sign Up</span>
            </button>
          )}

          <button
            onClick={onOpenQuickBook}
            className="text-xs font-bold tracking-wider uppercase bg-[#66daba] text-[#00382c] px-5 py-2.5 rounded-full hover:bg-[#84f7d5] transition-colors"
          >
            Book Slot
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-[#bccac3] hover:text-white p-1"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-20 left-4 right-4 bg-[#131b2e] border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 z-50">
          <button
            onClick={() => { setActiveTab('finder'); setMobileMenuOpen(false); }}
            className="text-left text-sm font-bold uppercase text-white py-2 border-b border-white/5"
          >
            Parking Finder
          </button>
          <button
            onClick={() => { setActiveTab('bookings'); setMobileMenuOpen(false); }}
            className="text-left text-sm font-bold uppercase text-white py-2 border-b border-white/5 flex items-center justify-between"
          >
            <span>My Bookings</span>
            {activeBookingCount > 0 && (
              <span className="bg-[#66daba] text-[#00382c] text-[10px] px-2 py-0.5 rounded-full font-bold">
                {activeBookingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('about'); setMobileMenuOpen(false); }}
            className="text-left text-sm font-bold uppercase text-white py-2 border-b border-white/5"
          >
            About Us
          </button>

          <button
            onClick={() => { onOpenAddLocationSlot(); setMobileMenuOpen(false); }}
            className="text-left text-sm font-bold uppercase text-[#66daba] py-2 border-b border-white/5 flex items-center gap-2"
          >
            <Building2 className="w-4 h-4 text-[#66daba]" />
            <span>Add Location / Slot</span>
          </button>

          <div className="flex gap-2 pt-2">
            {currentUser ? (
              <button
                onClick={() => { onOpenProfile(); setMobileMenuOpen(false); }}
                className="flex-1 bg-[#171f33] text-white py-2.5 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-1.5"
              >
                <User className="w-4 h-4 text-[#66daba]" /> Profile ({currentUser.name.split(' ')[0]})
              </button>
            ) : (
              <button
                onClick={() => { onOpenAuth(); setMobileMenuOpen(false); }}
                className="flex-1 bg-[#66daba] text-[#00382c] py-2.5 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-1.5"
              >
                <LogIn className="w-4 h-4" /> Sign In / Sign Up
              </button>
            )}

            <button
              onClick={() => { onOpenNotifications(); setMobileMenuOpen(false); }}
              className="bg-[#171f33] text-white p-2.5 rounded-xl text-xs font-bold uppercase flex items-center justify-center"
            >
              <Bell className="w-4 h-4 text-[#66daba]" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

