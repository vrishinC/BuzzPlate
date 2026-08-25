import { Navigate, Link } from 'react-router-dom';
import { useProfile } from '../hooks/useProfile';
import { useTodayLog } from '../hooks/useTodayLog';
import { dailyTargets, remainingBudgetForMeal, sumLoggedMacros } from '../lib/budget';
import { currentMealPeriod } from '../lib/mealTiming';
import { supabase } from '../lib/supabaseClient';
import { MacroProgress } from '../components/MacroProgress';
import { LogEntryRow } from '../components/LogEntryRow';

export function Dashboard() {
  const { profile, loading: profileLoading } = useProfile();
  const { entries, loading: entriesLoading, refresh } = useTodayLog();

  if (profileLoading) {
    return <p className="p-6 text-center text-gray-400">Loading…</p>;
  }
  if (!profile) {
    return <Navigate to="/settings" replace />;
  }

  const consumed = sumLoggedMacros(entries);
  const target = dailyTargets(profile);
  const nextMeal = currentMealPeriod();
  const remainingNext = remainingBudgetForMeal(profile, nextMeal, entries);

  async function handleDelete(id: string) {
    await supabase.from('log_entries').delete().eq('id', id);
    refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <section>
        <h1 className="mb-4 text-2xl font-bold text-white">Today</h1>
        <div className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <MacroProgress label="Calories" consumed={consumed.calories} target={target.calories} unit=" kcal" colorClass="bg-amber-400" />
          <MacroProgress label="Protein" consumed={consumed.proteinG} target={target.proteinG} unit="g" colorClass="bg-sky-400" />
          {target.carbsG > 0 && (
            <MacroProgress label="Carbs" consumed={consumed.carbsG} target={target.carbsG} unit="g" colorClass="bg-emerald-400" />
          )}
          {target.fatG > 0 && (
            <MacroProgress label="Fat" consumed={consumed.fatG} target={target.fatG} unit="g" colorClass="bg-rose-400" />
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-amber-300">
          Remaining budget · {nextMeal}
        </h2>
        <p className="text-3xl font-bold text-white">
          {Math.max(0, Math.round(remainingNext.calories))} kcal
        </p>
        <p className="mt-1 text-sm text-gray-400">
          {Math.max(0, Math.round(remainingNext.proteinG))}g protein left for this meal
        </p>
        <Link
          to="/log/menu"
          className="mt-4 inline-block rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300"
        >
          Get meal suggestions →
        </Link>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Today's log</h2>
          <Link to="/history" className="text-sm text-amber-300 hover:underline">
            7-day history →
          </Link>
        </div>
        {entriesLoading ? (
          <p className="text-gray-400">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-800 p-6 text-center text-gray-500">
            Nothing logged yet today.
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <LogEntryRow key={e.id} entry={e} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
