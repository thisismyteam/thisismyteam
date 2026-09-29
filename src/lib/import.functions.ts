import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const HEADERS = {
  roster: ["#", "First", "Last", "Grade", "Level", "Position"],
  schedule: ["Date", "Opponent", "H/A", "Time", "Location", "Result"],
} as const;

const input = z.object({
  teamId: z.string().uuid(),
  kind: z.enum(["roster", "schedule"]),
  fileName: z.string().max(200),
  dataUrl: z.string().max(14_000_000).optional(),
  text: z.string().max(200_000).optional(),
});

export const extractImportTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("team_members").select("role").eq("team_id", data.teamId).eq("user_id", context.userId).maybeSingle();
    if (!member) throw new Error("You don't manage this team.");
    if (!data.dataUrl && !data.text) throw new Error("No file content.");
    if (data.dataUrl && !/^data:(image\/(png|jpe?g|webp|gif)|application\/pdf);base64,/.test(data.dataUrl))
      throw new Error("Unsupported file type.");

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured.");
    const headers = HEADERS[data.kind];
    const instructions = data.kind === "roster"
      ? "Extract every player from this sports team roster. Columns: jersey number, first name, last name, grade/class/year, level (e.g. Varsity/JV), position abbreviation. Leave unknown cells empty. Do not invent players."
      : "Extract every game from this sports team schedule. Columns: date (YYYY-MM-DD if the year is known, otherwise as printed like 'Aug 21'), opponent name only, Home/Away/Neutral (from 'vs', 'at', '@' or a column), time as printed, location, result exactly as printed (e.g. 'W 28-14' or 'L 39-7'). Leave unknown cells empty. Do not invent games.";

    const content: unknown[] = [{ type: "text", text: `${instructions}\nFile: ${data.fileName}` }];
    if (data.text) content.push({ type: "text", text: data.text.slice(0, 200_000) });
    if (data.dataUrl) content.push({ type: "image_url", image_url: { url: data.dataUrl } });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content }],
        tools: [{
          type: "function",
          function: {
            name: "return_rows",
            description: `Return the table rows. Each row is an array of ${headers.length} strings in this order: ${headers.join(", ")}.`,
            parameters: {
              type: "object",
              properties: { rows: { type: "array", items: { type: "array", items: { type: "string" } } } },
              required: ["rows"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_rows" } },
      }),
    });
    if (res.status === 429) throw new Error("Too many requests right now. Try again in a minute.");
    if (res.status === 402) throw new Error("AI credits are used up. Add credits in workspace billing to read this file.");
    if (!res.ok) {
      console.error("AI extraction failed", res.status, await res.text());
      throw new Error("We couldn't read that file. Try a CSV or Excel file instead.");
    }
    const json = await res.json() as { choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[] };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let rows: string[][] = [];
    try { rows = (JSON.parse(args ?? "{}") as { rows?: unknown[] }).rows?.filter(Array.isArray).map((r) => (r as unknown[]).map((c) => String(c ?? ""))) ?? []; }
    catch { rows = []; }
    return { rows: [[...headers], ...rows] };
  });
