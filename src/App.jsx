import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { UNIT_SUGGESTIONS, ingredientKey, toBase, fromBase } from "./lib/units";
import InventoryTab from "./tabs/InventoryTab.jsx";
import RecipesTab from "./tabs/RecipesTab.jsx";
import PlanTab from "./tabs/PlanTab.jsx";
import SuggestionsTab from "./tabs/SuggestionsTab.jsx";
import ShoppingTab from "./tabs/ShoppingTab.jsx";
import HouseholdMenu from "./HouseholdMenu.jsx";

// Convert DB rows ({date, meal, recipe_id}) into UI shape ({date: {meal: recipe_id}}).
const planFromRows = (rows) => {
  const out = {};
  for (const r of rows) {
    if (!out[r.date]) out[r.date] = {};
    out[r.date][r.meal] = r.recipe_id;
  }
  return out;
};

export default function App({ session, profile, onProfileChange }) {
  const householdId = profile.household_id;
  const [tab, setTab] = useState("inventory");
  const [inventory, setInventory] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [mealPlan, setMealPlan] = useState({});
  const [loading, setLoading] = useState(true);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [inv, rec, plan] = await Promise.all([
        supabase.from("inventory").select("*").eq("household_id", householdId),
        supabase.from("recipes").select("*").eq("household_id", householdId),
        supabase.from("meal_plan_entries").select("*").eq("household_id", householdId),
      ]);
      if (cancelled) return;
      setInventory(inv.data || []);
      setRecipes(rec.data || []);
      setMealPlan(planFromRows(plan.data || []));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [householdId]);

  // Real-time: subscribe to changes on our household's rows.
  useEffect(() => {
    const channel = supabase
      .channel(`household-${householdId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "inventory", filter: `household_id=eq.${householdId}` },
        (payload) => applyInventoryChange(payload, setInventory))
      .on("postgres_changes",
        { event: "*", schema: "public", table: "recipes", filter: `household_id=eq.${householdId}` },
        (payload) => applyRecipeChange(payload, setRecipes))
      .on("postgres_changes",
        { event: "*", schema: "public", table: "meal_plan_entries", filter: `household_id=eq.${householdId}` },
        (payload) => applyPlanChange(payload, setMealPlan))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [householdId]);

  // ---- Inventory mutations ----
  const addInventoryItem = async (item) => {
    const row = { household_id: householdId, name: item.name, quantity: Number(item.quantity) || 0, unit: item.unit || "", category: item.category || "Other" };
    const { data } = await supabase.from("inventory").insert(row).select().single();
    if (data) setInventory((s) => upsert(s, data));
  };
  const updateInventoryItem = async (item) => {
    const { id, ...rest } = item;
    const { data } = await supabase.from("inventory").update({ ...rest, quantity: Number(rest.quantity) || 0, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    if (data) setInventory((s) => upsert(s, data));
  };
  const deleteInventoryItem = async (id) => {
    await supabase.from("inventory").delete().eq("id", id);
    setInventory((s) => s.filter((x) => x.id !== id));
  };
  // Bulk replace inventory (used by "Mark as cooked" deduction)
  const replaceInventory = async (newInventory) => {
    setInventory(newInventory);
    // Diff against current state and write changes
    const ops = [];
    for (const it of newInventory) {
      const existing = inventory.find((x) => x.id === it.id);
      if (!existing) ops.push(supabase.from("inventory").insert({ household_id: householdId, name: it.name, quantity: Number(it.quantity) || 0, unit: it.unit || "", category: it.category || "Other" }));
      else if (Number(existing.quantity) !== Number(it.quantity)) ops.push(supabase.from("inventory").update({ quantity: Number(it.quantity) || 0, updated_at: new Date().toISOString() }).eq("id", it.id));
    }
    for (const it of inventory) {
      if (!newInventory.find((x) => x.id === it.id)) ops.push(supabase.from("inventory").delete().eq("id", it.id));
    }
    await Promise.all(ops);
  };

  // ---- Recipe mutations ----
  const upsertRecipe = async (recipe) => {
    if (recipe.id && recipes.find((r) => r.id === recipe.id)) {
      const { data } = await supabase.from("recipes").update({
        name: recipe.name, servings: Number(recipe.servings) || 1,
        ingredients: recipe.ingredients, instructions: recipe.instructions || "",
        updated_at: new Date().toISOString(),
      }).eq("id", recipe.id).select().single();
      if (data) setRecipes((s) => upsert(s, data));
      return data;
    }
    const { data } = await supabase.from("recipes").insert({
      household_id: householdId, name: recipe.name, servings: Number(recipe.servings) || 1,
      ingredients: recipe.ingredients, instructions: recipe.instructions || "",
    }).select().single();
    if (data) setRecipes((s) => upsert(s, data));

    // Auto-create stock entries for any new ingredients
    if (data) {
      const existingKeys = new Set(inventory.map((it) => ingredientKey(it.name, it.unit)));
      const seen = new Set();
      const toAdd = [];
      for (const ing of data.ingredients) {
        const k = ingredientKey(ing.name, ing.unit);
        if (existingKeys.has(k) || seen.has(k)) continue;
        seen.add(k);
        toAdd.push({ household_id: householdId, name: ing.name, quantity: 0, unit: ing.unit || "", category: "Other" });
      }
      if (toAdd.length > 0) {
        const { data: added } = await supabase.from("inventory").insert(toAdd).select();
        if (added) setInventory((s) => [...s, ...added]);
      }
    }
    return data;
  };
  const deleteRecipe = async (id) => {
    await supabase.from("recipes").delete().eq("id", id);
    setRecipes((s) => s.filter((r) => r.id !== id));
  };

  // ---- Meal plan mutations ----
  const setMealSlot = async (date, meal, recipeId) => {
    if (recipeId) {
      const { data } = await supabase.from("meal_plan_entries")
        .upsert({ household_id: householdId, date, meal, recipe_id: recipeId }, { onConflict: "household_id,date,meal" })
        .select().single();
      if (data) {
        setMealPlan((p) => ({ ...p, [date]: { ...(p[date] || {}), [meal]: recipeId } }));
      }
    } else {
      await supabase.from("meal_plan_entries").delete().eq("household_id", householdId).eq("date", date).eq("meal", meal);
      setMealPlan((p) => {
        const next = { ...p };
        if (next[date]) {
          next[date] = { ...next[date] };
          delete next[date][meal];
          if (Object.keys(next[date]).length === 0) delete next[date];
        }
        return next;
      });
    }
  };

  const handleSignOut = () => supabase.auth.signOut();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">Loading household…</div>;
  }

  const state = { inventory, recipes, mealPlan };

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5 gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold text-slate-900">Household Recipe Manager</h1>
          <p className="text-slate-500 text-xs sm:text-sm">Plan meals, track pantry, generate shopping lists.</p>
        </div>
        <div className="flex items-center justify-end gap-2 flex-wrap shrink-0">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 leading-none hidden sm:block">Signed in as</div>
            <div className="text-sm font-medium text-slate-700">{profile.display_name || session.user.email}</div>
          </div>
          <HouseholdMenu profile={profile} householdId={householdId} session={session} onProfileChange={onProfileChange} />
          <button onClick={handleSignOut} className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 border border-slate-200 rounded-md bg-white">Sign out</button>
        </div>
      </header>

      <nav className="flex flex-wrap gap-1 mb-5 bg-white rounded-lg p-1 shadow-sm border border-slate-200 sm:w-fit">
        {[
          ["inventory", "Inventory"],
          ["recipes", "Recipes"],
          ["plan", "Meal Plan"],
          ["suggestions", "Suggestions"],
          ["shopping", "Shopping"],
        ].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition whitespace-nowrap ${tab === k ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
            {label}
          </button>
        ))}
      </nav>

      <datalist id="inventory-units-list">
        {UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}
      </datalist>

      <main>
        {tab === "inventory" && <InventoryTab inventory={inventory} onAdd={addInventoryItem} onUpdate={updateInventoryItem} onDelete={deleteInventoryItem} />}
        {tab === "recipes" && <RecipesTab recipes={recipes} inventory={inventory} onSave={upsertRecipe} onDelete={deleteRecipe} />}
        {tab === "plan" && <PlanTab state={state} onSlotChange={setMealSlot} />}
        {tab === "suggestions" && <SuggestionsTab state={state} onReplaceInventory={replaceInventory} />}
        {tab === "shopping" && <ShoppingTab state={state} onReplaceInventory={replaceInventory} />}
      </main>

      <footer className="text-xs text-slate-400 mt-10 text-center">
        Data is synced across devices for everyone in your household.
      </footer>
    </div>
  );
}

// ---- Real-time helpers ----
const upsert = (list, row) => {
  const i = list.findIndex((x) => x.id === row.id);
  if (i === -1) return [...list, row];
  const next = list.slice();
  next[i] = row;
  return next;
};

function applyInventoryChange(payload, set) {
  if (payload.eventType === "INSERT") set((s) => upsert(s, payload.new));
  else if (payload.eventType === "UPDATE") set((s) => upsert(s, payload.new));
  else if (payload.eventType === "DELETE") set((s) => s.filter((x) => x.id !== payload.old.id));
}
function applyRecipeChange(payload, set) {
  if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") set((s) => upsert(s, payload.new));
  else if (payload.eventType === "DELETE") set((s) => s.filter((x) => x.id !== payload.old.id));
}
function applyPlanChange(payload, set) {
  if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
    const r = payload.new;
    set((p) => ({ ...p, [r.date]: { ...(p[r.date] || {}), [r.meal]: r.recipe_id } }));
  } else if (payload.eventType === "DELETE") {
    const r = payload.old;
    set((p) => {
      const next = { ...p };
      if (next[r.date]) {
        next[r.date] = { ...next[r.date] };
        delete next[r.date][r.meal];
        if (Object.keys(next[r.date]).length === 0) delete next[r.date];
      }
      return next;
    });
  }
}
