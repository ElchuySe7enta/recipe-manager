import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { Field, inputCls } from "./lib/utils.jsx";

export default function HouseholdSetup({ session, onReady }) {
  const [name, setName] = useState("My household");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(true);

  // Look for invites sent to this user's email — covers the case where someone
  // signed up via an invite link but landed here instead of /invite/<token>.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("household_invites")
        .select("token, household_id, households(name)")
        .ilike("email", session.user.email)
        .is("accepted_at", null);
      if (!cancelled) {
        setPendingInvites(data || []);
        setLoadingInvites(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session.user.email]);

  const refreshProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, household_id, display_name")
      .eq("id", session.user.id)
      .single();
    if (data) onReady(data);
  };

  const acceptInvite = async (token) => {
    setError(""); setBusy(true);
    try {
      const { error } = await supabase.rpc("accept_invite", { invite_token: token });
      if (error) throw error;
      await refreshProfile();
    } catch (err) {
      setError(err.message || "Could not accept invite");
    } finally {
      setBusy(false);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const { data: hh, error: hhErr } = await supabase
        .from("households")
        .insert({ name: name.trim() || "My household" })
        .select()
        .single();
      if (hhErr) throw hhErr;
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
          Join a household to start sharing recipes and inventory.
        </p>

        {!loadingInvites && pendingInvites.length > 0 && (
          <div className="mb-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-2">
              Pending invitation{pendingInvites.length > 1 ? "s" : ""}
            </div>
            {pendingInvites.map((inv) => (
              <div key={inv.token} className="border border-emerald-200 bg-emerald-50 rounded-md p-3 mb-2">
                <div className="text-sm text-slate-800">
                  You've been invited to <span className="font-semibold">{inv.households?.name || "a household"}</span>.
                </div>
                <button
                  onClick={() => acceptInvite(inv.token)}
                  disabled={busy}
                  className="mt-2 w-full bg-emerald-600 text-white rounded-md py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                  {busy ? "Joining…" : "Join household"}
                </button>
              </div>
            ))}
            <div className="text-center text-[11px] text-slate-400 my-3">— or create a new one —</div>
          </div>
        )}

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
      </div>
    </div>
  );
}
