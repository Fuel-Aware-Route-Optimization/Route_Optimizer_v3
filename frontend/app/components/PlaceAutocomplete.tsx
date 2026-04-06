"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlaceSuggestion } from "../types";

interface PlaceAutocompleteProps {
  id: string;
  label: string;
  value: string;
  loading: boolean;
  suggestions: PlaceSuggestion[];
  selectedPlace: PlaceSuggestion | null;
  onChange: (value: string) => void;
  onSelect: (place: PlaceSuggestion) => void;
  onSubmit: () => void;
}

export default function PlaceAutocomplete({
  id,
  label,
  value,
  loading,
  suggestions,
  selectedPlace,
  onChange,
  onSelect,
  onSubmit,
}: PlaceAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLLabelElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const showSuggestions = isOpen && suggestions.length > 0;
  const highlightedIndex = Math.min(activeIndex, Math.max(suggestions.length - 1, 0));
  const statusText = useMemo(() => {
    if (loading) return "Searching places";
    if (selectedPlace && value === selectedPlace.label) return "Selected";
    if (value.trim().length < 2) return "Type a city or address";
    return `${suggestions.length} suggestions`;
  }, [loading, selectedPlace, suggestions.length, value]);

  return (
    <label className="search-field" ref={rootRef}>
      <span className="field-label">{label}</span>
      <div className={`field-input-wrap ${showSuggestions ? "open" : ""}`}>
        <input
          id={id}
          value={value}
          autoComplete="off"
          spellCheck={false}
          placeholder="Search any city or address"
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((current) =>
                Math.min(current + 1, Math.max(suggestions.length - 1, 0)),
              );
              return;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => Math.max(current - 1, 0));
              return;
            }

            if (event.key === "Enter") {
              event.preventDefault();
              if (showSuggestions && suggestions[highlightedIndex]) {
                onSelect(suggestions[highlightedIndex]);
                setIsOpen(false);
                return;
              }
              setIsOpen(false);
              onSubmit();
            }

            if (event.key === "Escape") {
              setIsOpen(false);
            }
          }}
        />
        <span className="field-status">{statusText}</span>
      </div>

      {showSuggestions ? (
        <div className="suggestions-popover" role="listbox" aria-label={`${label} suggestions`}>
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              className={`suggestion-item ${index === highlightedIndex ? "active" : ""}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => {
                onSelect(suggestion);
                setIsOpen(false);
              }}
            >
              <span className="suggestion-primary">{suggestion.primary_text}</span>
              <span className="suggestion-secondary">{suggestion.secondary_text}</span>
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}
