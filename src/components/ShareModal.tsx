import React, { useState } from 'react';
import { trackEvent } from '../utils/analytics';
import { LifnivoLogo } from './LifnivoLogo';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const shareUrl = window.location.origin;
  const shareMessage =
    'LIFNIVO AI — Your life. Simplified. An AI-powered personal life organizer that brings tasks, calendar, notes, goals, reminders, plans, and important information into one place.';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareMessage}\n\n${shareUrl}`);
      setCopied(true);
      trackEvent('ai_interaction_used', { action: 'share_link_copied' });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'LIFNIVO AI — Your life. Simplified.',
          text: shareMessage,
          url: shareUrl,
        });
        trackEvent('ai_interaction_used', { action: 'native_share_triggered' });
        onClose();
      } catch {
        // User cancelled
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/30 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Share LIFNIVO AI"
    >
      <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-4 text-left">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
          <div className="flex items-center gap-2.5">
            <LifnivoLogo size={28} variant="icon" />
            <h2 className="text-base font-semibold text-on-surface">Share LIFNIVO AI</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-7 h-7 rounded-full bg-surface-container hover:bg-surface-container-high text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          Know someone who could use a simpler, calmer life organizer? Share LIFNIVO with friends, family, or colleagues.
        </p>

        {/* Share preview quote */}
        <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface leading-relaxed italic">
          "{shareMessage}"
        </div>

        {/* Share actions */}
        <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/15">
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full py-2.5 px-4 rounded-full bg-primary text-on-primary text-xs font-semibold shadow-xs hover:bg-primary-container transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">
              {copied ? 'check' : 'content_copy'}
            </span>
            <span>{copied ? 'Copied to clipboard!' : 'Copy shareable link'}</span>
          </button>

          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full py-2 px-4 rounded-full border border-outline-variant/30 hover:bg-surface-container text-xs font-medium text-on-surface transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">ios_share</span>
              <span>Share via device options</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
