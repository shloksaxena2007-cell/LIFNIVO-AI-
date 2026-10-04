import React from 'react';
import { LifnivoLogo } from './LifnivoLogo';

interface PublicLandingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignInWithGoogle: () => void;
}

export const PublicLandingModal: React.FC<PublicLandingModalProps> = ({
  isOpen,
  onClose,
  onSignInWithGoogle,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-on-surface/35 backdrop-blur-md overflow-y-auto animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to LIFNIVO AI"
    >
      <div className="w-full max-w-2xl bg-surface-container-lowest rounded-3xl p-6 sm:p-10 shadow-2xl border border-outline-variant/30 flex flex-col gap-8 my-auto text-left relative">
        {/* Dismiss / Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close presentation"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Brand Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3.5">
            <LifnivoLogo size={56} variant="icon" />
            <div className="flex flex-col">
              <div className="flex items-center gap-1 font-bold text-xl sm:text-2xl text-on-surface tracking-tight leading-none">
                <span>LIFNIVO</span>
                <span className="bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">AI</span>
              </div>
              <span className="text-xs sm:text-sm font-semibold text-primary mt-1">
                Your life. Simplified.
              </span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight leading-snug">
            An AI-powered personal life organizer.
          </h1>
          <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">
            LIFNIVO brings tasks, calendar, notes, goals, reminders, plans, and important information into one calm, unified place.
          </p>
        </div>

        {/* Core Value Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
            </div>
            <h3 className="text-sm font-semibold text-on-surface">Tasks & Priorities</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Capture your to-dos, recurring habits, and key goals with intelligent priority and context cues.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">calendar_today</span>
            </div>
            <h3 className="text-sm font-semibold text-on-surface">Calendar & Schedule</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Navigate seamlessly across any month or year, view full schedules, and spot overlaps before they happen.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-xl bg-tertiary/15 text-tertiary flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">psychology</span>
            </div>
            <h3 className="text-sm font-semibold text-on-surface">Notes & Memory</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Keep important reference notes and personal memories secure and searchable in seconds.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            </div>
            <h3 className="text-sm font-semibold text-on-surface">AI Life Assistant</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Get calm, grounded day plans and natural answers connected to your actual schedule and commitments.
            </p>
          </div>
        </div>

        {/* Call to Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t border-outline-variant/15">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-6 rounded-full bg-primary text-on-primary font-semibold text-sm shadow-sm hover:bg-primary-container transition-all cursor-pointer text-center"
          >
            Start using LIFNIVO
          </button>
          <button
            type="button"
            onClick={() => {
              onSignInWithGoogle();
              onClose();
            }}
            className="py-3 px-5 rounded-full border border-outline-variant/40 hover:bg-surface-container text-xs sm:text-sm font-medium text-on-surface transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Sign in with Google</span>
          </button>
        </div>

        <p className="text-[11px] text-outline text-center">
          Free guest mode works immediately on this device.
        </p>
      </div>
    </div>
  );
};
