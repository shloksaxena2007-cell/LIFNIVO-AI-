import React, { useState } from 'react';
import { FirebaseUser } from '../firebase';
import { SyncState } from '../utils/cloudSync';

interface UserProfileAvatarProps {
  user: FirebaseUser | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  showSyncDot?: boolean;
  syncState?: SyncState;
  onClick?: () => void;
  title?: string;
}

const sizeConfig: Record<string, { px: number; classStr: string; textClass: string; iconClass: string }> = {
  xs: { px: 24, classStr: 'w-6 h-6', textClass: 'text-[10px]', iconClass: 'text-[14px]' },
  sm: { px: 32, classStr: 'w-8 h-8', textClass: 'text-xs', iconClass: 'text-[18px]' },
  md: { px: 40, classStr: 'w-10 h-10', textClass: 'text-sm font-semibold', iconClass: 'text-[20px]' },
  lg: { px: 52, classStr: 'w-13 h-13', textClass: 'text-base font-bold', iconClass: 'text-[24px]' },
  xl: { px: 68, classStr: 'w-17 h-17', textClass: 'text-xl font-bold', iconClass: 'text-[32px]' },
};

/**
 * Ensures Google profile photos are requested in high resolution for retina/high-DPI screens.
 * Automatically upgrades default =s96-c to =s256-c or =s384-c.
 */
export function getHighResPhotoUrl(url: string | null | undefined, targetPx = 256): string | null {
  if (!url) return null;
  try {
    // If it's a googleusercontent photo, request high-DPI resolution
    if (url.includes('googleusercontent.com')) {
      const highResParam = `=s${Math.max(targetPx * 2, 256)}-c`;
      if (/=s\d+(-c)?/.test(url)) {
        return url.replace(/=s\d+(-c)?$/, highResParam);
      }
      return url.includes('?') ? `${url}&sz=${targetPx * 2}` : `${url}?sz=${targetPx * 2}`;
    }
  } catch {
    // Return original url on parse error
  }
  return url;
}

/**
 * Generates consistent initials from user display name or email.
 */
function getInitials(displayName?: string | null, email?: string | null): string {
  if (displayName && displayName.trim().length > 0) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  }
  if (email && email.trim().length > 0) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'U';
}

/**
 * Returns a high-contrast, modern gradient based on the user's string identifier.
 */
function getAvatarGradient(seedStr: string): string {
  const gradients = [
    'from-sky-500 to-indigo-600',
    'from-teal-500 to-emerald-600',
    'from-violet-500 to-purple-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-blue-600 to-cyan-500',
    'from-indigo-500 to-sky-600',
  ];
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

export const UserProfileAvatar: React.FC<UserProfileAvatarProps> = ({
  user,
  size = 'sm',
  className = '',
  showSyncDot = false,
  syncState = 'synced',
  onClick,
  title,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const config = typeof size === 'number'
    ? { px: size, classStr: '', textClass: 'text-sm font-semibold', iconClass: 'text-[20px]' }
    : sizeConfig[size] || sizeConfig.sm;

  const styleDimension = typeof size === 'number' ? { width: size, height: size } : undefined;

  const rawPhoto = user?.photoURL;
  const highResPhoto = getHighResPhotoUrl(rawPhoto, config.px);
  const displayName = user?.displayName || user?.email || 'User';
  const initials = getInitials(user?.displayName, user?.email);
  const bgGradient = getAvatarGradient(user?.uid || user?.email || 'lifnivo');

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={styleDimension}
      onClick={onClick}
      title={title || displayName}
    >
      {user && highResPhoto && !imgFailed ? (
        <img
          src={highResPhoto}
          alt={displayName}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onError={() => setImgFailed(true)}
          className={`${config.classStr} rounded-full object-cover shadow-xs ring-2 ring-primary/25 hover:ring-primary/45 transition-all`}
          style={styleDimension}
        />
      ) : user ? (
        // Authenticated user without photo or if image load failed: vibrant crisp initials badge
        <div
          className={`${config.classStr} rounded-full bg-gradient-to-br ${bgGradient} text-white flex items-center justify-center ${config.textClass} shadow-xs ring-2 ring-primary/20 tracking-tight`}
          style={styleDimension}
        >
          {initials}
        </div>
      ) : (
        // Guest mode avatar: clean, calm guest badge with soft border
        <div
          className={`${config.classStr} rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center ${config.iconClass} shadow-xs ring-1.5 ring-outline-variant/30`}
          style={styleDimension}
        >
          <span className="material-symbols-outlined text-outline">person</span>
        </div>
      )}

      {/* Optional sync status indicator dot */}
      {showSyncDot && (
        <span
          className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface shadow-xs transition-colors ${
            user
              ? syncState === 'synced' || syncState === 'saved'
                ? 'bg-secondary'
                : syncState === 'error'
                ? 'bg-error'
                : 'bg-primary animate-pulse'
              : 'bg-outline/50'
          }`}
          aria-hidden="true"
        />
      )}
    </div>
  );
};
