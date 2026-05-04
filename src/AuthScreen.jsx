import { useState } from "react";
import { supabase } from "./lib/supabase";
import { Field, inputCls } from "./lib/utils.jsx";

export default function AuthScreen() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: name || email.split("@")[0] } },
        });
        if (error) throw error;
        setInfo("Check your email for a confirmation link, then come back and sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-slate-900">Household Recipe Manager</h1>
          <p className="text-xs text-slate-500 mt-1">{mode === "signin" ? "Sign in to your household" : "Create your account"}</p>
        </div>
        <div className="flex bg-slate-100 rounded-lg p-1 mb-5 text-sm">
          <button type="button" onClick={() => setMode("signin")}
            className={`flex-1 py-1.5 rounded-md font-medium transition ${mode === "signin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Sign in</button>
          <button type="button" onClick={() => setMode("signup")}
            className={`flex-1 py-1.5 rounded-md font-medium transition ${mode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Sign up</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <Field label="Display name (optional)">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Jesús" />
            </Field>
          )}
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} required autoFocus />
          </Field>
          <Field label="Password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} required minLength={6} />
          </Field>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          {info && <p className="text-xs text-emerald-700">{info}</p>}
          <button type="submit" disabled={busy} className="w-full bg-emerald-600 text-white rounded-md py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
            {busy ? "Working…" : (mode === "signin" ? "Sign in" : "Create account")}
          </button>
        </form>
        <p className="text-[10px] text-slate-400 text-center mt-5 leading-snug">
          You and your household members share one pantry, recipe book, and meal plan.
        </p>
      </div>
    </div>
  );
}
