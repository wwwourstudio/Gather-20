import React from 'react';

interface AudioPulseRingsProps {
  active: boolean;
  pulseTrigger?: number;
}

export const AudioPulseRings: React.FC<AudioPulseRingsProps> = ({ active }) => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible"
    >
      {/* Inner subtle concentric ring */}
      <div
        className={`w-[78%] aspect-square rounded-full border transition-opacity duration-500 ${
          active ? 'border-white/[0.08] animate-audio-ring-a' : 'border-white/[0.05] opacity-35'
        }`}
      />

      {/* Outer subtle concentric ring */}
      <div
        className={`absolute w-[98%] aspect-square rounded-full border transition-opacity duration-500 ${
          active
            ? 'border-white/[0.06] animate-audio-ring-b'
            : 'border-white/[0.04] opacity-25'
        }`}
        style={{ animationDelay: '700ms' }}
      />

      {/* Single soft outward pulse wave when mic active */}
      {active && (
        <div className="absolute w-[90%] aspect-square rounded-full border border-[#4f6ef7]/25 animate-audio-ripple" />
      )}

      {/* Quiet radial studio glow */}
      <div
        className={`absolute w-[74%] h-[70%] rounded-full blur-3xl transition-opacity duration-500 ${
          active ? 'animate-audio-aura' : 'opacity-20'
        }`}
        style={{
          background:
            'radial-gradient(circle at 42% 46%, rgba(59, 108, 245, 0.16), rgba(124, 58, 237, 0.13) 55%, transparent 78%)',
        }}
      />
    </div>
  );
};
