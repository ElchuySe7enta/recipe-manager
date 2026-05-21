import { useMemo, useState } from "react";
import { CATEGORIES, Field, inputCls, Icon, I } from "../lib/utils.jsx";
import { ingredientKey, toBase, fromBase } from "../lib/units";

export default function InventoryTab({ inventory, onAdd, onUpdate, onDelete }) {
  const [filter, setFilter] = useState("All");
  const blank = { id: null, name: "", quantity: "", unit: "", category: "Pantry" };
  const [addDraft, setAddDraft] = useState(blank);
  const [editDraft, setEditDraft] = useState(null);

  const grouped = useMemo(() => {
    const g = {};
    for (const it of inventory) (g[it.category] = g[it.category] || []).push(it);
    for (const k of Object.keys(g)) g[k].sort((a, b) => a.name.localeCompare(b.name));
    return g;
  }, [inventory]);

  const openEdit = (it) => setEditDraft({ ...it });
  const closeEdit = () => setEditDraft(null);

  // When saving an edit, if the new name+dimension collides with another
  // existing inventory row, merge quantities and delete this one instead of
  // creating a parallel row.
  const saveEdit = async () => {
    if (!editDraft || !editDraft.name.trim()) return;
    const editedKey = ingredientKey(editDraft.name, editDraft.unit);
    const duplicate = inventory.find(
      (it) => it.id !== editDraft.id && ingredientKey(it.name, it.unit) === editedKey
    );
    if (duplicate) {
      const editedBase = toBase(editDraft.quantity, editDraft.unit);
      const newBase = toBase(duplicate.quantity, duplicate.unit) + editedBase;
      const newQty = Math.round(fromBase(newBase, duplicate.unit) * 1000) / 1000;
      await onUpdate({ ...duplicate, quantity: newQty });
      await onDelete(editDraft.id);
    } else {
      await onUpdate(editDraft);
    }
    closeEdit();
  };

  const deleteFromEdit = async () => {
    if (!editDraft) return;
    if (!confirm(`Delete "${editDraft.name}"?`)) return;
    await onDelete(editDraft.id);
    closeEdit();
  };

  // When adding, if the new ingredient matches an existing one (same name +
  // same unit dimension, e.g. "Milk"/L matches "Milk"/mL), increment the
  // existing row's quantity instead of creating a duplicate.
  const addItem = async () => {
    if (!addDraft.name.trim()) return;
    const targetKey = ingredientKey(addDraft.name, addDraft.unit);
    const existing = inventory.find((it) => ingredientKey(it.name, it.unit) === targetKey);
    if (existing) {
      const addedBase = toBase(addDraft.quantity, addDraft.unit);
      const newBase = toBase(existing.quantity, existing.unit) + addedBase;
      const newQty = Math.round(fromBase(newBase, existing.unit) * 1000) / 1000;
      await onUpdate({ ...existing, quantity: newQty });
    } else {
      await onAdd(addDraft);
    }
    setAddDraft(blank);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <section className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-lg">Pantry & Fridge</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="text-sm border-slate-300 rounded-md border px-2 py-1.5">
            <option>All</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        {inventory.length === 0 && <p className="text-slate-400 text-sm py-8 text-center">No items yet.</p>}
        <div className="space-y-4">
          {Object.entries(grouped).filter(([cat]) => filter === "All" || cat === filter).map(([cat, items]) => (
            <div key={cat}>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{cat}</div>
              <ul className="divide-y divide-slate-100">
                {items.map((it) => (
                  <li key={it.id} className="py-2">
                    <button onClick={() => openEdit(it)} className="w-full text-left -m-1 p-1 rounded hover:bg-slate-50 transition">
                      <div className="font-medium text-slate-800 hover:text-emerald-700">{it.name}</div>
                      <div className="text-xs text-slate-500">{it.quantity} {it.unit}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-4">Tip: tap an ingredient name to edit. Adding an ingredient that already exists merges quantities automatically.</p>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5 h-fit">
        <h2 className="font-semibold text-lg mb-3">Add item</h2>
        <div className="space-y-3">
          <Field label="Name"><input value={addDraft.name} onChange={(e) => setAddDraft({ ...addDraft, name: e.target.value })} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity"><input type="number" value={addDraft.quantity} onChange={(e) => setAddDraft({ ...addDraft, quantity: e.target.value })} className={inputCls} /></Field>
            <Field label="Unit"><input list="inventory-units-list" value={addDraft.unit} onChange={(e) => setAddDraft({ ...addDraft, unit: e.target.value })} placeholder="g, mL, pcs" className={inputCls} /></Field>
          </div>
          <Field label="Category">
            <select value={addDraft.category} onChange={(e) => setAddDraft({ ...addDraft, category: e.target.value })} className={inputCls}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <button onClick={addItem} className="w-full bg-emerald-600 text-white rounded-md py-2 text-sm font-medium hover:bg-emerald-700">Add</button>
        </div>
      </section>

      {editDraft && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-3 sm:p-6" onClick={closeEdit}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h2 className="font-semibold text-lg">Edit item</h2>
              <button onClick={closeEdit} className="text-slate-400 hover:text-slate-700 -m-2 p-2"><Icon d={I.x} className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <Field label="Name"><input value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} className={inputCls} autoFocus /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantity"><input type="number" value={editDraft.quantity} onChange={(e) => setEditDraft({ ...editDraft, quantity: e.target.value })} className={inputCls} /></Field>
                <Field label="Unit"><input list="inventory-units-list" value={editDraft.unit} onChange={(e) => setEditDraft({ ...editDraft, unit: e.target.value })} placeholder="g, mL, pcs" className={inputCls} /></Field>
              </div>
              <Field label="Category">
                <select value={editDraft.category} onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })} className={inputCls}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <div className="flex gap-2 pt-2">
                <button onClick={saveEdit} className="flex-1 bg-emerald-600 text-white rounded-md py-2 text-sm font-medium hover:bg-emerald-700">Save</button>
                <button onClick={closeEdit} className="px-4 py-2 border border-slate-300 rounded-md text-sm">Cancel</button>
                <button onClick={deleteFromEdit} className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-md text-sm" title="Delete"><Icon d={I.trash} className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
