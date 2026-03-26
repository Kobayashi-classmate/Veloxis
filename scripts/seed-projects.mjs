import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const DIRECTUS_URL = `http://localhost:8080${process.env.ADMIN_BASE_PATH ?? ''}`
const EMAIL        = process.env.ADMIN_EMAIL
const PASSWORD     = process.env.ADMIN_PASSWORD

// Simple UUID helper
const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function authenticate() {
  const res = await axios.post(`${DIRECTUS_URL}/auth/login`, { email: EMAIL, password: PASSWORD })
  return res.data.data.access_token
}

async function run() {
  console.log(`🔗 Connecting to ${DIRECTUS_URL}`)
  const token = await authenticate()
  console.log('✅ Authenticated\n')

  const client = axios.create({
    baseURL: DIRECTUS_URL,
    headers: { Authorization: `Bearer ${token}` },
  })

  const meRes = await client.get('/users/me?fields=id')
  const adminId = meRes.data.data.id
  console.log(`👤 Admin user id: ${adminId}`)

  const PROJECTS = [
    {
      id:            uuidv4(),
      name:          '电商运营数据中台',
      description:   '整合多渠道销售数据，提供实时销售看板、用户行为漏斗与 GMV 趋势分析，支撑运营日常决策。',
      status:        'active',
      visibility:    'private',
      tenant:        '集团本部',
      color:         '#1677ff',
      tags:          ['销售', '用户行为', '实时'],
      storage_label: '1.2 TB',
      cube_health:   98,
      doris_latency: '12ms',
      last_active:   new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      members_count: 18,
      datasets_count: 12,
      workbooks_count: 8,
      recipes_count:  5,
    },
    {
      id:            uuidv4(),
      name:          '海外增长分析中心',
      description:   '追踪东南亚、欧美区域的用户增长、渠道 ROI 及 留存率，为国际化战略提供数据支撑。',
      status:        'active',
      visibility:    'private',
      tenant:        '国际事业部',
      color:         '#7c3aed',
      tags:          ['增长', '海外', 'ROI'],
      storage_label: '850 GB',
      cube_health:   95,
      doris_latency: '45ms',
      last_active:   new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      members_count: 9,
      datasets_count: 6,
      workbooks_count: 5,
      recipes_count:  3,
    },
    {
      id:            uuidv4(),
      name:          '供应链实时监控平台',
      description:   '监控仓储库存、物流轨迹和供应商交付率，集成 Doris 实时流数据，SLA 异常自动告警。',
      status:        'warning',
      visibility:    'internal',
      tenant:        '物流事业部',
      color:         '#f59e0b',
      tags:          ['供应链', '实时', '告警'],
      storage_label: '4.2 TB',
      cube_health:   72,
      doris_latency: '150ms',
      last_active:   new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      members_count: 7,
      datasets_count: 15,
      workbooks_count: 4,
      recipes_count:  9,
    },
    {
      id:            uuidv4(),
      name:          '用户画像与 RFM 分析',
      description:   '基于全量用户行为日志构建多维用户标签体系，输出 RFM 分层模型，驱动精准营销策略。',
      status:        'active',
      visibility:    'private',
      tenant:        '集团本部',
      color:         '#059669',
      tags:          ['用户画像', 'RFM', '营销'],
      storage_label: '2.8 TB',
      cube_health:   100,
      doris_latency: '8ms',
      last_active:   new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      members_count: 12,
      datasets_count: 8,
      workbooks_count: 6,
      recipes_count:  4,
    },
  ]

  const createdIds = []

  for (const proj of PROJECTS) {
    try {
      const res = await client.post('/items/projects', proj)
      const id = res.data.data.id
      createdIds.push(id)
      console.log(`  ✅ Created project: ${proj.name} (${id})`)
    } catch (err) {
      console.error(`  ❌ Failed to create ${proj.name}:`, err.response?.data ?? err.message)
    }
  }

  console.log('\n👥 Adding admin to project_members...')
  const memberRoles = ['Owner', 'Analyst', 'Analyst', 'Reader']

  for (let i = 0; i < createdIds.length; i++) {
    try {
      await client.post('/items/project_members', {
        project_id:        createdIds[i],
        directus_users_id: adminId,
        role:              memberRoles[i] || 'Reader',
      })
      console.log(`  ✅ Added admin as ${memberRoles[i]} of ${PROJECTS[i].name}`)
    } catch (err) {
      console.error(`  ❌ Failed to add member:`, err.response?.data ?? err.message)
    }
  }

  console.log('\n⭐ Starring first two projects for admin...')
  for (let i = 0; i < Math.min(createdIds.length, 2); i++) {
    try {
      await client.post('/items/project_starred', {
        project_id:        createdIds[i],
        directus_users_id: adminId,
      })
      console.log(`  ✅ Starred: ${PROJECTS[i].name}`)
    } catch (err) {
      console.error(`  ❌ Failed to star:`, err.response?.data ?? err.message)
    }
  }

  console.log('\n🎉 Seed complete! Visit /workspaces to see the projects.')
}

run().catch((err) => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
