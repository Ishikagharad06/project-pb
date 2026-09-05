import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles, X, Minimize2, Maximize2, Car, MapPin, Zap } from 'lucide-react';
import { ChatMessage } from '../types.js';
import { API_BASE_URL } from '../apiConfig.js';

interface ChatWidgetProps {
  isOpen: boolean;
  onClose?: () => void;
  isFloating?: boolean;
  onBookingSuccess?: () => void;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  isOpen,
  onClose,
  isFloating = false,
  onBookingSuccess
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-init',
      conversation_id: 'session-default',
      sender: 'ai',
      message: 'Hi! 👋 Ask me about parking availability, rates, or instant bookings.',
      created_at: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    'Any vacant spots near Gate 1?',
    'Book slot A2',
    'What are the parking rates?',
    'How do I cancel a booking?'
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      conversation_id: 'session-default',
      sender: 'user',
      message: text,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: 'session-default' })
      });

      const data = await res.json();

      const aiMsg: ChatMessage = {
        id: 'ai-' + Date.now(),
        conversation_id: 'session-default',
        sender: 'ai',
        message: data.reply || 'Sorry, I could not process that request.',
        created_at: new Date().toISOString(),
        intent: data.intent,
        data: data.data
      };

      setMessages(prev => [...prev, aiMsg]);

      if (data.intent === 'booking' && data.data?.booking_result?.success && onBookingSuccess) {
        onBookingSuccess();
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          conversation_id: 'session-default',
          sender: 'ai',
          message: '⚠️ Could not reach chatbot server. Is it running?',
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const containerClasses = isFloating
    ? `fixed bottom-6 right-6 z-50 bg-[#131b2e] border border-white/20 rounded-2xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.8)] overflow-hidden transition-all duration-300 flex flex-col ${
        isExpanded ? 'w-[90vw] md:w-[600px] h-[700px]' : 'w-[380px] h-[540px]'
      }`
    : 'w-full max-w-2xl mx-auto bg-[#131b2e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[600px]';

  return (
    <div className={containerClasses}>
      {/* Header matching test_widget.html color #1a3d8f */}
      <div className="bg-[#1a3d8f] text-white px-5 py-3.5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🅿️</span>
          <div>
            <h3 className="font-bold text-sm tracking-wide leading-tight">Smart Parking Assistant</h3>
            <span className="text-[10px] text-emerald-300 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Online • AI Powered
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isFloating && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-white/10 rounded text-white/80 transition-colors"
              title={isExpanded ? 'Minimize' : 'Expand'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded text-white/80 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#0b1326]">
        {messages.map((m, idx) => {
          const isUser = m.sender === 'user';
          return (
            <div key={m.id || idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-[#1a3d8f] text-white rounded-br-xs font-medium shadow-md'
                    : 'bg-[#171f33] text-[#dae2fd] border border-white/10 rounded-bl-xs shadow-md'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.message}</div>

                {/* Render slot cards inside message if availability data returned */}
                {m.data?.slots && m.data.slots.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-white/10 pt-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#66daba] block">
                      Live Available Slots:
                    </span>
                    <div className="grid grid-cols-1 gap-1.5">
                      {m.data.slots.map((s: any) => (
                        <div key={s.id} className="bg-[#222a3d] p-2 rounded-lg flex items-center justify-between text-xs">
                          <span className="font-bold text-white font-mono">Slot {s.slot_number} ({s.location_name || s.parking_name})</span>
                          <button
                            onClick={() => handleSend(`Book slot ${s.slot_number}`)}
                            className="bg-[#66daba] text-[#00382c] px-2.5 py-0.5 rounded font-bold text-[10px] uppercase hover:bg-[#84f7d5]"
                          >
                            Book
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <span className="text-[10px] text-[#86948e] mt-1 px-1">
                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-[#bccac3] bg-[#171f33] p-3 rounded-2xl border border-white/10 w-fit">
            <Sparkles className="w-4 h-4 text-[#66daba] animate-spin" />
            <span>Assistant is thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="bg-[#131b2e] px-3 py-2 border-t border-white/5 overflow-x-auto flex gap-2 no-scrollbar">
        {quickPrompts.map((qp, i) => (
          <button
            key={i}
            onClick={() => handleSend(qp)}
            className="shrink-0 bg-[#171f33] hover:bg-[#222a3d] text-[#bccac3] hover:text-[#66daba] border border-white/10 text-[11px] font-medium px-3 py-1 rounded-full transition-colors whitespace-nowrap"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Input Row matching test_widget.html */}
      <div className="p-3 bg-[#131b2e] border-t border-white/10 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask about parking..."
          className="flex-1 bg-[#0b1326] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#86948e] focus:outline-none focus:border-[#1a3d8f]"
        />

        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          className="bg-[#1a3d8f] hover:bg-[#254cb3] text-white p-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
