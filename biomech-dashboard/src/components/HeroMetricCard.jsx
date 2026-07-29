import React, { useState, useEffect } from 'react';
import { motion, animate, useMotionValue, useTransform } from 'motion/react';

export default function HeroMetricCard({ liveJumpHeight }) {
  const [maxHeight, setMaxHeight] = useState(0);
  const [isPeak, setIsPeak] = useState(false);
  
  // Framer Motion values for the tweening number counter
  const count = useMotionValue(0);
  const rounded = useTransform(count, (value) => Math.round(value * 10) / 10);

  useEffect(() => {
    if (liveJumpHeight > maxHeight) {
      setMaxHeight(liveJumpHeight);
      setIsPeak(true);
      
      // Animate the number counting up rapidly instead of snapping instantly
      const animation = animate(count, liveJumpHeight, { duration: 0.4 });
      
      // Remove the "NEW PEAK" chip after 800ms
      const timeout = setTimeout(() => setIsPeak(false), 800);
      
      return () => {
        animation.stop();
        clearTimeout(timeout);
      };
    }
  }, [liveJumpHeight, maxHeight, count]);

  return (
    <motion.section 
      layout
      transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
      className="w-full max-w-md"
    >
      <div className="card-base p-lg relative flex flex-col items-center justify-center text-center overflow-hidden min-h-[220px]">
        {/* Decorative background elements */}
        <div 
          className="absolute inset-0 opacity-10 pointer-events-none" 
          style={{ backgroundImage: "radial-gradient(circle at center, #00fbfb 0%, transparent 70%)" }}
        />
        
        {isPeak && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-4 right-4 flex items-center gap-2 bg-error-container/20 border border-secondary-container px-3 py-1 rounded-full"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-secondary-container pulse-dot-red"></div>
            <span className="font-data-label text-[10px] tracking-wider text-secondary-container">NEW PEAK</span>
          </motion.div>
        )}
        
        <div className="mt-8 mb-4">
          <h2 className="font-data-label text-data-label text-on-surface-variant tracking-widest uppercase mb-xs">
            Last Jump
          </h2>
          <div className="font-display-metrics text-display-metrics text-primary-fixed">
            <motion.span>{rounded}</motion.span>
            <span className="text-headline-md text-on-surface-variant ml-1">cm</span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
