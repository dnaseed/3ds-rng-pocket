import { Check, Clipboard, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { parseHex32, toHex32 } from '../../engine/math/uint';

interface HexSeedInputProps {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
}

export function HexSeedInput({ value, onChange, label }: HexSeedInputProps) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(value);
    }
  }, [value, focused]);

  const valid = draft === '' || parseHex32(draft) !== null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard unavailable
    }
  };

  const handlePaste = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      const parsed = parseHex32(txt);
      if (parsed !== null) {
        const formatted = toHex32(parsed);
        setDraft(formatted);
        onChange(formatted);
      }
    } catch {
      // clipboard unavailable
    }
  };

  const commit = (raw: string) => {
    const parsed = parseHex32(raw);
    if (parsed !== null) {
      const formatted = toHex32(parsed);
      setDraft(formatted);
      onChange(formatted);
    } else {
      setDraft(value);
    }
  };

  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-zinc-400">{label}</label>}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          maxLength={10}
          spellCheck={false}
          autoCapitalize="characters"
          autoComplete="off"
          aria-label={label ?? 'Hex Seed'}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit(draft);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit(draft);
              (e.target as HTMLInputElement).blur();
            }
          }}
          onChange={(e) => {
            const cleaned = e.target.value
              .trim()
              .replace(/^0[xX]/, '')
              .replace(/[^0-9a-fA-F]/g, '')
              .toUpperCase()
              .slice(0, 8);
            setDraft(cleaned);
            if (cleaned.length > 0) {
              const p = parseHex32(cleaned);
              if (p !== null) onChange(toHex32(p));
            }
          }}
          placeholder="00000000"
          className={`flex-1 min-w-0 min-h-11 rounded-xl bg-zinc-900 border px-3.5 font-mono text-base tracking-widest tabular-nums focus:outline-none focus:ring-2 ${
            valid
              ? 'border-zinc-700 text-amber-300 focus:ring-amber-500/40 focus:border-amber-500'
              : 'border-rose-500/70 text-rose-300 focus:ring-rose-500/40'
          }`}
        />
        <button
          type="button"
          onClick={handlePaste}
          title="Paste"
          aria-label="Paste"
          className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl bg-zinc-800/90 border border-zinc-700 text-zinc-200 active:scale-95 transition"
        >
          <Clipboard className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleCopy}
          title="Copy"
          aria-label="Copy"
          className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl bg-zinc-800/90 border border-zinc-700 text-zinc-200 active:scale-95 transition"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
