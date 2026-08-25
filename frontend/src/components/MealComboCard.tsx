import { scaleItemMacros, sumScaledMacros } from '../lib/quantity';
import type { MenuItem } from '../lib/types';
import { QuantityStepper } from './QuantityStepper';

interface ComboItemView {
  item: MenuItem;
  quantity: number;
}

interface MealComboCardProps {
  items: ComboItemView[];
  allItems: MenuItem[];
  onSwap: (itemIndex: number, replacement: MenuItem) => void;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onLog: () => void;
  comboIndex: number;
  logging: boolean;
  highlighted?: boolean;
}

export function MealComboCard({
  items,
  allItems,
  onSwap,
  onQuantityChange,
  onLog,
  comboIndex,
  logging,
  highlighted = false,
}: MealComboCardProps) {
  const totals = sumScaledMacros(items);

  return (
    <div
      className={`flex flex-col rounded-2xl border p-5 ${
        highlighted
          ? 'border-amber-400/50 bg-amber-400/[0.04] shadow-lg shadow-amber-400/5'
          : 'border-gray-800 bg-gray-900'
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-white">Option {comboIndex + 1}</h3>
          {highlighted && (
            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
              Best fit
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="rounded-full bg-gray-800 px-2 py-1 font-medium text-gray-200">
            {Math.round(totals.calories)} kcal
          </span>
          <span className="rounded-full bg-sky-400/10 px-2 py-1 font-medium text-sky-300">
            {Math.round(totals.proteinG)}g protein
          </span>
        </div>
      </div>

      <ul className="flex-1 space-y-2">
        {items.map(({ item, quantity }, itemIndex) => {
          const scaled = scaleItemMacros(item, quantity);
          return (
            <li
              key={item.id}
              className="rounded-xl border border-gray-800/80 bg-black/20 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-100">{item.name}</p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {item.station}
                    {item.servingSizeLabel ? ` · 1 serving = ${item.servingSizeLabel}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs font-medium text-gray-400">
                  <div>{Math.round(scaled.calories)} kcal</div>
                  <div className="text-gray-500">{Math.round(scaled.proteinG)}g protein</div>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2">
                <QuantityStepper
                  value={quantity}
                  onChange={(q) => onQuantityChange(item.id, q)}
                />
                <select
                  className="min-w-0 flex-1 cursor-pointer rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-xs text-gray-300 outline-none focus:border-amber-400"
                  value={item.id}
                  onChange={(e) => {
                    const replacement = allItems.find((i) => i.id === e.target.value);
                    if (replacement) onSwap(itemIndex, replacement);
                  }}
                >
                  <option value={item.id}>Keep this item</option>
                  {allItems
                    .filter((i) => i.id !== item.id && !i.nutritionEstimated)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        Swap for {i.name}
                      </option>
                    ))}
                </select>
              </div>
            </li>
          );
        })}
      </ul>

      <button
        onClick={onLog}
        disabled={logging}
        className="mt-4 w-full rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:opacity-50"
      >
        {logging ? 'Logging…' : 'Log this meal'}
      </button>
    </div>
  );
}
