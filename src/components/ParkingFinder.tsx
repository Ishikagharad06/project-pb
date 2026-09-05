import React, { useState } from 'react';
import { MapPin, Zap, CheckCircle2, XCircle, Clock, Car, Filter, ShieldCheck, Plus, Building2 } from 'lucide-react';
import { ParkingLocation, ParkingSlot } from '../types.js';

interface ParkingFinderProps {
  locations: ParkingLocation[];
  slots: ParkingSlot[];
  onBookSlot: (slotId: string, vehicleNo: string, duration: number, paymentMethod?: string) => Promise<void>;
  onOpenAddLocationSlot?: () => void;
  isLoading: boolean;
}

export const ParkingFinder: React.FC<ParkingFinderProps> = ({
  locations,
  slots,
  onBookSlot,
  onOpenAddLocationSlot,
  isLoading
}) => {
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [bookingSlot, setBookingSlot] = useState<ParkingSlot | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState<string>('MH12AB1234');
  const [durationHours, setDurationHours] = useState<number>(2);
  const [paymentMethod, setPaymentMethod] = useState<string>('upi');
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<string | null>(null);

  const filteredSlots = slots.filter(s => {
    const matchesLoc =
      selectedLocation === 'all' ||
      s.parking_id === selectedLocation ||
      (s.location_name && s.location_name.toLowerCase().includes(selectedLocation.toLowerCase()));

    const matchesType = selectedType === 'all' || s.slot_type === selectedType;

    return matchesLoc && matchesType;
  });

  const handleConfirmBooking = async () => {
    if (!bookingSlot) return;
    try {
      await onBookSlot(bookingSlot.id, vehicleNumber, durationHours);
      setBookingSuccessMsg(`Successfully reserved Slot ${bookingSlot.slot_number} at ${bookingSlot.parking_name || bookingSlot.location_name}!`);
      setBookingSlot(null);
      setTimeout(() => setBookingSuccessMsg(null), 5000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 w-full flex flex-col gap-8">
      {/* Title & Stats Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#131b2e] p-6 rounded-2xl border border-white/10">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-[#66daba]" />
            Live Parking Slot Finder
          </h2>
          <p className="text-[#bccac3] text-sm mt-1">
            Real-time vacancy tracking and instant spot reservation
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onOpenAddLocationSlot && (
            <button
              onClick={onOpenAddLocationSlot}
              className="bg-[#1a3d8f] hover:bg-[#254cb3] text-white text-xs font-bold uppercase px-4 py-2.5 rounded-xl border border-white/10 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-[#66daba]" />
              <span>Add Location / Slot</span>
            </button>
          )}

          {bookingSuccessMsg && (
            <div className="bg-[#66daba]/20 border border-[#66daba] text-[#66daba] px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 animate-pulse">
              <CheckCircle2 className="w-5 h-5 text-[#66daba]" />
              {bookingSuccessMsg}
            </div>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#171f33] p-4 rounded-xl border border-white/10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-[#bccac3] mr-2">
            <Filter className="w-4 h-4 text-[#66daba]" />
            Location:
          </div>
          <button
            onClick={() => setSelectedLocation('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              selectedLocation === 'all'
                ? 'bg-[#66daba] text-[#00382c]'
                : 'bg-[#222a3d] text-[#bccac3] hover:text-white'
            }`}
          >
            All Locations
          </button>
          {locations.map(loc => (
            <button
              key={loc.id}
              onClick={() => setSelectedLocation(loc.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                selectedLocation === loc.id
                  ? 'bg-[#66daba] text-[#00382c]'
                  : 'bg-[#222a3d] text-[#bccac3] hover:text-white'
              }`}
            >
              {loc.name} ({loc.available_slots_count} free)
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#bccac3] uppercase">Type:</span>
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="bg-[#222a3d] text-white border border-white/10 text-xs rounded-lg px-3 py-1.5 font-bold focus:outline-none focus:border-[#66daba]"
          >
            <option value="all">All Types</option>
            <option value="regular">Regular</option>
            <option value="ev">EV Charging</option>
            <option value="disabled">Disabled Access</option>
          </select>
        </div>
      </div>

      {/* Slot Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSlots.map(slot => {
          const isFree = slot.status === 'available';
          return (
            <div
              key={slot.id}
              className={`rounded-2xl p-6 border transition-all flex flex-col justify-between gap-4 ${
                isFree
                  ? 'bg-[#131b2e]/80 border-white/10 hover:border-[#66daba]/50 hover:shadow-lg hover:shadow-[#66daba]/10'
                  : 'bg-[#131b2e]/40 border-white/5 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-[#bccac3] uppercase tracking-wider">
                    {slot.parking_name || slot.location_name || 'Parking Spot'}
                  </span>
                  <h3 className="text-2xl font-black text-white font-mono mt-0.5">
                    Slot {slot.slot_number}
                  </h3>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isFree
                      ? 'bg-[#66daba]/20 text-[#66daba] border border-[#66daba]/40'
                      : 'bg-red-500/20 text-red-400 border border-red-500/40'
                  }`}
                >
                  {isFree ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Vacant
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" /> Occupied
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-[#bccac3] bg-[#171f33] p-3 rounded-xl border border-white/5">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="capitalize font-semibold">{slot.slot_type}</span>
                </div>
                <div className="font-mono text-white font-bold text-sm">
                  ₹{slot.price_per_hr} <span className="text-[10px] text-[#bccac3]">/ hr</span>
                </div>
              </div>

              {isFree ? (
                <button
                  onClick={() => setBookingSlot(slot)}
                  className="w-full bg-[#66daba] text-[#00382c] font-bold text-xs uppercase tracking-wider py-3 rounded-xl hover:bg-[#84f7d5] transition-colors flex items-center justify-center gap-2"
                >
                  <Car className="w-4 h-4" />
                  Book Now
                </button>
              ) : (
                <button
                  disabled
                  className="w-full bg-[#222a3d] text-[#bccac3] font-bold text-xs uppercase tracking-wider py-3 rounded-xl cursor-not-allowed opacity-60"
                >
                  Currently Occupied
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Instant Booking Modal */}
      {bookingSlot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#131b2e] border border-white/20 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Car className="w-5 h-5 text-[#66daba]" />
                Book Slot {bookingSlot.slot_number}
              </h3>
              <button
                onClick={() => setBookingSlot(null)}
                className="text-[#bccac3] hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="bg-[#171f33] p-4 rounded-xl border border-white/5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#bccac3]">Location:</span>
                  <span className="text-white font-semibold">{bookingSlot.parking_name || bookingSlot.location_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#bccac3]">Slot Type:</span>
                  <span className="text-white font-semibold uppercase">{bookingSlot.slot_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#bccac3]">Hourly Rate:</span>
                  <span className="text-[#66daba] font-mono font-bold">₹{bookingSlot.price_per_hr}/hr</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#bccac3] mb-1.5">
                  Vehicle Registration Number
                </label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. MH12AB1234"
                  className="w-full bg-[#222a3d] border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono uppercase font-semibold focus:outline-none focus:border-[#66daba]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#bccac3] mb-1.5">
                  Duration (Hours)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 4, 8].map(hrs => (
                    <button
                      key={hrs}
                      type="button"
                      onClick={() => setDurationHours(hrs)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        durationHours === hrs
                          ? 'bg-[#66daba] text-[#00382c] border-[#66daba]'
                          : 'bg-[#222a3d] text-[#bccac3] border-white/10 hover:text-white'
                      }`}
                    >
                      {hrs} {hrs === 1 ? 'hr' : 'hrs'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#222a3d] p-4 rounded-xl flex items-center justify-between border border-white/10">
                <span className="text-xs font-bold uppercase text-[#bccac3]">Total Price:</span>
                <span className="text-2xl font-black text-[#66daba] font-mono">
                  ₹{bookingSlot.price_per_hr * durationHours}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBookingSlot(null)}
                className="flex-1 bg-[#222a3d] text-[#bccac3] font-bold text-xs uppercase py-3 rounded-xl hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBooking}
                disabled={isLoading}
                className="flex-1 bg-[#66daba] text-[#00382c] font-bold text-xs uppercase py-3 rounded-xl hover:bg-[#84f7d5] transition-colors"
              >
                Confirm & Pay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
