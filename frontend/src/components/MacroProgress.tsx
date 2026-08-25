interface MacroProgressProps {
  label: string;
  consumed: number;
  target: number;
  unit?: string;
  colorClass?: string;
}

export function MacroProgress({
  label,
  consumed,
  target,
  unit = '',
  colorClass = 'bg-amber-400',
}: MacroProgressProps) {
  const pct = target > 0 ? Math.min(100, (consumed / target) * 100) : 0;
  const over = target > 0 && consumed > target;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium text-gray-200">{label}</span>
        <span className={over ? 'text-red-400' : 'text-gray-400'}>
          {Math.round(consumed)}
          {unit} / {Math.round(target)}
          {unit}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-800">
        <div
          className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
