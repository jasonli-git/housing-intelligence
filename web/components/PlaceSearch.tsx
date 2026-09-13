"use client";

import { useRouter } from "next/navigation";
import { type KeyboardEvent, useId, useRef, useState } from "react";

import { matchEntries, type SearchEntry } from "@/lib/search";

/**
 * Find a county, municipality or ZIP code by name (Milestone 17).
 *
 * A combobox over `search.json`, fetched the first time the box is focused rather than
 * carried in the page. Arrow keys move through the results, Enter opens one, Escape
 * closes the list; each result says what it is — "Township in Morris County" — so two
 * places with one name are two different answers.
 */
export function PlaceSearch() {
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const requested = useRef(false);
  const router = useRouter();
  const id = useId();

  const results = entries ? matchEntries(entries, query) : [];
  const showing = open && query.trim().length > 0;

  function load() {
    if (requested.current) return;
    requested.current = true;
    fetch("/search.json")
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data: SearchEntry[]) => setEntries(data))
      .catch(() => setFailed(true));
  }

  function go(entry: SearchEntry) {
    setOpen(false);
    router.push(`/regions/${entry.id}`);
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
      go(results[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="place-search">
      <label className="control-label" htmlFor={`${id}-input`}>
        Find a place
      </label>
      <input
        id={`${id}-input`}
        type="search"
        role="combobox"
        autoComplete="off"
        placeholder="Town, county or ZIP code"
        aria-autocomplete="list"
        aria-expanded={showing}
        aria-controls={`${id}-list`}
        aria-activedescendant={showing && results[active] ? `${id}-option-${active}` : undefined}
        value={query}
        onFocus={load}
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
                go(entry);
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
