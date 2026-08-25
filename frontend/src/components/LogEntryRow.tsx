import type { LogEntry } from '../lib/types';

const SOURCE_ICON: Record<LogEntry['source'], string> = {
  gt_menu: '🏫',
  photo_gt_match: '📷',
  photo_outside: '📷',
};

interface LogEntryRowProps {
  entry: LogEntry;
  onDelete: (id: string) => void;
}

export function LogEntryRow({ entry, onDelete }: LogEntryRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span title={entry.source}>{SOURCE_ICON[entry.source]}</span>
          <span className="truncate font-medium text-white">{entry.dish_name}</span>
        </div>
        <p className="mt-0.5 text-xs capitalize text-gray-400">
          {entry.meal_period} · {entry.calories} kcal
          {entry.protein_g != null ? ` · ${Math.round(Number(entry.protein_g))}g protein` : ''}
        </p>
      </div>
      <button
        onClick={() => onDelete(entry.id)}
        className="shrink-0 rounded-full px-2 py-1 text-xs text-gray-500 hover:bg-red-500/10 hover:text-red-400"
        aria-label={`Delete ${entry.dish_name}`}
      >
        Delete
      </button>
    </div>
  );
}
