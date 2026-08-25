interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function QuantityStepper({
  value,
  onChange,
  min = 0.25,
  max = 10,
  step = 0.25,
  label,
}: QuantityStepperProps) {
  function adjust(delta: number) {
    const next = Math.round(clamp(value + delta, min, max) * 100) / 100;
    onChange(next);
  }

  return (
    <div className="inline-flex items-center gap-2">
      {label && <span className="text-xs text-gray-500">{label}</span>}
      <div className="inline-flex items-center rounded-lg border border-gray-700 bg-gray-800">
        <button
          type="button"
          onClick={() => adjust(-step)}
          disabled={value <= min}
          className="px-2 py-1 text-sm text-gray-300 hover:text-white disabled:opacity-30"
          aria-label="Decrease servings"
        >
          −
        </button>
        <span className="min-w-[2.75rem] text-center text-xs font-medium text-gray-100">
          {formatQuantity(value)}×
        </span>
        <button
          type="button"
          onClick={() => adjust(step)}
          disabled={value >= max}
          className="px-2 py-1 text-sm text-gray-300 hover:text-white disabled:opacity-30"
          aria-label="Increase servings"
        >
          +
        </button>
      </div>
    </div>
  );
}
