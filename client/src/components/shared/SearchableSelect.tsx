import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function SearchableSelect({ value, onChange, onBlur, options, placeholder, disabled, className = '', id }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
        onBlur?.();
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, value, onBlur]);

  function selectOption(opt: string) {
    onChange(opt);
    setQuery(opt);
    setOpen(false);
    setHighlighted(-1);
    onBlur?.();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted >= 0 && filtered[highlighted]) {
        selectOption(filtered[highlighted]);
      } else {
        onChange(query);
        setOpen(false);
        onBlur?.();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery(value);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        id={id}
        ref={inputRef}
        type="text"
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
          setHighlighted(-1);
        }}
        onFocus={() => { if (!disabled) setOpen(true); }}
        onKeyDown={handleKeyDown}
        className="w-full border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-100 pr-7"
        autoComplete="off"
      />
      {!disabled && (
        <button
          type="button"
          tabIndex={-1}
          className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-400 hover:text-gray-600"
          onClick={() => { setOpen((o) => !o); inputRef.current?.focus(); }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={open ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
          </svg>
        </button>
      )}
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.map((opt, i) => (
            <li
              key={opt}
              onMouseDown={(e) => { e.preventDefault(); selectOption(opt); }}
              onMouseEnter={() => setHighlighted(i)}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === highlighted ? 'bg-blue-50 text-blue-700' : 'text-gray-800 hover:bg-gray-50'
              }`}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
