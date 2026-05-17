import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

export type SortState<K extends string> = { key: K; dir: SortDir };

export function useSort<K extends string>(initial: SortState<K>) {
  const [sort, setSort] = useState<SortState<K>>(initial);
  function toggle(key: K) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }
  return { sort, toggle };
}

export function compareValues(a: unknown, b: unknown): number {
  // null/undefined sort last
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const an = typeof a === "string" ? Number(a) : NaN;
  const bn = typeof b === "string" ? Number(b) : NaN;
  if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function useSorted<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  getValue: (row: T, key: K) => unknown,
): T[] {
  return useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      const cmp = compareValues(getValue(a, sort.key), getValue(b, sort.key));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [rows, sort, getValue]);
}

type SortableHeaderProps<K extends string> = {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onToggle: (key: K) => void;
  align?: "left" | "right";
  className?: string;
};

export function SortableHeader<K extends string>({
  label,
  sortKey,
  sort,
  onToggle,
  align = "left",
  className = "",
}: SortableHeaderProps<K>) {
  const active = sort.key === sortKey;
  const arrow = active ? (sort.dir === "asc" ? "▲" : "▼") : "↕";
  return (
    <th className={`px-6 py-4 ${align === "right" ? "text-right" : "text-left"} ${className}`}>
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors ${
          active ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
        }`}
      >
        <span>{label}</span>
        <span className={`text-[10px] ${active ? "opacity-100" : "opacity-40"}`}>{arrow}</span>
      </button>
    </th>
  );
}
