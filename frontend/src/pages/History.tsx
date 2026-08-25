import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { todayIso } from '../lib/mealTiming';
import type { LogEntry } from '../lib/types';

const DAYS_BACK = 7;
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayIso(d);
}

const SOURCE_ICON: Record<LogEntry['source'], string> = {
  gt_menu: '🏫',
  photo_gt_match: '📷',
  photo_outside: '📷',
};

export function History() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    setLoading(true);
    const since = isoDaysAgo(DAYS_BACK - 1);
    const { data } = await supabase
      .from('log_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('log_date', since)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: true });

    const rows = (data as LogEntry[]) ?? [];
    setEntries(rows);

    const withPhotos = rows.filter((e) => e.photo_storage_path);
    if (withPhotos.length > 0) {
      const urlEntries = await Promise.all(
        withPhotos.map(async (e) => {
          const { data: signed } = await supabase.storage
            .from('food-photos')
            .createSignedUrl(e.photo_storage_path!, SIGNED_URL_TTL_SECONDS);
          return [e.id, signed?.signedUrl ?? ''] as const;
        }),
      );
      setPhotoUrls(Object.fromEntries(urlEntries));
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const byDay = useMemo(() => {
    const map = new Map<string, LogEntry[]>();
    for (const e of entries) {
      const list = map.get(e.log_date) ?? [];
      list.push(e);
      map.set(e.log_date, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

  async function handleDelete(id: string) {
    await supabase.from('log_entries').delete().eq('id', id);
    load();
  }

  if (loading) return <p className="p-6 text-center text-gray-400">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <h1 className="text-2xl font-bold text-white">7-day history</h1>

      {byDay.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-800 p-6 text-center text-gray-500">
          No entries in the last {DAYS_BACK} days.
        </p>
      ) : (
        byDay.map(([date, dayEntries]) => {
          const totalCalories = dayEntries.reduce((s, e) => s + e.calories, 0);
          const totalProtein = dayEntries.reduce((s, e) => s + Number(e.protein_g ?? 0), 0);
          return (
            <section key={date}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="font-semibold text-white">
                  {new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </h2>
                <span className="text-sm text-gray-400">
                  {Math.round(totalCalories)} kcal · {Math.round(totalProtein)}g protein
                </span>
              </div>
              <div className="space-y-2">
                {dayEntries.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3"
                  >
                    {e.photo_storage_path && photoUrls[e.id] && (
                      <img
                        src={photoUrls[e.id]}
                        alt={e.dish_name}
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span>{SOURCE_ICON[e.source]}</span>
                        <span className="truncate text-sm font-medium text-white">
                          {e.dish_name}
                        </span>
                      </div>
                      <p className="text-xs capitalize text-gray-400">
                        {e.meal_period} · {e.calories} kcal
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(e.id)}
                      className="shrink-0 rounded-full px-2 py-1 text-xs text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
