import { useMemo, useState } from "react";
import { MEALS, fmtPretty, weekDays, Field, inputCls, Icon, I, uid } from "../lib/utils.jsx";
import { ingredientKey, dimensionOf, toBase, fromBase, formatBase } from "../lib/units";

export default function ShoppingTab({ state, onReplaceInventory }) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [checked, setChecked] = useState({});
  const [purchasing, setPurchasing] = useState(null);
  const days = weekDays(anchor);
  const recipeMap = useMemo(() => Object.fromEntries(state.recipes.map((r) => [r.id, r])), [state.recipes]);

  // Sum needed quantities in BASE units, scaling each recipe by the slot's
  // servings override (defaults to the recipe's own servings → multiplier 1).
  const needed = useMemo(() => {
    const sum = {};
    const addRecipe = (r, planned) => {
      const mult = planned && r.servings ? planned / r.servings : 1;
      for (const ing of r.ingredients) {
        const k = ingredientKey(ing.name, ing.unit);
        if (!sum[k]) sum[k] = { name: ing.name, dim: dimensionOf(ing.unit), baseQty: 0 };
        sum[k].baseQty += toBase(ing.quantity, ing.unit) * mult;
      }
    };
    for (const d of days) {
      const day = state.mealPlan[d] || {};
      for (const meal of MEALS) {
        const slot = day[meal];
        if (!slot) continue;
        const main = slot.main_recipe_id ? recipeMap[slot.main_recipe_id] : null;
        const side = slot.side_recipe_id ? recipeMap[slot.side_recipe_id] : null;
        const planned = slot.servings || main?.servings || side?.servings || null;
        if (main) addRecipe(main, planned);
        if (side) addRecipe(side, planned);
      }
    }
    return sum;
  }, [days, state.mealPlan, recipeMap]);

  const inventoryMap = useMemo(() => {
    const m = {};
    for (const it of state.inventory) {
      const k = ingredientKey(it.name, it.unit);
      m[k] = (m[k] || 0) + toBase(it.quantity, it.unit);
    }
    return m;
  }, [state.inventory]);

  const list = useMemo(() => {
    const rows = [];
    for (const k of Object.keys(needed)) {
      const need = needed[k];
      const haveBase = inventoryMap[k] || 0;
      const buyBase = Math.max(0, need.baseQty - haveBase);
      if (buyBase > 0) {
        rows.push({
          key: k, name: need.name, dim: need.dim,
          need: formatBase(need.baseQty, need.dim),
          have: formatBase(haveBase, need.dim),
          buy: formatBase(buyBase, need.dim),
        });
      }
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, [needed, inventoryMap]);

  const shift = (n) => { const d = new Date(anchor); d.setDate(d.getDate() + n * 7); setAnchor(d); };

  const handleRowClick = (row) => {
    if (checked[row.key]) {
      setChecked((c) => { const n = { ...c }; delete n[row.key]; return n; });
      return;
    }
    setPurchasing({ key: row.key, name: row.name, dim: row.dim, quantity: String(row.buy.value), unit: row.buy.unit });
  };
  const closePurchase = () => setPurchasing(null);
  const confirmPurchase = async () => {
    if (!purchasing) return;
    const qty = Number(purchasing.quantity) || 0;
    if (qty <= 0) { closePurchase(); return; }
    const targetKey = ingredientKey(purchasing.name, purchasing.unit);
    const boughtBase = toBase(qty, purchasing.unit);
    let merged = false;
    const inv = state.inventory.map((it) => {
      if (merged) return it;
      if (ingredientKey(it.name, it.unit) === targetKey) {
        merged = true;
        const newBase = toBase(it.quantity, it.unit) + boughtBase;
        const newQty = Math.round(fromBase(newBase, it.unit) * 1000) / 1000;
        return { ...it, quantity: newQty };
      }
      return it;
    });
    if (!merged) {
      inv.push({ id: uid(), name: purchasing.name, quantity: qty, unit: purchasing.unit, category: "Other" });
    }
    await onReplaceInventory(inv);
    setChecked((c) => ({ ...c, [purchasing.key]: true }));
    closePurchase();
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold text-lg">Shopping list — week of {fmtPretty(days[0])}</h2>
        <div className="flex gap-2">
          <button onClick={() => shift(-1)} className="px-3 py-1.5 border border-slate-300 rounded-md text-sm">←</button>
          <button onClick={() => setAnchor(new Date())} className="px-3 py-1.5 border border-slate-300 rounded-md text-sm">Today</button>
          <button onClick={() => shift(1)} className="px-3 py-1.5 border border-slate-300 rounded-md text-sm">→</button>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="text-slate-500 text-sm py-6 text-center">Nothing to buy — either you've planned no meals or you already have everything in your inventory.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {list.map((row) => (
            <li key={row.key} className="py-2">
              <button onClick={() => handleRowClick(row)} className="w-full flex items-center gap-3 text-left -m-1 p-1 rounded hover:bg-slate-50 transition">
                <span className={`w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition ${checked[row.key] ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300 bg-white"}`}>
                  {checked[row.key] && <Icon d={I.check} className="w-3 h-3" />}
                </span>
                <span className={`flex-1 ${checked[row.key] ? "line-through text-slate-400" : "text-slate-800"}`}>
                  <span className="font-medium block">{row.name}</span>
                  <span className="text-xs text-slate-500 block">
                    Need {row.need.value} {row.need.unit} · Have {row.have.value} {row.have.unit} · <span className="text-emerald-700 font-semibold">Buy {row.buy.value} {row.buy.unit}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-slate-500">Tap a row to log a purchase. Quantities respect per-meal serving overrides set in the Meal Plan.</p>

      {purchasing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-3 sm:p-6" onClick={closePurchase}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-1">
              <h2 className="font-semibold text-lg">Add to pantry</h2>
              <button onClick={closePurchase} className="text-slate-400 hover:text-slate-700 -m-2 p-2"><Icon d={I.x} className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-600 mb-4">How much <span className="font-semibold">{purchasing.name}</span> did you buy?</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantity"><input type="number" value={purchasing.quantity} onChange={(e) => setPurchasing({ ...purchasing, quantity: e.target.value })} className={inputCls} autoFocus /></Field>
                <Field label="Unit"><input list="inventory-units-list" value={purchasing.unit} onChange={(e) => setPurchasing({ ...purchasing, unit: e.target.value })} className={inputCls} /></Field>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={confirmPurchase} className="flex-1 bg-emerald-600 text-white rounded-md py-2 text-sm font-medium hover:bg-emerald-700">Add to pantry</button>
                <button onClick={closePurchase} className="px-4 py-2 border border-slate-300 rounded-md text-sm">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
