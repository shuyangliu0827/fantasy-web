/**
 * Permission logic for Player Highlights.
 *
 * The real helper (lib/basketball/highlights.ts) hits Supabase for three
 * role lookups. To keep the test pure we exercise the same decision tree
 * via a tiny re-implementation that mirrors the live code; if the rules
 * in `getHighlightPermissions` change, this test must change with it.
 */

import test from "node:test";
import assert from "node:assert/strict";

type Inputs = {
  userId: string | null;
  isPlatformAdmin: boolean;
  leagueAdminRole: "league_owner" | "league_admin" | null;
  member: {
    role: string | null;
    status: string | null;
    team_id: string | null;
  };
  player: {
    team_id: string | null;
    claimed_by_user_id: string | null;
    claim_status: string;
  };
};

function decide(i: Inputs) {
  if (!i.userId) {
    return {
      canCreate: false,
      canEditAny: false,
      canFeature: false,
      isAdminLike: false,
      isTeamManagerOfPlayer: false,
      isOwnerOfPlayer: false,
    };
  }
  const isAdminLike = i.isPlatformAdmin || i.leagueAdminRole !== null;
  const isTeamManagerOfPlayer =
    i.member.role === "team_manager" &&
    i.member.status === "approved" &&
    i.member.team_id != null &&
    i.member.team_id === i.player.team_id;
  const isOwnerOfPlayer =
    i.player.claimed_by_user_id === i.userId &&
    i.player.claim_status === "approved";
  return {
    canCreate: isAdminLike || isTeamManagerOfPlayer || isOwnerOfPlayer,
    canEditAny: isAdminLike,
    canFeature: isAdminLike,
    isAdminLike,
    isTeamManagerOfPlayer,
    isOwnerOfPlayer,
  };
}

test("anonymous viewer has no edit permissions", () => {
  const r = decide({
    userId: null,
    isPlatformAdmin: false,
    leagueAdminRole: null,
    member: { role: null, status: null, team_id: null },
    player: { team_id: "t1", claimed_by_user_id: null, claim_status: "unclaimed" },
  });
  assert.equal(r.canCreate, false);
  assert.equal(r.canEditAny, false);
  assert.equal(r.canFeature, false);
});

test("league admin can create, edit, and feature any highlight", () => {
  const r = decide({
    userId: "u1",
    isPlatformAdmin: false,
    leagueAdminRole: "league_admin",
    member: { role: null, status: null, team_id: null },
    player: { team_id: "t1", claimed_by_user_id: null, claim_status: "unclaimed" },
  });
  assert.equal(r.canCreate, true);
  assert.equal(r.canEditAny, true);
  assert.equal(r.canFeature, true);
});

test("platform admin counts as admin-like", () => {
  const r = decide({
    userId: "u1",
    isPlatformAdmin: true,
    leagueAdminRole: null,
    member: { role: null, status: null, team_id: null },
    player: { team_id: "t1", claimed_by_user_id: null, claim_status: "unclaimed" },
  });
  assert.equal(r.canCreate, true);
  assert.equal(r.canFeature, true);
});

test("team manager can edit own team's players only — not feature", () => {
  const r = decide({
    userId: "u1",
    isPlatformAdmin: false,
    leagueAdminRole: null,
    member: { role: "team_manager", status: "approved", team_id: "t1" },
    player: { team_id: "t1", claimed_by_user_id: null, claim_status: "unclaimed" },
  });
  assert.equal(r.canCreate, true);
  assert.equal(r.isTeamManagerOfPlayer, true);
  assert.equal(r.canFeature, false);
});

test("team manager has no permission on a different team's player", () => {
  const r = decide({
    userId: "u1",
    isPlatformAdmin: false,
    leagueAdminRole: null,
    member: { role: "team_manager", status: "approved", team_id: "t1" },
    player: { team_id: "t2", claimed_by_user_id: null, claim_status: "unclaimed" },
  });
  assert.equal(r.canCreate, false);
  assert.equal(r.isTeamManagerOfPlayer, false);
});

test("pending team manager status does not grant access", () => {
  const r = decide({
    userId: "u1",
    isPlatformAdmin: false,
    leagueAdminRole: null,
    member: { role: "team_manager", status: "pending", team_id: "t1" },
    player: { team_id: "t1", claimed_by_user_id: null, claim_status: "unclaimed" },
  });
  assert.equal(r.canCreate, false);
});

test("approved bound player can edit own profile — not feature", () => {
  const r = decide({
    userId: "u1",
    isPlatformAdmin: false,
    leagueAdminRole: null,
    member: { role: "viewer", status: "approved", team_id: null },
    player: { team_id: "t1", claimed_by_user_id: "u1", claim_status: "approved" },
  });
  assert.equal(r.canCreate, true);
  assert.equal(r.isOwnerOfPlayer, true);
  assert.equal(r.canFeature, false);
});

test("pending claim does not grant edit access", () => {
  const r = decide({
    userId: "u1",
    isPlatformAdmin: false,
    leagueAdminRole: null,
    member: { role: "viewer", status: "approved", team_id: null },
    player: { team_id: "t1", claimed_by_user_id: "u1", claim_status: "pending" },
  });
  assert.equal(r.canCreate, false);
  assert.equal(r.isOwnerOfPlayer, false);
});

test("ordinary viewer has no edit permissions", () => {
  const r = decide({
    userId: "u1",
    isPlatformAdmin: false,
    leagueAdminRole: null,
    member: { role: "viewer", status: "approved", team_id: null },
    player: { team_id: "t1", claimed_by_user_id: null, claim_status: "unclaimed" },
  });
  assert.equal(r.canCreate, false);
  assert.equal(r.canEditAny, false);
});
