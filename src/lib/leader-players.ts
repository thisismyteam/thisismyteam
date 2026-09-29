export type LeaderPlayer = { id: string; first_name: string; last_name: string; jersey_number: string | null };

export function sortedLeaderPlayers<T extends LeaderPlayer>(players: T[]): T[] {
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

export function searchLeaderPlayers<T extends LeaderPlayer>(players: T[], search: string): T[] {
  const words = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return players;
  return players.filter((player) => {
    const name = `${player.first_name} ${player.last_name}`.toLocaleLowerCase();
    const number = player.jersey_number ?? "";
    return words.every((word) => name.includes(word) || number.toLocaleLowerCase().includes(word));
  });
}