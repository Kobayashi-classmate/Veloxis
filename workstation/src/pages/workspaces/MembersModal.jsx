import React, { useState, useEffect, useCallback } from 'react';
import { Modal, List, Avatar, Select, Button, Space, Typography, message, Empty, Divider, Input, Tooltip, Tag } from 'antd';
import { UserOutlined, DeleteOutlined, UserAddOutlined, SearchOutlined } from '@ant-design/icons';
import { getProjectMembers, removeProjectMember, updateProjectMemberRole, getUsers, addProjectMember } from '@src/service/api/projects';
import { authService } from '@/service/authService';

const { Text, Title } = Typography;
const { Option } = Select;

const ROLE_OPTIONS = [
  { label: '项目所有者', value: 'Owner' },
  { label: '数据管理员', value: 'Data Admin' },
  { label: '数据分析师', value: 'Analyst' },
  { label: '业务决策者', value: 'Viewer' },
];

const MembersModal = ({ open, onCancel, projectId, projectName }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [selectedRoles, setSelectedRoles] = useState({}); // user_id -> role
  
  const currentUser = authService.getState().user;
  const currentMemberRecord = members.find(m => {
    const uid = typeof m.directus_users_id === 'string' ? m.directus_users_id : m.directus_users_id?.id;
    return uid === currentUser?.id;
  });
  const isOwner = currentMemberRecord?.role === 'Owner';

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const data = await getProjectMembers(projectId);
      setMembers(data);
    } catch (err) {
      message.error('获取成员列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    setUserSearchLoading(true);
    try {
      const users = await getUsers();
      const memberUserIds = new Set(members.map(m => {
        return typeof m.directus_users_id === 'string' ? m.directus_users_id : m.directus_users_id?.id;
      }));
      setSearchResults(users.filter(u => !memberUserIds.has(u.id)));
    } catch (err) {
      console.error('Fetch users failed', err);
    } finally {
      setUserSearchLoading(false);
    }
  };

  useEffect(() => {
    if (open && projectId) {
      fetchMembers();
      setSearchText('');
      setSelectedRoles({});
    }
  }, [open, projectId]);

  useEffect(() => {
    if (open && members.length > 0) {
        fetchAllUsers();
    }
  }, [open, members.length]);

  const handleSearchUsers = async (val) => {
    setSearchText(val);
    setUserSearchLoading(true);
    try {
      const users = await getUsers(val);
      const memberUserIds = new Set(members.map(m => {
        return typeof m.directus_users_id === 'string' ? m.directus_users_id : m.directus_users_id?.id;
      }));
      setSearchResults(users.filter(u => !memberUserIds.has(u.id)));
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setUserSearchLoading(false);
    }
  };

  const handleAddMember = async (userId) => {
    const role = selectedRoles[userId] || 'Viewer';
    try {
      await addProjectMember(projectId, userId, role);
      message.success('成员添加成功');
      fetchMembers();
      setSearchResults(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      message.error('添加成员失败');
    }
  };

  const handleUserRoleChange = (userId, role) => {
    setSelectedRoles(prev => ({ ...prev, [userId]: role }));
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      await updateProjectMemberRole(memberId, newRole);
      message.success('角色更新成功');
      setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    } catch (err) {
      message.error('角色更新失败');
    }
  };

  const handleRemove = async (memberId) => {
    try {
      await removeProjectMember(memberId);
      message.success('已移除成员');
      setMembers(members.filter(m => m.id !== memberId));
    } catch (err) {
      message.error('移除失败');
    }
  };

  return (
    <Modal
      title={`项目成员管理 - ${projectName}`}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={680}
      destroyOnClose
    >
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>添加新成员</Title>
        <Space.Compact style={{ width: '100%' }}>
            <Input 
                placeholder="输入邮箱或姓名搜索用户..." 
                prefix={<SearchOutlined />} 
                value={searchText}
                onChange={e => handleSearchUsers(e.target.value)}
                disabled={!isOwner}
            />
        </Space.Compact>
        
        <List
            size="small"
            bordered
            loading={userSearchLoading}
            style={{ marginTop: 8, maxHeight: 200, overflow: 'auto', background: '#fff' }}
            dataSource={searchResults}
            locale={{ emptyText: searchText ? '未找到匹配的用户' : '暂无可添加的用户' }}
            renderItem={user => (
                <List.Item
                    actions={[
                        <Select
                            size="small"
                            defaultValue="Viewer"
                            style={{ width: 120 }}
                            onChange={(val) => handleUserRoleChange(user.id, val)}
                            disabled={!isOwner}
                        >
                            {ROLE_OPTIONS.map(opt => (
                                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                            ))}
                        </Select>,
                        <Button 
                            type="primary" 
                            size="small" 
                            icon={<UserAddOutlined />} 
                            onClick={() => handleAddMember(user.id)}
                            disabled={!isOwner}
                        >
                            添加
                        </Button>
                    ]}
                >
                    <List.Item.Meta
                        avatar={<Avatar size="small" src={user.avatar} icon={<UserOutlined />} />}
                        title={<Text size="small">{user.first_name || ''} {user.last_name || ''} ({user.email})</Text>}
                    />
                </List.Item>
            )}
        />
        {!isOwner && <Text type="secondary" style={{ fontSize: 12 }}>提示: 只有项目所有者可以管理成员</Text>}
      </div>

      <Divider style={{ margin: '16px 0' }} />

      <Title level={5} style={{ marginBottom: 16 }}>当前成员 ({members.length})</Title>
      <List
        loading={loading}
        dataSource={members}
        locale={{ emptyText: <Empty description="暂无成员" /> }}
        renderItem={(item) => {
          const user = item.directus_users_id;
          const name = user ? (typeof user === 'string' ? user : `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email) : '未知用户';
          const uid = user ? (typeof user === 'string' ? user : user.id) : null;
          const isCurrentUser = uid === currentUser?.id;
          
          return (
            <List.Item
              actions={[
                <Select
                  size="small"
                  value={item.role}
                  onChange={(val) => handleRoleChange(item.id, val)}
                  style={{ width: 130 }}
                  disabled={!isOwner || (item.role === 'Owner' && members.filter(m => m.role === 'Owner').length <= 1 && isCurrentUser)}
                >
                  {ROLE_OPTIONS.map(opt => (
                    <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                  ))}
                </Select>,
                <Tooltip title={item.role === 'Owner' && members.filter(m => m.role === 'Owner').length <= 1 ? "项目必须至少有一个所有者" : "移除成员"}>
                    <Button 
                        type="text" 
                        danger 
                        icon={<DeleteOutlined />} 
                        onClick={() => handleRemove(item.id)}
                        disabled={!isOwner || (item.role === 'Owner' && members.filter(m => m.role === 'Owner').length <= 1)}
                    />
                </Tooltip>
              ]}
            >
              <List.Item.Meta
                avatar={<Avatar icon={<UserOutlined />} src={user?.avatar} />}
                title={
                    <Space>
                        <Text strong>{name}</Text>
                        {isCurrentUser && <Tag color="blue" bordered={false} style={{ fontSize: 10 }}>我</Tag>}
                    </Space>
                }
                description={user?.email}
              />
            </List.Item>
          );
        }}
      />
    </Modal>
  );
};

export default MembersModal;
