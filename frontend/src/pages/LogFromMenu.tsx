import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { useTodayLog } from '../hooks/useTodayLog';
import { getMenu } from '../lib/api';
import { remainingBudgetForMeal } from '../lib/budget';
import { filterMenuByDietaryTags } from '../lib/dietaryFilter';
import { currentMealPeriod, todayIso } from '../lib/mealTiming';
import { dishNameWithQuantity, scaleItemMacros } from '../lib/quantity';
import { suggestMealCombos, type ScoredCombo } from '../lib/suggestions';
import { supabase } from '../lib/supabaseClient';
import { DINING_HALLS, MENU_MEAL_PERIODS, type DiningHallId, type MenuItem } from '../lib/types';
import { MealComboCard } from '../components/MealComboCard';
import { QuantityStepper } from '../components/QuantityStepper';

export function LogFromMenu() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { entries: todaysEntries, refresh: refreshLog } = useTodayLog();

  const [diningHall, setDiningHall] = useState<DiningHallId>(DINING_HALLS[0].id);
  const [mealPeriod, setMealPeriod] = useState(currentMealPeriod());
  const [items, setItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuWarning, setMenuWarning] = useState<string | null>(null);
  const [combos, setCombos] = useState<ScoredCombo[]>([]);
  // Portion sizes, keyed by menu item id and shared between the suggested
  // combos and the full-menu browser — 1 means "one Nutrislice serving".
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loggingIndex, setLoggingIndex] = useState<number | null>(null);
  const [loggedMessage, setLoggedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredItems = useMemo(
    () => filterMenuByDietaryTags(items, profile?.dietary_tags ?? []),
    [items, profile],
  );

  const remaining = useMemo(
    () => (profile ? remainingBudgetForMeal(profile, mealPeriod, todaysEntries) : null),
    [profile, mealPeriod, todaysEntries],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadMenu() {
      setMenuLoading(true);
      setError(null);
      setMenuWarning(null);
      try {
        const res = await getMenu(diningHall, mealPeriod, todayIso());
        if (cancelled) return;
        setItems(res.items);
        if (res.source === 'unavailable' || res.source === 'stale-cache') {
          setMenuWarning(res.warning ?? 'Menu may be out of date.');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load menu');
      } finally {
        if (!cancelled) setMenuLoading(false);
      }
    }
    loadMenu();
    return () => {
      cancelled = true;
    };
  }, [diningHall, mealPeriod]);

  useEffect(() => {
    if (!remaining) return;
    setCombos(suggestMealCombos(filteredItems, remaining));
    setQuantities({});
  }, [filteredItems, remaining]);

  function getQuantity(itemId: string): number {
    return quantities[itemId] ?? 1;
  }

  function setQuantity(itemId: string, quantity: number) {
    setQuantities((prev) => ({ ...prev, [itemId]: quantity }));
  }

  function handleSwap(comboIndex: number, itemIndex: number, replacement: MenuItem) {
    setCombos((prev) => {
      const next = [...prev];
      const combo = next[comboIndex];
      const newItems = [...combo.items];
      newItems[itemIndex] = replacement;
      next[comboIndex] = { ...combo, items: newItems };
      return next;
    });
  }

  async function logCombo(comboIndex: number) {
    if (!user) return;
    const combo = combos[comboIndex];
    setLoggingIndex(comboIndex);
    setError(null);
    try {
      const rows = combo.items.map((item) => {
        const quantity = getQuantity(item.id);
        const scaled = scaleItemMacros(item, quantity);
        return {
          user_id: user.id,
          log_date: todayIso(),
          meal_period: mealPeriod,
          source: 'gt_menu' as const,
          dish_name: dishNameWithQuantity(item.name, quantity),
          calories: Math.round(scaled.calories),
          protein_g: scaled.proteinG,
          carbs_g: scaled.carbsG,
          fat_g: scaled.fatG,
          gt_menu_item_ref: item,
        };
      });
      const { error: insertError } = await supabase.from('log_entries').insert(rows);
      if (insertError) throw insertError;
      setLoggedMessage(`Logged ${combo.items.length} item(s) to ${mealPeriod}.`);
      await refreshLog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log meal');
    } finally {
      setLoggingIndex(null);
    }
  }

  async function logSingleItem(item: MenuItem) {
    if (!user) return;
    setError(null);
    try {
      const quantity = getQuantity(item.id);
      const scaled = scaleItemMacros(item, quantity);
      const { error: insertError } = await supabase.from('log_entries').insert({
        user_id: user.id,
        log_date: todayIso(),
        meal_period: mealPeriod,
        source: 'gt_menu',
        dish_name: dishNameWithQuantity(item.name, quantity),
        calories: Math.round(scaled.calories),
        protein_g: scaled.proteinG,
        carbs_g: scaled.carbsG,
        fat_g: scaled.fatG,
        gt_menu_item_ref: item,
      });
      if (insertError) throw insertError;
      setLoggedMessage(`Logged ${dishNameWithQuantity(item.name, quantity)}.`);
      await refreshLog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log item');
    }
  }

  if (profileLoading) return <p className="p-6 text-center text-gray-400">Loading…</p>;
  if (!profile) return <Navigate to="/settings" replace />;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Log from GT Menu</h1>

      <div className="flex flex-wrap gap-3">
        <select
          value={diningHall}
          onChange={(e) => setDiningHall(e.target.value as DiningHallId)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
        >
          {DINING_HALLS.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <select
          value={mealPeriod}
          onChange={(e) => setMealPeriod(e.target.value as typeof mealPeriod)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white capitalize"
        >
          {MENU_MEAL_PERIODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {remaining && (
        <p className="text-sm text-gray-400">
          Remaining for this meal:{' '}
          <span className="font-semibold text-amber-300">
            {Math.max(0, Math.round(remaining.calories))} kcal
          </span>{' '}
          · {Math.max(0, Math.round(remaining.proteinG))}g protein
        </p>
      )}

      {menuWarning && (
        <p className="rounded-lg border border-yellow-700 bg-yellow-900/20 px-3 py-2 text-sm text-yellow-300">
          {menuWarning}
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {loggedMessage && <p className="text-sm text-green-400">{loggedMessage}</p>}

      {menuLoading ? (
        <p className="text-gray-400">Loading menu…</p>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">Suggested combos</h2>
            {combos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-800 p-6 text-center text-gray-500">
                No combos fit right now — browse the full menu below.
              </p>
            ) : (
              <div className="grid items-start gap-4 sm:grid-cols-2">
                {combos.map((combo, i) => (
                  <MealComboCard
                    key={i}
                    items={combo.items.map((item) => ({ item, quantity: getQuantity(item.id) }))}
                    comboIndex={i}
                    allItems={filteredItems}
                    onSwap={(itemIndex, replacement) => handleSwap(i, itemIndex, replacement)}
                    onQuantityChange={setQuantity}
                    onLog={() => logCombo(i)}
                    logging={loggingIndex === i}
                    highlighted={i === 0}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">Full menu</h2>
            <MenuList
              items={filteredItems}
              getQuantity={getQuantity}
              onQuantityChange={setQuantity}
              onLog={logSingleItem}
            />
          </section>
        </>
      )}
    </div>
  );
}

function MenuList({
  items,
  getQuantity,
  onQuantityChange,
  onLog,
}: {
  items: MenuItem[];
  getQuantity: (itemId: string) => number;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onLog: (item: MenuItem) => void;
}) {
  const byStation = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of items) {
      const list = map.get(item.station) ?? [];
      list.push(item);
      map.set(item.station, list);
    }
    return map;
  }, [items]);

  if (items.length === 0) {
    return <p className="text-gray-500">No items match your dietary filters right now.</p>;
  }

  return (
    <div className="space-y-5">
      {[...byStation.entries()].map(([station, stationItems]) => (
        <div key={station}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            {station}
          </h3>
          <div className="space-y-2">
            {stationItems.map((item) => {
              const quantity = getQuantity(item.id);
              const scaled = scaleItemMacros(item, quantity);
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-gray-100">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.nutritionEstimated
                        ? 'Nutrition unavailable'
                        : `${Math.round(scaled.calories)} kcal · ${Math.round(scaled.proteinG)}g protein`}
                      {item.servingSizeLabel ? ` · 1 serving = ${item.servingSizeLabel}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!item.nutritionEstimated && (
                      <QuantityStepper
                        value={quantity}
                        onChange={(q) => onQuantityChange(item.id, q)}
                      />
                    )}
                    <button
                      onClick={() => onLog(item)}
                      disabled={item.nutritionEstimated}
                      className="rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-300 hover:border-amber-400 hover:text-amber-300 disabled:opacity-40"
                    >
                      Log
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
