import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import AuthScreen from "./AuthScreen.jsx";
import HouseholdSetup from "./HouseholdSetup.jsx";
import App from "./App.jsx";

export default function Root() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Track session
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  // Load profile when session changes
  useEffect(() => {
    if (!session?.user) { setProfile(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, household_id, display_name")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!cancelled) setProfile(data);
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">Loading…</div>;
  }
  if (!session) return <AuthScreen />;
  if (!profile?.household_id) {
    return <HouseholdSetup session={session} onReady={(p) => setProfile(p)} />;
  }
  return <App session={session} profile={profile} onProfileChange={setProfile} />;
}
