import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarDays, Download, Droplets, Leaf, Save, Scale, Stethoscope, Sun, Wheat, Bell, ShieldCheck } from 'lucide-react';
import { supabase } from './supabaseClient';
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

function App() {
  const [date, setDate] = useState(todayIso());
  const [daily, setDaily] = useState(blankDailyLog(todayIso()));
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [vetChecked, setVetChecked] = useState(false);
  const [vetNotes, setVetNotes] = useState('');
  const [weightValue, setWeightValue] = useState('');
  const [weightNotes, setWeightNotes] = useState('');
  const [vetVisits, setVetVisits] = useState([]);
  const [weights, setWeights] = useState([]);
  const [exportStart, setExportStart] = useState(todayIso());
  const [exportEnd, setExportEnd] = useState(todayIso());

  const plan = useMemo(() => getDayPlan(date), [date]);

  useEffect(() => {
    loadDay(date);
    loadLogs();
  }, [date]);

  async function loadDay(dateString) {
    setLoading(true);
    setStatus('');
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('care_date', dateString)
      .maybeSingle();

    if (error) setStatus(`Could not load day: ${error.message}`);
    setDaily(data || blankDailyLog(dateString));
    setVetChecked(false);
    setVetNotes('');
    setLoading(false);
  }

  async function loadLogs() {
    const { data: vetData } = await supabase
      .from('vet_visits')
      .select('*')
      .order('visit_date', { ascending: false })
      .limit(20);
    setVetVisits(vetData || []);

    const { data: weightData } = await supabase
      .from('weight_logs')
      .select('*')
      .order('weigh_date', { ascending: false })
      .limit(20);
    setWeights(weightData || []);
  }

  function updateDaily(field, value) {
    setDaily((prev) => ({ ...prev, [field]: value }));
  }

  async function saveDaily() {
    setLoading(true);
    setStatus('');

    const payload = {
      ...daily,
      care_date: date,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('daily_logs')
      .upsert(payload, { onConflict: 'care_date' });

    if (error) {
      setStatus(`Save failed: ${error.message}`);
    } else {
      setStatus('Daily care saved.');
    }

    if (vetChecked && vetNotes.trim()) {
      const { error: vetError } = await supabase.from('vet_visits').insert({
        visit_date: date,
        notes: vetNotes.trim(),
      });
      if (vetError) setStatus(`Daily saved, but vet visit failed: ${vetError.message}`);
      else {
        setVetChecked(false);
        setVetNotes('');
      }
    }

    await loadLogs();
    setLoading(false);
  }

  async function saveWeight() {
    if (!weightValue.trim()) {
      setStatus('Enter a weight first.');
      return;
    }

    const { error } = await supabase.from('weight_logs').insert({
      weigh_date: date,
      weight_value: weightValue.trim(),
      notes: weightNotes.trim(),
    });

    if (error) setStatus(`Weight save failed: ${error.message}`);
    else {
      setWeightValue('');
      setWeightNotes('');
      setStatus('Weight saved.');
      await loadLogs();
    }
  }

  async function exportCsv() {
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .gte('care_date', exportStart)
      .lte('care_date', exportEnd)
      .order('care_date', { ascending: true });

    if (error) {
      setStatus(`Export failed: ${error.message}`);
      return;
    }

    const rows = data || [];
    const headers = [
      'care_date',
      'soak_status',
      'humidifier_refilled',
      'calcium_given',
      'greens_fed',
      'greens_text',
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
      ...rows.map((row) =>
        headers
          .map((header) => `"${String(row[header] ?? '').replaceAll('"', '""')}"`)
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daily-tort-${exportStart}-to-${exportEnd}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const reminderItems = [
    'Soak for 15 minutes',
    'Feed greens',
    plan.isFruitDay ? 'Feed fruit' : 'Feed veggie',
    plan.isSunday ? 'Feed protein' : null,
    'Give calcium',
    'Refill humidifier',
  ].filter(Boolean);

  return (
    <main>
      <section className="hero">
        <div className="hero-image">
          <div className="tort-icon">🐢</div>
          <p>Add Raphael image here</p>
        </div>
        <div className="hero-copy">
          <p className="eyebrow">Raphael's Care Tracker</p>
          <h1>The Daily Tort</h1>
          <p className="hero-text">
            A daily care dashboard for soaking, feeding rotation, humidity, sunshine, weight, vet notes, and sitter exports.
          </p>
          <div className="hero-buttons">
            <button onClick={saveDaily}><Save size={18} /> Save Today</button>
            <button className="secondary" onClick={exportCsv}><Download size={18} /> Export CSV</button>
          </div>
        </div>
      </section>

      {status && <div className="status">{status}</div>}

      <section className="grid cards">
        <div className="card">
          <CalendarDays />
          <span>Selected Date</span>
          <strong>{niceDate(date)}</strong>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="card">
          <Wheat />
          <span>Food Rotation</span>
          <strong>{plan.isFruitDay ? 'Fruit Day' : 'Veggie Day'}</strong>
        </div>
        <div className="card">
          <Bell />
          <span>Protein</span>
          <strong>{plan.isSunday ? 'Due Today' : 'Sunday Only'}</strong>
        </div>
        <div className="card">
          <ShieldCheck />
          <span>Substrate</span>
          <strong>7/1 + 12/1 yearly</strong>
        </div>
      </section>

      <section className="layout">
        <div className="panel">
          <h2>Today's Care Log</h2>

          <div className="task-row">
            <label>
              <input type="radio" name="soak" checked={daily.soak_status === 'complete'} onChange={() => updateDaily('soak_status', 'complete')} />
              Soak complete
            </label>
            <label>
              <input type="radio" name="soak" checked={daily.soak_status === 'missed'} onChange={() => updateDaily('soak_status', 'missed')} />
              Soak missed
            </label>
          </div>

          <div className="check-grid">
            <label><input type="checkbox" checked={daily.humidifier_refilled} onChange={(e) => updateDaily('humidifier_refilled', e.target.checked)} /> Humidifier refilled</label>
            <label><input type="checkbox" checked={daily.calcium_given} onChange={(e) => updateDaily('calcium_given', e.target.checked)} /> Calcium given</label>
            <label><input type="checkbox" checked={daily.outside_time} onChange={(e) => updateDaily('outside_time', e.target.checked)} /> Outside sunshine</label>
          </div>

          {daily.outside_time && (
            <input value={daily.outside_duration || ''} onChange={(e) => updateDaily('outside_duration', e.target.value)} placeholder="Outside duration, e.g. 30 minutes" />
          )}

          <h3>Feeding</h3>
          <div className="food-box">
            <label><input type="checkbox" checked={daily.greens_fed} onChange={(e) => updateDaily('greens_fed', e.target.checked)} /> Greens fed</label>
            <input value={daily.greens_text || ''} onChange={(e) => updateDaily('greens_text', e.target.value)} placeholder="Kale, dandelion greens, romaine, etc." />
          </div>

          {plan.isFruitDay && (
            <div className="food-box">
              <label><input type="checkbox" checked={daily.fruit_fed} onChange={(e) => updateDaily('fruit_fed', e.target.checked)} /> Fruit fed</label>
              <input value={daily.fruit_text || ''} onChange={(e) => updateDaily('fruit_text', e.target.value)} placeholder="Papaya, mango, berries, etc." />
            </div>
          )}

          {plan.isVeggieDay && (
            <div className="food-box">
              <label><input type="checkbox" checked={daily.veggie_fed} onChange={(e) => updateDaily('veggie_fed', e.target.checked)} /> Veggie fed</label>
              <input value={daily.veggie_text || ''} onChange={(e) => updateDaily('veggie_text', e.target.value)} placeholder="Squash, mushroom, carrot, etc." />
            </div>
          )}

          {plan.isSunday && (
            <div className="food-box">
              <label><input type="checkbox" checked={daily.protein_fed} onChange={(e) => updateDaily('protein_fed', e.target.checked)} /> Protein fed</label>
              <input value={daily.protein_text || ''} onChange={(e) => updateDaily('protein_text', e.target.value)} placeholder="Crickets, protein item, etc." />
            </div>
          )}

          <h3>Vet Visit</h3>
          <label className="inline-check">
            <input type="checkbox" checked={vetChecked} onChange={(e) => setVetChecked(e.target.checked)} />
            Vet visit today
          </label>
          {vetChecked && (
            <textarea value={vetNotes} onChange={(e) => setVetNotes(e.target.value)} placeholder="Vet visit notes..." />
          )}

          <h3>Care Notes</h3>
          <textarea value={daily.care_notes || ''} onChange={(e) => updateDaily('care_notes', e.target.value)} placeholder="General care notes..." />

          <button className="wide" onClick={saveDaily} disabled={loading}>
            <Save size={18} /> {loading ? 'Saving...' : 'Save Daily Care'}
          </button>
        </div>

        <aside className="side">
          <div className="panel">
            <h2>Today's Reminder</h2>
            <ul className="reminders">
              {reminderItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>

          <div className="panel">
            <h2>Weight Log</h2>
            <input value={weightValue} onChange={(e) => setWeightValue(e.target.value)} placeholder="Weight, e.g. 694g" />
            <input value={weightNotes} onChange={(e) => setWeightNotes(e.target.value)} placeholder="Weight notes" />
            <button className="wide secondary" onClick={saveWeight}><Scale size={18} /> Save Weight</button>
            <div className="mini-log">
              {weights.map((entry) => (
                <div key={entry.id}><strong>{entry.weight_value}</strong><span>{niceDate(entry.weigh_date)}</span></div>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2>Vet Visit Log</h2>
            <div className="mini-log">
              {vetVisits.map((visit) => (
                <div key={visit.id}><strong>{niceDate(visit.visit_date)}</strong><span>{visit.notes}</span></div>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2>Pet Sitter Export</h2>
            <label>Start date</label>
            <input type="date" value={exportStart} onChange={(e) => setExportStart(e.target.value)} />
            <label>End date</label>
            <input type="date" value={exportEnd} onChange={(e) => setExportEnd(e.target.value)} />
            <button className="wide secondary" onClick={exportCsv}><Download size={18} /> Export Care Schedule</button>
          </div>
        </aside>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
