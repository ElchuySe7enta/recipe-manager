import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { UNIT_SUGGESTIONS, ingredientKey, toBase, fromBase } from "./lib/units";
import InventoryTab from "./tabs/InventoryTab.jsx";
import RecipesTab from "./tabs/RecipesTab.jsx";
import PlanTab from "./tabs/PlanTab.jsx";
import SuggestionsTab from "./tabs/SuggestionsTab.jsx";
import ShoppingTab from "./tabs/ShoppingTab.jsx";
import HouseholdMenu from "./HouseholdMenu.jsx";

// Convert DB rows ({date, meal, slot_type, recipe_id, servings}) into UI shape:
//   { date: { meal: { main_recipe_id, side_recipe_id, servings } } }
const planFromRows = (rows) => {
  const out = {};
  for (const r of rows) {
    if (!out[r.date]) out[r.date] = {};
    if (!out[r.date][r.meal]) out[r.date][r.meal] = {};
    if (r.slot_type === "main") out[r.date][r.meal].main_recipe_id = r.recipe_id;
    if (r.slot_type === "side") out[r.date][r.meal].side_recipe_id = r.recipe_id;
    if (r.servings != null) out[r.date][r.meal].servings = r.servings;
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

  useEffect(() => {
    const channel = supabase
      .channel(`household-${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory", filter: `household_id=eq.${householdId}` },
        (payload) => applyInventoryChange(payload, setInventory))
      .on("postgres_changes", { event: "*", schema: "public", table: "recipes", filter: `household_id=eq.${householdId}` },
        (payload) => applyRecipeChange(payload, setRecipes))
      .on("postgres_changes", { event: "*", schema: "public", table: "meal_plan_entries", filter: `household_id=eq.${householdId}` },
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
  const replaceInventory = async (newInventory) => {
    setInventory(newInventory);
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
        recipe_type: recipe.recipe_type || "main",
        updated_at: new Date().toISOString(),
      }).eq("id", recipe.id).select().single();
      if (data) setRecipes((s) => upsert(s, data));
      return data;
    }
    const { data } = await supabase.from("recipes").insert({
      household_id: householdId, name: recipe.name, servings: Number(recipe.servings) || 1,
      ingredients: recipe.ingredients, instructions: recipe.instructions || "",
      recipe_type: recipe.recipe_type || "main",
    }).select().single();
    if (data) setRecipes((s) => upsert(s, data));

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
  // setMealSlot replaces the entire (date, meal) entry: writes/deletes both
  // main and side rows as needed, and stamps servings on every row written.
  const setMealSlot = async (date, meal, { main_recipe_id, side_recipe_id, servings }) => {
    await supabase.from("meal_plan_entries").delete()
      .eq("household_id", householdId).eq("date", date).eq("meal", meal);
    const toInsert = [];
    if (main_recipe_id) toInsert.push({ household_id: householdId, date, meal, slot_type: "main", recipe_id: main_recipe_id, servings: servings || null });
    if (side_recipe_id) toInsert.push({ household_id: householdId, date, meal, slot_type: "side", recipe_id: side_recipe_id, servings: servings || null });
    if (toInsert.length > 0) {
      await supabase.from("meal_plan_entries").insert(toInsert);
    }
    setMealPlan((p) => {
      const np = { ...p };
      np[date] = { ...(np[date] || {}) };
      if (main_recipe_id || side_recipe_id) {
        np[date][meal] = {
          main_recipe_id: main_recipe_id || undefined,
          side_recipe_id: side_recipe_id || undefined,
          servings: servings || undefined,
        };
      } else {
        delete np[date][meal];
      }
      if (Object.keys(np[date]).length === 0) delete np[date];
      return np;
    });
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
        {[["inventory","Inventory"],["recipes","Recipes"],["plan","Meal Plan"],["suggestions","Suggestions"],["shopping","Shopping"]].map(([k, label]) => (
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

      <footer className="text-xs text-slate-400 mt-10 text-center">Data is synced across devices for everyone in your household.</footer>
    </div>
  );
}

const upsert = (list, row) => {
  const i = list.findIndex((x) => x.id === row.id);
  if (i === -1) return [...list, row];
  const next = list.slice();
  next[i] = row;
  return next;
};

function applyInventoryChange(payload, set) {
  if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") set((s) => upsert(s, payload.new));
  else if (payload.eventType === "DELETE") set((s) => s.filter((x) => x.id !== payload.old.id));
}
function applyRecipeChange(payload, set) {
  if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") set((s) => upsert(s, payload.new));
  else if (payload.eventType === "DELETE") set((s) => s.filter((x) => x.id !== payload.old.id));
}
function applyPlanChange(payload, set) {
  if (payload.eventType === "DELETE") {
    const r = payload.old;
    set((p) => {
      const np = { ...p };
      if (np[r.date]?.[r.meal]) {
        np[r.date] = { ...np[r.date] };
        np[r.date][r.meal] = { ...np[r.date][r.meal] };
        if (r.slot_type === "main") delete np[r.date][r.meal].main_recipe_id;
        if (r.slot_type === "side") delete np[r.date][r.meal].side_recipe_id;
        if (!np[r.date][r.meal].main_recipe_id && !np[r.date][r.meal].side_recipe_id) delete np[r.date][r.meal];
        if (Object.keys(np[r.date]).length === 0) delete np[r.date];
      }
      return np;
    });
  } else {
    const r = payload.new;
    set((p) => {
      const np = { ...p };
      np[r.date] = { ...(np[r.date] || {}) };
      np[r.date][r.meal] = { ...(np[r.date][r.meal] || {}) };
      if (r.slot_type === "main") np[r.date][r.meal].main_recipe_id = r.recipe_id;
      if (r.slot_type === "side") np[r.date][r.meal].side_recipe_id = r.recipe_id;
      if (r.servings != null) np[r.date][r.meal].servings = r.servings;
      return np;
    });
  }
}
