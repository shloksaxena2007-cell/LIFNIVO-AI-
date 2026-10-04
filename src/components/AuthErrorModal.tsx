import React, { useState } from 'react';
import firebaseConfig from '../../firebase-applet-config.json';

export interface AuthErrorInfo {
  code: string;
  domain?: string;
  message: string;
}

interface AuthErrorModalProps {
  error: AuthErrorInfo | null;
  onClose: () => void;
  onRetry: () => void;
}

export const AuthErrorModal: React.FC<AuthErrorModalProps> = ({
  error,
  onClose,
  onRetry,
}) => {
  const [copied, setCopied] = useState(false);

  if (!error) return null;

  const currentHost = error.domain || window.location.hostname;
  const isUnauthorizedDomain = error.code === 'auth/unauthorized-domain';
  const projectId = firebaseConfig.projectId;
  const consoleAuthUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;

  const handleCopyDomain = async () => {
    try {
      await navigator.clipboard.writeText(currentHost);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/30 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Authentication Notice"
    >
      <div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-5 text-left">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-2 border-b border-outline-variant/15">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isUnauthorizedDomain ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-error-container text-on-error-container'
            }`}>
              <span className="material-symbols-outlined text-[22px]">
                {isUnauthorizedDomain ? 'domain_verification' : 'error'}
              </span>
            </div>
            <div className="flex flex-col">
              <h2 className="text-base sm:text-lg font-semibold text-on-surface">
                {isUnauthorizedDomain
                  ? 'Authorize Domain in Firebase'
                  : 'Sign-in Notification'}
              </h2>
              <span className="text-xs text-outline">
                {isUnauthorizedDomain ? 'One-time setup required' : 'Authentication notice'}
              </span>
            </div>
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

        {/* Content */}
        {isUnauthorizedDomain ? (
          <div className="flex flex-col gap-3 text-xs sm:text-sm text-on-surface-variant leading-relaxed">
            <p>
              Firebase Authentication requires new deployment hostnames to be registered in your Firebase project's <strong>Authorized domains</strong> list before Google Sign-In can open.
            </p>

            {/* Domain display card with copy button */}
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                  Current Domain
                </span>
                <span className="font-mono text-xs font-semibold text-on-surface break-all select-all">
                  {currentHost}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyDomain}
                className="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {copied ? 'check' : 'content_copy'}
                </span>
                <span>{copied ? 'Copied!' : 'Copy Domain'}</span>
              </button>
            </div>

            {/* Quick 3-Step Guide */}
            <div className="p-3.5 rounded-xl bg-secondary-fixed/20 border border-secondary/20 flex flex-col gap-2">
              <span className="text-xs font-semibold text-secondary flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">help</span>
                <span>Quick 3-step setup in Firebase:</span>
              </span>
              <ol className="list-decimal list-inside space-y-1 text-xs text-on-surface-variant">
                <li>
                  Go to <a
                    href={consoleAuthUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
                  >
                    <span>Firebase Console Authentication Settings</span>
                    <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                  </a>
                </li>
                <li>Scroll to <strong>Authorized domains</strong> and click <strong>Add domain</strong></li>
                <li>Paste <code className="px-1 py-0.5 rounded bg-surface-container font-mono text-[11px]">{currentHost}</code> and click <strong>Save</strong></li>
              </ol>
            </div>

            <p className="text-xs text-outline italic">
              Note: All tasks, calendar items, areas, and AI features work immediately in <strong>Guest Mode</strong> on this device without signing in.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-xs sm:text-sm text-on-surface-variant">
            <p>{error.message}</p>
            <p className="text-xs text-outline">
              You can continue using all features locally in Guest Mode.
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2 border-t border-outline-variant/15">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-medium text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer transition-colors text-center"
          >
            Continue in Guest Mode
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onRetry();
            }}
            className="px-5 py-2 rounded-full text-xs font-semibold bg-primary text-on-primary hover:bg-primary-container shadow-sm cursor-pointer transition-all text-center"
          >
            Retry Sign-in
          </button>
        </div>
      </div>
    </div>
  );
};
