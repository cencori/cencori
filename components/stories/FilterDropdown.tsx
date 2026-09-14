"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type FilterGroup = {
  heading?: string;
  options: string[];
};

export function FilterDropdown({
  label,
  icon,
  groups,
  selected,
  onToggle,
  onClear,
  closeOnSelect = false,
}: {
  label: string;
  icon?: ReactNode;
  groups: FilterGroup[];
  selected: string[];
  onToggle: (option: string) => void;
  onClear: () => void;
  closeOnSelect?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open ]);

  return (
    <span className="relative inline-flex" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex min-h-11 items-center gap-2 bg-transparent px-1 text-sm"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {closeOnSelect && selected.length > 0
          ? selected[0]
          : selected.length > 0
            ? `${label} (${selected.length})`
            : label}
        {icon}
      </button>

      {open ? (
        <span className="absolute left-0 top-full z-20 mt-2 min-w-48 rounded-xl bg-[#111110] p-1.5 text-[#f4f4ef] shadow-xl">
          {groups.map((group) => (
            <span className="block" key={group.heading ?? "options"}>
              {group.heading ? (
                <span className="block px-2.5 pb-0.5 pt-1.5 text-[11px] uppercase tracking-wide text-white/45">
                  {group.heading}
                </span>
              ) : null}
              {group.options.map((option) => {
                const checked = selected.includes(option);
                return (
                  <label
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs hover:bg-white/10"
                    key={option}
                  >
                    <input
                      checked={checked}
                      className="sr-only"
                      onChange={() => {
                        onToggle(option);
                        if (closeOnSelect) setOpen(false);
                      }}
                      type="checkbox"
                    />
                    <span
                      aria-hidden="true"
                      className={`grid size-3.5 shrink-0 place-items-center rounded-[5px] ${
                        checked ? "bg-[#f4f4ef]" : "bg-white/15"
                      }`}
                    >
                      {checked ? (
                        <svg
                          fill="none"
                          height="10"
                          viewBox="0 0 10 10"
                          width="10"
                        >
                          <path
                            d="M1.5 5.2 4 7.5 8.5 2.5"
                            stroke="#111110"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.6"
                          />
                        </svg>
                      ) : null}
                    </span>
                    {option}
                  </label>
                );
              })}
            </span>
          ))}
          {selected.length > 0 ? (
            <button
              className="mt-0.5 w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-white/55 hover:bg-white/10"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              type="button"
            >
              Clear
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
