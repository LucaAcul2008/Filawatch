import React from 'react';

export function Panel({ title, children, accent = '#ffb800', className = '' }) {
  return (
    <div className={`relative bg-blueprint/60 backdrop-blur-sm border border-line ${className}`}>
      <div className="absolute -top-px left-0 right-0 h-px" style={{ background: accent }} />
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-line">
          <h2 className="font-display text-xs uppercase tracking-[0.2em]" style={{ color: accent }}>
            ▸ {title}
          </h2>
          <span className="text-[10px] text-line font-display">[ {String(Math.floor(Math.random() * 99)).padStart(2, '0')} ]</span>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function Stat({ label, value, unit, accent = '#ffb800' }) {
  return (
    <div className="border border-line bg-blueprint/40 p-4 relative corner-marks">
      <div className="text-[10px] uppercase tracking-widest text-gray-500 font-display">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-display text-3xl font-bold" style={{ color: accent }}>{value}</span>
        {unit && <span className="text-xs text-gray-400">{unit}</span>}
      </div>
    </div>
  );
}

export function Button({ children, onClick, variant = 'primary', type = 'button', className = '' }) {
  const styles = {
    primary: 'bg-accent text-ink hover:bg-yellow-400',
    ghost: 'bg-transparent border border-line text-gray-300 hover:border-accent hover:text-accent',
    danger: 'bg-transparent border border-danger text-danger hover:bg-danger hover:text-ink',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      className={`px-4 py-2 font-display text-xs uppercase tracking-widest transition-all ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input({ label, ...props }) {
  return (
    <label className="block">
      {label && <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 font-display">{label}</div>}
      <input
        {...props}
        className="w-full bg-ink border border-line px-3 py-2 text-sm font-body focus:outline-none focus:border-accent transition-colors"
      />
    </label>
  );
}

export function Select({ label, options, ...props }) {
  return (
    <label className="block">
      {label && <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 font-display">{label}</div>}
      <select
        {...props}
        className="w-full bg-ink border border-line px-3 py-2 text-sm font-body focus:outline-none focus:border-accent transition-colors"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/80 backdrop-blur-sm" />
      <div
        onClick={e => e.stopPropagation()}
        className="relative bg-blueprint border border-accent max-w-2xl w-full max-h-[92vh] overflow-auto"
      >
        <div className="absolute -top-px left-0 right-0 h-px bg-accent" />
        <div className="flex items-center justify-between px-4 py-3 border-b border-line sticky top-0 bg-blueprint z-10">
          <h2 className="font-display text-sm uppercase tracking-widest text-accent">▸ {title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-accent text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
