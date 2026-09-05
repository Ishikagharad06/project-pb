import React from 'react';
import { ArrowRight, Zap, Shield, Leaf } from 'lucide-react';

interface HeroSectionProps {
  onExploreClick: () => void;
  onOpenChat: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onExploreClick, onOpenChat }) => {
  return (
    <div className="flex flex-col items-center w-full px-4 md:px-8 py-12 gap-20">
      {/* Hero Section */}
      <section className="max-w-5xl w-full flex flex-col items-center text-center mt-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#171f33] border border-[#66daba]/30 text-[#66daba] text-xs font-bold tracking-wider uppercase mb-6">
          <span className="w-2 h-2 rounded-full bg-[#66daba] animate-pulse"></span>
          Intelligent Parking Infrastructure
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 max-w-4xl leading-tight">
          Redefining Urban Mobility Through{' '}
          <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-amber-400 bg-clip-text text-transparent">
            Intelligent Spaces
          </span>
          .
        </h1>

        <p className="text-[#bccac3] max-w-2xl mb-10 text-lg leading-relaxed">
          We believe that finding a place to park shouldn't be the hardest part of your journey. ParkBy leverages high-tech infrastructure and community-driven data to seamlessly connect drivers with premium parking solutions.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onExploreClick}
            className="bg-[#66daba] text-[#00382c] font-bold text-sm tracking-wider uppercase px-8 py-4 rounded-full hover:bg-[#84f7d5] transition-all flex items-center gap-2 shadow-lg shadow-[#66daba]/20"
          >
            Explore Parking Spots
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenChat}
            className="bg-[#171f33] text-[#66daba] border border-[#66daba]/30 font-bold text-sm tracking-wider uppercase px-8 py-4 rounded-full hover:bg-[#222a3d] transition-all"
          >
            Ask AI Assistant
          </button>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="max-w-6xl w-full bg-[#131b2e]/70 backdrop-blur-xl rounded-2xl p-8 border border-white/10 shadow-2xl grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-white/10">
        <div className="flex flex-col items-center pt-4 md:pt-0">
          <span className="text-3xl md:text-4xl font-bold text-[#66daba] font-mono mb-1">150,000+</span>
          <span className="text-xs font-bold tracking-wider uppercase text-[#bccac3]">Spots Listed</span>
        </div>

        <div className="flex flex-col items-center pt-4 md:pt-0">
          <span className="text-3xl md:text-4xl font-bold text-[#66daba] font-mono mb-1">45</span>
          <span className="text-xs font-bold tracking-wider uppercase text-[#bccac3]">Cities Active</span>
        </div>

        <div className="flex flex-col items-center pt-4 md:pt-0">
          <span className="text-3xl md:text-4xl font-bold text-[#66daba] font-mono mb-1">2.5M</span>
          <span className="text-xs font-bold tracking-wider uppercase text-[#bccac3]">Happy Drivers</span>
        </div>
      </section>

      {/* Core Principles */}
      <section className="max-w-6xl w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Core Principles</h2>
          <p className="text-[#bccac3] text-sm">The technological foundations driving our smart parking platform.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#131b2e]/60 rounded-2xl p-8 border border-white/10 flex flex-col gap-4 hover:bg-[#171f33] transition-all">
            <div className="w-12 h-12 rounded-full bg-[#222a3d] border border-white/10 flex items-center justify-center text-[#66daba]">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Frictionless Speed</h3>
            <p className="text-sm text-[#bccac3] leading-relaxed">
              Optimized routing and instant booking algorithms designed for users in motion with live sensor feedback.
            </p>
          </div>

          <div className="bg-[#131b2e]/60 rounded-2xl p-8 border border-white/10 flex flex-col gap-4 hover:bg-[#171f33] transition-all">
            <div className="w-12 h-12 rounded-full bg-[#222a3d] border border-white/10 flex items-center justify-center text-[#66daba]">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Verified Trust</h3>
            <p className="text-sm text-[#bccac3] leading-relaxed">
              Every slot listing is cross-referenced with satellite imagery and verified hardware status for ultimate reliability.
            </p>
          </div>

          <div className="bg-[#131b2e]/60 rounded-2xl p-8 border border-white/10 flex flex-col gap-4 hover:bg-[#171f33] transition-all">
            <div className="w-12 h-12 rounded-full bg-[#222a3d] border border-white/10 flex items-center justify-center text-[#66daba]">
              <Leaf className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Urban Efficiency</h3>
            <p className="text-sm text-[#bccac3] leading-relaxed">
              Reducing urban emissions by eliminating the endless circle of searching for vacant street parking spots.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="max-w-5xl w-full relative overflow-hidden rounded-2xl bg-[#131b2e] border border-white/10 p-10 md:p-14 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#66daba]/10 blur-3xl pointer-events-none"></div>

        <div className="max-w-xl z-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to optimize your urban experience?</h2>
          <p className="text-[#bccac3] text-sm">Join millions of drivers and property owners redefining city mobility.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 shrink-0 z-10">
          <button
            onClick={onExploreClick}
            className="bg-[#66daba] text-[#00382c] font-bold text-xs tracking-wider uppercase px-7 py-3.5 rounded-full hover:bg-[#84f7d5] transition-colors flex items-center justify-center gap-2"
          >
            Explore Platform
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <button
            onClick={onOpenChat}
            className="bg-[#171f33] text-[#66daba] border border-[#66daba]/30 font-bold text-xs tracking-wider uppercase px-7 py-3.5 rounded-full hover:bg-[#222a3d] transition-colors"
          >
            Ask Assistant
          </button>
        </div>
      </section>
    </div>
  );
};
