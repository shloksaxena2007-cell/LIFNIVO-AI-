import React from 'react';

interface MigrationDialogProps {
  isOpen: boolean;
  hasCloudData: boolean;
  taskCount: number;
  eventCount: number;
  recurringCount: number;
  memoryCount: number;
  onConfirmMigrate: () => void;
  onKeepAccountData: () => void;
  onCancel: () => void;
}

export const MigrationDialog: React.FC<MigrationDialogProps> = ({
  isOpen,
  hasCloudData,
  taskCount,
  eventCount,
  recurringCount,
  memoryCount,
  onConfirmMigrate,
  onKeepAccountData,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-on-surface/25 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Account Data Migration"
    >
      <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-4 text-left">
        {/* Header Icon & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-fixed flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">cloud_sync</span>
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-on-surface">
              {hasCloudData
                ? 'Your account already has LIFNIVO information'
                : 'Move your LIFNIVO to your account?'}
            </h3>
            <span className="text-xs text-outline">Cloud synchronization</span>
          </div>
        </div>

        {/* Descriptive Body */}
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          {hasCloudData
            ? 'We found existing data saved in your cloud account. You can keep your existing account data or merge your current device information into your account.'
            : 'Your tasks, calendar items, recurring items, Areas, and saved memories can be connected to your account so you can access them on other devices.'}
        </p>

        {/* Summary of local data */}
        <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col gap-2">
          <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
            Current Device Data
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs text-on-surface">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-secondary">
                check_circle
              </span>
              <span>{taskCount} tasks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-primary">
                calendar_today
              </span>
              <span>{eventCount} calendar items</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-secondary">sync</span>
              <span>{recurringCount} recurring items</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-tertiary">
                psychology
              </span>
              <span>{memoryCount} saved memories</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {hasCloudData ? (
          <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-outline-variant/15">
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto px-4 py-2 rounded-full text-xs font-medium text-outline hover:text-on-surface cursor-pointer"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={onKeepAccountData}
              className="w-full sm:w-auto px-4 py-2 rounded-full text-xs font-medium bg-surface-container hover:bg-surface-container-high text-on-surface cursor-pointer"
            >
              Keep account data
            </button>
            <button
              type="button"
              onClick={onConfirmMigrate}
              className="w-full sm:w-auto px-5 py-2 rounded-full text-xs font-semibold bg-primary text-on-primary hover:bg-primary-container shadow-sm cursor-pointer"
            >
              Add my device data
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/15">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-full text-xs font-medium text-outline hover:text-on-surface cursor-pointer"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={onConfirmMigrate}
              className="px-5 py-2 rounded-full text-xs font-semibold bg-primary text-on-primary hover:bg-primary-container shadow-sm cursor-pointer"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
