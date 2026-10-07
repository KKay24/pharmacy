import React, { useState, useEffect } from "react";

let toasts = [];
let listeners = [];

function notify() { listeners.forEach(fn => fn([...toasts])); }

export function showToast(message, type = "success", duration = 3000) {
  const id = Date.now();
  toasts.push({ id, message, type });
  notify();
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id);
    notify();
  }, duration);
}

export function StoreToast() {
  const [list, setList] = useState([]);
  useEffect(() => {
    listeners.push(setList);
    return () => { listeners = listeners.filter(fn => fn !== setList); };
  }, []);
  return (
    <div className="store-toast-root">
      {list.map(t => (
        <div key={t.id} className={`store-toast ${t.type}`}>
          {t.type === "success" ? "✓" : "✕"} {t.message}
        </div>
      ))}
    </div>
  );
}
