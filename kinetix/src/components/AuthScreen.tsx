import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthScreenProps {
  onLogin: (email: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('user@telemetrylab.com');
  const [password, setPassword] = useState('••••••••');
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [athleteName, setAthleteName] = useState('Alex Rivers');
  const [sport, setSport] = useState('Volleyball');
  const [notification, setNotification] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'forgot') {
      setNotification(`Password reset instructions sent to ${email}`);
      setTimeout(() => setNotification(null), 4000);
      setMode('login');
      return;
    }
    
    // Authenticate
    onLogin(email || 'user@telemetrylab.com');
  };

  const handleExternalAuth = (provider: string) => {
    onLogin(`${provider.toLowerCase()}@telemetrylab.com`);
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-[#e5e2e1] flex flex-col font-body relative selection:bg-[#00dddd] selection:text-black overflow-x-hidden">
      {/* Background Glow Accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#00dddd]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* TopAppBar */}
      <header className="w-full top-0 left-0 z-10 bg-transparent pt-8 pb-4">
        <div className="flex items-center justify-center w-full px-5 md:px-10">
          <h1 className="font-data-label text-xl md:text-2xl font-bold text-white tracking-[0.2em] uppercase flex items-center">
            <span className="material-symbols-outlined align-middle mr-2 text-[#00dddd] text-2xl">
              sensors
            </span>
            TELEMETRY LAB
          </h1>
        </div>
      </header>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#00dddd] text-black px-6 py-2.5 rounded-full font-data-label text-xs shadow-xl font-bold uppercase tracking-wider flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">mark_email_read</span>
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center px-4 pb-28 pt-4 relative z-10 my-auto">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md rounded-3xl p-6 sm:p-8 relative overflow-hidden transition-all duration-300 border border-[#3a4a49] hover:border-[#00dddd]/40 bg-[#1c1b1b] shadow-2xl"
        >
          <div className="relative z-10">
            <div className="text-center mb-8">
              <h2 className="font-data-label text-xs text-[#00dddd] uppercase tracking-[0.3em] mb-2 font-semibold">
                System Access
              </h2>
              <h3 className="font-headline text-xl sm:text-2xl text-white tracking-wider uppercase font-bold">
                {mode === 'login' && 'ATHLETE AUTHENTICATION'}
                {mode === 'register' && 'CREATE ATHLETE ACCOUNT'}
                {mode === 'forgot' && 'RESET PASSCODE'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'register' && (
                <>
                  <div className="space-y-1.5">
                    <label className="block font-data-label text-xs text-[#b9cac9] uppercase tracking-widest">
                      Full Name
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#00dddd]/70 text-lg">
                        badge
                      </span>
                      <input
                        className="w-full bg-black/40 border border-[#2a2a2a] rounded-xl py-3.5 pl-12 pr-4 text-white font-data-label text-sm focus:outline-none focus:border-[#00dddd] focus:ring-1 focus:ring-[#00dddd] transition-all duration-300 placeholder-white/20"
                        value={athleteName}
                        onChange={(e) => setAthleteName(e.target.value)}
                        placeholder="Alex Rivers"
                        type="text"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-data-label text-xs text-[#b9cac9] uppercase tracking-widest">
                      Primary Sport
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#00dddd]/70 text-lg">
                        sports_volleyball
                      </span>
                      <select
                        className="w-full bg-black/40 border border-[#2a2a2a] rounded-xl py-3.5 pl-12 pr-4 text-white font-data-label text-sm focus:outline-none focus:border-[#00dddd] focus:ring-1 focus:ring-[#00dddd] transition-all duration-300"
                        value={sport}
                        onChange={(e) => setSport(e.target.value)}
                      >
                        <option value="Volleyball" className="bg-[#1c1b1b]">Volleyball</option>
                        <option value="Sprints" className="bg-[#1c1b1b]">Sprints</option>
                        <option value="Basketball" className="bg-[#1c1b1b]">Basketball</option>
                        <option value="Cricket" className="bg-[#1c1b1b]">Cricket</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label className="block font-data-label text-xs text-[#b9cac9] uppercase tracking-widest" htmlFor="email">
                  Operator ID (Email)
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#00dddd]/70 text-lg">
                    person
                  </span>
                  <input
                    className="w-full bg-black/40 border border-[#2a2a2a] rounded-xl py-3.5 pl-12 pr-4 text-white font-data-label text-sm focus:outline-none focus:border-[#00dddd] focus:ring-1 focus:ring-[#00dddd] transition-all duration-300 placeholder-white/20"
                    id="email"
                    placeholder="user@telemetrylab.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div className="space-y-1.5">
                  <label className="block font-data-label text-xs text-[#b9cac9] uppercase tracking-widest" htmlFor="password">
                    Passcode
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#00dddd]/70 text-lg">
                      key
                    </span>
                    <input
                      className="w-full bg-black/40 border border-[#2a2a2a] rounded-xl py-3.5 pl-12 pr-4 text-white font-data-label text-sm focus:outline-none focus:border-[#00dddd] focus:ring-1 focus:ring-[#00dddd] transition-all duration-300 placeholder-white/20"
                      id="password"
                      placeholder="••••••••"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <button
                className="w-full bg-[#00dddd] hover:bg-[#00fbfb] hover:shadow-[0_0_20px_rgba(0,221,221,0.4)] text-black font-data-label font-bold rounded-xl py-4 uppercase tracking-[0.2em] transition-all active:scale-[0.98] duration-300 mt-6 flex items-center justify-center group cursor-pointer text-sm"
                type="submit"
              >
                {mode === 'login' && 'LOGIN TO LAB'}
                {mode === 'register' && 'REGISTER ATHLETE'}
                {mode === 'forgot' && 'SEND RESET LINK'}
                <span className="material-symbols-outlined ml-3 group-hover:translate-x-2 transition-transform duration-300 text-lg">
                  {mode === 'forgot' ? 'send' : 'login'}
                </span>
              </button>
            </form>

            {mode === 'login' && (
              <div className="mt-8">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#353534]" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 font-data-label text-[10px] text-[#b9cac9] tracking-[0.2em] bg-[#1c1b1b]">
                      EXTERNAL AUTH
                    </span>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() => handleExternalAuth('Google')}
                    className="w-full flex justify-center items-center py-3 px-4 border border-[#353534] rounded-xl shadow-sm bg-black/20 hover:bg-[#00dddd]/10 hover:border-[#00dddd]/50 text-white font-data-label text-xs uppercase tracking-widest transition-all duration-300 cursor-pointer"
                  >
                    <svg className="h-5 w-5 mr-3 fill-current" viewBox="0 0 24 24">
                      <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z" />
                    </svg>
                    Sign in with Google
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExternalAuth('Apple')}
                    className="w-full flex justify-center items-center py-3 px-4 border border-[#353534] rounded-xl shadow-sm bg-black/20 hover:bg-white/10 hover:border-[#3a4a49] text-white font-data-label text-xs uppercase tracking-widest transition-all duration-300 cursor-pointer"
                  >
                    <svg className="h-5 w-5 mr-3 fill-current" viewBox="0 0 24 24">
                      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.702z" />
                    </svg>
                    Sign in with Apple
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </main>

      {/* Footer Navigation Bar for Auth Actions */}
      <footer className="bg-black/80 backdrop-blur-md w-full border-t border-white/10 fixed bottom-0 z-50">
        <div className="flex justify-around items-center h-20 px-4 w-full max-w-lg mx-auto">
          <button
            onClick={() => setMode(mode === 'forgot' ? 'login' : 'forgot')}
            className={`flex flex-col items-center justify-center px-4 py-2 transition-all active:scale-95 duration-200 cursor-pointer ${
              mode === 'forgot' ? 'text-[#00dddd]' : 'text-[#b9cac9] hover:text-[#00dddd]'
            }`}
          >
            <span className="material-symbols-outlined mb-1 text-lg">
              {mode === 'forgot' ? 'arrow_back' : 'lock_reset'}
            </span>
            <span className="font-data-label uppercase tracking-[0.15em] text-[10px] font-bold">
              {mode === 'forgot' ? 'Back to Login' : 'Forgot Password'}
            </span>
          </button>

          <button
            onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
            className={`flex flex-col items-center justify-center px-4 py-2 transition-all active:scale-95 duration-200 cursor-pointer ${
              mode === 'register' ? 'text-[#00dddd]' : 'text-[#b9cac9] hover:text-[#00dddd]'
            }`}
          >
            <span className="material-symbols-outlined mb-1 text-lg">
              {mode === 'register' ? 'login' : 'person_add'}
            </span>
            <span className="font-data-label uppercase tracking-[0.15em] text-[10px] font-bold">
              {mode === 'register' ? 'Sign In Instead' : 'Create Account'}
            </span>
          </button>
        </div>
      </footer>
    </div>
  );
};
