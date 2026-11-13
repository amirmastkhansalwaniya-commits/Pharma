import React, { useState } from 'react';
import { Delete, Lock, ShieldCheck } from 'lucide-react';
import { verifyPin } from '../utils/security';
import { BrandCrest } from './BrandMark';

interface PinLockScreenProps {
  storedHash: string;
  onUnlock: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({ storedHash, onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleDigit = (digit: string) => {
    if (pin.length >= 6) return;
    setError('');
    setPin((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setError('');
    setPin((prev) => prev.slice(0, -1));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.length < 4) {
      setError('Enter your 4 to 6 digit PIN');
      return;
    }
    setChecking(true);
    try {
      const ok = await verifyPin(pin, storedHash);
      if (ok) {
        setPin('');
        onUnlock();
      } else {
        setError('Incorrect PIN. Please try again.');
        setPin('');
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <BrandCrest className="h-12 w-12" />
          <h1 className="mt-3 text-lg font-bold tracking-tight text-white">
            ROYAL KING VET PHARMA
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <Lock className="h-3.5 w-3.5 text-emerald-400" />
            <span>Application Locked · Enter Security PIN</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6">
          <div className="flex justify-center gap-2.5">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className={`flex h-11 w-10 items-center justify-center rounded-xl border font-mono text-lg font-bold transition ${
                  idx < pin.length
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-700 bg-slate-800/70 text-slate-600'
                }`}
              >
                {idx < pin.length ? '•' : ''}
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-3 text-center text-xs font-medium text-rose-400" role="alert">
              {error}
            </p>
          )}

          <div className="mt-6 grid grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDigit(d)}
                className="min-h-[52px] rounded-xl border border-slate-800 bg-slate-800/80 font-mono text-lg font-semibold text-white hover:bg-slate-700 active:scale-95 transition"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={handleBackspace}
              className="flex min-h-[52px] items-center justify-center rounded-xl border border-slate-800 bg-slate-800/60 text-slate-300 hover:bg-slate-700 active:scale-95 transition"
              aria-label="Delete last digit"
            >
              <Delete className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="min-h-[52px] rounded-xl border border-slate-800 bg-slate-800/80 font-mono text-lg font-semibold text-white hover:bg-slate-700 active:scale-95 transition"
            >
              0
            </button>
            <button
              type="submit"
              disabled={checking || pin.length < 4}
              className="flex min-h-[52px] items-center justify-center gap-1 rounded-xl bg-emerald-700 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-40 active:scale-95 transition"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Unlock</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
