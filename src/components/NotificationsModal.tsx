import React from 'react';
import { X, Bell, Clock, AlertTriangle, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  type: 'info' | 'warning' | 'success';
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBookingCount: number;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  activeBookingCount
}) => {
  if (!isOpen) return null;

  const notifications: NotificationItem[] = [
    {
      id: 'n1',
      title: 'Active Parking Session',
      message: `You currently have ${activeBookingCount || 1} active parking slot session. Auto-reminder will alert you 10 minutes before expiry.`,
      time: '10m ago',
      unread: true,
      type: 'info'
    },
    {
      id: 'n2',
      title: 'Special Night Rate Discount',
      message: 'Basement Level B1 parking rate reduced to ₹15/hr for off-peak hours.',
      time: '1h ago',
      unread: true,
      type: 'success'
    },
    {
      id: 'n3',
      title: 'Booking Confirmed',
      message: 'Slot A1 at Gate 1 Plaza has been confirmed for vehicle MH12AB1234.',
      time: '2h ago',
      unread: false,
      type: 'success'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#131b2e] border border-white/20 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#66daba]" />
            <h3 className="text-lg font-bold text-white">Notifications & Alerts</h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg text-[#bccac3] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`p-4 rounded-xl border transition-all ${
                n.unread
                  ? 'bg-[#171f33] border-[#66daba]/30'
                  : 'bg-[#131b2e]/60 border-white/5 opacity-80'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  {n.type === 'info' && <Clock className="w-4 h-4 text-[#66daba]" />}
                  {n.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {n.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                  <h4 className="text-sm font-bold text-white">{n.title}</h4>
                </div>
                <span className="text-[10px] text-[#bccac3] font-mono shrink-0">{n.time}</span>
              </div>
              <p className="text-xs text-[#bccac3] leading-relaxed pl-6">{n.message}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-between items-center border-t border-white/10">
          <span className="text-xs text-[#bccac3]">3 Total Notifications</span>
          <button
            onClick={onClose}
            className="bg-[#222a3d] text-white font-bold text-xs uppercase px-5 py-2 rounded-xl hover:bg-[#2e3952]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
