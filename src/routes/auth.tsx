import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";

type AuthSearch = { mode?: "signin" | "signup"; sport?: string };

const NEXT_KEY = "timt:next";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    mode: search.mode === "signup" ? "signup" : search.mode === "signin" ? "signin" : undefined,
    sport: typeof search.sport === "string" ? search.sport : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — This Is My Team" },
      {
        name: "description",
        content: "Sign in to build and manage your team's home on This Is My Team.",
      },
      { property: "og:title", content: "Sign in — This Is My Team" },
      {
        property: "og:description",
        content: "Sign in to build and manage your team's home on This Is My Team.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { sport, mode } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  // Remember where to land after a redirect-based sign-in.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sport) window.localStorage.setItem(NEXT_KEY, sport);
  }, [sport]);

  useEffect(() => {
    if (loading || !user) return;
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(NEXT_KEY) : null;
    const chosen = sport ?? stored ?? undefined;
    if (typeof window !== "undefined") window.localStorage.removeItem(NEXT_KEY);
    if (chosen) navigate({ to: "/start", search: { sport: chosen }, replace: true });
    else navigate({ to: "/dashboard", replace: true });
  }, [user, loading, sport, navigate]);

  async function handleGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result.error) {
        toast.error("Google sign-in didn't work. Try again.");
        setBusy(false);
        return;
      }
      if (result.redirected) return;
    } catch {
      toast.error("Google sign-in didn't work. Try again.");
      setBusy(false);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/auth" },
        });
        if (error) throw error;
        if (!data.session) {
          setCheckEmail(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (checkEmail) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="display-xl text-4xl">Check your email</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            We sent a confirmation link to <span className="text-foreground">{email}</span>. Click it
            to finish creating your account.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background field-lines">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col px-4 py-12 sm:py-20">
        <p className="eyebrow text-primary">{isSignUp ? "Get started" : "Welcome back"}</p>
        <h1 className="display-xl mt-3 text-4xl sm:text-5xl">
          {isSignUp ? "Create your team" : "Sign in"}
        </h1>
        {sport ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Sport selected: <span className="font-semibold capitalize text-foreground">{sport}</span>
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-md bg-foreground px-4 text-sm font-bold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.8 2.6 13.5l7.8 6c1.9-5.7 7.2-10 13.6-10z"
            />
            <path
              fill="#4285F4"
              d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3-2.3 5.6-4.9 7.3l7.6 5.9c4.4-4.1 7.1-10.2 7.1-17.5z"
            />
            <path
              fill="#FBBC05"
              d="M10.4 28.5c-.5-1.5-.8-3-.8-4.5s.3-3 .8-4.5l-7.8-6C.9 16.7 0 20.2 0 24s.9 7.3 2.6 10.5l7.8-6z"
            />
            <path
              fill="#34A853"
              d="M24 47.5c6.2 0 11.5-2 15.4-5.6l-7.6-5.9c-2.1 1.4-4.8 2.3-7.8 2.3-6.4 0-11.7-4.3-13.6-10l-7.8 6C6.5 42.2 14.6 47.5 24 47.5z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="eyebrow text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow text-muted-foreground">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="h-12 rounded-md border border-input bg-surface px-3 text-base outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow text-muted-foreground">Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              className="h-12 rounded-md border border-input bg-surface px-3 text-base outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="h-12 rounded-md bg-primary text-sm font-bold uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setIsSignUp((v) => !v)}
          className="mt-6 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {isSignUp ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>

        <Link to="/" className="mt-10 text-xs text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>
      </main>
    </div>
  );
}
