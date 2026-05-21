import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Loader2, Check } from 'lucide-react';

export interface SelectOption {
  label: string;
  value: string | number;
}

interface CustomSelectProps {
  name: string;
  value: string | number;
  onChange: (e: { target: { name: string; value: string | number } }) => void;
  options: SelectOption[];
  icon?: React.ElementType;
  disabled?: boolean;
  placeholder?: string;
  loading?: boolean;
  className?: string;
  align?: 'left' | 'right';
  dropDirection?: 'auto' | 'up' | 'down';
}

export function CustomSelect({
  name,
  value,
  onChange,
  options,
  icon: Icon,
  disabled = false,
  placeholder = '',
  loading = false,
  className = '',
  align = 'left',
  dropDirection = 'auto',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const [actualDirection, setActualDirection] = useState<'up' | 'down'>('down');

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  // Handle clicking outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle dropdown positioning direction (up vs down) dynamically if direction is 'auto'
  useEffect(() => {
    if (isOpen && containerRef.current) {
      if (dropDirection === 'up') {
        setActualDirection('up');
      } else if (dropDirection === 'down') {
        setActualDirection('down');
      } else {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        if (spaceBelow < 200 && spaceAbove > spaceBelow) {
          setActualDirection('up');
        } else {
          setActualDirection('down');
        }
      }
    }
  }, [isOpen, dropDirection]);

  const handleSelect = (newValue: string | number) => {
    if (disabled || loading) return;
    onChange({ target: { name, value: newValue } });
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative w-full select-none", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full bg-white dark:bg-[#16191E] border border-zinc-200 dark:border-[#2D3139] rounded-lg py-2 pl-3 pr-10 text-xs font-semibold text-zinc-900 dark:text-[#E0E0E0] outline-none transition-all shadow-sm flex items-center justify-between text-left",
          Icon ? "pl-9" : "pl-3",
          isOpen ? "border-indigo-500 ring-2 ring-indigo-500/10 dark:ring-indigo-500/20" : "hover:border-zinc-350 dark:hover:border-[#3E4552]",
          disabled ? "opacity-55 cursor-not-allowed bg-zinc-50 dark:bg-[#0F1115]" : "cursor-pointer"
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {Icon && (
            <span className="text-zinc-400 dark:text-zinc-500 shrink-0">
              <Icon className="w-4 h-4" />
            </span>
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : (placeholder || 'Select...')}
          </span>
        </div>

        <span className="absolute right-3 text-zinc-400 dark:text-zinc-500 shrink-0 flex items-center pointer-events-none">
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isOpen ? "transform rotate-180" : "")} />
          )}
        </span>
      </button>

      {/* Dropdown Options List */}
      {isOpen && (
        <div
          ref={optionsRef}
          className={cn(
            "absolute z-50 w-full min-w-[140px] bg-white dark:bg-[#1C2028] border border-zinc-200 dark:border-[#2D3139] rounded-lg shadow-xl py-1 focus:outline-none transition-all duration-150 ease-out animate-in fade-in-50 zoom-in-95",
            actualDirection === 'up' ? "bottom-full mb-1.5" : "top-full mt-1.5",
            align === 'right' ? "right-0" : "left-0"
          )}
        >
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-400 dark:text-zinc-500 italic text-center">
                No options available
              </div>
            ) : (
              options.map((option) => {
                const isSelected = String(option.value) === String(value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between transition-colors",
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                    )}
                  >
                    <span className="truncate pr-4">{option.label}</span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Simple fallback helper for joining classNames gracefully
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
