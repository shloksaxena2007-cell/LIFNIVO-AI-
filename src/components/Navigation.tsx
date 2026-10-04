import React from 'react';
import { TabType } from '../types';
import { LifnivoLogo } from './LifnivoLogo';

interface NavigationProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
}) => {
  const navItems: { id: TabType; label: string; icon: string }[] = [
    { id: 'today', label: 'Today', icon: 'wb_sunny' },
    { id: 'tasks', label: 'Tasks', icon: 'check_circle' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar_today' },
    { id: 'areas', label: 'Areas', icon: 'grid_view' },
    { id: 'ai', label: 'AI', icon: 'auto_awesome' },
  ];

  return (
    <>
      {/* Desktop Sidebar (md and up) */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-surface-container-low/80 backdrop-blur-xl z-50 flex-col justify-between py-6 px-4 border-r border-outline-variant/20 shadow-[0_1px_8px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col gap-7">
          {/* Logo & Emblem (Clickable home like ChatGPT / Perplexity / Gemini) */}
          <div
            onClick={() => onSelectTab('today')}
            className="flex items-center gap-3 px-3 py-1 cursor-pointer select-none group transition-transform duration-150 active:scale-98"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelectTab('today')}
            title="LIFNIVO AI - Return to Today"
          >
            <LifnivoLogo size={40} variant="icon" />
            <div className="flex flex-col">
              <span className="font-bold text-[1.125rem] tracking-tight text-on-surface group-hover:text-primary transition-colors">
                LIFNIVO AI
              </span>
              <span className="text-[0.72rem] font-medium text-outline">
                Your life. Simplified.
              </span>
            </div>
          </div>

          {/* 5 Main Navigation Items */}
          <nav className="flex flex-col gap-1.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-all duration-150 text-left w-full group cursor-pointer ${
                    isActive
                      ? 'bg-secondary-container text-on-secondary-fixed font-medium shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[20px] transition-colors ${
                      isActive ? 'text-on-secondary-fixed' : 'text-outline group-hover:text-on-surface'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="text-[0.875rem] font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Workspace Brand / Status Badge */}
        <div className="flex flex-col gap-2 pt-4 px-1 border-t border-outline-variant/15">
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/20 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center font-medium text-xs shrink-0">
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[12px] font-semibold text-on-surface truncate">
                Private Workspace
              </span>
              <span className="text-[10px] text-outline flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary inline-block"></span>
                Safe & Isolated
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (Screens < md) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-container-lowest/95 backdrop-blur-xl border-t border-outline-variant/30 px-2 py-1.5 flex items-center justify-around shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
        aria-label="Mobile Navigation"
      >
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
                isActive ? 'text-secondary font-semibold' : 'text-outline hover:text-on-surface'
              }`}
            >
              <div
                className={`p-1 rounded-full transition-all ${
                  isActive ? 'bg-secondary-container text-on-secondary-fixed' : ''
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              </div>
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
