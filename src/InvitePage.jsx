import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "./lib/supabase";

export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking"); // checking | needSignIn | accepting | done | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) setStatus("needSignIn");
        return;
      }
      if (!cancelled) setStatus("accepting");
      const { data, error } = await supabase.rpc("accept_invite", { invite_token: token });
      if (cancelled) return;
      if (error) {
        setStatus("error");
        setMessage(error.message);
      } else {
        setStatus("done");
        setMessage("Joined the household. Redirecting…");
        setTimeout(() => navigate("/"), 1500);
      }
    })();
    return () => { cancelled = true; };
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
        <h1 className="text-lg font-semibold mb-3">Household invite</h1>
        {status === "checking" && <p className="text-sm text-slate-500">Checking invite…</p>}
        {status === "needSignIn" && (
          <>
            <p className="text-sm text-slate-700 mb-4">Sign in or create your account first using the email this invite was sent to. Then come back to this link.</p>
            <Link to="/" className="inline-block bg-emerald-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-emerald-700">Go to sign-in</Link>
          </>
        )}
        {status === "accepting" && <p className="text-sm text-slate-500">Joining household…</p>}
        {status === "done" && <p className="text-sm text-emerald-700">{message}</p>}
        {status === "error" && (
          <>
            <p className="text-sm text-rose-700 mb-3">{message}</p>
            <Link to="/" className="text-sm text-emerald-700 hover:underline">Back to home</Link>
          </>
        )}
      </div>
    </div>
  );
}
