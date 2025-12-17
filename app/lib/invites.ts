import { randomBytes, randomUUID } from "crypto";
import db from "./db";
import type { GroupInvite } from "./types";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

interface InviteRow {
  id: string;
  group_id: string;
  token: string;
  code: string;
  created_by: string;
  created_at: string;
  expires_at?: string | null;
  used_by?: string | null;
  used_at?: string | null;
  group_name?: string;
}

type InviteRowWithGroup = InviteRow & { group_name: string };

export const DEFAULT_INVITE_TTL_HOURS = 72;

function generateToken() {
  return randomBytes(24).toString("hex");
}

function generateCodeCandidate() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * CODE_ALPHABET.length);
    code += CODE_ALPHABET[index];
  }
  return code;
}

function formatForStorage(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function fromStorage(value?: string | null) {
  if (!value) {
    return null;
  }

  return value.replace(" ", "T") + "Z";
}

function getExpiresAt(hours: number | undefined) {
  if (!hours || hours <= 0) {
    return null;
  }

  const expires = new Date(Date.now() + hours * 60 * 60 * 1000);
  return formatForStorage(expires);
}

function mapInvite(row: InviteRow): GroupInvite {
  return {
    id: row.id,
    groupId: row.group_id,
    token: row.token,
    code: row.code,
    createdBy: row.created_by,
    createdAt: fromStorage(row.created_at) || row.created_at,
    expiresAt: fromStorage(row.expires_at),
    usedBy: row.used_by || null,
    usedAt: fromStorage(row.used_at),
  };
}

function generateUniqueCode() {
  let code: string;

  do {
    code = generateCodeCandidate();
  } while (
    db
      .prepare(`SELECT 1 FROM group_invites WHERE code = ?`)
      .get(code)
  );

  return code;
}

export function createGroupInvite(
  groupId: string,
  createdBy: string,
  expiresInHours: number = DEFAULT_INVITE_TTL_HOURS
): GroupInvite {
  const inviteId = randomUUID();
  const token = generateToken();
  const code = generateUniqueCode();
  const expiresAt = getExpiresAt(expiresInHours);

  db.prepare(
    `INSERT INTO group_invites (id, group_id, token, code, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(inviteId, groupId, token, code, createdBy, expiresAt);

  return getInviteById(inviteId)!;
}

function getInviteById(inviteId: string): GroupInvite | null {
  const row = db
    .prepare(`SELECT * FROM group_invites WHERE id = ?`)
    .get(inviteId) as InviteRow | undefined;

  return row ? mapInvite(row) : null;
}

export interface GroupInviteWithGroup extends GroupInvite {
  groupName: string;
}

export function getInviteByToken(token: string): GroupInviteWithGroup | null {
  const row = db
    .prepare(
      `
      SELECT gi.*, g.name as group_name
      FROM group_invites gi
      INNER JOIN groups g ON g.id = gi.group_id
      WHERE gi.token = ?
    `
    )
    .get(token) as InviteRowWithGroup | undefined;

  if (!row) {
    return null;
  }

  const invite = mapInvite(row);
  return {
    ...invite,
    groupName: row.group_name,
  };
}

export function getInviteByCode(code: string): GroupInviteWithGroup | null {
  const normalized = code.trim().toUpperCase();
  const row = db
    .prepare(
      `
      SELECT gi.*, g.name as group_name
      FROM group_invites gi
      INNER JOIN groups g ON g.id = gi.group_id
      WHERE gi.code = ?
    `
    )
    .get(normalized) as InviteRowWithGroup | undefined;

  if (!row) {
    return null;
  }

  const invite = mapInvite(row);
  return {
    ...invite,
    groupName: row.group_name,
  };
}

export function getActiveInvitesForGroup(groupId: string): GroupInvite[] {
  const rows = db
    .prepare(
      `
      SELECT *
      FROM group_invites
      WHERE group_id = ?
        AND used_at IS NULL
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY created_at DESC
    `
    )
    .all(groupId) as InviteRow[];

  return rows.map(mapInvite);
}

