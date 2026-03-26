import React from 'react'
import { Typography, Row, Col, Card, Statistic, List, Avatar } from 'antd'
import { useParams } from 'react-router-dom'
import {
  DatabaseOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography

const Overview = () => {
  const { name } = useParams()

  return (
    <div>
      <Title level={2}>项目概览</Title>
      <Paragraph type="secondary">
        这里展示项目 {name} 的核心指标、活跃动态和资源状态。
      </Paragraph>

      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card bordered={false} hoverable>
            <Statistic
              title="已连接数据集"
              value={12}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} hoverable>
            <Statistic
              title="看板/工作台"
              value={5}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} hoverable>
            <Statistic
              title="ETL 任务"
              value={8}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} hoverable>
            <Statistic
              title="项目成员"
              value={4}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={16}>
          <Card title="最近动态" bordered={false}>
            <List
              itemLayout="horizontal"
              dataSource={[
                { title: '数据导入成功', desc: '销售数据_2024Q1.csv 已成功导入 Doris', time: '10 分钟前' },
                { title: '模型更新', desc: '张三 更新了 "用户行为分析" 模型', time: '2 小时前' },
                { title: '新成员加入', desc: '李四 加入了项目', time: '昨天' },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} />}
                    title={item.title}
                    description={`${item.desc} - ${item.time}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="资源健康度" bordered={false}>
            <Statistic title="Cube.js 状态" value="正常" valueStyle={{ color: '#3f8600' }} />
            <Statistic title="Doris 存储" value="1.2 GB / 10 GB" style={{ marginTop: 16 }} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Overview
