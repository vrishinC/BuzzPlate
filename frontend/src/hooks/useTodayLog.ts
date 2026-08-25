import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { todayIso } from '../lib/mealTiming';
import type { LogEntry } from '../lib/types';

interface UseTodayLogResult {
  entries: LogEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTodayLog(): UseTodayLogResult {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('log_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', todayIso())
      .order('created_at', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setError(null);
      setEntries((data as LogEntry[]) ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { entries, loading, error, refresh };
}
