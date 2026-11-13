import React, { useState } from 'react';
import { Download, Smartphone, Wifi, WifiOff, X } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'sidebar' | 'compact' | 'card' }> = ({
  variant = 'sidebar',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    if (variant === 'card') {
      return (
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <Smartphone className="h-4 w-4 shrink-0" />
          <span>Installed as Standalone App</span>
        </div>
      );
    }
    return null;
  }

  const handleTrigger = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleTrigger}
        className={
          variant === 'compact'
            ? 'inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/30 bg-emerald-800/10 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-800/20 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200 whitespace-nowrap shrink-0 min-h-[40px]'
            : 'flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-900 active:scale-[0.99] transition whitespace-nowrap min-h-[44px]'
        }
      >
        <Download className="h-4 w-4 shrink-0" />
        <span>{isInstallable ? 'Install App' : 'Install on Device'}</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Install ROYAL KING VET PHARMA
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Run full-screen offline on Android, Windows, or iOS without opening the browser.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close install instructions"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-4 space-y-2.5 text-sm text-slate-700 dark:text-slate-200">
                <li>1. Tap the <strong>Share</strong> icon in Safari toolbar.</li>
                <li>2. Scroll down and select <strong>Add to Home Screen</strong>.</li>
                <li>3. Tap <strong>Add</strong> to install on your home screen.</li>
              </ol>
            ) : (
              <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Android (Chrome / Edge)</p>
                  <p className="text-slate-600 dark:text-slate-300">
                    Open browser menu (three dots) and tap <strong>Add to Home screen</strong> or <strong>Install app</strong>.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Windows Desktop (Chrome / Edge)</p>
                  <p className="text-slate-600 dark:text-slate-300">
                    Click the <strong>Install icon</strong> in the right side of the address bar or Menu &rarr; Save and share &rarr; Install app.
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full min-h-[44px] rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-600"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const ConnectivityStatusText: React.FC = () => {
  const isOnline = useOnlineStatus();
  return (
    <div
      className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${
        isOnline
          ? 'text-slate-600 dark:text-slate-300'
          : 'text-amber-700 dark:text-amber-300'
      }`}
    >
      {isOnline ? (
        <>
          <Wifi className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <span>Online · Local DB Ready</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>Offline Mode · Working Locally</span>
        </>
      )}
    </div>
  );
};

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="no-print flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>Offline Mode Active — All invoices, customers, products &amp; PDF downloads work locally.</span>
    </div>
  );
};
