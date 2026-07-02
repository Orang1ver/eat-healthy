"use client";

type Props = {
  options: string[];
  selected: string[];
  disabled?: Set<string>;
  multi?: boolean;
  onToggle: (label: string) => void;
};

export function TagChips({ options, selected, disabled, multi = true, onToggle }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((label) => {
        const isOn = selected.includes(label);
        const isDisabled = disabled?.has(label) && !isOn;
        return (
          <button
            key={label}
            type="button"
            disabled={isDisabled}
            onClick={() => onToggle(label)}
            className="heal-btn text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            style={
              isOn
                ? { background: "var(--heal-amber-50)", color: "var(--heal-amber-text)", border: "1px solid transparent" }
                : { background: "var(--heal-card-bg)", color: "var(--heal-muted)", border: "0.5px solid var(--heal-card-border)" }
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
