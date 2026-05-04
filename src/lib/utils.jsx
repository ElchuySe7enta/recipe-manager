import React from "react";

export const CATEGORIES = ["Pantry", "Produce", "Dairy", "Meat", "Frozen", "Spices", "Other"];
export const MEALS = ["breakfast", "lunch", "dinner"];

// ---- date helpers ----
// Use local components — toISOString() shifts to UTC and would push dates to
// the previous day in any positive-offset timezone.
export const fmtDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
export const fmtPretty = (iso) => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};
export const startOfWeek = (d) => {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday-start
  const r = new Date(d);
  r.setDate(d.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
};
export const weekDays = (anchor) => {
  const start = startOfWeek(anchor);
  return [...Array(7)].map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return fmtDate(d);
  });
};

// ---- icons ----
export const Icon = ({ d, className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{d}</svg>
);
export const I = {
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <><path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" /></>,
  check: <path d="M5 13l4 4L19 7" />,
  x: <><path d="M6 6l12 12" /><path d="M6 18L18 6" /></>,
};

// ---- shared form bits ----
export const inputCls =
  "w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500";
export const Field = ({ label, children }) => (
  <label className="block">
    <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
    {children}
  </label>
);

// ---- excel import ----
import * as XLSX from "xlsx";
export async function readExcelIngredients(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (!rows.length) return [];
  let nameCol = 0, qtyCol = 1, unitCol = 2, startIdx = 0;
  const first = rows[0].map((c) => String(c || "").toLowerCase().trim());
  const findCol = (re) => first.findIndex((c) => re.test(c));
  const ni = findCol(/^(ingredient|name|item)$/);
  const qi = findCol(/^(quantity|qty|amount)$/);
  const ui = findCol(/^(unit|units|measure)$/);
  if (ni >= 0 && qi >= 0) {
    nameCol = ni; qtyCol = qi; unitCol = ui >= 0 ? ui : 2;
    startIdx = 1;
  }
  const out = [];
  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row[nameCol] ?? "").trim();
    if (!name) continue;
    const rawQty = row[qtyCol];
    const quantity = rawQty === "" || rawQty == null ? "" : Number(rawQty) || rawQty;
    const unit = String(row[unitCol] ?? "").trim();
    out.push({ name, quantity, unit });
  }
  return out;
}

export const uid = () => Math.random().toString(36).slice(2, 10);
