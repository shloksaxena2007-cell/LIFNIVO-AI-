import React from 'react';
import { TabType } from '../types';
import { FirebaseUser } from '../firebase';
import { SyncState } from '../utils/cloudSync';
import { AccountMenu } from './AccountMenu';
import { LifnivoLogo } from './LifnivoLogo';

interface HeaderProps {
  currentTab: TabType;
  onOpenSearch?: () => void;
  onOpenQuickCapture?: () => void;
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

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenSearch,
  onOpenQuickCapture,
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
  const tabTitles: Record<TabType, string> = {
    today: 'Today',
    tasks: 'Tasks',
    calendar: 'Calendar',
    areas: 'Areas',
    ai: 'AI Assistant',
  };

  return (
    <header className="fixed top-0 left-0 md:left-64 right-0 z-40 bg-surface/85 backdrop-blur-xl border-b border-outline-variant/20 shadow-[0_1px_8px_rgba(0,0,0,0.02)] transition-all">
      <div className="h-16 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 flex items-center justify-between gap-2.5 sm:gap-3">
        {/* Breadcrumb & Tab Name */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="md:hidden flex items-center gap-2 mr-1">
            <LifnivoLogo size={32} variant="icon" />
            <span className="font-bold text-[15px] tracking-tight text-on-surface">LIFNIVO</span>
            <span className="text-outline-variant text-xs">/</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-outline">
            <span>Workspace</span>
            <span className="text-outline-variant">/</span>
            <span>Personal Life Organizer</span>
            <span className="text-outline-variant">/</span>
          </div>
          <span className="text-xs sm:text-sm font-semibold text-on-surface truncate">
            {tabTitles[currentTab]}
          </span>
        </div>

        {/* Center Search + Quick Capture Everywhere */}
        <div className="flex items-center gap-2 flex-1 justify-end sm:justify-center max-w-md min-w-0">
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container border border-outline-variant/20 hover:border-outline-variant/40 text-xs text-outline hover:text-on-surface transition-all cursor-pointer shadow-xs max-w-[165px] sm:max-w-xs w-full min-w-0"
            title="Search LIFNIVO (⌘K or /)"
            aria-label="Search LIFNIVO"
          >
            <span className="material-symbols-outlined text-[16px] text-outline shrink-0">search</span>
            <span className="truncate text-left text-on-surface-variant/80">Search...</span>
            <kbd className="hidden sm:inline-block ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container text-outline shrink-0">
              ⌘K
            </kbd>
          </button>

          {onOpenQuickCapture && (
            <button
              type="button"
              onClick={onOpenQuickCapture}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary-container hover:bg-secondary-fixed text-on-secondary-fixed text-xs font-semibold transition-all cursor-pointer shrink-0 shadow-xs"
              title="Quick Capture anywhere (Tasks, Events, Memory)"
              aria-label="Quick Capture"
            >
              <span
                className="material-symbols-outlined text-[15px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_awesome
              </span>
              <span className="hidden sm:inline">Capture</span>
            </button>
          )}
        </div>

        {/* Right side controls: Account & Sync Menu */}
        <div className="flex items-center gap-2.5 shrink-0">
          <AccountMenu
            user={user}
            syncState={syncState}
            onSignInWithGoogle={onSignInWithGoogle}
            onSignOut={onSignOut}
            taskCount={taskCount}
            eventCount={eventCount}
            memoryCount={memoryCount}
            onOpenAbout={onOpenAbout}
            onOpenFeedback={onOpenFeedback}
            onOpenShare={onOpenShare}
            onRetrySync={onRetrySync}
          />
        </div>
      </div>
    </header>
  );
};
