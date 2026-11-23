import React, { useEffect, useState } from 'react';

interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  allowNegative?: boolean;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Compact numeric input that lets users freely erase all digits without
 * forcing a stuck "0", and clamps/commits cleanly on blur or Enter.
 */
export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  min = 0,
  max = 99999999,
  allowNegative,
  ariaLabel,
  placeholder,
  className = '',
}) => {
  const canBeNegative = allowNegative ?? min < 0;
  const [draft, setDraft] = useState<string>(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(String(value));
    }
  }, [value, focused]);

  const clamp = (n: number): number => Math.min(max, Math.max(min, n));

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '-') {
      const fallback = clamp(0);
      onChange(fallback);
      setDraft(String(fallback));
      return;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = clamp(parsed);
    onChange(clamped);
    setDraft(String(clamped));
  };

  return (
    <input
      type="text"
      inputMode={canBeNegative ? 'text' : 'numeric'}
      pattern={canBeNegative ? '-?[0-9]*' : '[0-9]*'}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={focused ? draft : String(value)}
      onFocus={() => {
        setFocused(true);
        setDraft(String(value));
      }}
      onBlur={() => {
        setFocused(false);
        commit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit(draft);
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      onChange={(e) => {
        const raw = e.target.value;
        const cleaned = canBeNegative
          ? raw.replace(/(?!^)-|[^0-9-]/g, '')
          : raw.replace(/[^0-9]/g, '');
        setDraft(cleaned);
        if (cleaned !== '' && cleaned !== '-') {
          const parsed = Number.parseInt(cleaned, 10);
          if (!Number.isNaN(parsed)) {
            onChange(clamp(parsed));
          }
        }
      }}
      className={className}
    />
  );
};
