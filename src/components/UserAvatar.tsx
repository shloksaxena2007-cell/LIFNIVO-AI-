import React, { useState, useEffect } from 'react';
import { FirebaseUser } from '../firebase';

interface UserAvatarProps {
  user?: FirebaseUser | null;
  photoURL?: string | null;
  displayName?: string | null;
  email?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showStatusDot?: boolean;
  statusColor?: string;
  ringColor?: string;
}

/**
 * Returns high-definition avatar URL for Google profile pictures.
 * Upgrades default low-res =s96-c to =s256-c or =s384-c for crystal-clear
 * rendering on mobile, tablet, and retina screens.
 */
export function getOptimizedPhotoUrl(url: string | null | undefined, targetSize = 256): string | null {
  if (!url) return null;
  try {
    // If it's a Google user content URL, optimize resolution parameter
    if (url.includes('googleusercontent.com')) {
      // If it contains =s\d+ or =s\d+-c, replace with high-res targetSize
      if (/=s\d+(-c)?/i.test(url)) {
        return url.replace(/=s\d+(-c)?/i, `=s${targetSize}-c`);
      }
      // If it ends without size parameter, append =s256-c
      if (!url.includes('=')) {
        return `${url}=s${targetSize}-c`;
      }
    }
    return url;
  } catch {
    return url;
  }
}

/**
 * Generates clean 1-2 letter initials for fallback avatar.
 */
export function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'U';
}

const SIZE_MAP = {
  xs: { box: 'w-6 h-6', text: 'text-[10px]', icon: 'text-[14px]', dot: 'w-1.5 h-1.5' },
  sm: { box: 'w-8 h-8', text: 'text-xs', icon: 'text-[18px]', dot: 'w-2 h-2' },
  md: { box: 'w-10 h-10', text: 'text-sm', icon: 'text-[20px]', dot: 'w-2.5 h-2.5' },
  lg: { box: 'w-12 h-12', text: 'text-base', icon: 'text-[24px]', dot: 'w-3 h-3' },
  xl: { box: 'w-16 h-16', text: 'text-lg', icon: 'text-[28px]', dot: 'w-3.5 h-3.5' },
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  photoURL: rawPhotoURL,
  displayName: rawDisplayName,
  email: rawEmail,
  size = 'sm',
  className = '',
  showStatusDot = false,
  statusColor = 'bg-secondary',
  ringColor = 'ring-secondary/30',
}) => {
  const photo = rawPhotoURL !== undefined ? rawPhotoURL : user?.photoURL;
  const name = rawDisplayName !== undefined ? rawDisplayName : user?.displayName;
  const email = rawEmail !== undefined ? rawEmail : user?.email;

  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Reset error/loaded state if photo URL changes
  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [photo]);

  const highResPhoto = getOptimizedPhotoUrl(photo, size === 'xl' || size === 'lg' ? 384 : 256);
  const initials = getInitials(name, email);
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.sm;

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${sizeClasses.box} ${className}`}>
      {highResPhoto && !hasError ? (
        <div className="w-full h-full rounded-full overflow-hidden relative shadow-xs ring-1 ring-inset ring-outline-variant/30">
          {/* Subtle loading placeholder while image decodes */}
          {!isLoaded && (
            <div className="absolute inset-0 bg-secondary-fixed/50 animate-pulse flex items-center justify-center text-on-secondary-fixed font-semibold text-xs">
              {initials}
            </div>
          )}
          <img
            src={highResPhoto}
            alt={name || 'User Profile Photo'}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            loading="eager"
            decoding="async"
            onLoad={() => setIsLoaded(true)}
            onError={() => {
              console.warn('Profile photo failed to load, falling back to initials');
              setHasError(true);
            }}
            className={`w-full h-full object-cover rounded-full transition-opacity duration-200 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      ) : (
        <div
          className={`w-full h-full rounded-full bg-gradient-to-br from-secondary-container to-secondary-fixed text-on-secondary-fixed flex items-center justify-center font-semibold select-none shadow-xs ring-1 ring-inset ${ringColor} ${sizeClasses.text}`}
          title={name || email || 'User'}
        >
          {user || name || email ? initials : (
            <span className={`material-symbols-outlined ${sizeClasses.icon}`}>person</span>
          )}
        </div>
      )}

      {/* Optional real-time status indicator dot */}
      {showStatusDot && (
        <span
          className={`absolute -top-0.5 -right-0.5 rounded-full border-2 border-surface ${sizeClasses.dot} ${statusColor}`}
          aria-hidden="true"
        />
      )}
    </div>
  );
};
