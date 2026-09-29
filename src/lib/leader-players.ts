import type { Player } from "@/lib/team";

export function sortedLeaderPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const aNumber = Number(a.jersey_number);
    const bNumber = Number(b.jersey_number);
    const aValid = a.jersey_number != null && a.jersey_number.trim() !== "" && Number.isFinite(aNumber);
    const bValid = b.jersey_number != null && b.jersey_number.trim() !== "" && Number.isFinite(bNumber);
    if (aValid !== bValid) return aValid ? -1 : 1;
    if (aValid && bValid && aNumber !== bNumber) return aNumber - bNumber;
    const byName = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
    return byName || a.id.localeCompare(b.id);
  });
}

export function searchLeaderPlayers(players: Player[], search: string): Player[] {
  const words = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return players;
  return players.filter((player) => {
    const name = `${player.first_name} ${player.last_name}`.toLocaleLowerCase();
    const number = player.jersey_number ?? "";
    return words.every((word) => name.includes(word) || number.toLocaleLowerCase().includes(word));
  });
}