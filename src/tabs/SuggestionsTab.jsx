import { useMemo, useState } from "react";
import { Icon, I } from "../lib/utils.jsx";
import { ingredientKey, toBase, fromBase } from "../lib/units";

export default function SuggestionsTab({ state, onReplaceInventory }) {
  const [sort, setSort] = useState("ready");

  const inventoryMap = useMemo(() => {
    const m = {};
    for (const it of state.inventory) {
      const k = ingredientKey(it.name, it.unit);
      m[k] = (m[k] || 0) + toBase(it.quantity, it.unit);
    }
    return m;
  }, [state.inventory]);

  const annotated = useMemo(() => state.recipes.map((r) => {
    const missing = [];
    let maxBatches = Infinity;
    for (const ing of r.ingredients) {
      const k = ingredientKey(ing.name, ing.unit);
      const haveBase = inventoryMap[k] || 0;
      const needBase = toBase(ing.quantity, ing.unit);
      if (needBase <= 0) continue;
      const batches = haveBase / needBase;
      if (batches < 1) {
        const shortBase = needBase - haveBase;
        missing.push({ name: ing.name, unit: ing.unit, short: Math.round(fromBase(shortBase, ing.unit) * 100) / 100 });
      }
      if (batches < maxBatches) maxBatches = batches;
    }
    const cookable = missing.length === 0;
    const batches = isFinite(maxBatches) ? Math.floor(maxBatches) : 0;
    return { recipe: r, missing, cookable, batches };
  }), [state.recipes, inventoryMap]);

  const ready = annotated.filter((a) => a.cookable);
  const close = annotated.filter((a) => !a.cookable && a.missing.length <= 2);
  const farAway = annotated.filter((a) => !a.cookable && a.missing.length > 2);

  const sortFn = sort === "name"
    ? (a, b) => a.recipe.name.localeCompare(b.recipe.name)
    : (a, b) => a.missing.length - b.missing.length || a.recipe.name.localeCompare(b.recipe.name);
  ready.sort(sortFn); close.sort(sortFn); farAway.sort(sortFn);

  const cook = async (recipe) => {
    if (!confirm(`Mark "${recipe.name}" as cooked? Ingredients will be deducted from your inventory.`)) return;
    const inv = state.inventory.map((it) => ({ ...it }));
    for (const ing of recipe.ingredients) {
      let remaining = toBase(ing.quantity, ing.unit);
      const k = ingredientKey(ing.name, ing.unit);
      for (const it of inv) {
        if (remaining <= 0) break;
        if (ingredientKey(it.name, it.unit) !== k) continue;
        const haveBase = toBase(it.quantity, it.unit);
        const useBase = Math.min(haveBase, remaining);
        remaining -= useBase;
        it.quantity = Math.max(0, Math.round(fromBase(haveBase - useBase, it.unit) * 1000) / 1000);
      }
    }
    const cleaned = inv.filter((it) => Number(it.quantity) > 0);
    await onReplaceInventory(cleaned);
  };

  const Card = ({ entry }) => {
    const { recipe, missing, cookable, batches } = entry;
    return (
      <div className={`rounded-xl border p-4 transition ${cookable ? "bg-emerald-50 border-emerald-200" : missing.length <= 2 ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 truncate">{recipe.name}</div>
            <div className="text-xs text-slate-600">{recipe.servings} servings per batch · {recipe.ingredients.length} ingredients</div>
          </div>
          {cookable && (
            <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
              <Icon d={I.check} className="w-3 h-3" /> Ready
            </span>
          )}
        </div>
        {cookable ? (
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-emerald-800">
              Stock supports up to <span className="font-semibold">{batches}</span> batch{batches === 1 ? "" : "es"}
              {batches > 0 && <> ({batches * recipe.servings} servings)</>}
            </div>
            <button onClick={() => cook(recipe)} className="bg-emerald-600 text-white text-xs font-medium rounded-md px-3 py-1.5 hover:bg-emerald-700">Mark as cooked</button>
          </div>
        ) : (
          <div className="mt-3">
            <div className="text-xs font-medium text-slate-700 mb-1">Missing {missing.length} ingredient{missing.length > 1 ? "s" : ""}:</div>
            <ul className="text-xs text-slate-600 space-y-0.5">
              {missing.map((m, i) => <li key={i}>• <span className="font-medium">{m.short} {m.unit}</span> {m.name}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const Section = ({ title, items, emptyHint, accent }) => (
    <section className="mb-6">
      <h3 className={`text-sm font-semibold mb-2 ${accent}`}>{title} <span className="text-slate-400 font-normal">({items.length})</span></h3>
      {items.length === 0 ? <p className="text-xs text-slate-400 italic">{emptyHint}</p> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{items.map((e) => <Card key={e.recipe.id} entry={e} />)}</div>
      )}
    </section>
  );

  if (state.recipes.length === 0) {
    return <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500 text-sm">Add some recipes first and we'll suggest what you can cook from your inventory.</section>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-lg">What can I cook?</h2>
          <p className="text-xs text-slate-500">Compares your current inventory against every recipe.</p>
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white">
          <option value="ready">Sort by readiness</option>
          <option value="name">Sort by name</option>
        </select>
      </div>
      <Section title="Ready to cook" items={ready} accent="text-emerald-700" emptyHint="No recipes are fully covered by your inventory yet — see what's close below." />
      <Section title="Almost there" items={close} accent="text-amber-700" emptyHint="Nothing missing just one or two items." />
      <Section title="Need more shopping" items={farAway} accent="text-slate-500" emptyHint="No recipes with several missing ingredients." />
    </div>
  );
}
