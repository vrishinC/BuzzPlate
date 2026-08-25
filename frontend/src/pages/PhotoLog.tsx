import { useState, type ChangeEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { useTodayLog } from '../hooks/useTodayLog';
import { analyzeFoodPhoto } from '../lib/api';
import { currentMealPeriod, todayIso } from '../lib/mealTiming';
import { dishNameWithQuantity, scaleItemMacros } from '../lib/quantity';
import { supabase } from '../lib/supabaseClient';
import { MENU_MEAL_PERIODS, type FoodAnalysis, type LogEntryInsert, type MenuItem } from '../lib/types';
import { QuantityStepper } from '../components/QuantityStepper';

type SourceType = 'gt_item' | 'outside';

export function PhotoLog() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { refresh: refreshLog } = useTodayLog();

  const [sourceType, setSourceType] = useState<SourceType>('outside');
  const [mealPeriod, setMealPeriod] = useState(currentMealPeriod());
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [gtMatch, setGtMatch] = useState<{ item: MenuItem; confidence: number } | null>(null);
  const [useGtMatch, setUseGtMatch] = useState(true);
  const [matchQuantity, setMatchQuantity] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedMessage, setLoggedMessage] = useState<string | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setAnalysis(null);
    setGtMatch(null);
    setMatchQuantity(1);
    setStoragePath(null);
    setError(null);
    setLoggedMessage(null);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  }

  async function handleAnalyze() {
    if (!file || !user) return;
    setError(null);
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('food-photos')
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      setStoragePath(path);
      setUploading(false);

      setAnalyzing(true);
      const result = await analyzeFoodPhoto(path, sourceType);
      setAnalysis(result.analysis);
      setGtMatch(result.gtMatch);
      setUseGtMatch(Boolean(result.gtMatch));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  }

  function updateAnalysisField<K extends keyof FoodAnalysis>(key: K, value: FoodAnalysis[K]) {
    setAnalysis((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const usingMatch = Boolean(sourceType === 'gt_item' && useGtMatch && gtMatch);

  async function handleLog() {
    if (!user || !analysis || !storagePath) return;
    setLogging(true);
    setError(null);
    try {
      const row: LogEntryInsert = usingMatch
        ? (() => {
            const scaled = scaleItemMacros(gtMatch!.item, matchQuantity);
            return {
              user_id: user.id,
              log_date: todayIso(),
              meal_period: mealPeriod,
              source: 'photo_gt_match' as const,
              dish_name: dishNameWithQuantity(gtMatch!.item.name, matchQuantity),
              calories: Math.round(scaled.calories),
              protein_g: scaled.proteinG,
              carbs_g: scaled.carbsG,
              fat_g: scaled.fatG,
              photo_storage_path: storagePath,
              gt_menu_item_ref: gtMatch!.item,
            };
          })()
        : {
            user_id: user.id,
            log_date: todayIso(),
            meal_period: mealPeriod,
            source: (sourceType === 'gt_item' ? 'photo_gt_match' : 'photo_outside') as
              | 'photo_gt_match'
              | 'photo_outside',
            dish_name: analysis.dishName,
            calories: Math.round(analysis.calories),
            protein_g: analysis.proteinG,
            carbs_g: analysis.carbsG,
            fat_g: analysis.fatG,
            photo_storage_path: storagePath,
            gt_menu_item_ref: null,
          };

      const { error: insertError } = await supabase.from('log_entries').insert(row);
      if (insertError) throw insertError;

      setLoggedMessage(`Logged ${row.dish_name}.`);
      await refreshLog();
      setFile(null);
      setPreviewUrl(null);
      setAnalysis(null);
      setGtMatch(null);
      setMatchQuantity(1);
      setStoragePath(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log entry');
    } finally {
      setLogging(false);
    }
  }

  if (profileLoading) return <p className="p-6 text-center text-gray-400">Loading…</p>;
  if (!profile) return <Navigate to="/settings" replace />;

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Log a photo</h1>

      <div className="flex flex-wrap gap-3">
        <select
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value as SourceType)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
        >
          <option value="outside">Outside food</option>
          <option value="gt_item">GT Dining item</option>
        </select>
        <select
          value={mealPeriod}
          onChange={(e) => setMealPeriod(e.target.value as typeof mealPeriod)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white capitalize"
        >
          {[...MENU_MEAL_PERIODS, 'snack' as const].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm text-gray-300">Photo</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-400 file:mr-3 file:rounded-full file:border-0 file:bg-amber-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
        />
        {previewUrl && (
          <img src={previewUrl} alt="Preview" className="mt-3 max-h-64 w-full rounded-xl object-cover" />
        )}
      </div>

      {file && !analysis && (
        <button
          onClick={handleAnalyze}
          disabled={uploading || analyzing}
          className="w-full rounded-lg bg-amber-400 px-4 py-2 font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : analyzing ? 'Analyzing…' : 'Analyze photo'}
        </button>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      {loggedMessage && <p className="text-sm text-green-400">{loggedMessage}</p>}

      {analysis && (
        <div className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <p className="text-xs text-gray-500">
            AI estimate — review and edit before logging. Confidence:{' '}
            {Math.round(analysis.confidence * 100)}%
          </p>

          {gtMatch && sourceType === 'gt_item' && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-sm">
              <input
                type="checkbox"
                checked={useGtMatch}
                onChange={(e) => setUseGtMatch(e.target.checked)}
                className="mt-1"
              />
              <span className="text-gray-200">
                Matched to GT menu item <strong>{gtMatch.item.name}</strong> (
                {Math.round(gtMatch.confidence * 100)}% match) — use its exact macros instead of
                the AI estimate.
              </span>
            </label>
          )}

          {usingMatch ? (
            <MatchedItemPortion
              item={gtMatch!.item}
              quantity={matchQuantity}
              onQuantityChange={setMatchQuantity}
            />
          ) : (
            <>
              <EditableField
                label="Dish name"
                value={analysis.dishName}
                onChange={(v) => updateAnalysisField('dishName', v)}
              />
              <EditableField
                label="Serving"
                value={analysis.estimatedServingDescription}
                onChange={(v) => updateAnalysisField('estimatedServingDescription', v)}
              />
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Calories"
                  value={analysis.calories}
                  onChange={(v) => updateAnalysisField('calories', v)}
                />
                <NumberField
                  label="Protein (g)"
                  value={analysis.proteinG}
                  onChange={(v) => updateAnalysisField('proteinG', v)}
                />
                <NumberField
                  label="Carbs (g)"
                  value={analysis.carbsG}
                  onChange={(v) => updateAnalysisField('carbsG', v)}
                />
                <NumberField
                  label="Fat (g)"
                  value={analysis.fatG}
                  onChange={(v) => updateAnalysisField('fatG', v)}
                />
              </div>
              {analysis.notes && <p className="text-xs text-gray-500">Note: {analysis.notes}</p>}
            </>
          )}

          <button
            onClick={handleLog}
            disabled={logging}
            className="w-full rounded-lg bg-amber-400 px-4 py-2 font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
          >
            {logging ? 'Logging…' : 'Log this entry'}
          </button>
        </div>
      )}
    </div>
  );
}

function MatchedItemPortion({
  item,
  quantity,
  onQuantityChange,
}: {
  item: MenuItem;
  quantity: number;
  onQuantityChange: (q: number) => void;
}) {
  const scaled = scaleItemMacros(item, quantity);
  return (
    <div className="rounded-lg border border-gray-800 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400">
          Servings{item.servingSizeLabel ? ` (1 = ${item.servingSizeLabel})` : ''}
        </span>
        <QuantityStepper value={quantity} onChange={onQuantityChange} />
      </div>
      <p className="mt-3 text-sm text-gray-200">
        {Math.round(scaled.calories)} kcal · {Math.round(scaled.proteinG)}g protein ·{' '}
        {Math.round(scaled.carbsG)}g carbs · {Math.round(scaled.fatG)}g fat
      </p>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400">{label}</label>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
      />
    </div>
  );
}
