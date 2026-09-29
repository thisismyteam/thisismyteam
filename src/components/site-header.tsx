import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { UserRound, LogOut } from "lucide-react";
import { Btn } from "@/components/ui-kit";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function SiteHeader({ slim = false, extra }: { slim?: boolean; extra?: React.ReactNode } = {}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className={slim ? "sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-md" : "sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md"}>
      <div className={`mx-auto flex ${slim ? "min-h-12 py-1.5" : "min-h-16 py-2"} max-w-7xl items-center justify-between gap-2 px-3 sm:px-6 lg:px-8`}>
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded bg-primary text-base font-black text-primary-foreground">
            T
          </span>
          <span className={`display-xl hidden leading-none ${slim ? "text-sm sm:text-base min-[340px]:block" : "text-lg sm:text-xl min-[370px]:block"}`}>This Is My Team</span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          {loading ? null : user ? (
            <>
              {extra}
              <Link
                to="/dashboard"
                 className="inline-flex h-10 items-center rounded-md bg-primary px-3 text-xs font-bold uppercase text-primary-foreground transition-colors hover:bg-primary/90 sm:px-4 sm:text-sm"
              >
                 My Teams
              </Link>
               <DropdownMenu>
                 <DropdownMenuTrigger asChild><Btn variant="outline" className="h-10 w-10 p-0" aria-label="Account menu" title="Account menu"><UserRound className="h-5 w-5" /></Btn></DropdownMenuTrigger>
                 <DropdownMenuContent align="end" className="min-w-44">
                   <DropdownMenuItem onSelect={() => void signOut()}><LogOut className="h-4 w-4" />Sign out</DropdownMenuItem>
                 </DropdownMenuContent>
               </DropdownMenu>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                className="rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign in
              </Link>
              {slim ? null : <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Create my team
              </Link>}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
