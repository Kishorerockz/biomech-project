import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthScreenProps {
  onLogin: (email: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
<<<<<<< HEAD
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [athleteName, setAthleteName] = useState('');
  const [sport, setSport] = useState('Volleyball');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
=======
  const [email, setEmail] = useState('user@telemetrylab.com');
  const [password, setPassword] = useState('••••••••');
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [athleteName, setAthleteName] = useState('Alex Rivers');
  const [sport, setSport] = useState('Volleyball');
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
  const [notification, setNotification] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'forgot') {
<<<<<<< HEAD
      setNotification(`Passcode reset link dispatched to ${email}`);
=======
      setNotification(`Password reset instructions sent to ${email}`);
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
      setTimeout(() => setNotification(null), 4000);
      setMode('login');
      return;
    }
    
<<<<<<< HEAD
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLogin(email || 'demo_user');
    }, 600);
  };

  const handleExternalAuth = (provider: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLogin(`${provider.toLowerCase()}@kinetix.io`);
    }, 500);
  };

  const handleDemoAccess = () => {
    setEmail('pro.athlete@kinetix.io');
    setPassword('demopass123');
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLogin('pro.athlete@kinetix.io');
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-[#e5e2e1] flex flex-col justify-between font-body relative selection:bg-[#00dddd] selection:text-black overflow-x-hidden">
      {/* Dynamic Background Grid & Ambient Glows */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#00dddd]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#c9a050]/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="w-full relative z-20 py-5 px-6 lg:px-12 flex justify-between items-center border-b border-white/5 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00dddd] to-[#0284c7] flex items-center justify-center text-black font-bold shadow-[0_0_15px_rgba(0,221,221,0.3)]">
            <span className="material-symbols-outlined text-xl">sensors</span>
          </div>
          <div>
            <span className="font-display-metrics text-xl tracking-wider text-white font-bold block leading-none">
              KINETIX
            </span>
            <span className="font-data-label text-[10px] text-[#00dddd] tracking-[0.2em] uppercase font-semibold">
              Telemetry Studio
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-data-label text-[10px] text-emerald-400 uppercase tracking-widest font-semibold">
              Live Sensor Bus Ready
            </span>
          </div>

          <button
            onClick={handleDemoAccess}
            type="button"
            className="flex items-center gap-1.5 bg-gradient-to-r from-[#00dddd]/10 to-[#0284c7]/10 hover:from-[#00dddd]/20 hover:to-[#0284c7]/20 border border-[#00dddd]/30 text-[#00dddd] px-3.5 py-1.5 rounded-full font-data-label text-xs uppercase tracking-wider font-semibold transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">bolt</span>
            Instant Demo
          </button>
        </div>
      </header>

      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-24 left-1/2 z-50 bg-[#00dddd] text-black px-6 py-3 rounded-full font-data-label text-xs shadow-2xl font-bold uppercase tracking-wider flex items-center gap-2 border border-white/20"
          >
            <span className="material-symbols-outlined text-base">mark_email_read</span>
=======
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
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

<<<<<<< HEAD
      {/* Main Container - Responsive 2-Column Split on Large Screens */}
      <main className="flex-grow flex items-center justify-center px-4 py-8 relative z-10 w-full max-w-6xl mx-auto">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Biomechanics Telemetry Feature Showcase */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="hidden lg:flex lg:col-span-6 flex-col justify-center space-y-8 pr-6"
          >
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00dddd]/10 border border-[#00dddd]/20 text-[#00dddd] font-data-label text-xs uppercase tracking-widest font-semibold mb-4">
                <span className="material-symbols-outlined text-sm">precision_manufacturing</span>
                Next-Gen Motion Intelligence
              </div>
              <h1 className="font-headline text-3xl xl:text-4xl font-bold text-white tracking-wide uppercase leading-tight">
                High-Frequency Kinetic Telemetry & Analysis
              </h1>
              <p className="text-[#b9cac9] text-sm mt-3 leading-relaxed max-w-lg">
                Stream 100Hz tri-axial accelerometer data, calculate takeoff velocities, peak power outputs, and track explosive flight times with laboratory precision.
              </p>
            </div>

            {/* Live Metrics Mock Card */}
            <div className="bg-[#1c1b1b]/80 border border-[#3a4a49] rounded-2xl p-5 backdrop-blur-md shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00dddd] animate-ping" />
                  <span className="font-data-label text-xs text-white uppercase tracking-wider font-semibold">
                    Sensor Bus #01 • Active
                  </span>
                </div>
                <span className="font-data-label text-[11px] text-[#00dddd] font-semibold">
                  100 FPS Telemetry
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-black/40 border border-white/5 rounded-xl p-3">
                  <span className="font-data-label text-[10px] text-[#b9cac9] uppercase tracking-wider block mb-1">
                    Peak Vertical
                  </span>
                  <span className="font-display-metrics text-xl text-white font-bold">
                    68.4 <span className="text-xs font-normal text-[#00dddd]">cm</span>
                  </span>
                </div>

                <div className="bg-black/40 border border-white/5 rounded-xl p-3">
                  <span className="font-data-label text-[10px] text-[#b9cac9] uppercase tracking-wider block mb-1">
                    Takeoff Vel.
                  </span>
                  <span className="font-display-metrics text-xl text-white font-bold">
                    3.66 <span className="text-xs font-normal text-[#c9a050]">m/s</span>
                  </span>
                </div>

                <div className="bg-black/40 border border-white/5 rounded-xl p-3">
                  <span className="font-data-label text-[10px] text-[#b9cac9] uppercase tracking-wider block mb-1">
                    Peak Power
                  </span>
                  <span className="font-display-metrics text-xl text-white font-bold">
                    5,120 <span className="text-xs font-normal text-emerald-400">W</span>
                  </span>
                </div>
              </div>

              {/* Decorative Pulse Wave Graphic */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-[#b9cac9] font-data-label">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#00dddd]">verified</span>
                  Zero-G Gyro Auto-Calibrated
                </span>
                <span className="text-white/40">v2.4.0 Engine</span>
              </div>
            </div>

            {/* Testimonials / Features badging */}
            <div className="flex items-center gap-6 pt-2">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-[#2a2a2a] border-2 border-[#0e0e0e] flex items-center justify-center font-bold text-xs text-[#00dddd]">AR</div>
                <div className="w-8 h-8 rounded-full bg-[#1c1b1b] border-2 border-[#0e0e0e] flex items-center justify-center font-bold text-xs text-[#c9a050]">MC</div>
                <div className="w-8 h-8 rounded-full bg-[#252525] border-2 border-[#0e0e0e] flex items-center justify-center font-bold text-xs text-emerald-400">KD</div>
              </div>
              <div className="text-xs text-[#b9cac9]">
                <span className="text-white font-semibold">Trusted by 2,400+</span> elite athletes & sports performance laboratories.
              </div>
            </div>
          </motion.div>

          {/* Right Column: High-End Auth Form Container */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="col-span-1 lg:col-span-6 w-full max-w-md mx-auto"
          >
            <div className="bg-[#1c1b1b] border border-[#3a4a49] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
              
              {/* Form Mode Selector Segmented Tabs */}
              <div className="grid grid-cols-2 p-1 bg-black/50 rounded-2xl border border-white/5 mb-6">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={`py-2.5 rounded-xl font-data-label text-xs uppercase tracking-wider font-bold transition-all cursor-pointer ${
                    mode === 'login'
                      ? 'bg-[#00dddd] text-black shadow-lg'
                      : 'text-[#b9cac9] hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className={`py-2.5 rounded-xl font-data-label text-xs uppercase tracking-wider font-bold transition-all cursor-pointer ${
                    mode === 'register'
                      ? 'bg-[#00dddd] text-black shadow-lg'
                      : 'text-[#b9cac9] hover:text-white'
                  }`}
                >
                  New Account
                </button>
              </div>

              {/* Form Title & Context */}
              <div className="mb-6">
                <h2 className="font-headline text-xl sm:text-2xl text-white tracking-wide uppercase font-bold flex items-center justify-between">
                  <span>
                    {mode === 'login' && 'ACCESS TELEMETRY LAB'}
                    {mode === 'register' && 'CREATE ATHLETE ID'}
                    {mode === 'forgot' && 'RESET PASSCODE'}
                  </span>
                  {mode === 'forgot' && (
                    <button
                      onClick={() => setMode('login')}
                      type="button"
                      className="text-xs text-[#00dddd] hover:underline font-normal cursor-pointer lowercase"
                    >
                      ← back
                    </button>
                  )}
                </h2>
                <p className="text-xs text-[#b9cac9] mt-1 font-body">
                  {mode === 'login' && 'Enter your credentials to connect to live sensors'}
                  {mode === 'register' && 'Setup your athlete profile and sync your sensor ID'}
                  {mode === 'forgot' && 'We will send a reset passcode to your registered email'}
                </p>
              </div>

              {/* Form Fields */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="block font-data-label text-[11px] text-[#b9cac9] uppercase tracking-wider font-semibold">
                        Full Name
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#00dddd]/70 text-lg">
                          badge
                        </span>
                        <input
                          className="w-full bg-black/40 border border-[#2a2a2a] rounded-xl py-3 pl-11 pr-4 text-white font-data-label text-sm focus:outline-none focus:border-[#00dddd] focus:ring-1 focus:ring-[#00dddd] transition-all placeholder-white/20"
                          value={athleteName}
                          onChange={(e) => setAthleteName(e.target.value)}
                          placeholder="e.g. Alex Rivers"
                          type="text"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block font-data-label text-[11px] text-[#b9cac9] uppercase tracking-wider font-semibold">
                        Primary Sport Focus
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#00dddd]/70 text-lg">
                          sports_volleyball
                        </span>
                        <select
                          className="w-full bg-black/40 border border-[#2a2a2a] rounded-xl py-3 pl-11 pr-4 text-white font-data-label text-sm focus:outline-none focus:border-[#00dddd] focus:ring-1 focus:ring-[#00dddd] transition-all cursor-pointer"
                          value={sport}
                          onChange={(e) => setSport(e.target.value)}
                        >
                          <option value="Volleyball" className="bg-[#1c1b1b]">Volleyball</option>
                          <option value="Basketball" className="bg-[#1c1b1b]">Basketball</option>
                          <option value="Track & Field" className="bg-[#1c1b1b]">Track & Field / Sprints</option>
                          <option value="High Jump / Long Jump" className="bg-[#1c1b1b]">High Jump / Long Jump</option>
                          <option value="Cricket / Baseball" className="bg-[#1c1b1b]">Cricket / Baseball</option>
                          <option value="Soccer / Football" className="bg-[#1c1b1b]">Soccer / Football</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <label className="block font-data-label text-[11px] text-[#b9cac9] uppercase tracking-wider font-semibold" htmlFor="email">
                    Operator ID / Email
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#00dddd]/70 text-lg">
                      mail
                    </span>
                    <input
                      className="w-full bg-black/40 border border-[#2a2a2a] rounded-xl py-3 pl-11 pr-4 text-white font-data-label text-sm focus:outline-none focus:border-[#00dddd] focus:ring-1 focus:ring-[#00dddd] transition-all placeholder-white/20"
                      id="email"
                      placeholder="alex.rivers@kinetix.io"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
=======
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
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
                      required
                    />
                  </div>
                </div>
<<<<<<< HEAD

                {mode !== 'forgot' && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="block font-data-label text-[11px] text-[#b9cac9] uppercase tracking-wider font-semibold" htmlFor="password">
                        Security Passcode
                      </label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => setMode('forgot')}
                          className="font-data-label text-[10px] text-[#00dddd] hover:underline uppercase tracking-wider cursor-pointer"
                        >
                          Forgot Passcode?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#00dddd]/70 text-lg">
                        key
                      </span>
                      <input
                        className="w-full bg-black/40 border border-[#2a2a2a] rounded-xl py-3 pl-11 pr-11 text-white font-data-label text-sm focus:outline-none focus:border-[#00dddd] focus:ring-1 focus:ring-[#00dddd] transition-all placeholder-white/20"
                        id="password"
                        placeholder="••••••••••••"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#b9cac9] hover:text-white transition-colors cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        <span className="material-symbols-outlined text-lg">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Remember me & Checkbox */}
                {mode === 'login' && (
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded bg-black/50 border-[#3a4a49] text-[#00dddd] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#00dddd]"
                      />
                      <span className="font-data-label text-xs text-[#b9cac9]">
                        Remember session ID
                      </span>
                    </label>
                  </div>
                )}

                {/* Primary Submit Button */}
                <button
                  className="w-full bg-[#00dddd] hover:bg-[#00fbfb] hover:shadow-[0_0_25px_rgba(0,221,221,0.4)] text-black font-data-label font-bold rounded-xl py-3.5 uppercase tracking-[0.2em] transition-all active:scale-[0.98] duration-300 mt-4 flex items-center justify-center cursor-pointer text-sm disabled:opacity-50 shadow-lg"
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Authenticating...
                    </span>
                  ) : (
                    <>
                      {mode === 'login' && 'Connect Session'}
                      {mode === 'register' && 'Initialize Athlete Profile'}
                      {mode === 'forgot' && 'Send Reset Passcode'}
                      <span className="material-symbols-outlined ml-2 text-lg">
                        {mode === 'forgot' ? 'send' : 'arrow_forward'}
                      </span>
                    </>
                  )}
                </button>
              </form>

              {/* SSO Section */}
              {mode === 'login' && (
                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#353534]" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-3 font-data-label text-[10px] text-[#b9cac9] tracking-[0.2em] uppercase bg-[#1c1b1b]">
                        or authenticate with
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleExternalAuth('Google')}
                      className="flex justify-center items-center py-2.5 px-3 border border-[#353534] rounded-xl bg-black/30 hover:bg-white/10 hover:border-[#00dddd]/40 text-white font-data-label text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer"
                    >
                      <svg className="h-4 w-4 mr-2 fill-current" viewBox="0 0 24 24">
                        <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z" />
                      </svg>
                      Google
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExternalAuth('Apple')}
                      className="flex justify-center items-center py-2.5 px-3 border border-[#353534] rounded-xl bg-black/30 hover:bg-white/10 hover:border-[#3a4a49] text-white font-data-label text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer"
                    >
                      <svg className="h-4 w-4 mr-2 fill-current" viewBox="0 0 24 24">
                        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.702z" />
                      </svg>
                      Apple ID
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer & Security Compliance Info */}
      <footer className="w-full py-4 px-6 border-t border-white/5 bg-black/40 backdrop-blur-md relative z-20">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2 font-data-label text-[10px] text-[#b9cac9] tracking-wider uppercase">
            <span className="material-symbols-outlined text-sm text-[#00dddd]">lock</span>
            <span>256-BIT ENCRYPTED TELEMETRY STREAM</span>
            <span className="text-white/20">•</span>
            <span>SOC2 COMPLIANT</span>
          </div>
          <div className="font-data-label text-[10px] text-white/40 tracking-wider">
            © {new Date().getFullYear()} KINETIX SPORTS SCIENCE INC. ALL RIGHTS RESERVED.
          </div>
=======
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
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
        </div>
      </footer>
    </div>
  );
};
<<<<<<< HEAD

=======
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
