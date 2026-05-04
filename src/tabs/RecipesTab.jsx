import { useState } from "react";
import { Field, inputCls, Icon, I, readExcelIngredients } from "../lib/utils.jsx";

export default function RecipesTab({ recipes, inventory, onSave, onDelete }) {
  const [editing, setEditing] = useState(null); // null | "new" | recipe.id
  const [open, setOpen] = useState(null);
  const blank = { id: null, name: "", servings: 2, ingredients: [{ name: "", quantity: "", unit: "" }], instructions: "" };
  const [draft, setDraft] = useState(blank);

  const startNew = () => { setEditing("new"); setDraft(blank); };
  const startEdit = (r) => { setEditing(r.id); setDraft({ ...r, ingredients: r.ingredients.map((i) => ({ ...i })) }); };
  const cancel = () => { setEditing(null); setDraft(blank); };

  const save = async () => {
    if (!draft.name.trim()) return;
    const recipe = {
      id: draft.id,
      name: draft.name,
      servings: Number(draft.servings) || 1,
      ingredients: draft.ingredients.filter((i) => i.name.trim()).map((i) => ({ ...i, quantity: Number(i.quantity) || 0 })),
      instructions: draft.instructions || "",
    };
    await onSave(recipe);
    cancel();
  };
  const remove = async (id) => {
    if (!confirm("Delete this recipe?")) return;
    await onDelete(id);
  };

  const updateIngredient = (idx, patch) => setDraft((d) => ({ ...d, ingredients: d.ingredients.map((ing, i) => i === idx ? { ...ing, ...patch } : ing) }));
  const addIngredient = () => setDraft((d) => ({ ...d, ingredients: [...d.ingredients, { name: "", quantity: "", unit: "" }] }));
  const removeIngredient = (idx) => setDraft((d) => ({ ...d, ingredients: d.ingredients.filter((_, i) => i !== idx) }));

  const pickFile = () => new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".xlsx,.xls,.csv";
    input.onchange = (e) => resolve(e.target.files?.[0] || null);
    input.click();
  });
  const importIntoDraft = async () => {
    const file = await pickFile(); if (!file) return;
    try {
      const imported = await readExcelIngredients(file);
      if (imported.length === 0) { alert("No ingredients found. Expected columns: ingredient, quantity, unit."); return; }
      setDraft((d) => {
        const kept = d.ingredients.filter((i) => i.name && i.name.trim());
        return { ...d, ingredients: [...kept, ...imported] };
      });
    } catch (err) { alert("Could not read the file: " + (err.message || err)); }
  };
  const importAsNewRecipe = async () => {
    const file = await pickFile(); if (!file) return;
    try {
      const imported = await readExcelIngredients(file);
      if (imported.length === 0) { alert("No ingredients found. Expected columns: ingredient, quantity, unit."); return; }
      setDraft({ id: null, name: file.name.replace(/\.[^.]+$/, ""), servings: 2, ingredients: imported, instructions: "" });
      setEditing("new");
    } catch (err) { alert("Could not read the file: " + (err.message || err)); }
  };

  if (editing) {
    return (
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5 max-w-3xl">
        <h2 className="font-semibold text-lg mb-4">{editing === "new" ? "New recipe" : "Edit recipe"}</h2>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2"><Field label="Recipe name"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} /></Field></div>
            <Field label="Servings"><input type="number" value={draft.servings} onChange={(e) => setDraft({ ...draft, servings: e.target.value })} className={inputCls} /></Field>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-600 mb-2">Ingredients</div>
            <div className="space-y-2">
              {draft.ingredients.map((ing, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input value={ing.name} onChange={(e) => updateIngredient(idx, { name: e.target.value })} placeholder="Ingredient" className={inputCls + " col-span-12 sm:col-span-6"} />
                  <input type="number" value={ing.quantity} onChange={(e) => updateIngredient(idx, { quantity: e.target.value })} placeholder="Qty" className={inputCls + " col-span-4 sm:col-span-2"} />
                  <input list="inventory-units-list" value={ing.unit} onChange={(e) => updateIngredient(idx, { unit: e.target.value })} placeholder="Unit" className={inputCls + " col-span-7 sm:col-span-3"} />
                  <button onClick={() => removeIngredient(idx)} className="col-span-1 text-slate-400 hover:text-rose-600 flex justify-center"><Icon d={I.x} className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <button onClick={addIngredient} className="text-emerald-600 text-sm font-medium flex items-center gap-1"><Icon d={I.plus} className="w-4 h-4" /> Add ingredient</button>
              <button onClick={importIntoDraft} className="text-emerald-600 text-sm font-medium flex items-center gap-1">↥ Import from Excel</button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Excel/CSV with columns <span className="font-mono">ingredient</span>, <span className="font-mono">quantity</span>, <span className="font-mono">unit</span>. Header row optional.</p>
          </div>
          <Field label="Instructions"><textarea value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} rows={5} className={inputCls} /></Field>
          <div className="flex gap-2 pt-2">
            <button onClick={save} className="bg-emerald-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-emerald-700">Save recipe</button>
            <button onClick={cancel} className="px-4 py-2 border border-slate-300 rounded-md text-sm">Cancel</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold text-lg">Recipes ({recipes.length})</h2>
        <div className="flex gap-2">
          <button onClick={importAsNewRecipe} className="bg-white border border-emerald-600 text-emerald-700 rounded-md px-3 py-2 text-sm font-medium hover:bg-emerald-50">↥ Import from Excel</button>
          <button onClick={startNew} className="bg-emerald-600 text-white rounded-md px-3 py-2 text-sm font-medium hover:bg-emerald-700 flex items-center gap-1"><Icon d={I.plus} className="w-4 h-4" /> New recipe</button>
        </div>
      </div>
      {recipes.length === 0 && <p className="text-slate-400 text-sm py-8 text-center bg-white rounded-xl border border-slate-200">No recipes yet.</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recipes.map((r) => (
          <div key={r.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-800">{r.name}</div>
                <div className="text-xs text-slate-500">{r.servings} servings · {r.ingredients.length} ingredients</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(r)} className="text-slate-400 hover:text-emerald-600 p-1"><Icon d={I.edit} className="w-4 h-4" /></button>
                <button onClick={() => remove(r.id)} className="text-slate-400 hover:text-rose-600 p-1"><Icon d={I.trash} className="w-4 h-4" /></button>
              </div>
            </div>
            <button onClick={() => setOpen(open === r.id ? null : r.id)} className="text-emerald-600 text-xs font-medium mt-2">{open === r.id ? "Hide details" : "Show details"}</button>
            {open === r.id && (
              <div className="mt-3 pt-3 border-t border-slate-100 text-sm space-y-2">
                <ul className="text-slate-600 list-disc pl-5 space-y-0.5">
                  {r.ingredients.map((i, idx) => <li key={idx}>{i.quantity} {i.unit} {i.name}</li>)}
                </ul>
                {r.instructions && <p className="text-slate-700 whitespace-pre-wrap">{r.instructions}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
