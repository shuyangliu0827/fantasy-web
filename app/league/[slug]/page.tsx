// app/league/[slug]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getLeagueBySlug, getSessionUser, supabase as storeSupa } from "@/lib/store";

import DraftRoom from "@/components/DraftRoom";

export default function LeaguePage() {
  const params = useParams();
  const leagueId = params.slug as string;
  
  const [league, setLeague] = useState<any | null>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [myTeam, setMyTeam] = useState<any | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    try {
      setCurrentUser(getSessionUser());
      await loadLeagueInfo();
    } catch (err) {
      console.error("Init error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadLeagueInfo() {
    try {
      // 1. 获取联赛信息 (by slug)
      const leagueData = await getLeagueBySlug(leagueId);
      if (!leagueData) return;
      setLeague(leagueData as any);

      // 2. 获取所有队伍
      const { data: teamsData } = await storeSupa
        .from('fantasy_teams')
        .select('*')
        .eq('league_id', leagueData.id)
        .order('draft_position', { ascending: true });

      setTeams(teamsData || []);

      // 3. 找到我的队伍
      const user = getSessionUser();
      if (user) {
        const myTeamData = teamsData?.find((t: any) => t.user_id === user.id);
        setMyTeam(myTeamData || null);
      }
    } catch (err) {
      console.error("Failed to load league:", err);
    }
  }

  async function handleJoinDraft() {
    if (!teamName.trim()) {
      alert("请输入队伍名称");
      return;
    }

    setJoining(true);

    try {
      const user = getSessionUser();
      if (!user) throw new Error("请先登录");
      const leagueData = league;
      if (!leagueData) throw new Error("联赛不存在");

      const { data: team, error } = await storeSupa
        .from("fantasy_teams")
        .insert({ league_id: leagueData.id, user_id: user.id, name: teamName.trim(), draft_position: teams.length + 1 })
        .select()
        .single();
      if (error) throw error;
      await storeSupa.from("league_members").upsert({ league_id: leagueData.id, user_id: user.id, role: "member" }, { onConflict: "league_id,user_id" });

      setMyTeam(team);
      setShowJoinModal(false);
      setTeamName("");
      await loadLeagueInfo();
    } catch (err: any) {
      console.error("Join error:", err);
      alert(err.message || "加入失败");
    } finally {
      setJoining(false);
    }
  }

  async function handleStartDraft() {
    if (!confirm("确定开始选秀吗？")) {
      return;
    }

    setStarting(true);
    
    try {
      const { error } = await storeSupa.from("leagues").update({ status: "drafting" }).eq("slug", leagueId);
      if (error) throw error;
      await loadLeagueInfo();
    } catch (err: any) {
      console.error("Start draft error:", err);
      alert(err.message || "开始选秀失败");
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px' }}>🏀</div>
        <p>加载中...</p>
      </div>
    );
  }

  if (!league) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>❌ 联赛未找到</h2>
        <p>League ID: {leagueId}</p>
      </div>
    );
  }

  // 如果选秀已开始且用户已加入，显示选秀房间
  if (league.status === "drafting" && myTeam) {
    return (
      <DraftRoom
        league={league}
        teams={teams}
        myTeam={myTeam}
        onDraftComplete={async () => {
          // DraftRoom already updates league status in Supabase when draft completes
          await loadLeagueInfo();
        }}
      />
    );
  }

  const isCommissioner = currentUser?.id === league.commissioner_id;
  const canStartDraft = isCommissioner && teams.length >= 2 && league.status === 'draft_pending';

  return (
    <div style={{ 
      minHeight: '100vh',
      background: '#f5f7fa',
      padding: '24px'
    }}>
      {/* 联赛头部 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '32px',
        borderRadius: '16px',
        color: 'white',
        marginBottom: '24px',
        boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ fontSize: '64px' }}>🏆</div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: '0 0 12px 0', fontSize: '32px' }}>{league.name}</h1>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ 
                padding: '6px 14px',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '20px',
                fontSize: '13px'
              }}>
                {league.season} 赛季
              </span>
              <span style={{ 
                padding: '6px 14px',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '20px',
                fontSize: '13px'
              }}>
                {league.draft_type === "snake" ? "蛇形选秀" : "线性选秀"}
              </span>
              <span style={{ 
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '13px',
                background: league.status === 'draft_pending' ? '#fbbf24' : 
                           league.status === 'drafting' ? '#10b981' : '#3b82f6',
                color: league.status === 'draft_pending' ? '#78350f' : 'white'
              }}>
                {league.status === "draft_pending" && "准备中"}
                {league.status === "drafting" && "选秀中"}
                {league.status === "active" && "进行中"}
              </span>
            </div>
            {isCommissioner && (
              <div style={{ marginTop: '8px', fontSize: '13px', opacity: 0.9 }}>
                👑 联盟管理员
              </div>
            )}
          </div>
          
          {!myTeam ? (
            <button 
              onClick={() => setShowJoinModal(true)}
              style={{
                padding: '12px 28px',
                background: 'white',
                color: '#667eea',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              ➕ 加入联赛
            </button>
          ) : (
            <div style={{
              padding: '12px 28px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              ✅ 已加入
            </div>
          )}
        </div>
      </div>

      {/* 联赛公告 */}
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '12px',
        marginBottom: '24px',
        borderLeft: '4px solid #3b82f6'
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#111' }}>📢 联赛公告</h3>
        <p style={{ margin: 0, color: '#333', lineHeight: 1.6 }}>
          欢迎来到联赛！准备好开始你的Fantasy 篮球之旅了吗?
        </p>
        {canStartDraft && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            background: '#fef3c7',
            borderRadius: '8px',
            color: '#92400e',
            fontSize: '14px',
            fontWeight: 500
          }}>
            💡 提示：已有{teams.length}支队伍加入，可以开始选秀了！
          </div>
        )}
      </div>

      {/* 快速操作 - 联赛进行中时显示 */}
      {league.status === 'active' && myTeam && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '24px'
        }}>
          {[
            { href: `/league/${leagueId}/roster`, icon: '📋', title: '查看阵容', desc: '管理首发和板凳' },
            { href: `/league/${leagueId}/free-agents`, icon: '🏪', title: '自由市场', desc: '签约和放弃球员' },
            { href: `/league/${leagueId}/trade`, icon: '🔄', title: '球员交易', desc: '与其他队伍交易' },
            { href: `/league/${leagueId}/standings`, icon: '🏆', title: '排行榜', desc: '查看联赛排名' },
          ].map(item => (
            <a
              key={item.href}
              href={item.href}
              style={{
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                border: '2px solid transparent',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
            >
              <span style={{ fontSize: '32px' }}>{item.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px', color: '#111' }}>{item.title}</div>
                <div style={{ fontSize: '12px', color: '#333' }}>{item.desc}</div>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* 参赛队伍 */}
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '12px',
        marginBottom: '24px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: 0, fontSize: '20px', color: '#111' }}>
            👥 参赛队伍 ({teams.length}/{league.max_teams})
          </h3>
          {canStartDraft && (
            <button 
              onClick={handleStartDraft}
              disabled={starting}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontWeight: '600',
                cursor: starting ? 'not-allowed' : 'pointer',
                opacity: starting ? 0.6 : 1
              }}
            >
              {starting ? "⏳ 开始中..." : "🚀 开始选秀"}
            </button>
          )}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {teams.map((team) => (
            <div 
              key={team.id} 
              style={{
                background: myTeam?.id === team.id ? 
                  'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' : '#f8fafc',
                padding: '20px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                border: myTeam?.id === team.id ? '2px solid #3b82f6' : '2px solid transparent'
              }}
            >
              <div style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '700',
                fontSize: '18px'
              }}>
                #{team.draft_position}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: '600',
                  fontSize: '16px',
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#111'
                }}>
                  {team.name}
                  {myTeam?.id === team.id && (
                    <span style={{
                      padding: '2px 8px',
                      background: '#3b82f6',
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: '700'
                    }}>
                      你
                    </span>
                  )}
                  {team.user_id === league.commissioner_id && (
                    <span style={{ fontSize: '14px' }}>👑</span>
                  )}
                </div>
                <div style={{ color: '#333', fontSize: '13px' }}>
                  {league.status === "draft_pending" ? "等待选秀" : `${team.wins}-${team.losses}`}
                </div>
              </div>
            </div>
          ))}
          
          {/* 空位 */}
          {Array.from({ length: league.max_teams - teams.length }).map((_, i) => (
            <div 
              key={`empty-${i}`}
              onClick={() => !myTeam && setShowJoinModal(true)}
              style={{
                background: '#f1f5f9',
                border: '2px dashed #cbd5e1',
                padding: '20px',
                borderRadius: '10px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: myTeam ? 'default' : 'pointer',
                flexDirection: 'column',
                gap: '8px',
                color: '#555'
              }}
            >
              <span style={{ fontSize: '32px' }}>➕</span>
              <span style={{ fontSize: '14px' }}>等待加入</span>
            </div>
          ))}
        </div>
      </div>

      {/* 加入联赛弹窗 */}
      {showJoinModal && (
        <div 
          onClick={() => setShowJoinModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '16px',
              maxWidth: '500px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '20px', color: '#111' }}>➕ 加入联赛</h3>
              <button 
                onClick={() => setShowJoinModal(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  background: '#f1f5f9',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: '18px'
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: '24px' }}>
              <p style={{ margin: '0 0 16px 0', color: '#333' }}>
                请为你的队伍起个名字
              </p>
              
              <input
                type="text"
                placeholder="输入队伍名称..."
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                maxLength={50}
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && teamName.trim()) {
                    handleJoinDraft();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
              
              <div style={{
                marginTop: '20px',
                padding: '16px',
                background: '#f8fafc',
                borderRadius: '8px'
              }}>
                <p style={{ margin: '0 0 12px 0', fontWeight: 600, color: '#111' }}>📋 你将获得:</p>
                <ul style={{ margin: 0, paddingLeft: '24px' }}>
                  <li style={{ marginBottom: '8px', color: '#333' }}>
                    一个独特的选秀位置 (#{teams.length + 1})
                  </li>
                  <li style={{ marginBottom: '8px', color: '#333' }}>
                    13个球员名额
                  </li>
                  <li style={{ color: '#333' }}>
                    参与所有周赛
                  </li>
                </ul>
              </div>
            </div>
            
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button 
                onClick={() => setShowJoinModal(false)}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  background: '#f1f5f9',
                  color: '#333',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
              <button 
                onClick={handleJoinDraft}
                disabled={joining || !teamName.trim()}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  fontWeight: 600,
                  cursor: joining || !teamName.trim() ? 'not-allowed' : 'pointer',
                  opacity: joining || !teamName.trim() ? 0.5 : 1
                }}
              >
                {joining ? "加入中..." : "确认加入"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}