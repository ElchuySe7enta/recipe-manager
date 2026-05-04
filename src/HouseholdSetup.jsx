import { useState } from "react";
import { supabase } from "./lib/supabase";
import { Field, inputCls } from "./lib/utils.jsx";

export default function HouseholdSetup({ session, onReady }) {
  const [name, setName] = useState("My household");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const create = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      // 1. Create the household
      const { data: hh, error: hhErr } = await supabase
        .from("households")
        .insert({ name: name.trim() || "My household" })
        .select()
        .single();
      if (hhErr) throw hhErr;
      // 2. Attach the user's profile to it
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .update({ household_id: hh.id })
        .eq("id", session.user.id)
        .select()
        .single();
      if (pErr) throw pErr;
      onReady(profile);
    } catch (err) {
      setError(err.message || "Could not create household");
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => supabase.auth.signOut();

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-lg font-bold text-slate-900 mb-1">Welcome, {session.user.email}</h1>
        <p className="text-xs text-slate-500 mb-5">
          Set up your household to start adding recipes and inventory. You can invite others later.
        </p>
        <form onSubmit={create} className="space-y-3">
          <Field label="Household name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required />
          </Field>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <button type="submit" disabled={busy} className="w-full bg-emerald-600 text-white rounded-md py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
            {busy ? "Creating…" : "Create household"}
          </button>
        </form>
        <button onClick={signOut} className="w-full text-xs text-slate-500 hover:text-slate-700 mt-4">Sign out</button>
        <p className="text-[10px] text-slate-400 text-center mt-4 leading-snug">
          If you've already been invited to a household, click your invite link instead of creating a new one.
        </p>
      </div>
    </div>
  );
}
