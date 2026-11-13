import React from 'react';

export const BrandCrest: React.FC<{ className?: string }> = ({ className = 'h-9 w-9' }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect width="64" height="64" rx="14" fill="#0F4C3A" />
    <rect x="4" y="4" width="56" height="56" rx="11" stroke="#D4AF37" strokeWidth="1.5" strokeOpacity="0.6" />
    <path d="M17 25L20 14L27 20L32 11L37 20L44 14L47 25H17Z" fill="#E8B931" />
    <rect x="17" y="26.5" width="30" height="3" rx="1.5" fill="#E8B931" />
    <rect x="28.5" y="33" width="7" height="20" rx="2" fill="#FFFFFF" />
    <rect x="22" y="39.5" width="20" height="7" rx="2" fill="#FFFFFF" />
  </svg>
);

export const CompanyStampSvg: React.FC<{ companyName: string }> = ({ companyName }) => {
  const display = companyName.length > 24 ? companyName.slice(0, 24) : companyName;
  return (
    <svg
      viewBox="0 0 120 120"
      className="h-20 w-20 text-emerald-900"
      aria-label={`${companyName} Official Company Stamp`}
    >
      <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeWidth="1" />
      <text
        x="60"
        y="37"
        textAnchor="middle"
        fill="currentColor"
        fontSize="7.5"
        fontWeight="700"
        letterSpacing="0.5"
      >
        {display}
      </text>
      <line x1="24" y1="45" x2="96" y2="45" stroke="currentColor" strokeWidth="0.8" />
      <text
        x="60"
        y="63"
        textAnchor="middle"
        fill="currentColor"
        fontSize="10"
        fontWeight="800"
        letterSpacing="1"
      >
        AUTHORIZED
      </text>
      <line x1="24" y1="72" x2="96" y2="72" stroke="currentColor" strokeWidth="0.8" />
      <text
        x="60"
        y="86"
        textAnchor="middle"
        fill="currentColor"
        fontSize="7.5"
        fontWeight="700"
        letterSpacing="0.6"
      >
        COMPANY SEAL
      </text>
    </svg>
  );
};
