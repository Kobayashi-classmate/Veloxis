import React from 'react'
import { Typography, Empty, Button } from 'antd'
import { PlusOutlined } from '@ant-design/icons'

const { Title, Paragraph } = Typography

const Models = () => {
  return (
    <div style={{ textAlign: 'center', paddingTop: 64 }}>
      <Title level={3}>数据模型</Title>
      <Paragraph type="secondary">在此定义 Cube.js 语义层模型，连接物理表并配置指标。</Paragraph>
      <Empty image="https://gw.alipayobjects.com/zos/antfincdn/ZHrcdLPrvN/empty.svg" description="暂无数据模型">
        <Button type="primary" icon={<PlusOutlined />}>
          创建新模型
        </Button>
      </Empty>
    </div>
  )
}

export default Models
