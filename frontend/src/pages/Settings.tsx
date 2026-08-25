import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { supabase } from '../lib/supabaseClient';
import { DEFAULT_MEAL_SPLIT, DIETARY_TAG_LABELS, DIETARY_TAG_OPTIONS, type MealSplit } from '../lib/types';

function toNumberOrNull(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function Settings() {
  const { user } = useAuth();
  const { profile, loading, refresh } = useProfile();
  const navigate = useNavigate();

  const [dailyCalories, setDailyCalories] = useState('2000');
  const [dailyProteinG, setDailyProteinG] = useState('150');
  const [dailyCarbsG, setDailyCarbsG] = useState('');
  const [dailyFatG, setDailyFatG] = useState('');
  const [dietaryTags, setDietaryTags] = useState<string[]>([]);
  const [mealSplit, setMealSplit] = useState<MealSplit>(DEFAULT_MEAL_SPLIT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDailyCalories(String(profile.daily_calories));
    setDailyProteinG(String(profile.daily_protein_g));
    setDailyCarbsG(profile.daily_carbs_g != null ? String(profile.daily_carbs_g) : '');
    setDailyFatG(profile.daily_fat_g != null ? String(profile.daily_fat_g) : '');
    setDietaryTags(profile.dietary_tags ?? []);
    setMealSplit(profile.meal_split ?? DEFAULT_MEAL_SPLIT);
  }, [profile]);

  function toggleTag(tag: string) {
    setDietaryTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  const mealSplitTotal =
    mealSplit.breakfast + mealSplit.lunch + mealSplit.dinner + mealSplit.snack;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSaved(false);

    if (Math.abs(mealSplitTotal - 1) > 0.01) {
      setError(`Meal split must add up to 100% (currently ${Math.round(mealSplitTotal * 100)}%).`);
      return;
    }

    setSaving(true);
    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      daily_calories: Number(dailyCalories),
      daily_protein_g: Number(dailyProteinG),
      daily_carbs_g: toNumberOrNull(dailyCarbsG),
      daily_fat_g: toNumberOrNull(dailyFatG),
      dietary_tags: dietaryTags,
      meal_split: mealSplit,
    });
    setSaving(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    setSaved(true);
    await refresh();
    if (!profile) navigate('/');
  }

  if (loading) {
    return <p className="p-6 text-center text-gray-400">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-white">
        {profile ? 'Settings' : 'Set up your goals'}
      </h1>
      <p className="mb-6 text-sm text-gray-400">
        Daily macro targets drive every suggestion and progress bar in BuzzPlate.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Daily calories" value={dailyCalories} onChange={setDailyCalories} required />
          <Field label="Daily protein (g)" value={dailyProteinG} onChange={setDailyProteinG} required />
          <Field label="Daily carbs (g, optional)" value={dailyCarbsG} onChange={setDailyCarbsG} />
          <Field label="Daily fat (g, optional)" value={dailyFatG} onChange={setDailyFatG} />
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-200">Dietary preferences</h2>
          <div className="flex flex-wrap gap-2">
            {DIETARY_TAG_OPTIONS.map((tag) => (
              <button
                type="button"
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  dietaryTags.includes(tag)
                    ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                {DIETARY_TAG_LABELS[tag]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-200">
            Meal split ({Math.round(mealSplitTotal * 100)}% total)
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((meal) => (
              <div key={meal}>
                <label className="mb-1 block text-xs capitalize text-gray-400">{meal}</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={Math.round(mealSplit[meal] * 100)}
                  onChange={(e) =>
                    setMealSplit((prev) => ({
                      ...prev,
                      [meal]: Number(e.target.value) / 100,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 text-white outline-none focus:border-amber-400"
                />
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {saved && <p className="text-sm text-green-400">Saved.</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-amber-400 px-4 py-2 font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save goals'}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400">{label}</label>
      <input
        type="number"
        required={required}
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-amber-400"
      />
    </div>
  );
}
