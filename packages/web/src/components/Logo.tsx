import React, { useId } from 'react';

export const LogoIcon: React.FC<{ size?: number }> = ({ size = 48 }) => {
  const uid = useId();
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="logo-icon-svg">
      <defs>
        <linearGradient id={`${uid}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a365d" />
          <stop offset="100%" stopColor="#2a4a7f" />
        </linearGradient>
        <linearGradient id={`${uid}-b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d4a574" />
          <stop offset="100%" stopColor="#b8855a" />
        </linearGradient>
        <filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#1a365d" floodOpacity=".25" />
        </filter>
      </defs>
      <rect x="1.5" y="1.5" width="45" height="45" rx="10" fill={`url(#${uid}-a)`} filter={`url(#${uid}-shadow)`} />
      <rect x="1.5" y="1.5" width="45" height="45" rx="10" stroke="rgba(255,255,255,.15)" strokeWidth="1" />
      <g transform="translate(9,9)">
        <rect x="0" y="0" width="14" height="14" rx="2.5" fill={`url(#${uid}-b)`} />
        <rect x="2.5" y="2.5" width="9" height="9" rx="1" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="0.8" />
        <rect x="16" y="0" width="14" height="14" rx="2.5" fill="rgba(255,255,255,.08)" />
        <rect x="18" y="2" width="10" height="10" rx="1" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="0.8" />
        <rect x="0" y="16" width="14" height="14" rx="2.5" fill="rgba(255,255,255,.12)" />
        <rect x="2" y="18" width="10" height="10" rx="1" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="0.8" />
        <rect x="16" y="16" width="14" height="14" rx="2.5" fill="rgba(212,165,116,.25)" />
        <rect x="18" y="18" width="10" height="10" rx="1" fill="none" stroke="rgba(212,165,116,.45)" strokeWidth="0.8" />
        <line x1="15" y1="2" x2="15" y2="28" stroke="rgba(255,255,255,.12)" strokeWidth="0.6" />
        <line x1="2" y1="15" x2="28" y2="15" stroke="rgba(255,255,255,.12)" strokeWidth="0.6" />
      </g>
    </svg>
  );
};

export const Logo: React.FC<{ large?: boolean }> = ({ large }) => (
  <div className={large ? 'logo logo-large' : 'logo'}>
    <LogoIcon size={large ? 72 : 48} />
    <div className="logo-text-block">
      <span className="logo-text-main">排砖宝</span>
      <span className="logo-text-sub">TileLayout AI</span>
    </div>
  </div>
);
