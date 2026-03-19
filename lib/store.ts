// lib/store.ts
/* =========================================================
   Blueprint Fantasy — Merged Store
   - Users, Insights, Leagues, Comments → Supabase
   - Drafts, Watchlist, MyTeams, Players → localStorage
   ========================================================= */

   import { supabase } from "./supabase";
   export { supabase };
   import { ALL_PLAYERS } from "./players-data";
   import { PLAYER_POSITIONS } from "./player-positions";
   import { dedupeRosterPlayers, pruneFutureLineupsAfterRemoval, syncRosterHistoryWithCurrentRoster } from "./fantasy-roster-history";
   import { formatDateStr } from "./week-utils";
   
   // ==================== Types ====================
   
   export type User = {
     id: string;
     name: string;
     email: string;
     username: string;
     avatar_url?: string;
   };
   
   export type League = {
     id: string;
     slug: string;
     name: string;
     commissioner_id: string;
     visibility: "public" | "private";
     created_at: string;
     draft_completed_at?: string; // Set when draft finishes; earliest valid lineup date
   };
   
   export type Insight = {
     id: string;
     title: string;
     body: string;
     league_slug?: string;
     cover_url?: string;
     images?: string[];      // 多图支持
     tags?: string[];
     author_id: string;
     author?: User;
     heat: number;
     created_at: string;
   };
   
   export type Comment = {
     id: string;
     insight_id: string;
     author_id: string;
     author?: User;
     body: string;
     created_at: string;
   };
   
   export type Player = {
     id: string;
     name: string;
     team: string;
     position: string;
     age: number;
     ppg: number;
     rpg: number;
     apg: number;
     spg: number;
     bpg: number;
     fg: number;
     ft: number;
     tov: number;
     gp: number;
     adp: number;
     rank: number;
     trend: "up" | "down" | "same";
     injury?: string;
   };
   
   export type DraftPick = {
     id: string;
     odraftId: string;
     round: number;
     pick: number;
     playerId: string;
     teamId: string;
     timestamp: number;
   };
   
   export type DraftTeam = {
     id: string;
     draftId: string;
     name: string;
     isUser: boolean;
     picks: string[];
   };
   
   export type Draft = {
     id: string;
     name: string;
     userId: string;
     leagueId?: string;
     type: "snake" | "linear" | "auction";
     teams: number;
     rounds: number;
     userPosition: number;
     status: "setup" | "active" | "completed";
     currentRound: number;
     currentPick: number;
     createdAt: number;
     completedAt?: number;
   };
   
   export type MyTeam = {
     id: string;
     leagueId: string;
     userId: string;
     name: string;
     players: string[];
     createdAt: number;
   };
   
   export type WatchlistItem = {
     playerId: string;
     userId: string;
     addedAt: number;
     notes?: string;
   };
   
   // ==================== LocalStorage Keys ====================
   
   const KEYS = {
     users: "bp_users",
     session: "bp_session",
     drafts: "bp_drafts",
     draftPicks: "bp_draft_picks",
     draftTeams: "bp_draft_teams",
     myTeams: "bp_my_teams",
     watchlist: "bp_watchlist",
     playerRankings: "bp_player_rankings",
   };
   
   // ==================== Utils ====================
   
   function safeParse<T>(raw: string | null, fallback: T): T {
     if (!raw) return fallback;
     try {
       return JSON.parse(raw) as T;
     } catch {
       return fallback;
     }
   }
   
   function uid(prefix = "id") {
     return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
   }
   
   function canUseStorage() {
     try {
       if (typeof window === "undefined") return false;
       const test = "__storage_test__";
       window.localStorage.setItem(test, test);
       window.localStorage.removeItem(test);
       return true;
     } catch {
       return false;
     }
   }
   
   // ==================== Session (localStorage) ====================
   
   const SESSION_KEY = "bp_session";
   
   export function getSessionUser(): User | null {
     if (typeof window === "undefined") return null;
     const raw = localStorage.getItem(SESSION_KEY);
     if (!raw) return null;
     try {
       return JSON.parse(raw) as User;
     } catch {
       return null;
     }
   }
   
   function setSessionUser(user: User) {
     if (typeof window === "undefined") return;
     localStorage.setItem(SESSION_KEY, JSON.stringify(user));
   }
   
   export async function logout() {
     if (typeof window === "undefined") return;
     localStorage.removeItem(SESSION_KEY);
     await supabase.auth.signOut().catch(() => {});
   }
   
   // ==================== Auth (Supabase + localStorage for password) ====================
   
   export async function signup(name: string, email: string, password: string) {
     // Derive username from the user's chosen name (URL-safe handle).
     // Fallback to email prefix only if name produces no URL-safe characters (e.g. pure Chinese).
     const rawHandle = name.trim().toLowerCase()
       .replace(/\s+/g, "_")
       .replace(/[^a-z0-9_-]/g, "")
       .slice(0, 30);
     const username = rawHandle || email.split("@")[0];

     // Check if email already exists in users table
     const { data: existing } = await supabase
       .from("users")
       .select("id")
       .eq("email", email)
       .single();
     if (existing) return { ok: false as const, error: "Email already exists" };

     // 1. Try Supabase Auth signup
     const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
     let userId: string | undefined = authData?.user?.id;

     // 2. If Auth fails (e.g. email rate limit), fall back to local-only auth
     if (authError || !userId) {
       const isDuplicate = authError?.message?.toLowerCase().includes("already") ||
                           authError?.message?.toLowerCase().includes("exists");
       if (isDuplicate) return { ok: false as const, error: "Email already exists" };
       const isRateLimit = authError?.message?.toLowerCase().includes("rate") ||
                           authError?.message?.toLowerCase().includes("email");
       if (!isRateLimit && authError) return { ok: false as const, error: authError.message };
       // Rate-limited or no user returned: generate a UUID and continue without Supabase Auth
       userId = crypto.randomUUID();
     }

     // 3. Insert into users table
     const { data: newUser, error: insertError } = await supabase
       .from("users")
       .insert({ id: userId, name, email, username })
       .select()
       .single();

     if (insertError) return { ok: false as const, error: insertError.message };

     // 4. Store credentials in localStorage so login works without Supabase Auth
     const storedUsers = JSON.parse(localStorage.getItem("bp_users") || "[]");
     storedUsers.push({ id: userId, email, password, username, name });
     localStorage.setItem("bp_users", JSON.stringify(storedUsers));

     setSessionUser(newUser);
     return { ok: true as const, user: newUser };
   }
   
   export async function login(email: string, password: string) {
     // 1. Try Supabase Auth first (works across all browsers/devices)
     const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
       email,
       password,
     });

     if (!authError && authData.user) {
       // Supabase Auth succeeded — fetch user profile
       let { data: user } = await supabase
         .from("users")
         .select("*")
         .eq("email", email)
         .single();

       // If public.users row is missing, auto-create it so FK constraints work
       if (!user) {
         const username = email.split("@")[0];
         const name = authData.user.user_metadata?.name || username;
         const { data: newUser } = await supabase
           .from("users")
           .upsert({ id: authData.user.id, name, email, username }, { onConflict: "id" })
           .select()
           .single();
         user = newUser;
       }

       if (user) {
         setSessionUser(user);
         return { ok: true as const, user };
       }
     }

     // 2. Fallback: check localStorage for old accounts (backward compat)
     const users = JSON.parse(localStorage.getItem("bp_users") || "[]");
     const storedUser = users.find((u: any) => u.email === email);

     if (!storedUser || storedUser.password !== password) {
       return { ok: false as const, error: "Invalid credentials" };
     }

     // localStorage auth succeeded — fetch user profile from Supabase
     const { data: user, error } = await supabase
       .from("users")
       .select("*")
       .eq("email", email)
       .single();

     if (error || !user) {
       return { ok: false as const, error: "User not found" };
     }

     // Auto-migrate: create Supabase Auth account so future logins work everywhere
     await supabase.auth.signUp({ email, password }).catch(() => {});

     setSessionUser(user);
     return { ok: true as const, user };
   }
   
   // ==================== Password Reset ====================

   export async function requestPasswordReset(email: string, redirectUrl?: string) {
     const baseUrl = redirectUrl || (typeof window !== "undefined" ? window.location.origin : "");
     const { error } = await supabase.auth.resetPasswordForEmail(email, {
       redirectTo: `${baseUrl}/auth/reset-password`,
     });
     if (error) {
       return { ok: false as const, error: error.message };
     }
     return { ok: true as const };
   }

   export async function updatePassword(newPassword: string) {
     const { error } = await supabase.auth.updateUser({ password: newPassword });
     if (error) {
       return { ok: false as const, error: error.message };
     }
     return { ok: true as const };
   }

   // ==================== Users (Supabase) ====================
   
   export async function getUserById(id: string): Promise<User | null> {
     const { data, error } = await supabase
       .from("users")
       .select("*")
       .eq("id", id)
       .single();
     if (error) return null;
     return data;
   }
   
   export async function getUserByUsername(username: string): Promise<User | null> {
     const { data, error } = await supabase
       .from("users")
       .select("*")
       .eq("username", username)
       .single();
     if (error) return null;
     return data;
   }
   
   // ==================== Image Upload (Supabase Storage) ====================
   
   export async function uploadImage(
     file: File,
     folder: string = "images"
   ): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
     const user = getSessionUser();
     if (!user) return { ok: false, error: "Login required" };
   
     // 生成唯一文件名
     const ext = file.name.split(".").pop() || "jpg";
     const fileName = `${folder}/${user.id}_${Date.now()}.${ext}`;
   
     // 上传到 Supabase Storage
     const { data, error } = await supabase.storage
       .from("images")
       .upload(fileName, file, {
         cacheControl: "3600",
         upsert: false,
       });
   
     if (error) {
       console.error("Upload error:", error);
       return { ok: false, error: error.message };
     }
   
     // 获取公开 URL
     const { data: urlData } = supabase.storage
       .from("images")
       .getPublicUrl(data.path);
   
     return { ok: true, url: urlData.publicUrl };
   }
   
   // ==================== Insights (Supabase) ====================
   
   export async function listInsights(): Promise<Insight[]> {
     const { data, error } = await supabase
       .from("insights")
       .select(`*, author:users(id, name, username, avatar_url)`)
       .order("created_at", { ascending: false });
     if (error) {
       console.error("Error fetching insights:", error);
       return [];
     }
     return data || [];
   }
   
   export async function getInsightById(id: string): Promise<Insight | null> {
     const { data, error } = await supabase
       .from("insights")
       .select(`*, author:users(id, name, username, avatar_url)`)
       .eq("id", id)
       .single();
     if (error) return null;
     return data;
   }
   
   export async function createInsight(input: {
     title: string;
     body: string;
     league_slug?: string;
     cover_url?: string;
     images?: string[];      // 多图支持
     tags?: string[];
   }) {
     const user = getSessionUser();
     if (!user) return { ok: false as const, error: "Login required" };
   
     const { data, error } = await supabase
       .from("insights")
       .insert({
         title: input.title.trim(),
         body: input.body.trim(),
         league_slug: input.league_slug,
         cover_url: input.cover_url,
         images: input.images,      // 多图支持
         tags: input.tags,
         author_id: user.id,
         heat: 0,  // 初始点赞数为 0
       })
       .select(`*, author:users(id, name, username, avatar_url)`)
       .single();
   
     if (error) {
       return { ok: false as const, error: error.message };
     }
     return { ok: true as const, insight: data };
   }
   
   // 删除帖子（只有作者可以删除）
   export async function deleteInsight(insightId: string) {
     const user = getSessionUser();
     if (!user) return { ok: false as const, error: "Login required" };
   
     // 先检查是否是作者
     const { data: insight } = await supabase
       .from("insights")
       .select("author_id")
       .eq("id", insightId)
       .single();
   
     if (!insight || insight.author_id !== user.id) {
       return { ok: false as const, error: "Permission denied" };
     }
   
     // 删除帖子（相关评论会因为外键约束自动删除，或者手动删除）
     const { error: deleteCommentsError } = await supabase
       .from("comments")
       .delete()
       .eq("insight_id", insightId);
   
     const { error } = await supabase
       .from("insights")
       .delete()
       .eq("id", insightId);
   
     if (error) {
       return { ok: false as const, error: error.message };
     }
     return { ok: true as const };
   }
   
   // 点赞帖子
   export async function likeInsight(insightId: string) {
     const user = getSessionUser();
     if (!user) return { ok: false as const, error: "Login required" };
   
     // 检查是否已点赞
     const likedKey = `bp_liked_${user.id}`;
     const liked = JSON.parse(localStorage.getItem(likedKey) || "[]");
     
     if (liked.includes(insightId)) {
       return { ok: false as const, error: "Already liked" };
     }
   
     // 更新数据库 heat + 1
     const { data, error } = await supabase.rpc('increment_heat', { insight_id: insightId });
     
     // 如果没有 rpc 函数，用普通更新
     if (error) {
       // 先获取当前 heat
       const { data: insight } = await supabase
         .from("insights")
         .select("heat")
         .eq("id", insightId)
         .single();
       
       if (insight) {
         const { error: updateError } = await supabase
           .from("insights")
           .update({ heat: (insight.heat || 0) + 1 })
           .eq("id", insightId);
         
         if (updateError) {
           return { ok: false as const, error: updateError.message };
         }
       }
     }
   
     // 保存到本地
     liked.push(insightId);
     localStorage.setItem(likedKey, JSON.stringify(liked));
     
     return { ok: true as const };
   }
   
   // 取消点赞
   export async function unlikeInsight(insightId: string) {
     const user = getSessionUser();
     if (!user) return { ok: false as const, error: "Login required" };
   
     const likedKey = `bp_liked_${user.id}`;
     const liked = JSON.parse(localStorage.getItem(likedKey) || "[]");
     
     if (!liked.includes(insightId)) {
       return { ok: false as const, error: "Not liked" };
     }
   
     // 更新数据库 heat - 1
     const { data: insight } = await supabase
       .from("insights")
       .select("heat")
       .eq("id", insightId)
       .single();
     
     if (insight) {
       const { error: updateError } = await supabase
         .from("insights")
         .update({ heat: Math.max(0, (insight.heat || 0) - 1) })
         .eq("id", insightId);
       
       if (updateError) {
         return { ok: false as const, error: updateError.message };
       }
     }
   
     // 从本地移除
     const newLiked = liked.filter((id: string) => id !== insightId);
     localStorage.setItem(likedKey, JSON.stringify(newLiked));
     
     return { ok: true as const };
   }
   
   // 检查是否已点赞
   export function isInsightLiked(insightId: string): boolean {
     const user = getSessionUser();
     if (!user) return false;
     
     const likedKey = `bp_liked_${user.id}`;
     const liked = JSON.parse(localStorage.getItem(likedKey) || "[]");
     return liked.includes(insightId);
   }
   
   // ==================== Comments (Supabase) ====================
   
   export async function listComments(insightId: string): Promise<Comment[]> {
     const { data, error } = await supabase
       .from("comments")
       .select(`*, author:users(id, name, username, avatar_url)`)
       .eq("insight_id", insightId)
       .order("created_at", { ascending: true });
     if (error) return [];
     return data || [];
   }
   
   export async function addComment(insightId: string, body: string) {
     const user = getSessionUser();
     if (!user) return { ok: false as const, error: "Login required" };
   
     const { data, error } = await supabase
       .from("comments")
       .insert({
         insight_id: insightId,
         author_id: user.id,
         body: body.trim(),
       })
       .select(`*, author:users(id, name, username, avatar_url)`)
       .single();
   
     if (error) {
       return { ok: false as const, error: error.message };
     }
     return { ok: true as const, comment: data };
   }
   
   // 删除评论
   // - 如果是评论作者删除：从数据库删除，所有人都看不到
   // - 如果是其他用户删除：只在本地隐藏，存到 localStorage
   export async function deleteComment(commentId: string, commentAuthorId: string) {
     const user = getSessionUser();
     if (!user) return { ok: false as const, error: "Login required" };
   
     // 如果是评论作者，真正删除
     if (user.id === commentAuthorId) {
       const { error } = await supabase
         .from("comments")
         .delete()
         .eq("id", commentId);
   
       if (error) {
         return { ok: false as const, error: error.message };
       }
       return { ok: true as const, type: "deleted" as const };
     }
   
     // 如果不是作者，只在本地隐藏
     const hiddenKey = "bp_hidden_comments";
     const hidden = JSON.parse(localStorage.getItem(hiddenKey) || "[]");
     if (!hidden.includes(commentId)) {
       hidden.push(commentId);
       localStorage.setItem(hiddenKey, JSON.stringify(hidden));
     }
     return { ok: true as const, type: "hidden" as const };
   }
   
   // 获取本地隐藏的评论 ID 列表
   export function getHiddenComments(): string[] {
     if (typeof window === "undefined") return [];
     return JSON.parse(localStorage.getItem("bp_hidden_comments") || "[]");
   }
   
   // ==================== Leagues (Supabase) ====================
   
   export async function listLeagues(): Promise<League[]> {
     const { data, error } = await supabase
       .from("leagues")
       .select("*")
       .order("created_at", { ascending: false });
     if (error) return [];
     return data || [];
   }
   
   export async function getLeagueBySlug(slug: string): Promise<League | null> {
     const { data, error } = await supabase
       .from("leagues")
       .select("*")
       .eq("slug", slug)
       .single();
     if (error) { console.error("[getLeagueBySlug] error:", JSON.stringify(error)); return null; }
     return data;
   }
   
   export async function createLeague(input: {
     name: string;
     visibility: "public" | "private";
   }) {
     const user = getSessionUser();
     if (!user) return { ok: false as const, error: "Login required" };
   
     let slug = input.name
       .trim()
       .toLowerCase()
       .replace(/[^a-z0-9]+/g, "-")
       .replace(/^-+|-+$/g, "")
       .slice(0, 40);

     // If slug is empty (e.g. Chinese characters only), generate a random one
     if (!slug) {
       slug = "league-" + Math.random().toString(36).slice(2, 10);
     }
   
     const { data, error } = await supabase
       .from("leagues")
       .insert({
         name: input.name.trim(),
         slug,
         commissioner_id: user.id,
         visibility: input.visibility,
         season: "2024-25",
         draft_type: "snake",
         status: "draft_pending",
       })
       .select()
       .single();
   
     if (error) {
       return { ok: false as const, error: error.message };
     }

     // 创建者自动成为成员（owner）
     await supabase.from("league_members").insert({
       league_id: data.id,
       user_id: user.id,
       role: "owner",
     });

     return { ok: true as const, league: data };
   }

   // 联赛成员类型
   export type LeagueMember = {
     id: string;
     league_id: string;
     user_id: string;
     role: "owner" | "member";
     joined_at: string;
     user?: User;
   };

   // 获取联赛成员列表
   export async function getLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
     // 先获取成员列表
     const { data: members, error } = await supabase
       .from("league_members")
       .select("*")
       .eq("league_id", leagueId)
       .order("joined_at", { ascending: true });
     
     if (error || !members) return [];

     // 获取所有用户 ID
     const userIds = members.map(m => m.user_id);
     
     // 获取用户信息
     const { data: users } = await supabase
       .from("users")
       .select("id, name, username, avatar_url");
     
     // 手动关联
     return members.map(member => ({
       ...member,
       user: users?.find(u => u.id === member.user_id) || undefined,
     }));
   }

   // 获取联赛成员数量
   export async function getLeagueMemberCount(leagueId: string): Promise<number> {
     const { count, error } = await supabase
       .from("league_members")
       .select("*", { count: "exact", head: true })
       .eq("league_id", leagueId);
     if (error) return 0;
     return count || 0;
   }

   // 检查用户是否已加入联赛
   export async function isLeagueMember(leagueId: string): Promise<boolean> {
     const user = getSessionUser();
     if (!user) return false;

     const { data, error } = await supabase
       .from("league_members")
       .select("id")
       .eq("league_id", leagueId)
       .eq("user_id", user.id)
       .single();

     return !!data && !error;
   }

   // 加入联赛
   export async function joinLeague(leagueId: string) {
     const user = getSessionUser();
     if (!user) return { ok: false as const, error: "Login required" };

     // 检查是否已经是成员
     const isMember = await isLeagueMember(leagueId);
     if (isMember) {
       return { ok: false as const, error: "Already a member" };
     }

     const { data, error } = await supabase
       .from("league_members")
       .insert({
         league_id: leagueId,
         user_id: user.id,
         role: "member",
       })
       .select()
       .single();

     if (error) {
       return { ok: false as const, error: error.message };
     }
     return { ok: true as const, member: data };
   }

   // 退出联赛
   export async function leaveLeague(leagueId: string) {
     const user = getSessionUser();
     if (!user) return { ok: false as const, error: "Login required" };

     const { error } = await supabase
       .from("league_members")
       .delete()
       .eq("league_id", leagueId)
       .eq("user_id", user.id);

     if (error) {
       return { ok: false as const, error: error.message };
     }
     return { ok: true as const };
   }
   
   // ==================== Stats (Supabase) ====================
   
   export async function getStats() {
     const [insightsRes, leaguesRes, usersRes] = await Promise.all([
       supabase.from("insights").select("id", { count: "exact", head: true }),
       supabase.from("leagues").select("id", { count: "exact", head: true }),
       supabase.from("users").select("id", { count: "exact", head: true }),
     ]);
   
     return {
       insightsCount: insightsRes.count || 0,
       leaguesCount: leaguesRes.count || 0,
       usersCount: usersRes.count || 0,
     };
   }
   
   // ==================== Players (localStorage) ====================
   
   const DEFAULT_PLAYERS: Player[] = (ALL_PLAYERS as Player[]).map(p => {
     const pos = PLAYER_POSITIONS[p.name];
     return pos ? { ...p, position: pos } : p;
   });
   
   export function getPlayers(): Player[] {
     if (!canUseStorage()) return DEFAULT_PLAYERS;
     const custom = safeParse<Player[]>(localStorage.getItem(KEYS.playerRankings), []);
     if (custom.length > 0) return custom;
     return DEFAULT_PLAYERS;
   }
   
   export function getPlayerById(id: string): Player | undefined {
     return getPlayers().find((p) => p.id === id);
   }
   
   export function updatePlayerRanking(playerId: string, newRank: number) {
     if (!canUseStorage()) return { ok: false as const };
     const players = getPlayers();
     const idx = players.findIndex((p) => p.id === playerId);
     if (idx === -1) return { ok: false as const };
     players[idx].rank = newRank;
     players.sort((a, b) => a.rank - b.rank);
     localStorage.setItem(KEYS.playerRankings, JSON.stringify(players));
     return { ok: true as const };
   }
   
   // ==================== Watchlist (localStorage) ====================
   
   export function getWatchlist(): WatchlistItem[] {
     if (!canUseStorage()) return [];
     const user = getSessionUser();
     if (!user) return [];
     const all = safeParse<WatchlistItem[]>(localStorage.getItem(KEYS.watchlist), []);
     return all.filter((w) => w.userId === user.id);
   }
   
   export function addToWatchlist(playerId: string, notes?: string) {
     if (!canUseStorage()) return { ok: false as const, error: "Storage unavailable" };
     const user = getSessionUser();
     if (!user) return { ok: false as const, error: "Login required" };
   
     const all = safeParse<WatchlistItem[]>(localStorage.getItem(KEYS.watchlist), []);
     if (all.some((w) => w.playerId === playerId && w.userId === user.id)) {
       return { ok: false as const, error: "Already in watchlist" };
     }
   
     all.push({ playerId, userId: user.id, addedAt: Date.now(), notes });
     localStorage.setItem(KEYS.watchlist, JSON.stringify(all));
     return { ok: true as const };
   }
   
   export function removeFromWatchlist(playerId: string) {
     if (!canUseStorage()) return { ok: false as const };
     const user = getSessionUser();
     if (!user) return { ok: false as const };
   
     let all = safeParse<WatchlistItem[]>(localStorage.getItem(KEYS.watchlist), []);
     all = all.filter((w) => !(w.playerId === playerId && w.userId === user.id));
     localStorage.setItem(KEYS.watchlist, JSON.stringify(all));
     return { ok: true as const };
   }
   
   // ==================== Drafts (localStorage) ====================
   
   export function listDrafts(): Draft[] {
     if (!canUseStorage()) return [];
     const user = getSessionUser();
     if (!user) return [];
     const all = safeParse<Draft[]>(localStorage.getItem(KEYS.drafts), []);
     return all.filter((d) => d.userId === user.id);
   }
   
   export function getDraftById(id: string): Draft | null {
     if (!canUseStorage()) return null;
     const all = safeParse<Draft[]>(localStorage.getItem(KEYS.drafts), []);
     return all.find((d) => d.id === id) ?? null;
   }
   
   export function createDraft(input: {
     name: string;
     type: "snake" | "linear" | "auction";
     teams: number;
     rounds: number;
     userPosition: number;
     leagueId?: string;
   }) {
     if (!canUseStorage()) return { ok: false as const, error: "Storage unavailable" };
     const user = getSessionUser();
     if (!user) return { ok: false as const, error: "Login required" };
   
     const draft: Draft = {
       id: uid("draft"),
       name: input.name,
       userId: user.id,
       leagueId: input.leagueId,
       type: input.type,
       teams: input.teams,
       rounds: input.rounds,
       userPosition: input.userPosition,
       status: "active",
       currentRound: 1,
       currentPick: 1,
       createdAt: Date.now(),
     };
   
     const all = safeParse<Draft[]>(localStorage.getItem(KEYS.drafts), []);
     all.push(draft);
     localStorage.setItem(KEYS.drafts, JSON.stringify(all));
   
     return { ok: true as const, draft };
   }
   
   export function updateDraft(id: string, updates: Partial<Draft>) {
     if (!canUseStorage()) return { ok: false as const };
     const all = safeParse<Draft[]>(localStorage.getItem(KEYS.drafts), []);
     const idx = all.findIndex((d) => d.id === id);
     if (idx === -1) return { ok: false as const };
     all[idx] = { ...all[idx], ...updates };
     localStorage.setItem(KEYS.drafts, JSON.stringify(all));
     return { ok: true as const, draft: all[idx] };
   }
   
   export function getDraftPicks(draftId: string): DraftPick[] {
     if (!canUseStorage()) return [];
     const all = safeParse<DraftPick[]>(localStorage.getItem(KEYS.draftPicks), []);
     return all.filter((p) => p.odraftId === draftId);
   }
   
   export function addDraftPick(
     draftId: string,
     playerId: string,
     teamId: string,
     round: number,
     pick: number
   ) {
     if (!canUseStorage()) return { ok: false as const };
   
     const draftPick: DraftPick = {
       id: uid("pick"),
       odraftId: draftId,
       playerId,
       teamId,
       round,
       pick,
       timestamp: Date.now(),
     };
   
     const all = safeParse<DraftPick[]>(localStorage.getItem(KEYS.draftPicks), []);
     all.push(draftPick);
     localStorage.setItem(KEYS.draftPicks, JSON.stringify(all));
     return { ok: true as const, pick: draftPick };
   }
   
   // ==================== My Teams (localStorage) ====================
   
   export function getMyTeams(): MyTeam[] {
     if (!canUseStorage()) return [];
     const user = getSessionUser();
     if (!user) return [];
     const all = safeParse<MyTeam[]>(localStorage.getItem(KEYS.myTeams), []);
     return all.filter((t) => t.userId === user.id);
   }
   
   export function createMyTeam(
     leagueId: string,
     name: string
   ): { ok: true; team: MyTeam } | { ok: false; error: string } {
     if (!canUseStorage()) return { ok: false, error: "Storage unavailable" };
     const user = getSessionUser();
     if (!user) return { ok: false, error: "Login required" };
   
     const team: MyTeam = {
       id: uid("team"),
       leagueId,
       userId: user.id,
       name,
       players: [],
       createdAt: Date.now(),
     };
   
     const all = safeParse<MyTeam[]>(localStorage.getItem(KEYS.myTeams), []);
     all.push(team);
     localStorage.setItem(KEYS.myTeams, JSON.stringify(all));
     return { ok: true, team };
   }
   
   export function addPlayerToTeam(teamId: string, playerId: string) {
     if (!canUseStorage()) return { ok: false as const };
     const all = safeParse<MyTeam[]>(localStorage.getItem(KEYS.myTeams), []);
     const idx = all.findIndex((t) => t.id === teamId);
     if (idx === -1) return { ok: false as const };
     if (!all[idx].players.includes(playerId)) {
       all[idx].players.push(playerId);
       localStorage.setItem(KEYS.myTeams, JSON.stringify(all));
     }
     return { ok: true as const };
   }
   
   export function removePlayerFromTeam(teamId: string, playerId: string) {
     if (!canUseStorage()) return { ok: false as const };
     const all = safeParse<MyTeam[]>(localStorage.getItem(KEYS.myTeams), []);
     const idx = all.findIndex((t) => t.id === teamId);
     if (idx === -1) return { ok: false as const };
     all[idx].players = all[idx].players.filter((p) => p !== playerId);
     localStorage.setItem(KEYS.myTeams, JSON.stringify(all));
     return { ok: true as const };
   }

   // ==================== League Roster (localStorage) ====================

   export type RosterPlayer = {
     id: string;
     name: string;
     team: string;
     position: string;
     ppg: number;
     rpg: number;
     apg: number;
     spg: number;
     bpg: number;
     fg: number;
     ft: number;
     tov: number;
     round: number;
     acquiredVia?: "draft" | "free_agent" | "trade";
     acquiredAt?: number;
   };

   // Fantasy basketball lineup slots
   export const LINEUP_SLOTS = ["PG", "SG", "SF", "PF", "C", "G", "F", "UTIL1", "UTIL2", "UTIL3", "BE1", "BE2", "BE3"] as const;
   export type LineupSlot = typeof LINEUP_SLOTS[number];

   // Which positions are eligible for which slot
   const SLOT_ELIGIBLE: Record<string, string[]> = {
     PG: ["PG"],
     SG: ["SG"],
     SF: ["SF"],
     PF: ["PF"],
     C: ["C"],
     G: ["PG", "SG"],
     F: ["SF", "PF"],
     UTIL1: ["PG", "SG", "SF", "PF", "C"],
     UTIL2: ["PG", "SG", "SF", "PF", "C"],
     UTIL3: ["PG", "SG", "SF", "PF", "C"],
     BE1: ["PG", "SG", "SF", "PF", "C"],
     BE2: ["PG", "SG", "SF", "PF", "C"],
     BE3: ["PG", "SG", "SF", "PF", "C"],
   };

   export function isEligibleForSlot(playerPosition: string, slot: string): boolean {
     const eligible = SLOT_ELIGIBLE[slot];
     if (!eligible) return false;
     // Player position can be "PG", "SG/SF", "PF/C" etc.
     const positions = playerPosition.split("/").map(p => p.trim());
     return positions.some(p => eligible.includes(p));
   }

   export function getLeagueRosters(leagueId: string): Record<string, RosterPlayer[]> {
     if (!canUseStorage()) return {};
     return safeParse<Record<string, RosterPlayer[]>>(
       localStorage.getItem(`bp_league_rosters_${leagueId}`), {}
     );
   }

   export function getTeamRoster(leagueId: string, teamId: string): RosterPlayer[] {
     const all = getLeagueRosters(leagueId);
     return all[teamId] || [];
   }

   export async function setTeamRoster(leagueId: string, teamId: string, roster: RosterPlayer[]): Promise<void> {
     const normalizedRoster = dedupeRosterPlayers(roster);
     if (canUseStorage()) {
       const all = getLeagueRosters(leagueId);
       all[teamId] = normalizedRoster;
       localStorage.setItem(`bp_league_rosters_${leagueId}`, JSON.stringify(all));
     }
     await supabase.from("fantasy_teams").update({ roster_data: normalizedRoster }).eq("id", teamId);
     await syncRosterHistoryWithCurrentRoster(leagueId, teamId, normalizedRoster);
   }

   // Lineup: { PG: playerId, SG: playerId, ... }
   export type LineupMap = Record<string, string>;
   // Daily lineup: { "2026-03-17": { PG: playerId, ... }, "2026-03-18": { ... } }
   export type DailyLineupMap = Record<string, LineupMap>;

   // Per-date lineup history: { "YYYY-MM-DD": LineupMap }
   export type LineupHistory = Record<string, LineupMap>;

   function isOldFlatLineup(data: any): boolean {
     if (!data || typeof data !== 'object') return false;
     const keys = Object.keys(data);
     if (keys.length === 0) return false;
     return !keys[0].match(/^\d{4}-\d{2}-\d{2}$/);
   }

   function migrateFlatLineup(flat: LineupMap): DailyLineupMap {
     const today = new Date();
     const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
     return { [todayStr]: flat };
   }

   export function getDailyLineups(leagueId: string, teamId: string): DailyLineupMap {
     if (!canUseStorage()) return {};
     const raw = safeParse<any>(
       localStorage.getItem(`bp_league_lineup_${leagueId}_${teamId}`), {}
     );
     if (isOldFlatLineup(raw)) return migrateFlatLineup(raw as LineupMap);
     return raw as DailyLineupMap;
   }

   export function getTeamLineup(leagueId: string, teamId: string): LineupMap {
     // Legacy compat: returns the most recent date's lineup or empty
     const daily = getDailyLineups(leagueId, teamId);
     const dates = Object.keys(daily).sort();
     if (dates.length === 0) return {};
     return daily[dates[dates.length - 1]];
   }

   export function getLineupForDate(leagueId: string, teamId: string, date: string): LineupMap {
     const daily = getDailyLineups(leagueId, teamId);
     return daily[date] || {};
   }

   export function setLineupForDate(leagueId: string, teamId: string, date: string, lineup: LineupMap) {
     if (!canUseStorage()) return;
     const daily = getDailyLineups(leagueId, teamId);
     daily[date] = lineup;
     localStorage.setItem(`bp_league_lineup_${leagueId}_${teamId}`, JSON.stringify(daily));
     // Sync full daily lineup map to Supabase (fire-and-forget)
     supabase.from("fantasy_teams").update({ lineup_data: daily }).eq("id", teamId).then(() => {});
   }

   export function setTeamLineup(leagueId: string, teamId: string, lineup: LineupMap) {
     // Legacy compat: saves as today's lineup
     const today = new Date();
     const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
     setLineupForDate(leagueId, teamId, todayStr, lineup);
   }

   // ── Per-week lineup history ──────────────────────────────────────────────

   function lineupHistoryKey(leagueId: string, teamId: string): string {
     return `bp_league_lineup_history_${leagueId}_${teamId}`;
   }

   export function getLineupHistory(leagueId: string, teamId: string): LineupHistory {
     if (!canUseStorage()) return {};
     return safeParse<LineupHistory>(localStorage.getItem(lineupHistoryKey(leagueId, teamId)), {});
   }

   export function setLineupHistory(leagueId: string, teamId: string, history: LineupHistory) {
     if (!canUseStorage()) return;
     localStorage.setItem(lineupHistoryKey(leagueId, teamId), JSON.stringify(history));
     // Sync to Supabase (fire-and-forget)
     supabase.from("fantasy_teams").update({ lineup_history: history }).eq("id", teamId).then(() => {});
   }

   export async function fetchLineupHistoryFromDB(leagueId: string, teamId: string): Promise<LineupHistory> {
     const { data, error } = await supabase
       .from("fantasy_teams")
       .select("lineup_history")
       .eq("id", teamId)
       .single();
     if (!error && data?.lineup_history && typeof data.lineup_history === "object") {
       const history = data.lineup_history as LineupHistory;
       if (canUseStorage()) {
         localStorage.setItem(lineupHistoryKey(leagueId, teamId), JSON.stringify(history));
       }
       return history;
     }
     return getLineupHistory(leagueId, teamId);
   }

   /**
    * Save a lineup for a specific date (YYYY-MM-DD).
    * Writes to lineup_data (same column fetchTeamLineupFromDB reads), so
    * editing one date never touches another date's lineup.
    */
   export function saveLineupForDate(leagueId: string, teamId: string, date: string, lineup: LineupMap) {
     setLineupForDate(leagueId, teamId, date, lineup);
   }

   // Fetch roster from Supabase (shared across users), falls back to localStorage
   export async function fetchTeamRosterFromDB(leagueId: string, teamId: string): Promise<RosterPlayer[]> {
     const { data, error } = await supabase
       .from("fantasy_teams")
       .select("roster_data")
       .eq("id", teamId)
       .single();
     if (!error && data?.roster_data && Array.isArray(data.roster_data) && data.roster_data.length > 0) {
       const roster = dedupeRosterPlayers(data.roster_data as RosterPlayer[]);
       // Update localStorage cache
       if (canUseStorage()) {
         const all = getLeagueRosters(leagueId);
         all[teamId] = roster;
         localStorage.setItem(`bp_league_rosters_${leagueId}`, JSON.stringify(all));
       }
       return roster;
     }
     // Fallback to localStorage (e.g. data was drafted before migration)
     const local = dedupeRosterPlayers(getTeamRoster(leagueId, teamId));
     if (local.length > 0) {
       // Backfill Supabase with localStorage data
       supabase.from("fantasy_teams").update({ roster_data: local }).eq("id", teamId).then(() => {});
     }
     return local;
   }

   // Fetch daily lineup map from Supabase, falls back to localStorage
   export async function fetchTeamLineupFromDB(leagueId: string, teamId: string): Promise<DailyLineupMap> {
     const { data, error } = await supabase
       .from("fantasy_teams")
       .select("lineup_data")
       .eq("id", teamId)
       .single();
     if (!error && data?.lineup_data && typeof data.lineup_data === "object" && Object.keys(data.lineup_data as object).length > 0) {
       let daily: DailyLineupMap;
       if (isOldFlatLineup(data.lineup_data)) {
         // Migrate old flat format in DB
         daily = migrateFlatLineup(data.lineup_data as LineupMap);
         supabase.from("fantasy_teams").update({ lineup_data: daily }).eq("id", teamId).then(() => {});
       } else {
         daily = data.lineup_data as DailyLineupMap;
       }
       // Update localStorage cache
       if (canUseStorage()) {
         localStorage.setItem(`bp_league_lineup_${leagueId}_${teamId}`, JSON.stringify(daily));
       }
       return daily;
     }
     // Fallback to localStorage
     const local = getDailyLineups(leagueId, teamId);
     if (Object.keys(local).length > 0) {
       // Backfill Supabase
       supabase.from("fantasy_teams").update({ lineup_data: local }).eq("id", teamId).then(() => {});
     }
     return local;
   }

   // Fetch all league rosters from Supabase
   export async function fetchLeagueRostersFromDB(leagueId: string): Promise<Record<string, RosterPlayer[]>> {
     const { data, error } = await supabase
       .from("fantasy_teams")
       .select("id, roster_data")
       .eq("league_id", leagueId);
     if (error || !data) return getLeagueRosters(leagueId);
     const result: Record<string, RosterPlayer[]> = {};
     for (const team of data) {
       const roster = (team.roster_data && Array.isArray(team.roster_data) && team.roster_data.length > 0)
         ? team.roster_data as RosterPlayer[]
         : getTeamRoster(leagueId, team.id);
       result[team.id] = roster;
     }
     // Update localStorage cache
     if (canUseStorage()) {
       localStorage.setItem(`bp_league_rosters_${leagueId}`, JSON.stringify(result));
     }
     return result;
   }

   // Auto-set lineup for today: greedy by PPG
   // Auto-set lineup by PPG. Returns the computed lineup but does NOT persist it —
   // the caller (page.tsx handleAutoLineup) is responsible for calling saveLineupForDate
   // with the correct date, so editing tomorrow never overwrites today.
   export function autoSetLineup(leagueId: string, teamId: string): LineupMap {
     const roster = dedupeRosterPlayers(getTeamRoster(leagueId, teamId));
     const lineup: LineupMap = {};
     const assigned = new Set<string>();
     const slotOrder: string[] = ["PG", "SG", "SF", "PF", "C", "G", "F", "UTIL1", "UTIL2", "UTIL3", "BE1", "BE2", "BE3"];
     for (const slot of slotOrder) {
       const eligible = roster
         .filter(p => !assigned.has(p.id) && isEligibleForSlot(p.position, slot))
         .sort((a, b) => b.ppg - a.ppg);
       if (eligible.length > 0) {
         lineup[slot] = eligible[0].id;
         assigned.add(eligible[0].id);
       }
     }
     return lineup;
   }

   // ==================== Free Agency (localStorage) ====================

   export function getUndraftedPlayers(leagueId: string): Player[] {
     const allPlayers = getPlayers();
     const rosters = getLeagueRosters(leagueId);
     const draftedIds = new Set<string>();
     for (const teamPlayers of Object.values(rosters)) {
       for (const p of teamPlayers) {
         draftedIds.add(p.id);
       }
     }
     return allPlayers.filter(p => !draftedIds.has(p.id));
   }

   export function addFreeAgent(leagueId: string, teamId: string, playerId: string, dropPlayerId?: string): { ok: boolean; error?: string } {
     if (!canUseStorage()) return { ok: false, error: "Storage unavailable" };
     const roster = dedupeRosterPlayers(getTeamRoster(leagueId, teamId));
     const allPlayers = getPlayers();
     const player = allPlayers.find(p => p.id === playerId);
     if (!player) return { ok: false, error: "Player not found" };

     // Check if player is already on a team
     const rosters = getLeagueRosters(leagueId);
     for (const [tid, teamRoster] of Object.entries(rosters)) {
       if (teamRoster.some(p => p.id === playerId)) {
         return { ok: false, error: tid === teamId ? "Player already on your team" : "Player is on another team" };
       }
     }

     if (dropPlayerId) {
       // Drop a player and add the free agent
       const dropIdx = roster.findIndex(p => p.id === dropPlayerId);
       if (dropIdx === -1) return { ok: false, error: "Drop player not found on roster" };
       roster.splice(dropIdx, 1);
       // Remove dropped player from all daily lineups (today and future)
       const daily = pruneFutureLineupsAfterRemoval(getDailyLineups(leagueId, teamId), [dropPlayerId], formatDateStr(new Date()));
       if (canUseStorage()) {
         localStorage.setItem(`bp_league_lineup_${leagueId}_${teamId}`, JSON.stringify(daily));
       }
       supabase.from("fantasy_teams").update({ lineup_data: daily }).eq("id", teamId).then(() => {});
     } else if (roster.length >= 13) {
       return { ok: false, error: "Roster is full (13 players). Drop a player first." };
     }

     const newPlayer: RosterPlayer = {
       id: player.id,
       name: player.name,
       team: player.team,
       position: player.position,
       ppg: player.ppg,
       rpg: player.rpg,
       apg: player.apg,
       spg: player.spg,
       bpg: player.bpg,
       fg: player.fg,
       ft: player.ft,
       tov: player.tov,
       round: 0,
       acquiredVia: "free_agent",
       acquiredAt: Date.now(),
     };

     roster.push(newPlayer);
     setTeamRoster(leagueId, teamId, roster);
     return { ok: true };
   }

   export function dropPlayer(leagueId: string, teamId: string, playerId: string): { ok: boolean; error?: string } {
     if (!canUseStorage()) return { ok: false, error: "Storage unavailable" };
     const roster = getTeamRoster(leagueId, teamId);
     const idx = roster.findIndex(p => p.id === playerId);
     if (idx === -1) return { ok: false, error: "Player not on roster" };
     roster.splice(idx, 1);
     setTeamRoster(leagueId, teamId, roster);
     // Remove from all daily lineups (today and future only, preserve past)
     const daily = pruneFutureLineupsAfterRemoval(getDailyLineups(leagueId, teamId), [playerId], formatDateStr(new Date()));
     let changed = JSON.stringify(daily) !== JSON.stringify(getDailyLineups(leagueId, teamId));
     if (changed) {
       localStorage.setItem(`bp_league_lineup_${leagueId}_${teamId}`, JSON.stringify(daily));
       supabase.from("fantasy_teams").update({ lineup_data: daily }).eq("id", teamId).then(() => {});
     }
     return { ok: true };
   }

   // ==================== Trades (Supabase) ====================

   export type TradeProposal = {
     id: string;
     leagueId: string;
     fromTeamId: string;
     fromTeamName: string;
     toTeamId: string;
     toTeamName: string;
     offeredPlayerIds: string[];
     requestedPlayerIds: string[];
     status: "pending" | "accepted" | "rejected" | "cancelled";
     createdAt: number;
     resolvedAt?: number;
     message?: string;
   };

   // Map Supabase row to TradeProposal
   function mapTradeRow(row: any): TradeProposal {
     return {
       id: row.id,
       leagueId: row.league_id,
       fromTeamId: row.from_team_id,
       fromTeamName: row.from_team_name,
       toTeamId: row.to_team_id,
       toTeamName: row.to_team_name,
       offeredPlayerIds: row.offered_player_ids || [],
       requestedPlayerIds: row.requested_player_ids || [],
       status: row.status,
       createdAt: new Date(row.created_at).getTime(),
       resolvedAt: row.resolved_at ? new Date(row.resolved_at).getTime() : undefined,
       message: row.message,
     };
   }

   export async function getLeagueTrades(leagueId: string): Promise<TradeProposal[]> {
     const { data, error } = await supabase
       .from("trade_proposals")
       .select("*")
       .eq("league_id", leagueId)
       .order("created_at", { ascending: false });
     if (error) {
       console.error("[getLeagueTrades] error:", error);
       return [];
     }
     return (data || []).map(mapTradeRow);
   }

   export async function getPendingTradeCount(leagueId: string, teamId: string): Promise<number> {
     const { count, error } = await supabase
       .from("trade_proposals")
       .select("*", { count: "exact", head: true })
       .eq("league_id", leagueId)
       .eq("to_team_id", teamId)
       .eq("status", "pending");
     if (error) return 0;
     return count || 0;
   }

   export async function proposeTrade(input: {
     leagueId: string;
     fromTeamId: string;
     fromTeamName: string;
     toTeamId: string;
     toTeamName: string;
     offeredPlayerIds: string[];
     requestedPlayerIds: string[];
     message?: string;
   }): Promise<{ ok: boolean; trade?: TradeProposal; error?: string }> {
     if (input.offeredPlayerIds.length === 0 || input.requestedPlayerIds.length === 0) {
       return { ok: false, error: "Must offer and request at least one player" };
     }
     const { data, error } = await supabase
       .from("trade_proposals")
       .insert({
         league_id: input.leagueId,
         from_team_id: input.fromTeamId,
         from_team_name: input.fromTeamName,
         to_team_id: input.toTeamId,
         to_team_name: input.toTeamName,
         offered_player_ids: input.offeredPlayerIds,
         requested_player_ids: input.requestedPlayerIds,
         message: input.message || null,
         status: "pending",
       })
       .select()
       .single();

     if (error) {
       return { ok: false, error: error.message };
     }
     return { ok: true, trade: mapTradeRow(data) };
   }

   export async function respondToTrade(leagueId: string, tradeId: string, accept: boolean): Promise<{ ok: boolean; error?: string }> {
     // Fetch the trade from Supabase
     const { data: row, error: fetchError } = await supabase
       .from("trade_proposals")
       .select("*")
       .eq("id", tradeId)
       .single();

     if (fetchError || !row) return { ok: false, error: "Trade not found" };
     if (row.status !== "pending") return { ok: false, error: "Trade already resolved" };

     const trade = mapTradeRow(row);

     if (accept) {
       // Execute the trade: swap players between rosters (fetch from Supabase for accuracy)
       const fromRoster = await fetchTeamRosterFromDB(leagueId, trade.fromTeamId);
       const toRoster = await fetchTeamRosterFromDB(leagueId, trade.toTeamId);

       const offeredPlayers = fromRoster.filter(p => trade.offeredPlayerIds.includes(p.id));
       const requestedPlayers = toRoster.filter(p => trade.requestedPlayerIds.includes(p.id));

       if (offeredPlayers.length === 0 && trade.offeredPlayerIds.length > 0) {
         return { ok: false, error: "Offered players not found on roster. The roster data may not have synced yet — please try again." };
       }
       if (requestedPlayers.length === 0 && trade.requestedPlayerIds.length > 0) {
         return { ok: false, error: "Requested players not found on roster. The roster data may not have synced yet — please try again." };
       }

       // Remove from original rosters
       const newFromRoster = fromRoster.filter(p => !trade.offeredPlayerIds.includes(p.id));
       const newToRoster = toRoster.filter(p => !trade.requestedPlayerIds.includes(p.id));

       // Add to new rosters with updated acquisition info
       for (const p of offeredPlayers) {
         newToRoster.push({ ...p, acquiredVia: "trade", acquiredAt: Date.now() });
       }
       for (const p of requestedPlayers) {
         newFromRoster.push({ ...p, acquiredVia: "trade", acquiredAt: Date.now() });
       }

       // Await both roster saves to Supabase before updating trade status
       await Promise.all([
         setTeamRoster(leagueId, trade.fromTeamId, newFromRoster),
         setTeamRoster(leagueId, trade.toTeamId, newToRoster),
       ]);

       // Clean up lineups for traded players (today and future only)
       const today = new Date();
       const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
       for (const tId of [trade.fromTeamId, trade.toTeamId]) {
         const daily = await fetchTeamLineupFromDB(leagueId, tId);
         const roster = tId === trade.fromTeamId ? newFromRoster : newToRoster;
         const rosterIds = new Set(roster.map(p => p.id));
         const removedIds = Object.values(daily).flatMap((lineup) => Object.values(lineup).filter((pid) => !rosterIds.has(pid)));
         const pruned = pruneFutureLineupsAfterRemoval(daily, removedIds, formatDateStr(new Date()));
         let changed = JSON.stringify(pruned) !== JSON.stringify(daily);
         if (changed) {
           if (canUseStorage()) {
             localStorage.setItem(`bp_league_lineup_${leagueId}_${tId}`, JSON.stringify(pruned));
           }
           await supabase.from("fantasy_teams").update({ lineup_data: pruned }).eq("id", tId);
         }
       }
     }

     // Update status in Supabase
     const newStatus = accept ? "accepted" : "rejected";
     const { error: updateError } = await supabase
       .from("trade_proposals")
       .update({ status: newStatus, resolved_at: new Date().toISOString() })
       .eq("id", tradeId);

     if (updateError) {
       return { ok: false, error: updateError.message };
     }
     return { ok: true };
   }

   export async function cancelTrade(leagueId: string, tradeId: string): Promise<{ ok: boolean; error?: string }> {
     const { data: row, error: fetchError } = await supabase
       .from("trade_proposals")
       .select("status")
       .eq("id", tradeId)
       .single();

     if (fetchError || !row) return { ok: false, error: "Trade not found" };
     if (row.status !== "pending") return { ok: false, error: "Trade already resolved" };

     const { error } = await supabase
       .from("trade_proposals")
       .update({ status: "cancelled", resolved_at: new Date().toISOString() })
       .eq("id", tradeId);

     if (error) return { ok: false, error: error.message };
     return { ok: true };
   }