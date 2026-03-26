import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, ColorPicker } from 'antd';
import { authService } from '@/service/authService';
import { getTenants } from '@/service/api/projects';
import { getUserPermissions } from '@/service/api/permission';

const { Option } = Select;
const { TextArea } = Input;

const ProjectModal = ({ open, onCancel, onOk, initialValues, title }) => {
  const [form] = Form.useForm();
  const [tenants, setTenants] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const user = authService.getState().user;

  useEffect(() => {
    const checkAdmin = async () => {
      const perms = await getUserPermissions();
      const admin = perms.permissions.includes('*:*');
      setIsAdmin(admin);
      if (admin) {
        try {
          const list = await getTenants();
          // Merge current user's tenant if not in list
          const uniqueTenants = Array.from(new Set([...list, user?.tenant].filter(Boolean)));
          setTenants(uniqueTenants);
        } catch (err) {
          console.error('Failed to fetch tenants', err);
          if (user?.tenant) setTenants([user.tenant]);
        }
      }
    };
    if (open) {
      checkAdmin();
    }
  }, [open, user?.tenant]);

  useEffect(() => {
    if (open) {
      if (initialValues) {
        form.setFieldsValue({
            ...initialValues,
            color: initialValues.color || '#1677ff'
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
            visibility: 'private',
            color: '#1677ff',
            tenant: user?.tenant
        });
      }
    }
  }, [open, initialValues, form, user?.tenant]);

  const handleOk = () => {
    form.validateFields().then((values) => {
        // Extract hex string from ColorPicker object
        const colorValue = typeof values.color === 'string' ? values.color : (values.color?.toHexString?.() || values.color);
        onOk({ ...values, color: colorValue });
    });
  };

  return (
    <Modal
      title={title || '项目'}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="项目名称"
          rules={[{ required: true, message: '请输入项目名称' }]}
        >
          <Input placeholder="例如: 电商运营数据中台" />
        </Form.Item>
        <Form.Item name="description" label="项目描述">
          <TextArea rows={3} placeholder="简要描述该项目的目标与用途" />
        </Form.Item>
        
        {isAdmin ? (
          <Form.Item 
            name="tenant" 
            label="所属组织/租户"
            rules={[{ required: true, message: '请选择所属组织' }]}
          >
            <Select placeholder="请选择或输入组织" showSearch>
              {tenants.map(t => (
                <Option key={t} value={t}>{t}</Option>
              ))}
            </Select>
          </Form.Item>
        ) : (
          <Form.Item 
            name="tenant" 
            label="所属组织/租户"
            tooltip="默认设置为您所在的组织"
          >
            <Input disabled />
          </Form.Item>
        )}

        <Form.Item name="visibility" label="可见性">
          <Select>
            <Option value="private">私有 (仅项目成员可见)</Option>
            <Option value="internal">内部 (本组织成员可见)</Option>
            <Option value="public">公开 (本平台所有成员可见)</Option>
          </Select>
        </Form.Item>
        <Form.Item name="color" label="项目主题色">
          <ColorPicker showText />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ProjectModal;
