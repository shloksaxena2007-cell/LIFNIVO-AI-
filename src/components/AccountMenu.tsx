import React, { useState, useRef, useEffect } from 'react';
import { FirebaseUser } from '../firebase';
import { SyncState } from '../utils/cloudSync';
import { UserProfileAvatar } from './UserProfileAvatar';

interface AccountMenuProps {
  user: FirebaseUser | null;
  syncState: SyncState;
  onSignInWithGoogle: () => void;
  onSignOut: () => void;
  taskCount: number;
  eventCount: number;
  memoryCount: number;
  onOpenAbout?: () => void;
  onOpenFeedback?: () => void;
  onOpenShare?: () => void;
  onRetrySync?: () => void;
}

export const AccountMenu: React.FC<AccountMenuProps> = ({
  user,
  syncState,
  onSignInWithGoogle,
  onSignOut,
  taskCount,
  eventCount,
  memoryCount,
  onOpenAbout,
  onOpenFeedback,
  onOpenShare,
  onRetrySync,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await onSignInWithGoogle();
      setIsOpen(false);
    } catch (error) {
      console.error('Sign-in error:', error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOutClick = () => {
    onSignOut();
    setIsOpen(false);
  };

  const syncLabelMap: Record<SyncState, { text: string; icon: string; color: string }> = {
    synced: { text: 'Synced', icon: 'cloud_done', color: 'text-secondary' },
    saving: { text: 'Saving...', icon: 'sync', color: 'text-primary' },
    syncing: { text: 'Syncing...', icon: 'sync', color: 'text-primary' },
    saved: { text: 'Saved', icon: 'check', color: 'text-secondary' },
    offline: { text: 'Offline', icon: 'cloud_off', color: 'text-outline' },
    error: { text: 'Sync delayed', icon: 'error_outline', color: 'text-error' },
  };

  const currentSync = syncLabelMap[syncState] || syncLabelMap.synced;

  return (
    <div className="relative" ref={menuRef}>
      {/* Profile Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 p-0.5 rounded-full hover:bg-surface-container transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
        title={user ? `${user.displayName || user.email} (${currentSync.text})` : 'Account & Sync (Guest mode)'}
        aria-label="Account and synchronization menu"
        aria-expanded={isOpen}
      >
        <UserProfileAvatar
          user={user}
          size={36}
          showSyncDot={true}
          syncState={syncState}
        />
      </button>

      {/* Account Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-72 sm:w-80 rounded-2xl bg-surface-container-lowest p-4 shadow-xl border border-outline-variant/30 text-left flex flex-col gap-3.5 animate-fade-in">
          {/* User Header */}
          {user ? (
            <div className="flex items-center gap-3 pb-3 border-b border-outline-variant/20">
              <UserProfileAvatar user={user} size="lg" />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-on-surface truncate">
                  {user.displayName || 'Connected Account'}
                </span>
                <span className="text-xs text-outline truncate">{user.email}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 pb-3 border-b border-outline-variant/20">
              <UserProfileAvatar user={null} size="lg" />
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wider text-outline">
                  Guest Mode
                </span>
                <p className="text-xs text-on-surface-variant leading-tight">
                  Saved privately on this device.
                </p>
              </div>
            </div>
          )}

          {/* Sync Status Badge */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-container-low text-xs">
            <span className="text-outline font-medium">Cloud sync:</span>
            <div className="flex items-center gap-1.5 font-medium">
              <span
                className={`material-symbols-outlined text-[15px] ${currentSync.color} ${
                  syncState === 'syncing' || syncState === 'saving' ? 'animate-spin' : ''
                }`}
              >
                {currentSync.icon}
              </span>
              <span className={currentSync.color}>{currentSync.text}</span>
              {syncState === 'error' && onRetrySync && (
                <button
                  type="button"
                  onClick={onRetrySync}
                  className="ml-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                >
                  Try again
                </button>
              )}
            </div>
          </div>

          {syncState === 'offline' && (
            <p className="text-[10px] text-outline px-1">
              Your device is offline. Changes will sync automatically when connection returns.
            </p>
          )}

          {/* Workspace summary */}
          <div className="text-[11px] text-outline px-1">
            <span>
              {taskCount} tasks • {eventCount} events • {memoryCount} memories
            </span>
          </div>

          {/* Quick Support & Sharing */}
          <div className="flex flex-col gap-1 py-1 border-t border-outline-variant/15 text-xs">
            {onOpenAbout && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenAbout();
                }}
                className="w-full py-1.5 px-2 rounded-lg hover:bg-surface-container text-left flex items-center gap-2 text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-outline">info</span>
                <span>About LIFNIVO AI</span>
              </button>
            )}
            {onOpenShare && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenShare();
                }}
                className="w-full py-1.5 px-2 rounded-lg hover:bg-surface-container text-left flex items-center gap-2 text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-outline">share</span>
                <span>Share LIFNIVO</span>
              </button>
            )}
            {onOpenFeedback && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenFeedback();
                }}
                className="w-full py-1.5 px-2 rounded-lg hover:bg-surface-container text-left flex items-center gap-2 text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-outline">feedback</span>
                <span>Help improve LIFNIVO</span>
              </button>
            )}
          </div>

          {/* Action button */}
          {user ? (
            <button
              type="button"
              onClick={handleSignOutClick}
              className="w-full py-2 px-3 rounded-xl border border-outline-variant/30 hover:bg-surface-container text-xs font-medium text-error hover:text-error/80 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span>Sign out</span>
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="w-full py-2.5 px-3 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{isSigningIn ? 'Connecting...' : 'Sign in with Google'}</span>
              </button>
              <p className="text-[10px] text-outline text-center">
                Sync across devices while keeping your data private.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
