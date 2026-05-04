import { useState } from "react";
import { supabase } from "./lib/supabase";
import { Field, inputCls, Icon, I } from "./lib/utils.jsx";

// Lets the user generate an invite link to send to their household partner.
export default function HouseholdMenu({ profile, householdId, session, onProfileChange }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");

  const create = async (e) => {
    e.preventDefault();
    setError(""); setInviteUrl(""); setBusy(true);
    try {
      const { data, error } = await supabase.from("household_invites").insert({
        household_id: householdId, email: email.trim().toLowerCase(), invited_by: session.user.id,
      }).select().single();
      if (error) throw error;
      const url = `${window.location.origin}/invite/${data.token}`;
      setInviteUrl(url);
    } catch (err) {
      setError(err.message || "Could not create invite");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); } catch {}
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-xs text-emerald-700 hover:text-emerald-800 px-3 py-1.5 border border-emerald-200 bg-emerald-50 rounded-md">
        Invite
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-3 sm:p-6"
             onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 sm:p-6"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <h2 className="font-semibold text-lg">Invite to household</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 -m-2 p-2"><Icon d={I.x} className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Generate an invite link for someone to join your household. They'll need to sign up using the same email address.
            </p>
            <form onSubmit={create} className="space-y-3">
              <Field label="Their email">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} required autoFocus />
              </Field>
              {error && <p className="text-xs text-rose-600">{error}</p>}
              <button type="submit" disabled={busy} className="w-full bg-emerald-600 text-white rounded-md py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {busy ? "Generating…" : "Generate invite link"}
              </button>
            </form>
            {inviteUrl && (
              <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-md text-xs break-all">
                <div className="font-medium text-slate-700 mb-1">Invite link (send this to {email}):</div>
                <div className="font-mono text-slate-600">{inviteUrl}</div>
                <button onClick={copy} className="mt-2 text-xs text-emerald-700 hover:text-emerald-800 font-medium">Copy link</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
