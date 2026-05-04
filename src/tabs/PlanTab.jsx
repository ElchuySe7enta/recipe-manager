import { useMemo, useState } from "react";
import { MEALS, fmtDate, fmtPretty, weekDays } from "../lib/utils.jsx";
import { ingredientKey, toBase, fromBase } from "../lib/units";

export default function PlanTab({ state, onSlotChange }) {
  const [anchor, setAnchor] = useState(() => new Date());
  const days = weekDays(anchor);
  const todayKey = fmtDate(new Date());

  const recipeMap = useMemo(() => Object.fromEntries(state.recipes.map((r) => [r.id, r])), [state.recipes]);
  const inventoryMap = useMemo(() => {
    const m = {};
    for (const it of state.inventory) {
      const k = ingredientKey(it.name, it.unit);
      m[k] = (m[k] || 0) + toBase(it.quantity, it.unit);
    }
    return m;
  }, [state.inventory]);

  const slotStatus = useMemo(() => {
    const running = { ...inventoryMap };
    const status = {};
    for (const d of days) {
      for (const meal of MEALS) {
        const rid = state.mealPlan[d]?.[meal];
        if (!rid) continue;
        const r = recipeMap[rid];
        if (!r) continue;
        const missing = [];
        for (const ing of r.ingredients) {
          const k = ingredientKey(ing.name, ing.unit);
          const haveBase = running[k] || 0;
          const needBase = toBase(ing.quantity, ing.unit);
          if (needBase > haveBase) {
            const shortBase = needBase - haveBase;
            missing.push({ name: ing.name, unit: ing.unit, short: Math.round(fromBase(shortBase, ing.unit) * 100) / 100 });
          }
          running[k] = Math.max(0, haveBase - needBase);
        }
        status[`${d}|${meal}`] = missing;
      }
    }
    return status;
  }, [days, state.mealPlan, recipeMap, inventoryMap]);

  const shift = (n) => { const d = new Date(anchor); d.setDate(d.getDate() + n * 7); setAnchor(d); };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold text-lg">Week of {fmtPretty(days[0])}</h2>
        <div className="flex gap-2">
          <button onClick={() => shift(-1)} className="px-3 py-1.5 border border-slate-300 rounded-md text-sm">← Prev</button>
          <button onClick={() => setAnchor(new Date())} className="px-3 py-1.5 border border-slate-300 rounded-md text-sm">Today</button>
          <button onClick={() => shift(1)} className="px-3 py-1.5 border border-slate-300 rounded-md text-sm">Next →</button>
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3 font-medium">Meal</th>
              {days.map((d) => (
                <th key={d} className={`py-2 px-2 font-medium min-w-[110px] sm:min-w-[140px] ${d === todayKey ? "bg-emerald-100 text-emerald-800 rounded-t-md" : ""}`}>
                  <span className="block sm:inline">{fmtPretty(d)}</span>
                  {d === todayKey && <span className="ml-0 sm:ml-1 block sm:inline text-[10px] uppercase font-semibold tracking-wider">· today</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEALS.map((meal) => (
              <tr key={meal} className="border-t border-slate-100">
                <td className="py-3 pr-3 font-medium capitalize text-slate-700">{meal}</td>
                {days.map((d) => {
                  const rid = state.mealPlan[d]?.[meal] || "";
                  const missing = rid ? (slotStatus[`${d}|${meal}`] || []) : [];
                  const isMissing = missing.length > 0;
                  const tooltip = isMissing ? "Missing: " + missing.map((m) => `${m.short} ${m.unit} ${m.name}`).join(", ") : "";
                  return (
                    <td key={d} className={`py-2 px-1 ${d === todayKey ? "bg-emerald-50/60" : ""}`}>
                      <div className="relative">
                        <select value={rid} onChange={(e) => onSlotChange(d, meal, e.target.value || null)} title={tooltip}
                          className={`w-full rounded-md px-2 py-1.5 text-xs border transition ${isMissing ? "bg-rose-50 border-rose-400 text-rose-700 font-medium" : "bg-slate-50 border-slate-200 text-slate-700"}`}>
                          <option value="">—</option>
                          {state.recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        {isMissing && <div className="mt-1 text-[10px] text-rose-600 leading-tight">Missing {missing.length} ingredient{missing.length > 1 ? "s" : ""}</div>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Slots are highlighted in <span className="text-rose-600 font-medium">red</span> when an ingredient runs out — meals are checked in order through the week, so earlier meals consume inventory before later ones.
      </p>
    </section>
  );
}
