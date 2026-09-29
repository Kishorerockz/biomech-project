import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const InstallAppBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(() => {
    return sessionStorage.getItem('pwa_banner_dismissed') === 'true';
  });
  const [showIOSTip, setShowIOSTip] = useState(false);

  if (isInstalled || isDismissed) {
    return null;
  }

  // Only show if browser supports direct install or on iOS Safari
  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSTip((prev) => !prev);
    } else {
      await promptInstall();
    }
  };

  return (
    <AnimatePresence>
      <motion.aside
        aria-label="PWA Installation Prompt"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-22 md:bottom-6 right-4 left-4 md:left-auto md:w-96 z-50 bg-[#151a1e]/95 backdrop-blur-md border border-[#00fbfb]/30 rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5),0_0_20px_rgba(0,251,251,0.15)] text-white"
      >
        <div className="flex items-start gap-3.5">
          {/* App Icon preview */}
          <div className="w-12 h-12 rounded-xl bg-[#0e1215] border border-[#00fbfb]/40 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(0,251,251,0.2)]">
            <img src="/icon.svg" alt="Kinetix" className="w-9 h-9" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="font-display-metrics text-sm font-semibold tracking-wide text-[#00fbfb]">
                Install Kinetix App
              </h4>
              <button
                onClick={handleDismiss}
                className="text-[#8899a6] hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                title="Dismiss"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <p className="text-xs text-[#b9cac9] mt-0.5 line-clamp-2">
              Launch directly from your home screen with full-screen telemetry & offline support.
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleInstallClick}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#00fbfb] hover:bg-[#38ffff] text-black font-data-label font-bold text-xs uppercase tracking-wider py-2 px-3 rounded-xl transition-all shadow-[0_0_12px_rgba(0,251,251,0.3)] active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">
                  {isIOS ? 'ios_share' : 'download'}
                </span>
                {isIOS ? 'How to Install' : 'Install App'}
              </button>

              <button
                onClick={handleDismiss}
                className="text-xs font-data-label uppercase tracking-wider text-[#8899a6] hover:text-white px-2.5 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Later
              </button>
            </div>

            {/* iOS Installation Instruction Accordion */}
            {isIOS && showIOSTip && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-3 pt-3 border-t border-white/10 text-[11px] text-[#b9cac9] space-y-1.5"
              >
                <div className="flex items-center gap-1.5 text-white font-medium">
                  <span className="material-symbols-outlined text-sm text-[#00fbfb]">info</span>
                  <span>To install on iPhone or iPad:</span>
                </div>
                <p>
                  1. Tap the <strong className="text-white">Share</strong> button in Safari toolbar.
                </p>
                <p>
                  2. Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
};
