import React, { useState } from 'react';
import { X, User, Car, Wallet, Shield, Plus, CheckCircle2, Award, LogOut, Mail } from 'lucide-react';
import { UserAccount, Vehicle } from '../types.js';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  onLogout: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogout
}) => {
  const [walletBalance, setWalletBalance] = useState<number>(currentUser?.wallet_balance || 500);
  const [addAmount, setAddAmount] = useState<string>('200');
  const [showAddMoney, setShowAddMoney] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [vehicles, setVehicles] = useState<Vehicle[]>([
    { id: 'veh-1', user_id: currentUser?.id || 'user-demo', registration_number: 'MH12AB1234', vehicle_type: 'car', model: 'Honda City', color: 'Pearl White' },
    { id: 'veh-2', user_id: currentUser?.id || 'user-demo', registration_number: 'MH12EV9999', vehicle_type: 'ev', model: 'Tata Nexon EV', color: 'Teal Blue' }
  ]);

  const [newRegNo, setNewRegNo] = useState<string>('');
  const [newModel, setNewModel] = useState<string>('');
  const [showAddVehicle, setShowAddVehicle] = useState<boolean>(false);

  if (!isOpen) return null;

  const userInitial = (currentUser?.name || 'KG').substring(0, 2).toUpperCase();

  const handleAddMoney = () => {
    const val = parseFloat(addAmount);
    if (!isNaN(val) && val > 0) {
      setWalletBalance(prev => prev + val);
      setSuccessMsg(`Successfully added ₹${val} to your ParkBy Wallet!`);
      setShowAddMoney(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleAddVehicle = () => {
    if (newRegNo.trim()) {
      const newVeh: Vehicle = {
        id: 'veh-' + Date.now(),
        user_id: currentUser?.id || 'user-demo',
        registration_number: newRegNo.toUpperCase().trim(),
        vehicle_type: 'car',
        model: newModel.trim() || 'Vehicle',
        color: 'Silver'
      };
      setVehicles(prev => [...prev, newVeh]);
      setNewRegNo('');
      setNewModel('');
      setShowAddVehicle(false);
      setSuccessMsg(`Added vehicle ${newVeh.registration_number}!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleLogoutClick = () => {
    onLogout();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#131b2e] border border-white/20 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            {currentUser?.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt={currentUser.name}
                className="w-12 h-12 rounded-full border border-white/20 bg-[#1a3d8f] object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#1a3d8f] flex items-center justify-center text-[#66daba] border border-white/20 text-xl font-bold">
                {userInitial}
              </div>
            )}
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">
                {currentUser?.name || 'Keshav Gupta'}
              </h3>
              <p className="text-xs text-[#bccac3] flex items-center gap-1">
                <span>{currentUser?.email || 'keshavgupta5060@gmail.com'}</span>
                <span>•</span>
                <span className="text-[#66daba] font-semibold capitalize">{currentUser?.role || 'User'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg text-[#bccac3] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMsg && (
          <div className="bg-[#66daba]/20 border border-[#66daba] text-[#66daba] px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-pulse">
            <CheckCircle2 className="w-4 h-4 text-[#66daba]" />
            {successMsg}
          </div>
        )}

        {/* Wallet Balance Card */}
        <div className="bg-gradient-to-r from-[#171f33] to-[#1a294d] p-5 rounded-2xl border border-white/10 space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#bccac3]">
              <Wallet className="w-4 h-4 text-[#66daba]" />
              ParkBy Wallet Balance
            </div>
            <button
              onClick={() => setShowAddMoney(!showAddMoney)}
              className="text-xs bg-[#66daba] text-[#00382c] font-bold px-3 py-1.5 rounded-lg hover:bg-[#84f7d5] transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Money
            </button>
          </div>

          <div className="text-3xl font-black font-mono text-white">
            ₹{(currentUser?.wallet_balance ?? walletBalance).toFixed(2)}
          </div>

          {showAddMoney && (
            <div className="pt-3 border-t border-white/10 flex items-center gap-2">
              <input
                type="number"
                value={addAmount}
                onChange={e => setAddAmount(e.target.value)}
                placeholder="Amount (₹)"
                className="bg-[#0b1326] border border-white/10 rounded-xl px-3 py-1.5 text-sm font-mono text-white w-32 focus:outline-none focus:border-[#66daba]"
              />
              <button
                onClick={handleAddMoney}
                className="bg-[#1a3d8f] text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-[#254cb3]"
              >
                Pay Now
              </button>
            </div>
          )}
        </div>

        {/* Registered Vehicles */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#bccac3] flex items-center gap-1.5">
              <Car className="w-4 h-4 text-[#66daba]" />
              Saved Vehicles ({vehicles.length})
            </h4>
            <button
              onClick={() => setShowAddVehicle(!showAddVehicle)}
              className="text-xs text-[#66daba] font-bold hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Vehicle
            </button>
          </div>

          {showAddVehicle && (
            <div className="bg-[#171f33] p-3 rounded-xl border border-white/10 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Reg No (e.g. MH12CD5678)"
                  value={newRegNo}
                  onChange={e => setNewRegNo(e.target.value)}
                  className="bg-[#0b1326] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white uppercase font-mono"
                />
                <input
                  type="text"
                  placeholder="Model (e.g. Hyundai Creta)"
                  value={newModel}
                  onChange={e => setNewModel(e.target.value)}
                  className="bg-[#0b1326] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>
              <button
                onClick={handleAddVehicle}
                className="w-full bg-[#66daba] text-[#00382c] font-bold text-xs py-1.5 rounded-lg hover:bg-[#84f7d5]"
              >
                Save Vehicle
              </button>
            </div>
          )}

          <div className="space-y-2">
            {vehicles.map(v => (
              <div key={v.id} className="bg-[#171f33] p-3 rounded-xl border border-white/5 flex items-center justify-between">
                <div>
                  <div className="font-mono font-bold text-white text-sm">{v.registration_number}</div>
                  <div className="text-xs text-[#bccac3]">{v.model} ({v.color})</div>
                </div>
                <span className="text-[10px] font-bold uppercase bg-[#222a3d] text-[#66daba] px-2.5 py-1 rounded-full border border-white/10">
                  {v.vehicle_type}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* User Stats */}
        <div className="grid grid-cols-3 gap-3 text-center bg-[#171f33] p-3 rounded-xl border border-white/10">
          <div>
            <span className="text-lg font-bold text-white font-mono">12</span>
            <span className="text-[10px] font-bold uppercase text-[#bccac3] block">Bookings</span>
          </div>
          <div>
            <span className="text-lg font-bold text-[#66daba] font-mono">4.9 ★</span>
            <span className="text-[10px] font-bold uppercase text-[#bccac3] block">Driver Score</span>
          </div>
          <div>
            <span className="text-lg font-bold text-amber-400 font-mono">150</span>
            <span className="text-[10px] font-bold uppercase text-[#bccac3] block">Rewards Pts</span>
          </div>
        </div>

        {/* Footer actions: Logout & Close */}
        <div className="pt-2 flex items-center justify-between border-t border-white/10">
          <button
            onClick={handleLogoutClick}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 font-bold text-xs uppercase px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out / Logout</span>
          </button>

          <button
            onClick={onClose}
            className="bg-[#222a3d] text-white font-bold text-xs uppercase px-6 py-2.5 rounded-xl hover:bg-[#2e3952]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
