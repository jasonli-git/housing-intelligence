"use client";

import { type KeyboardEvent, useId, useState } from "react";

import { matchEntries, type SearchEntry } from "@/lib/search";

/**
 * A combobox over a list of places: type, arrow through the matches, Enter or a click to
 * pick one, Escape to close. Each match says what it is — "Township in Morris County" —
 * so two places with one name are two different answers. Shared by the bar's search
 * (#150) and the affordability page's "check a place" (Milestone 23); the caller says what
 * picking does.
 *
 * It avoids what iOS reads as an address field — autofill, autocorrect, capitalisation and
 * spelling off — and reopens its list whenever it is focused with text in it, so a value
 * AutoFill typed in is never a dead end that has to be deleted and retyped.
 */
export function PlacePicker({
  entries,
  onPick,
  onFocus,
  label,
  placeholder,
  name,
  initialQuery = "",
  keepPicked = false,
  failed = false,
  className,
  role,
}: {
  /** The places to match, or null while they load. */
  entries: SearchEntry[] | null;
  onPick: (entry: SearchEntry) => void;
  onFocus?: () => void;
  /** Read to a screen reader in place of a visible label. */
  label: string;
  placeholder: string;
  name: string;
  initialQuery?: string;
  /** Leave the picked place's name in the box, rather than clearing it. */
  keepPicked?: boolean;
  failed?: boolean;
  className?: string;
  role?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();

  const results = entries ? matchEntries(entries, query) : [];
  const showing = open && query.trim().length > 0;

  function pick(entry: SearchEntry) {
    setOpen(false);
    setQuery(keepPicked ? entry.name : "");
    onPick(entry);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (results.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((at) => (at + step + results.length) % results.length);
    } else if (event.key === "Enter" && showing && results[active]) {
      event.preventDefault();
      pick(results[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={className} role={role}>
      <label className="visually-hidden" htmlFor={`${id}-input`}>
        {label}
      </label>
      <input
        id={`${id}-input`}
        name={name}
        type="text"
        role="combobox"
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="go"
        aria-autocomplete="list"
        aria-expanded={showing}
        aria-controls={`${id}-list`}
        aria-activedescendant={showing && results[active] ? `${id}-option-${active}` : undefined}
        value={query}
        onFocus={() => {
          onFocus?.();
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {showing && (
        <ul id={`${id}-list`} role="listbox" className="search-results" aria-label="Places">
          {results.map((entry, index) => (
            <li
              key={entry.id}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === active}
              // mousedown, not click: a click lands after the input's blur has closed the list.
              onMouseDown={(event) => {
                event.preventDefault();
                pick(entry);
              }}
              onMouseEnter={() => setActive(index)}
            >
              <span className="result-name">{entry.name}</span>
              <span className="result-detail">{entry.detail}</span>
            </li>
          ))}
          {results.length === 0 && (
            <li className="search-empty" aria-disabled="true">
              {failed ? "Search is unavailable right now." : entries ? "No place by that name." : "Loading places…"}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
