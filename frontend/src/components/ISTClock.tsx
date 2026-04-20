/**
 * ISTClock — Real-time IST clock bar for all dashboards
 * Shows date, day, time in India Standard Time (Asia/Kolkata)
 */
import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface ISTClockProps {
  variant?: 'light' | 'dark';
  className?: string;
}

const ISTClock: React.FC<ISTClockProps> = ({ variant = 'light', className = '' }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...opts }).format(now);

  const timeStr = fmt({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dayStr  = fmt({ weekday: 'long' });
  const dateStr = fmt({ day: 'numeric', month: 'long', year: 'numeric' });

  const isDark = variant === 'dark';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Clock className={`h-4 w-4 flex-shrink-0 ${isDark ? 'text-indigo-300' : 'text-indigo-500'}`} />
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={`font-bold tabular-nums text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {timeStr}
        </span>
        <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
          {dayStr}, {dateStr}
        </span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full
          ${isDark ? 'bg-indigo-700/50 text-indigo-300' : 'bg-indigo-50 text-indigo-500 border border-indigo-200'}`}>
          IST
        </span>
      </div>
    </div>
  );
};

export default ISTClock;
