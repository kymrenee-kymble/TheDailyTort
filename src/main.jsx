
import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App(){
  return (
    <div style={{padding:20}}>
      <h1>The Daily Tort 🐢</h1>
      <div className="panel">
        <h2>Today’s Care</h2>
        <div className="food-card">Greens</div>
        <div className="food-card">Fruit / Veg</div>
      </div>
      <div className="callout">Reminder: Feed Raphael</div>
    </div>
  )
}

createRoot(document.getElementById("root")).render(<App/>);
