import React, { useState } from 'react';
import { X, MapPin, Car, Plus, CheckCircle2, Sparkles, Building2, Grid } from 'lucide-react';
import { ParkingLocation, SlotType } from '../types.js';
import { API_BASE_URL } from '../apiConfig.js';

interface AddLocationSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: ParkingLocation[];
  onRefreshData: () => Promise<void>;
}

export const AddLocationSlotModal: React.FC<AddLocationSlotModalProps> = ({
  isOpen,
  onClose,
  locations,
  onRefreshData
}) => {
  const [activeTab, setActiveTab] = useState<'location' | 'slot'>('location');

  // Location Form State
  const [locName, setLocName] = useState<string>('');
  const [locAddress, setLocAddress] = useState<string>('');
  const [locCity, setLocCity] = useState<string>('Metro City');
  const [locTotalSlots, setLocTotalSlots] = useState<number>(20);

  // Slot Form State
  const [selectedLocId, setSelectedLocId] = useState<string>(locations[0]?.id || '');
  const [slotNumber, setSlotNumber] = useState<string>('');
  const [slotType, setSlotType] = useState<SlotType>('regular');
  const [slotPrice, setSlotPrice] = useState<number>(20);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!locName.trim() || !locAddress.trim()) {
      setErrorMsg('Please enter both location name and address.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/locations/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: locName.trim(),
          address: locAddress.trim(),
          city: locCity.trim(),
          total_slots: locTotalSlots
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.reason || 'Failed to add location');
      }

      setSuccessMsg(`Successfully added new location: "${data.location.name}"!`);
      await onRefreshData();

      setLocName('');
      setLocAddress('');

      setTimeout(() => {
        setSuccessMsg(null);
      }, 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating location.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const targetLoc = selectedLocId || locations[0]?.id;

    if (!targetLoc) {
      setErrorMsg('Please select a valid location first.');
      return;
    }

    if (!slotNumber.trim()) {
      setErrorMsg('Please specify a slot number (e.g. D1, EV-2).');
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/slots/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parking_id: targetLoc,
          slot_number: slotNumber.trim().toUpperCase(),
          slot_type: slotType,
          price_per_hr: slotPrice
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.reason || 'Failed to add slot');
      }

      setSuccessMsg(`Successfully added new Slot "${data.slot.slot_number}"!`);
      await onRefreshData();

      setSlotNumber('');

      setTimeout(() => {
        setSuccessMsg(null);
      }, 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating slot.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#131b2e] border border-white/20 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl relative my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#1a3d8f] rounded-xl text-[#66daba]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Parking Management</h3>
              <p className="text-xs text-[#bccac3]">Add new parking locations & slots to the network</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg text-[#bccac3] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 bg-[#0b1326] p-1.5 rounded-xl border border-white/10">
          <button
            onClick={() => { setActiveTab('location'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 rounded-lg text-xs font-bold uppercase transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'location'
                ? 'bg-[#1a3d8f] text-white shadow-md'
                : 'text-[#bccac3] hover:text-white'
            }`}
          >
            <MapPin className="w-4 h-4 text-[#66daba]" /> Add Location
          </button>

          <button
            onClick={() => { setActiveTab('slot'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 rounded-lg text-xs font-bold uppercase transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'slot'
                ? 'bg-[#1a3d8f] text-white shadow-md'
                : 'text-[#bccac3] hover:text-white'
            }`}
          >
            <Grid className="w-4 h-4 text-[#66daba]" /> Add Slot
          </button>
        </div>

        {/* Alert Messages */}
        {successMsg && (
          <div className="bg-[#66daba]/20 border border-[#66daba] text-[#66daba] p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-pulse">
            <CheckCircle2 className="w-4 h-4 text-[#66daba] shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-300 p-3 rounded-xl text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Form 1: Add Location */}
        {activeTab === 'location' && (
          <form onSubmit={handleCreateLocation} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-[#bccac3] mb-1">
                Location / Facility Name
              </label>
              <input
                type="text"
                required
                value={locName}
                onChange={e => setLocName(e.target.value)}
                placeholder="e.g. Airport Terminal 3 Plaza"
                className="w-full bg-[#0b1326] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#66daba]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#bccac3] mb-1">
                Street Address & Area
              </label>
              <input
                type="text"
                required
                value={locAddress}
                onChange={e => setLocAddress(e.target.value)}
                placeholder="e.g. Sector 18, Main Expressway"
                className="w-full bg-[#0b1326] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#66daba]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-[#bccac3] mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={locCity}
                  onChange={e => setLocCity(e.target.value)}
                  className="w-full bg-[#0b1326] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#bccac3] mb-1">
                  Slot Capacity
                </label>
                <input
                  type="number"
                  min="1"
                  value={locTotalSlots}
                  onChange={e => setLocTotalSlots(Number(e.target.value))}
                  className="w-full bg-[#0b1326] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#66daba] text-[#00382c] font-bold text-sm uppercase py-3 rounded-xl hover:bg-[#84f7d5] transition-colors disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
            >
              {isLoading ? <Sparkles className="w-4 h-4 animate-spin text-[#00382c]" /> : <Plus className="w-4 h-4" />}
              Create Location
            </button>
          </form>
        )}

        {/* Form 2: Add Slot */}
        {activeTab === 'slot' && (
          <form onSubmit={handleCreateSlot} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-[#bccac3] mb-1">
                Select Parking Location
              </label>
              <select
                value={selectedLocId || (locations[0]?.id || '')}
                onChange={e => setSelectedLocId(e.target.value)}
                className="w-full bg-[#0b1326] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-semibold focus:outline-none focus:border-[#66daba]"
              >
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.address})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#bccac3] mb-1">
                Slot Identifier / Number
              </label>
              <input
                type="text"
                required
                value={slotNumber}
                onChange={e => setSlotNumber(e.target.value.toUpperCase())}
                placeholder="e.g. D1, D2, EV-1"
                className="w-full bg-[#0b1326] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono uppercase focus:outline-none focus:border-[#66daba]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#bccac3] mb-1">
                Slot Category / Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSlotType('regular')}
                  className={`py-2 rounded-xl text-xs font-bold border ${
                    slotType === 'regular'
                      ? 'bg-[#66daba] text-[#00382c] border-[#66daba]'
                      : 'bg-[#171f33] text-[#bccac3] border-white/10'
                  }`}
                >
                  Regular
                </button>
                <button
                  type="button"
                  onClick={() => setSlotType('ev')}
                  className={`py-2 rounded-xl text-xs font-bold border ${
                    slotType === 'ev'
                      ? 'bg-[#66daba] text-[#00382c] border-[#66daba]'
                      : 'bg-[#171f33] text-[#bccac3] border-white/10'
                  }`}
                >
                  EV Charger
                </button>
                <button
                  type="button"
                  onClick={() => setSlotType('disabled')}
                  className={`py-2 rounded-xl text-xs font-bold border ${
                    slotType === 'disabled'
                      ? 'bg-[#66daba] text-[#00382c] border-[#66daba]'
                      : 'bg-[#171f33] text-[#bccac3] border-white/10'
                  }`}
                >
                  Accessible
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#bccac3] mb-1">
                Hourly Rate (₹/hr)
              </label>
              <input
                type="number"
                min="5"
                step="5"
                value={slotPrice}
                onChange={e => setSlotPrice(Number(e.target.value))}
                className="w-full bg-[#0b1326] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-[#66daba]"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#66daba] text-[#00382c] font-bold text-sm uppercase py-3 rounded-xl hover:bg-[#84f7d5] transition-colors disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
            >
              {isLoading ? <Sparkles className="w-4 h-4 animate-spin text-[#00382c]" /> : <Plus className="w-4 h-4" />}
              Create Slot
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
