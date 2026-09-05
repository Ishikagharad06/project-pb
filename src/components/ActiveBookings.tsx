import React, { useState, useEffect } from 'react';
import { Clock, Calendar, ShieldCheck, Plus, AlertCircle, CheckCircle2, Car } from 'lucide-react';
import { Booking } from '../types.js';

interface ActiveBookingsProps {
  bookings: Booking[];
  onExtendBooking: (bookingId: string, hours: number) => Promise<void>;
  onCancelBooking: (bookingId: string) => Promise<void>;
}

export const ActiveBookings: React.FC<ActiveBookingsProps> = ({
  bookings,
  onExtendBooking,
  onCancelBooking
}) => {
  const [now, setNow] = useState<Date>(new Date());
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatRemainingTime = (endTimeStr: string) => {
    const diff = new Date(endTimeStr).getTime() - now.getTime();
    if (diff <= 0) return '00:00:00 (Expired)';

    const hrs = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleExtend = async (id: string) => {
    try {
      await onExtendBooking(id, 1);
      setMsg('Booking extended by 1 hour!');
      setTimeout(() => setMsg(null), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await onCancelBooking(id);
      setMsg('Booking cancelled successfully.');
      setTimeout(() => setMsg(null), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  const activeList = bookings.filter(b => b.status === 'active');
  const pastList = bookings.filter(b => b.status !== 'active');

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#131b2e] p-6 rounded-2xl border border-white/10">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-[#66daba]" />
            My Active Bookings & Live Session Timers
          </h2>
          <p className="text-[#bccac3] text-sm mt-1">
            Track your parked sessions in real-time or extend your slot
          </p>
        </div>

        {msg && (
          <div className="bg-[#66daba]/20 border border-[#66daba] text-[#66daba] px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#66daba]" />
            {msg}
          </div>
        )}
      </div>

      {/* Active Sessions */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#66daba]">
          Active Parking Sessions ({activeList.length})
        </h3>

        {activeList.length === 0 ? (
          <div className="bg-[#131b2e]/60 rounded-2xl p-8 border border-white/10 text-center text-[#bccac3]">
            <Car className="w-12 h-12 text-[#222a3d] mx-auto mb-3" />
            <p className="font-semibold text-white">No active parking sessions</p>
            <p className="text-xs mt-1">Use the Parking Finder or ask the AI Assistant to book a slot!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeList.map(b => (
              <div key={b.id} className="bg-[#131b2e] border border-[#66daba]/40 rounded-2xl p-6 space-y-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-[#66daba] text-[#00382c] px-4 py-1 rounded-bl-xl text-xs font-black uppercase tracking-wider">
                  Active
                </div>

                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#bccac3]">
                    {b.parking_name}
                  </span>
                  <h4 className="text-3xl font-black text-white font-mono mt-1">
                    Slot {b.slot_number}
                  </h4>
                  <span className="inline-block mt-2 bg-[#222a3d] text-white text-xs font-mono px-3 py-1 rounded-lg border border-white/10">
                    Vehicle: {b.vehicle_number}
                  </span>
                </div>

                {/* Live Countdown */}
                <div className="bg-[#171f33] p-4 rounded-xl border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#bccac3] block">Remaining Time</span>
                    <span className="text-2xl font-black font-mono text-[#66daba]">
                      {formatRemainingTime(b.scheduled_end_time)}
                    </span>
                  </div>

                  <div className="text-right font-mono text-xs text-[#bccac3]">
                    <div>End: {new Date(b.scheduled_end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="text-white font-bold mt-1">Total: ₹{b.total_amount}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => handleExtend(b.id)}
                    className="flex-1 bg-[#66daba] text-[#00382c] font-bold text-xs uppercase py-3 rounded-xl hover:bg-[#84f7d5] transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Extend +1 Hr
                  </button>

                  <button
                    onClick={() => handleCancel(b.id)}
                    className="bg-[#222a3d] text-red-400 border border-red-500/20 font-bold text-xs uppercase px-4 py-3 rounded-xl hover:bg-red-500/10 transition-colors"
                  >
                    Cancel Session
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      {pastList.length > 0 && (
        <div className="space-y-4 pt-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#bccac3]">
            Past Booking History ({pastList.length})
          </h3>

          <div className="bg-[#131b2e]/60 rounded-2xl border border-white/10 overflow-hidden">
            <div className="divide-y divide-white/5">
              {pastList.map(b => (
                <div key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white font-mono">Slot {b.slot_number}</span>
                      <span className="text-xs text-[#bccac3]">({b.parking_name})</span>
                    </div>
                    <span className="text-xs text-[#bccac3] font-mono">Vehicle: {b.vehicle_number}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono text-[#bccac3]">₹{b.total_amount}</span>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      b.status === 'completed'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {b.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
