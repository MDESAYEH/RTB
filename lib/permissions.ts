/** Role-based access control for the admin area. Fail closed: anything unknown needs `users:manage`. */
export const roles = ["owner", "manager", "editor", "scorer"] as const;
export type Role = (typeof roles)[number];

export const permissions = [
  "game:control",
  "game:correct",
  "content:write",
  "tournament:write",
  "media:upload",
  "users:manage",
] as const;
export type Permission = (typeof permissions)[number];

const grants: Record<Role, readonly Permission[]> = {
  // Everything, including managing other admin accounts.
  owner: permissions,
  // Runs the tournament but cannot manage accounts.
  manager: [
    "game:control",
    "game:correct",
    "content:write",
    "tournament:write",
    "media:upload",
  ],
  // News, players and stats, plus images.
  editor: ["content:write", "media:upload"],
  // Live control room only: score, clock and status.
  scorer: ["game:control"],
};

export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (roles as readonly string[]).includes(value);

export const permissionsOf = (role: string): readonly Permission[] =>
  isRole(role) ? grants[role] : [];

export const can = (role: string, permission: Permission) =>
  permissionsOf(role).includes(permission);

const CONTENT_KINDS = ["news", "players", "stats", "teamStats", "pulse", "events"];
const TOURNAMENT_KINDS = ["teams", "games", "settings"];

/** The permission a `/api/admin` command needs. Unknown commands need the strictest one. */
export function requiredPermission(command: {
  action: string;
  kind?: string;
}): Permission {
  switch (command.action) {
    case "score":
    case "clock":
    case "status":
    case "undo":
    case "stream":
      return "game:control";
    case "correct":
      return "game:correct";
    case "save":
      if (command.kind && CONTENT_KINDS.includes(command.kind))
        return "content:write";
      if (command.kind && TOURNAMENT_KINDS.includes(command.kind))
        return "tournament:write";
      return "users:manage";
    case "user:create":
    case "user:role":
    case "user:password":
    case "user:disable":
    case "user:enable":
    case "user:delete":
    case "user:2fa-reset":
      return "users:manage";
    default:
      return "users:manage";
  }
}

/** Role labels for the admin UI. */
export const roleLabels: Record<Role, { ar: string; en: string }> = {
  owner: { ar: "مالك النظام", en: "Owner" },
  manager: { ar: "مدير البطولة", en: "Tournament manager" },
  editor: { ar: "محرر محتوى", en: "Content editor" },
  scorer: { ar: "مسجّل نتائج", en: "Scorekeeper" },
};
