// app/test-db/page.tsx
import { supabase } from '@/lib/supabase'

export default async function TestPage() {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .limit(5)
  
  return (
    <div style={{ padding: '40px', fontFamily: 'monospace' }}>
      <h1>数据库连接测试</h1>
      {error ? (
        <div style={{ color: 'red' }}>
          <p>错误: {error.message}</p>
        </div>
      ) : (
        <div>
          <p style={{ color: 'green' }}>✅ 连接成功！</p>
          <p>找到 {data?.length || 0} 条联赛记录</p>
          <pre style={{ 
            background: '#f5f5f5', 
            padding: '20px', 
            borderRadius: '8px',
            overflow: 'auto'
          }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
