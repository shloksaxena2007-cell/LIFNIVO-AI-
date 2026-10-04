import React, { useState } from 'react';
import { trackEvent } from '../utils/analytics';
import { LifnivoLogo } from './LifnivoLogo';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  userEmail,
}) => {
  const [tab, setTab] = useState<'feedback' | 'problem'>('feedback');
  const [category, setCategory] = useState('Usability');
  const [feedbackText, setFeedbackText] = useState('');
  const [problemHappened, setProblemHappened] = useState('');
  const [problemTryingToDo, setProblemTryingToDo] = useState('');
  const [contactEmail, setContactEmail] = useState(userEmail || '');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const existing = JSON.parse(localStorage.getItem('lifedesk_feedback_submissions') || '[]');
      const newEntry = {
        type: tab,
        category: tab === 'feedback' ? category : undefined,
        feedback: tab === 'feedback' ? feedbackText : undefined,
        problemHappened: tab === 'problem' ? problemHappened : undefined,
        problemTryingToDo: tab === 'problem' ? problemTryingToDo : undefined,
        contactEmail: contactEmail.trim() || undefined,
        submittedAt: new Date().toISOString(),
      };
      localStorage.setItem('lifedesk_feedback_submissions', JSON.stringify([newEntry, ...existing]));
      trackEvent('ai_interaction_used', { feedbackType: tab });
    } catch {
      // ignore
    }
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFeedbackText('');
      setProblemHappened('');
      setProblemTryingToDo('');
      onClose();
    }, 2200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/30 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Feedback & Support"
    >
      <div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-4 text-left">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
          <div className="flex items-center gap-2.5">
            <LifnivoLogo size={28} variant="icon" />
            <h2 className="text-base sm:text-lg font-semibold text-on-surface">
              {tab === 'feedback' ? 'Help improve LIFNIVO' : 'Report an issue'}
            </h2>
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

        {/* Tab switcher */}
        <div className="flex items-center p-1 bg-surface-container-low rounded-xl gap-1 text-xs">
          <button
            type="button"
            onClick={() => setTab('feedback')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              tab === 'feedback'
                ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                : 'text-outline hover:text-on-surface'
            }`}
          >
            Give feedback
          </button>
          <button
            type="button"
            onClick={() => setTab('problem')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              tab === 'problem'
                ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                : 'text-outline hover:text-on-surface'
            }`}
          >
            Report an issue
          </button>
        </div>

        {submitted ? (
          <div className="py-8 flex flex-col items-center justify-center text-center gap-2 animate-fade-in">
            <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">check</span>
            </div>
            <h4 className="text-sm font-semibold text-on-surface">Thank you!</h4>
            <p className="text-xs text-on-surface-variant max-w-xs">
              Your feedback helps shape LIFNIVO AI into a simpler, calmer tool for everyone.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {tab === 'feedback' ? (
              <>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Tell us what works, what feels confusing, and what you'd like to see improved.
                </p>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="p-2 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                  >
                    <option value="Usability">Usability & Navigation</option>
                    <option value="Feature request">Feature suggestion</option>
                    <option value="AI quality">AI Assistant experience</option>
                    <option value="Calendar & Tasks">Calendar & Tasks</option>
                    <option value="General feedback">General thoughts</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                    Your thoughts
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="What could be simpler or more useful?"
                    className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                  />
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Notice something not working quite right? Let us know so we can fix it.
                </p>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                    What happened?
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={problemHappened}
                    onChange={(e) => setProblemHappened(e.target.value)}
                    placeholder="e.g. A task didn't save or the calendar view showed an unexpected error"
                    className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                    What were you trying to do?
                  </label>
                  <input
                    type="text"
                    value={problemTryingToDo}
                    onChange={(e) => setProblemTryingToDo(e.target.value)}
                    placeholder="e.g. Editing a recurring event"
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                Email (Optional)
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="In case we need to follow up with a fix"
                className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/15">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-xs font-medium text-outline hover:text-on-surface cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-full text-xs font-semibold bg-primary text-on-primary hover:bg-primary-container shadow-sm cursor-pointer"
              >
                Send feedback
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
