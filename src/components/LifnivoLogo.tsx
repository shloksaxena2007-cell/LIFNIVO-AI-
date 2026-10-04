import React, { useState } from 'react';

interface LifnivoLogoProps {
  size?: number | string;
  variant?: 'icon' | 'full' | 'inline';
  className?: string;
  showTagline?: boolean;
  onClick?: () => void;
}

export const LifnivoLogo: React.FC<LifnivoLogoProps> = ({
  size = 36,
  variant = 'icon',
  className = '',
  showTagline = false,
  onClick,
}) => {
  const [imgSrc, setImgSrc] = useState('/app-profile.png');
  const [hasError, setHasError] = useState(false);

  // Exact fallback if primary image path fails
  const handleError = () => {
    if (imgSrc === '/app-profile.png') {
      setImgSrc('/logo.png');
    } else if (imgSrc === '/logo.png') {
      setImgSrc('/logo.svg');
    } else {
      setHasError(true);
    }
  };

  const dim = typeof size === 'number' ? `${size}px` : size;
  const dimStyle = { width: dim, height: dim, minWidth: dim, minHeight: dim };

  // Profile Photo Badge - Always directly visible like ChatGPT, Perplexity, Gemini, Kimi
  const ImageBadge = (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full select-none overflow-hidden ring-1.5 ring-sky-400/30 shadow-sm bg-[#060b20] ${
        onClick ? 'cursor-pointer hover:ring-sky-400/60 active:scale-95 transition-all' : ''
      }`}
      style={dimStyle}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      title="LIFNIVO AI"
      aria-label="LIFNIVO AI Profile Photo"
    >
      {!hasError ? (
        <img
          src={imgSrc}
          alt="LIFNIVO AI"
          className="w-full h-full object-cover rounded-full select-none pointer-events-none"
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="sync"
          onError={handleError}
        />
      ) : (
        // Self-contained inline vector disk if all external image loads were blocked
        <div className="w-full h-full rounded-full bg-gradient-to-br from-sky-400 via-indigo-600 to-purple-700 flex items-center justify-center text-white font-black text-xs">
          L
        </div>
      )}
    </div>
  );

  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>
        {ImageBadge}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div
        className={`inline-flex items-center gap-3 shrink-0 ${onClick ? 'cursor-pointer select-none group' : ''} ${className}`}
        onClick={onClick}
      >
        {ImageBadge}
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1 font-bold text-on-surface tracking-tight text-base sm:text-lg">
            <span>LIFNIVO</span>
            <span className="bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">AI</span>
          </div>
          {showTagline && (
            <span className="text-[11px] text-on-surface-variant font-medium mt-0.5">
              Your life. Simplified.
            </span>
          )}
        </div>
      </div>
    );
  }

  // variant === 'full'
  return (
    <div className={`flex flex-col items-center text-center gap-3.5 ${className}`}>
      {ImageBadge}
      <div className="flex flex-col items-center gap-0.5">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface flex items-center gap-1.5">
          <span>LIFNIVO</span>
          <span className="bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600 bg-clip-text text-transparent">
            AI
          </span>
        </h1>
        <p className="text-sm sm:text-base font-medium text-on-surface-variant">
          Your life. Simplified.
        </p>
      </div>
    </div>
  );
};
