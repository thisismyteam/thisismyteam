import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Btn, Field, TextInput } from "@/components/ui-kit";

type Member = { id: string; user_id: string; role: "owner" | "contributor"; profiles: { email: string | null; display_name: string | null } | null };
type Invite = { id: string; email: string; created_at: string };
export function MembersEditor({ teamId, isOwner }: { teamId: string; isOwner: boolean }) {
  const qc = useQueryClient(); const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false);
  const query = useQuery({ queryKey: ["members", teamId], queryFn: async () => {
    const [members, invites] = await Promise.all([supabase.from("team_members").select("id,user_id,role").eq("team_id", teamId), supabase.from("team_invites").select("id,email,created_at").eq("team_id", teamId)]);
    if (members.error) throw members.error; if (invites.error) throw invites.error;
    const ids = (members.data ?? []).map((m) => m.user_id);
    const profiles = ids.length ? await supabase.from("profiles").select("id,email,display_name").in("id", ids) : { data: [], error: null };
    return { members: (members.data ?? []).map((m) => ({ ...m, profiles: profiles.data?.find((p) => p.id === m.user_id) ?? null })) as Member[], invites: (invites.data ?? []) as Invite[] };
  }});
  function refresh() { void qc.invalidateQueries({ queryKey: ["members", teamId] }); }
  async function invite() {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) { toast.error("Enter a valid email address."); return; }
    setBusy(true);
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("team_invites").insert({ team_id: teamId, email: normalized, invited_by: user.user?.id ?? "" });
    setBusy(false);
    if (error) toast.error(error.code === "23505" ? "Already invited." : error.message); else { setEmail(""); refresh(); toast.success("Invitation saved. Ask them to sign in with this email."); }
  }
  async function removeMember(id: string) {
    if (!window.confirm("Remove this contributor from the team?")) return;
    const { error } = await supabase.from("team_members").delete().eq("id", id).eq("role", "contributor");
    if (error) toast.error(error.message); else { refresh(); toast.success("Contributor removed"); }
  }
  return <div className="space-y-6">
    {isOwner ? <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void invite(); }}><Field label="Invite contributor by email" className="min-w-0 flex-1 sm:max-w-sm"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" required /></Field><Btn type="submit" disabled={busy}>Invite</Btn><p className="w-full text-xs text-muted-foreground">No email is sent yet. Share the sign-in page with them; access activates when they sign in with this address.</p></form> : null}
    {query.isError ? <p className="text-sm text-destructive">Members could not be loaded.</p> : null}
    <div className="divide-y divide-border">{query.data?.members.map((m) => <div key={m.id} className="flex items-center justify-between gap-3 py-4"><div><p className="font-condensed text-xl font-bold uppercase">{m.profiles?.display_name || m.profiles?.email || (m.role === "owner" ? "Team owner" : "Contributor")}</p><p className="text-xs text-muted-foreground">{m.profiles?.email ?? "Email hidden"} · {m.role}</p></div>{isOwner && m.role === "contributor" ? <Btn variant="danger" onClick={() => void removeMember(m.id)}>Remove</Btn> : null}</div>)}
    {isOwner && query.data?.invites.map((i) => <div key={i.id} className="flex items-center justify-between gap-3 py-4"><div><p className="font-semibold">{i.email}</p><p className="text-xs text-muted-foreground">Pending invitation · Contributor</p></div><Btn variant="danger" onClick={async () => { const { error } = await supabase.from("team_invites").delete().eq("id", i.id); if (error) toast.error(error.message); else refresh(); }}>Revoke</Btn></div>)}</div>
  </div>;
}
