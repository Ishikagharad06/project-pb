import React, { useState } from 'react';
import { X, Car, CheckCircle2, Zap } from 'lucide-react';
import { ParkingSlot } from '../types.js';

interface QuickBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  slots: ParkingSlot[];
  onBookSlot: (slotId: string, vehicleNo: string, duration: number) => Promise<void>;
}

export const QuickBookModal: React.FC<QuickBookModalProps> = ({
  isOpen,
  onClose,
  slots,
  onBookSlot
}) => {
  const availableSlots = slots.filter(s => s.status === 'available');
  const [selectedSlotId, setSelectedSlotId] = useState<string>(availableSlots[0]?.id || '');
  const [vehicleNo, setVehicleNo] = useState<string>('MH12AB1234');
  const [duration, setDuration] = useState<number>(2);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentSlot = slots.find(s => s.id === selectedSlotId) || availableSlots[0];

  const handleConfirm = async () => {
    if (!currentSlot) return;
    try {
      setIsSubmitting(true);
      await onBookSlot(currentSlot.id, vehicleNo, duration);
      setSuccessMsg(`Successfully booked Slot ${currentSlot.slot_number}!`);
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#131b2e] border border-white/20 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Car className="w-5 h-5 text-[#66daba]" />
            <h3 className="text-lg font-bold text-white">Instant Parking Reservation</h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg text-[#bccac3] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMsg ? (
          <div className="bg-[#66daba]/20 border border-[#66daba] text-[#66daba] p-6 rounded-2xl text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-[#66daba] mx-auto animate-bounce" />
            <h4 className="font-bold text-lg text-white">{successMsg}</h4>
            <p className="text-xs text-[#bccac3]">Redirecting to active bookings...</p>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            {/* Slot selector */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#bccac3] mb-1.5">
                Select Available Parking Spot
              </label>
              <select
                value={selectedSlotId}
                onChange={e => setSelectedSlotId(e.target.value)}
                className="w-full bg-[#222a3d] border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono font-semibold focus:outline-none focus:border-[#66daba]"
              >
                {availableSlots.map(s => (
                  <option key={s.id} value={s.id}>
                    Slot {s.slot_number} — {s.parking_name || s.location_name} (₹{s.price_per_hr}/hr)
                  </option>
                ))}
              </select>
            </div>

            {/* Vehicle Number */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#bccac3] mb-1.5">
                Vehicle Registration Number
              </label>
              <input
                type="text"
                value={vehicleNo}
                onChange={e => setVehicleNo(e.target.value.toUpperCase())}
                placeholder="e.g. MH12AB1234"
                className="w-full bg-[#222a3d] border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono uppercase font-semibold focus:outline-none focus:border-[#66daba]"
              />
            </div>

            {/* Duration Selector */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#bccac3] mb-1.5">
                Duration (Hours)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 4, 8].map(hrs => (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => setDuration(hrs)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      duration === hrs
                        ? 'bg-[#66daba] text-[#00382c] border-[#66daba]'
                        : 'bg-[#222a3d] text-[#bccac3] border-white/10 hover:text-white'
                    }`}
                  >
                    {hrs} {hrs === 1 ? 'hr' : 'hrs'}
                  </button>
                ))}
              </div>
            </div>

            {/* Calculation */}
            {currentSlot && (
              <div className="bg-[#171f33] p-4 rounded-xl flex items-center justify-between border border-white/10">
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#bccac3] block">Rate</span>
                  <span className="text-white font-mono font-bold">₹{currentSlot.price_per_hr}/hr</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-[#bccac3] block">Total Amount</span>
                  <span className="text-2xl font-black text-[#66daba] font-mono">
                    ₹{currentSlot.price_per_hr * duration}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-[#222a3d] text-[#bccac3] font-bold text-xs uppercase py-3 rounded-xl hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting || !currentSlot}
                className="flex-1 bg-[#66daba] text-[#00382c] font-bold text-xs uppercase py-3 rounded-xl hover:bg-[#84f7d5] transition-colors disabled:opacity-50"
              >
                Confirm Booking
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
