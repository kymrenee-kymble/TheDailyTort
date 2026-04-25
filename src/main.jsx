import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Apple,
  Bone,
  CalendarDays,
  Camera,
  Carrot,
  Download,
  Filter,
  History,
  Home,
  Leaf,
  RefreshCw,
  Save,
  Scale,
  ShieldCheck,
  Stethoscope,
  Utensils,
} from 'lucide-react';
import { supabase, hasSupabaseConfig } from './supabaseClient';
import './styles.css';

const todayIso = () => new Date().toISOString().slice(0, 10);

function getDayPlan(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  const start = new Date('2026-04-22T12:00:00');
  const diff = Math.floor((date - start) / 86400000);

  return {
    isFruitDay: diff % 2 === 0,
    isVeggieDay: diff % 2 !== 0,
    isSunday: date.getDay() === 0,
  };
}

function niceDate(dateString) {
  if (!dateString) return '';
  return new Date(`${dateString}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function blankDailyLog(dateString) {
  return {
    care_date: dateString,
    soak_status: 'not logged',
    humidifier_refilled: false,
    calcium_given: false,
    greens_fed: false,
    greens_text: '',
    fruit_fed: false,
    fruit_text: '',
    veggie_fed: false,
    veggie_text: '',
    protein_fed: false,
    protein_text: '',
    outside_time: false,
    outside_duration: '',
    care_notes: '',
  };
}

function cleanDailyPayload(daily, date) {
  return {
    care_date: date,
    soak_status: daily.soak_status || 'not logged',
    humidifier_refilled: Boolean(daily.humidifier_refilled),
    calcium_given: Boolean(daily.calcium_given),
    greens_fed: Boolean(daily.greens_fed),
    greens_text: daily.greens_text || '',
    fruit_fed: Boolean(daily.fruit_fed),
    fruit_text: daily.fruit_text || '',
    veggie_fed: Boolean(daily.veggie_fed),
    veggie_text: daily.veggie_text || '',
    protein_fed: Boolean(daily.protein_fed),
    protein_text: daily.protein_text || '',
    outside_time: Boolean(daily.outside_time),
    outside_duration: daily.outside_duration || '',
    care_notes: daily.care_notes || '',
    updated_at: new Date().toISOString(),
  };
}

function asCsvValue(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function makeHistoryItems(dailyLogs, weights, vetVisits, photoLogs) {
  return [
    ...dailyLogs.map((entry) => ({
      id: `daily-${entry.id}`,
      type: 'daily',
      date: entry.care_date,
      data: entry,
    })),
    ...weights.map((entry) => ({
      id: `weight-${entry.id}`,
      type: 'weight',
      date: entry.weigh_date,
      data: entry,
    })),
    ...vetVisits.map((entry) => ({
      id: `vet-${entry.id}`,
      type: 'vet',
      date: entry.visit_date,
      data: entry,
    })),
    ...photoLogs.map((entry) => ({
      id: `photo-${entry.id}`,
      type: 'photo',
      date: entry.photo_date,
      data: entry,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}

function App() {
  const [activeTab, setActiveTab] = useState('today');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [date, setDate] = useState(todayIso());
  const [daily, setDaily] = useState(blankDailyLog(todayIso()));
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [debug, setDebug] = useState('');
  const [vetChecked, setVetChecked] = useState(false);
  const [vetNotes, setVetNotes] = useState('');
  const [weightValue, setWeightValue] = useState('');
  const [weightNotes, setWeightNotes] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [vetVisits, setVetVisits] = useState([]);
  const [weights, setWeights] = useState([]);
  const [photoLogs, setPhotoLogs] = useState([]);
  const [history, setHistory] = useState([]);
  const [exportStart, setExportStart] = useState(todayIso());
  const [exportEnd, setExportEnd] = useState(todayIso());

  const plan = useMemo(() => getDayPlan(date), [date]);
  const combinedHistory = useMemo(
    () => makeHistoryItems(history, weights, vetVisits, photoLogs),
    [history, weights, vetVisits, photoLogs]
  );
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return combinedHistory;
    return combinedHistory.filter((item) => item.type === historyFilter);
  }, [combinedHistory, historyFilter]);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setStatus('Supabase is not connected. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your host environment variables, then redeploy.');
      return;
    }

    loadDay(date);
    loadAllLogs();
  }, [date]);

  async function runQuery(label, fn) {
    if (!supabase) {
      const message = 'Supabase client is missing. Check your environment variables.';
      setStatus(message);
      setDebug(message);
      return { data: null, error: { message } };
    }

    try {
      const result = await fn();
      if (result?.error) {
        const message = `${label}: ${result.error.message || JSON.stringify(result.error)}`;
        setStatus(message);
        setDebug(message);
      }
      return result;
    } catch (error) {
      const message = `${label}: ${error.message || String(error)}`;
      setStatus(message);
      setDebug(message);
      return { data: null, error };
    }
  }

  async function testConnection() {
    setStatus('Testing Supabase connection...');
    const result = await runQuery('Connection test failed', () =>
      supabase.from('daily_logs').select('care_date').limit(1)
    );

    if (!result.error) {
      setStatus('Connection test passed. Supabase is reachable.');
      setDebug('Connection test passed.');
    }
  }

  async function loadDay(dateString) {
    setLoading(true);
    const { data, error } = await runQuery('Could not load this day', () =>
      supabase.from('daily_logs').select('*').eq('care_date', dateString).maybeSingle()
    );

    if (!error) {
      setDaily(data || blankDailyLog(dateString));
      setVetChecked(false);
      setVetNotes('');
    }

    setLoading(false);
  }

  async function loadAllLogs() {
    const vetResult = await runQuery('Could not load vet visits', () =>
      supabase.from('vet_visits').select('*').order('visit_date', { ascending: false }).limit(100)
    );
    if (!vetResult.error) setVetVisits(vetResult.data || []);

    const weightResult = await runQuery('Could not load weight logs', () =>
      supabase.from('weight_logs').select('*').order('weigh_date', { ascending: false }).limit(100)
    );
    if (!weightResult.error) setWeights(weightResult.data || []);

    const historyResult = await runQuery('Could not load daily history', () =>
      supabase.from('daily_logs').select('*').order('care_date', { ascending: false }).limit(365)
    );
    if (!historyResult.error) setHistory(historyResult.data || []);

    const photoResult = await runQuery('Could not load photo logs', () =>
      supabase.from('photo_logs').select('*').order('photo_date', { ascending: false }).limit(100)
    );
    if (!photoResult.error) setPhotoLogs(photoResult.data || []);
  }

  function updateDaily(field, value) {
    setDaily((prev) => ({ ...prev, [field]: value }));
  }

  async function saveDaily() {
    setLoading(true);
    setStatus('Saving daily care...');
    setDebug('');

    const payload = cleanDailyPayload(daily, date);

    const saveResult = await runQuery('Save failed', () =>
      supabase.from('daily_logs').upsert(payload, { onConflict: 'care_date' }).select().single()
    );

    if (saveResult.error) {
      setLoading(false);
      return;
    }

    if (vetChecked && vetNotes.trim()) {
      const vetResult = await runQuery('Daily saved, but vet visit failed', () =>
        supabase
          .from('vet_visits')
          .insert({ visit_date: date, notes: vetNotes.trim() })
          .select()
          .single()
      );

      if (!vetResult.error) {
        setVetChecked(false);
        setVetNotes('');
      }
    }

    await loadAllLogs();
    setDaily(saveResult.data || payload);
    setStatus(`Saved ${niceDate(date)} successfully.`);
    setDebug(`Saved row id: ${saveResult.data?.id || 'unknown'}`);
    setLoading(false);
  }

  async function saveWeight() {
    if (!weightValue.trim()) {
      setStatus('Enter a weight first.');
      return;
    }

    const { error } = await runQuery('Weight save failed', () =>
      supabase
        .from('weight_logs')
        .insert({
          weigh_date: date,
          weight_value: weightValue.trim(),
          notes: weightNotes.trim(),
        })
        .select()
        .single()
    );

    if (!error) {
      setWeightValue('');
      setWeightNotes('');
      setStatus('Weight saved.');
      await loadAllLogs();
    }
  }

  async function savePhoto() {
    if (!photoFile) {
      setStatus('Choose a photo first.');
      return;
    }

    setLoading(true);
    setStatus('Uploading photo...');
    setDebug('');

    const extension = photoFile.name.split('.').pop() || 'jpg';
    const fileName = `${date}-${Date.now()}.${extension}`.replaceAll(' ', '-');

    const uploadResult = await runQuery('Photo upload failed', () =>
      supabase.storage.from('tort-photos').upload(fileName, photoFile, {
        cacheControl: '3600',
        upsert: false,
      })
    );

    if (uploadResult.error) {
      setLoading(false);
      return;
    }

    const { data } = supabase.storage.from('tort-photos').getPublicUrl(fileName);

    const logResult = await runQuery('Photo log failed', () =>
      supabase
        .from('photo_logs')
        .insert({
          photo_date: date,
          photo_url: data.publicUrl,
          caption: photoCaption.trim(),
        })
        .select()
        .single()
    );

    if (!logResult.error) {
      setStatus('Photo saved.');
      setDebug(`Saved photo id: ${logResult.data?.id || 'unknown'}`);
      setPhotoFile(null);
      setPhotoCaption('');
      const input = document.getElementById('photo-upload-input');
      if (input) input.value = '';
      await loadAllLogs();
    }

    setLoading(false);
  }

  async function exportCsv(range = true) {
    let query = supabase.from('daily_logs').select('*').order('care_date', { ascending: true });
    if (range) query = query.gte('care_date', exportStart).lte('care_date', exportEnd);

    const { data, error } = await runQuery('Export failed', () => query);
    if (error) return;

    const headers = [
      'care_date',
      'soak_status',
      'humidifier_refilled',
      'greens_fed',
      'greens_text',
      'calcium_given',
      'fruit_fed',
      'fruit_text',
      'veggie_fed',
      'veggie_text',
      'protein_fed',
      'protein_text',
      'outside_time',
      'outside_duration',
      'care_notes',
    ];

    const csv = [
      headers.join(','),
      ...(data || []).map((row) => headers.map((header) => asCsvValue(row[header])).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileRange = range ? `${exportStart}-to-${exportEnd}` : 'all-history';
    link.href = url;
    link.download = `daily-tort-${fileRange}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const reminderItems = [
    'Soak for 15 minutes',
    'Feed greens',
    'Give calcium',
    plan.isFruitDay ? 'Feed fruit' : 'Feed veggie',
    plan.isSunday ? 'Feed protein' : null,
    'Refill humidifier',
  ].filter(Boolean);

  return (
    <main>
      <header className="masthead">
        <div className="paper-date">{niceDate(date)} • Raphael Edition • Care Ledger</div>
        <div className="masthead-row">
          <div className="tort-badge">
            <img src="/raphael-tort.png" alt="Raphael the tortoise wearing sunglasses" />
          </div>
          <div>
            <p className="eyebrow">Raphael's Care Tracker</p>
            <h1>The Daily Tort</h1>
            <p className="tagline">All the care that’s fit to log.</p>
          </div>
        </div>
      </header>

      {status && (
        <div className="status">
          <strong>{status}</strong>
          {debug && <small>{debug}</small>}
        </div>
      )}

      <nav className="tabs">
        <button className={activeTab === 'today' ? 'tab active' : 'tab'} onClick={() => setActiveTab('today')}><Home size={18} /> Today</button>
        <button className={activeTab === 'history' ? 'tab active' : 'tab'} onClick={() => setActiveTab('history')}><History size={18} /> History</button>
        <button className={activeTab === 'health' ? 'tab active' : 'tab'} onClick={() => setActiveTab('health')}><Stethoscope size={18} /> Health + Photos</button>
        <button className={activeTab === 'export' ? 'tab active' : 'tab'} onClick={() => setActiveTab('export')}><Download size={18} /> Export</button>
        <button className="tab" onClick={testConnection}><RefreshCw size={18} /> Test Save Connection</button>
      </nav>

      {activeTab === 'today' && (
        <>
          <section className="headline-grid">
            <article className="tile-red">
              <CalendarDays />
              <span>Selected Date</span>
              <strong>{niceDate(date)}</strong>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </article>
            <article className="tile-orange">
              <Utensils />
              <span>Food Rotation</span>
              <strong>{plan.isFruitDay ? 'Fruit Day' : 'Veggie Day'}</strong>
            </article>
            <article className="tile-green">
              <Bone />
              <span>Cuttlefish Bone</span>
              <strong>Every 30 days</strong>
            </article>
            <article className="tile-green">
              <ShieldCheck />
              <span>Substrate</span>
              <strong>7/1 + 12/1 yearly</strong>
            </article>
          </section>

          <section className="layout">
            <div className="panel main-story">
              <h2>Today’s Care Log</h2>

              <div className="form-section">
                <h3>Soak</h3>
                <div className="radio-grid">
                  <label>
                    <input type="radio" name="soak" checked={daily.soak_status === 'complete'} onChange={() => updateDaily('soak_status', 'complete')} />
                    Complete
                  </label>
                  <label>
                    <input type="radio" name="soak" checked={daily.soak_status === 'missed'} onChange={() => updateDaily('soak_status', 'missed')} />
                    Missed
                  </label>
                </div>
              </div>

              <div className="form-section">
                <h3>Habitat + Sunshine</h3>
                <div className="check-grid">
                  <label><input type="checkbox" checked={daily.humidifier_refilled} onChange={(event) => updateDaily('humidifier_refilled', event.target.checked)} /> Humidifier refilled</label>
                  <label><input type="checkbox" checked={daily.outside_time} onChange={(event) => updateDaily('outside_time', event.target.checked)} /> Outside sunshine</label>
                </div>
                {daily.outside_time && (
                  <input value={daily.outside_duration || ''} onChange={(event) => updateDaily('outside_duration', event.target.value)} placeholder="Outside duration, e.g. 30 minutes" />
                )}
              </div>

              <div className="form-section">
                <h3>Food Log</h3>
                <div className="food-grid">
                  <div className="food-card green-card">
                    <label><input type="checkbox" checked={daily.greens_fed} onChange={(event) => updateDaily('greens_fed', event.target.checked)} /> <Leaf size={16} /> Greens fed</label>
                    <input value={daily.greens_text || ''} onChange={(event) => updateDaily('greens_text', event.target.value)} placeholder="Kale, dandelion greens, romaine, etc." />
                  </div>

                  <div className="food-card orange-card">
                    <label><input type="checkbox" checked={daily.calcium_given} onChange={(event) => updateDaily('calcium_given', event.target.checked)} /> <Bone size={16} /> Calcium given</label>
                    <input value="Daily calcium" disabled />
                  </div>

                  {plan.isFruitDay && (
                    <div className="food-card red-card">
                      <label><input type="checkbox" checked={daily.fruit_fed} onChange={(event) => updateDaily('fruit_fed', event.target.checked)} /> <Apple size={16} /> Fruit fed</label>
                      <input value={daily.fruit_text || ''} onChange={(event) => updateDaily('fruit_text', event.target.value)} placeholder="Papaya, mango, berries, etc." />
                    </div>
                  )}

                  {plan.isVeggieDay && (
                    <div className="food-card orange-card">
                      <label><input type="checkbox" checked={daily.veggie_fed} onChange={(event) => updateDaily('veggie_fed', event.target.checked)} /> <Carrot size={16} /> Veggie fed</label>
                      <input value={daily.veggie_text || ''} onChange={(event) => updateDaily('veggie_text', event.target.value)} placeholder="Squash, mushroom, carrot, etc." />
                    </div>
                  )}

                  {plan.isSunday && (
                    <div className="food-card green-card full">
                      <label><input type="checkbox" checked={daily.protein_fed} onChange={(event) => updateDaily('protein_fed', event.target.checked)} /> Protein fed</label>
                      <input value={daily.protein_text || ''} onChange={(event) => updateDaily('protein_text', event.target.value)} placeholder="Crickets, protein item, etc." />
                    </div>
                  )}
                </div>
              </div>

              <div className="form-section">
                <h3>Vet Visit</h3>
                <div className="vet-box">
                  <label className="single-line">
                    <input type="checkbox" checked={vetChecked} onChange={(event) => setVetChecked(event.target.checked)} />
                    Vet visit today
                  </label>
                  {vetChecked && (
                    <textarea value={vetNotes} onChange={(event) => setVetNotes(event.target.value)} placeholder="Vet visit notes..." />
                  )}
                </div>
              </div>

              <div className="form-section">
                <h3>Care Notes</h3>
                <textarea value={daily.care_notes || ''} onChange={(event) => updateDaily('care_notes', event.target.value)} placeholder="General care notes..." />
              </div>

              <button className="wide" onClick={saveDaily} disabled={loading}>
                <Save size={18} /> {loading ? 'Saving...' : 'Save Daily Care'}
              </button>
            </div>

            <aside className="sidebar">
              <div className="panel reminder-panel">
                <h2>Today’s Reminder</h2>
                <p className="callout">{plan.isFruitDay ? 'Fruit Day' : 'Veggie Day'} for Raphael</p>
                <ul className="reminders">
                  {reminderItems.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>

              <div className="panel accent-green">
                <h2>Upcoming</h2>
                <div className="mini-log">
                  <div><strong>Weigh Raphael</strong><span>Every 30 days</span></div>
                  <div><strong>New cuttlefish bone</strong><span>Every 30 days</span></div>
                  <div><strong>Change substrate</strong><span>July 1 + Dec 1 yearly</span></div>
                </div>
              </div>
            </aside>
          </section>
        </>
      )}

      {activeTab === 'history' && (
        <section className="panel">
          <div className="section-header">
            <div>
              <h2>History</h2>
              <p>Search care history by category: daily food log, weight, vet visit, or photo.</p>
            </div>
            <button className="secondary" onClick={() => exportCsv(false)}><Download size={18} /> Export Daily Logs</button>
          </div>

          <div className="history-filter">
            <Filter size={18} />
            {[
              ['all', 'All'],
              ['daily', 'Daily Food Log'],
              ['weight', 'Weight'],
              ['vet', 'Vet Visit'],
              ['photo', 'Photo'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={historyFilter === value ? 'filter-pill active' : 'filter-pill'}
                onClick={() => setHistoryFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="history-list">
            {filteredHistory.length === 0 && <p>No matching history yet.</p>}

            {filteredHistory.map((item) => {
              if (item.type === 'daily') {
                const entry = item.data;
                const entryPlan = getDayPlan(entry.care_date);
                return (
                  <article className="history-card" key={item.id}>
                    <div className="history-title">
                      <strong>{niceDate(entry.care_date)}</strong>
                      <span>Daily Food Log • {entryPlan.isFruitDay ? 'Fruit Day' : 'Veggie Day'}{entryPlan.isSunday ? ' + Protein' : ''}</span>
                    </div>
                    <div className="chips">
                      <span>Soak: {entry.soak_status}</span>
                      <span>Humidifier: {entry.humidifier_refilled ? 'yes' : 'no'}</span>
                      <span>Calcium: {entry.calcium_given ? 'yes' : 'no'}</span>
                      <span>Outside: {entry.outside_time ? entry.outside_duration || 'yes' : 'no'}</span>
                    </div>
                    <div className="history-food">
                      <p><strong>Greens:</strong> {entry.greens_fed ? entry.greens_text || 'fed' : 'not logged'}</p>
                      {entry.fruit_text || entry.fruit_fed ? <p><strong>Fruit:</strong> {entry.fruit_fed ? entry.fruit_text || 'fed' : 'not logged'}</p> : null}
                      {entry.veggie_text || entry.veggie_fed ? <p><strong>Veggie:</strong> {entry.veggie_fed ? entry.veggie_text || 'fed' : 'not logged'}</p> : null}
                      {entry.protein_text || entry.protein_fed ? <p><strong>Protein:</strong> {entry.protein_fed ? entry.protein_text || 'fed' : 'not logged'}</p> : null}
                      {entry.care_notes ? <p><strong>Notes:</strong> {entry.care_notes}</p> : null}
                    </div>
                  </article>
                );
              }

              if (item.type === 'weight') {
                const entry = item.data;
                return (
                  <article className="history-card" key={item.id}>
                    <div className="history-title">
                      <strong>{niceDate(entry.weigh_date)}</strong>
                      <span>Weight</span>
                    </div>
                    <p><strong>Weight:</strong> {entry.weight_value}</p>
                    {entry.notes ? <p><strong>Notes:</strong> {entry.notes}</p> : null}
                  </article>
                );
              }

              if (item.type === 'vet') {
                const entry = item.data;
                return (
                  <article className="history-card" key={item.id}>
                    <div className="history-title">
                      <strong>{niceDate(entry.visit_date)}</strong>
                      <span>Vet Visit</span>
                    </div>
                    <p>{entry.notes}</p>
                  </article>
                );
              }

              const entry = item.data;
              return (
                <article className="history-card photo-history-card" key={item.id}>
                  <div className="history-title">
                    <strong>{niceDate(entry.photo_date)}</strong>
                    <span>Photo</span>
                  </div>
                  <img src={entry.photo_url} alt={entry.caption || 'Tort photo'} />
                  {entry.caption ? <p><strong>Caption:</strong> {entry.caption}</p> : null}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === 'health' && (
        <section className="layout">
          <div className="panel">
            <h2>Weight + Photo Log</h2>

            <div className="form-section">
              <h3>Weight</h3>
              <input value={weightValue} onChange={(event) => setWeightValue(event.target.value)} placeholder="Weight, e.g. 694g" />
              <input value={weightNotes} onChange={(event) => setWeightNotes(event.target.value)} placeholder="Weight notes" />
              <button className="wide secondary" onClick={saveWeight}><Scale size={18} /> Save Weight</button>
            </div>

            <div className="form-section">
              <h3>Photo</h3>
              <input id="photo-upload-input" type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} />
              <input value={photoCaption} onChange={(event) => setPhotoCaption(event.target.value)} placeholder="Photo caption or note" />
              <button className="wide secondary" onClick={savePhoto} disabled={loading}><Camera size={18} /> Save Photo</button>
            </div>

            <div className="mini-log">
              {weights.map((entry) => (
                <div key={entry.id}><strong>{entry.weight_value}</strong><span>{niceDate(entry.weigh_date)} {entry.notes ? `— ${entry.notes}` : ''}</span></div>
              ))}
            </div>
          </div>

          <div className="panel accent-green">
            <h2>Photo Gallery</h2>
            <div className="photo-gallery">
              {photoLogs.length === 0 && <p>No photos saved yet.</p>}
              {photoLogs.map((photo) => (
                <div className="photo-tile" key={photo.id}>
                  <img src={photo.photo_url} alt={photo.caption || 'Tort photo'} />
                  <strong>{niceDate(photo.photo_date)}</strong>
                  {photo.caption ? <span>{photo.caption}</span> : null}
                </div>
              ))}
            </div>

            <h2 className="secondary-heading">Vet Visit Log</h2>
            <div className="mini-log">
              {vetVisits.length === 0 && <p>No vet visits saved yet.</p>}
              {vetVisits.map((visit) => (
                <div key={visit.id}><strong>{niceDate(visit.visit_date)}</strong><span>{visit.notes}</span></div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'export' && (
        <section className="panel export-panel">
          <h2>Pet Sitter Export</h2>
          <p>Export all daily history or choose a custom timeframe.</p>
          <div className="export-grid">
            <label>Start date<input type="date" value={exportStart} onChange={(event) => setExportStart(event.target.value)} /></label>
            <label>End date<input type="date" value={exportEnd} onChange={(event) => setExportEnd(event.target.value)} /></label>
          </div>
          <div className="button-row">
            <button onClick={() => exportCsv(true)}><Download size={18} /> Export Selected Timeframe</button>
            <button className="secondary" onClick={() => exportCsv(false)}><Download size={18} /> Export All Daily Logs</button>
          </div>
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
