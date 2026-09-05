import React from 'react';
import { Car, Globe, Share2 } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#060e20] w-full pt-16 pb-8 border-t border-white/10 mt-auto">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 px-4 md:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 font-headline-lg text-2xl font-bold text-[#66daba]">
            <Car className="w-7 h-7 text-[#66daba]" />
            <span>ParkBy</span>
          </div>
          <p className="text-sm text-[#bccac3]">
            © {new Date().getFullYear()} ParkBy Technologies. All rights reserved. Smart parking microservice & AI assistant.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#bccac3]">Platform</span>
          <a href="#" className="text-sm text-[#bccac3] hover:text-[#66daba] transition-colors">
            Terms of Service
          </a>
          <a href="#" className="text-sm text-[#bccac3] hover:text-[#66daba] transition-colors">
            Privacy Policy
          </a>
          <a href="#" className="text-sm text-[#bccac3] hover:text-[#66daba] transition-colors">
            API Documentation
          </a>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#bccac3]">Support</span>
          <a href="#" className="text-sm text-[#bccac3] hover:text-[#66daba] transition-colors">
            Help Center
          </a>
          <a href="#" className="text-sm text-[#bccac3] hover:text-[#66daba] transition-colors">
            Contact Support
          </a>
          <a href="#" className="text-sm text-[#bccac3] hover:text-[#66daba] transition-colors">
            FAQ
          </a>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#bccac3]">Connect</span>
          <div className="flex gap-4">
            <a href="#" className="text-[#bccac3] hover:text-[#66daba] transition-colors">
              <Globe className="w-5 h-5" />
            </a>
            <a href="#" className="text-[#bccac3] hover:text-[#66daba] transition-colors">
              <Share2 className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
