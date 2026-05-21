import { useMemo, useState } from "react";
import { MEALS, fmtDate, fmtPretty, weekDays, Field, inputCls, Icon, I } from "../lib/utils.jsx";
import { ingredientKey, toBase, fromBase } from "../lib/units";

export default function PlanTab({ state, onSlotChange }) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [editing, setEditing] = useState(null);
  const days = weekDays(anchor);
  const todayKey = fmtDate(new Date());

  const recipeMap = useMemo(() => Object.fromEntries(state.recipes.map((r) => [r.id, r])), [state.recipes]);
  const mainRecipes = useMemo(() => state.recipes.filter((r) => (r.recipe_type || "main") === "main"), [state.recipes]);
  const sideRecipes = useMemo(() => state.recipes.filter((r) => (r.recipe_type || "main") === "side"), [state.recipes]);

  const inventoryMap = useMemo(() => {
    const m = {};
    for (const it of state.inventory) {
      const k = ingredientKey(it.name, it.unit);
      m[k] = (m[k] || 0) + toBase(it.quantity, it.unit);
    }
    return m;
  }, [state.inventory]);

  // Cumulative simulation: walk the week, deducting ingredients for every dish
  // (main + side) at each slot, scaled by the servings override / recipe's default.
  const slotStatus = useMemo(() => {
    const running = { ...inventoryMap };
    const status = {};
    const consumeRecipe = (r, plannedServings, missing) => {
      const mult = plannedServings && r.servings ? plannedServings / r.servings : 1;
      for (const ing of r.ingredients) {
        const k = ingredientKey(ing.name, ing.unit);
        const haveBase = running[k] || 0;
        const needBase = toBase(ing.quantity, ing.unit) * mult;
        if (needBase > haveBase) {
          const shortBase = needBase - haveBase;
          missing.push({ name: ing.name, unit: ing.unit, short: Math.round(fromBase(shortBase, ing.unit) * 100) / 100 });
        }
        running[k] = Math.max(0, haveBase - needBase);
      }
    };
    for (const d of days) {
      for (const meal of MEALS) {
        const slot = state.mealPlan[d]?.[meal];
        if (!slot) continue;
        const missing = [];
        const main = slot.main_recipe_id ? recipeMap[slot.main_recipe_id] : null;
        const side = slot.side_recipe_id ? recipeMap[slot.side_recipe_id] : null;
        const planned = slot.servings || main?.servings || side?.servings || null;
        if (main) consumeRecipe(main, planned, missing);
        if (side) consumeRecipe(side, planned, missing);
        if (missing.length > 0) status[`${d}|${meal}`] = missing;
      }
    }
    return status;
  }, [days, state.mealPlan, recipeMap, inventoryMap]);

  const shift = (n) => { const d = new Date(anchor); d.setDate(d.getDate() + n * 7); setAnchor(d); };

  const openEdit = (date, meal) => {
    const slot = state.mealPlan[date]?.[meal] || {};
    const main = slot.main_recipe_id ? recipeMap[slot.main_recipe_id] : null;
    setEditing({
      date, meal,
      main_recipe_id: slot.main_recipe_id || "",
      side_recipe_id: slot.side_recipe_id || "",
      servings: slot.servings || main?.servings || "",
    });
  };
  const closeEdit = () => setEditing(null);
  const saveEdit = async () => {
    if (!editing) return;
    await onSlotChange(editing.date, editing.meal, {
      main_recipe_id: editing.main_recipe_id || null,
      side_recipe_id: editing.side_recipe_id || null,
      servings: editing.servings ? Number(editing.servings) : null,
    });
    closeEdit();
  };
  const clearSlot = async () => {
    if (!editing) return;
    await onSlotChange(editing.date, editing.meal, { main_recipe_id: null, side_recipe_id: null, servings: null });
    closeEdit();
  };

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
                <th key={d} className={`py-2 px-2 font-medium min-w-[120px] sm:min-w-[160px] ${d === todayKey ? "bg-emerald-100 text-emerald-800 rounded-t-md" : ""}`}>
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
                  const slot = state.mealPlan[d]?.[meal];
                  const missing = slot ? (slotStatus[`${d}|${meal}`] || []) : [];
                  const isMissing = missing.length > 0;
                  const tooltip = isMissing ? "Missing: " + missing.map((m) => `${m.short} ${m.unit} ${m.name}`).join(", ") : "";
                  const main = slot?.main_recipe_id ? recipeMap[slot.main_recipe_id] : null;
                  const side = slot?.side_recipe_id ? recipeMap[slot.side_recipe_id] : null;
                  const planned = slot?.servings || main?.servings || null;
                  const empty = !main && !side;
                  return (
                    <td key={d} className={`py-2 px-1 align-top ${d === todayKey ? "bg-emerald-50/60" : ""}`}>
                      <button onClick={() => openEdit(d, meal)} title={tooltip}
                        className={`w-full rounded-md px-2 py-1.5 text-xs border text-left transition ${
                          empty ? "bg-white border-dashed border-slate-300 text-slate-400 hover:border-emerald-400 hover:text-emerald-600" :
                          isMissing ? "bg-rose-50 border-rose-400 text-rose-700" :
                          "bg-slate-50 border-slate-200 text-slate-700 hover:border-emerald-400"
                        }`}>
                        {empty ? (
                          <span className="block text-center">+ add</span>
                        ) : (
                          <>
                            {main && <span className="block font-medium truncate">{main.name}</span>}
                            {side && <span className="block text-amber-700 text-[11px] truncate">+ {side.name}</span>}
                            <span className="block text-[10px] text-slate-500 mt-0.5">{planned ? `${planned} servings` : ""}</span>
                          </>
                        )}
                      </button>
                      {isMissing && <div className="mt-1 text-[10px] text-rose-600 leading-tight">Missing {missing.length} item{missing.length > 1 ? "s" : ""}</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Tap a slot to set a main dish, optional side dish, and servings. Inventory consumption scales by servings — Sunday lunch for 6 uses 3× the ingredients of a 2-serving recipe.
        Slots in <span className="text-rose-600 font-medium">red</span> indicate ingredient shortfalls (cumulative across the week).
      </p>

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-3 sm:p-6" onClick={closeEdit}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-semibold text-lg capitalize">{editing.meal}</h2>
                <p className="text-xs text-slate-500">{fmtPretty(editing.date)}</p>
              </div>
              <button onClick={closeEdit} className="text-slate-400 hover:text-slate-700 -m-2 p-2"><Icon d={I.x} className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <Field label="Main dish">
                <select value={editing.main_recipe_id} onChange={(e) => setEditing({ ...editing, main_recipe_id: e.target.value })} className={inputCls}>
                  <option value="">— none —</option>
                  {mainRecipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </Field>
              <Field label="Side dish (optional)">
                <select value={editing.side_recipe_id} onChange={(e) => setEditing({ ...editing, side_recipe_id: e.target.value })} className={inputCls}>
                  <option value="">— none —</option>
                  {sideRecipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </Field>
              <Field label="Servings">
                <input type="number" min="1" value={editing.servings} onChange={(e) => setEditing({ ...editing, servings: e.target.value })} className={inputCls} placeholder="e.g. 4" />
              </Field>
              <p className="text-[11px] text-slate-400">Servings scales the ingredients. Leave blank to use each recipe's default.</p>
              <div className="flex gap-2 pt-2">
                <button onClick={saveEdit} className="flex-1 bg-emerald-600 text-white rounded-md py-2 text-sm font-medium hover:bg-emerald-700">Save</button>
                <button onClick={closeEdit} className="px-4 py-2 border border-slate-300 rounded-md text-sm">Cancel</button>
                <button onClick={clearSlot} className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-md text-sm" title="Clear slot"><Icon d={I.trash} className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
