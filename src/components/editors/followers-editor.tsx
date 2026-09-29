import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Btn } from "@/components/ui-kit";

export function FollowersEditor({ teamId }: { teamId: string }) {
  const query = useQuery({ queryKey: ["followers", teamId], queryFn: async () => { const { data, error } = await supabase.from("followers").select("email, created_at").eq("team_id", teamId).order("created_at", { ascending: false }); if (error) throw error; return data ?? []; } });
  function exportCsv() {
    const rows = [["Email", "Followed at"], ...(query.data ?? []).filter((r) => r.email).map((r) => [r.email ?? "", r.created_at])];
    const csv = rows.map((r) => r.map((v) => `"${v.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = href; a.download = "team-followers.csv"; a.click(); URL.revokeObjectURL(href);
  }
  return <div className="space-y-5"><div className="flex items-center justify-between gap-3"><p className="stat-number text-4xl">{query.data?.length ?? 0} <span className="font-sans text-sm font-normal text-muted-foreground">followers</span></p><Btn type="button" variant="outline" disabled={!query.data?.some((r) => r.email)} onClick={exportCsv}>Export CSV</Btn></div>{query.isError ? <p className="text-sm text-destructive">Follower list could not be loaded.</p> : null}<div className="divide-y divide-border">{query.data?.map((row, i) => <div key={`${row.created_at}-${i}`} className="flex justify-between gap-2 py-3 text-sm"><span>{row.email ?? "Account follower"}</span><time className="shrink-0 text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</time></div>)}</div></div>;
}
