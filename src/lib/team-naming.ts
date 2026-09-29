export function organizationShortName(name: string) {
  return name.trim().replace(/\s+(?:High School|Middle School|Elementary School|HS|School|Academy|Athletics|Athletic Club|Sports Club|Club|League)$/i, "").trim() || name.trim();
}

export function suggestedTeamName(organization: string, mascot: string) {
  return [organizationShortName(organization), mascot.trim()].filter(Boolean).join(" ");
}

export function existingMascot(name: string, organization: string, mascot: string | null) {
  if (mascot) return mascot;
  const prefix = organizationShortName(organization);
  return name.toLowerCase().startsWith(`${prefix.toLowerCase()} `) ? name.slice(prefix.length).trim() : "";
}