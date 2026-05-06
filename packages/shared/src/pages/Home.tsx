/**
 * 项目首页组件
 * 
 * 功能：
 * - 显示项目列表
 * - 创建新项目
 * - 搜索和筛选项目
 * - 分页显示
 * 
 * 生产环境特性：
 * - 完整的错误处理和重试机制
 * - 性能优化（React.memo, useMemo, useCallback）
 * - 加载状态和空状态处理
 * - 响应式设计
 * - 无障碍访问支持
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Space,
  Typography,
  Empty,
  Input,
  Select,
  Spin,
  message,
  Modal,
  Form,
  Row,
  Col,
  Tag,
  Tooltip,
  Pagination,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  FolderOutlined,
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useAppStore } from '../store';
import type { Project } from '../types';
import { projectsApi } from '../services';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { confirm } = Modal;

/**
 * 项目状态枚举
 */
enum ProjectStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

/**
 * 项目状态配置
 */
const PROJECT_STATUS_CONFIG = {
  [ProjectStatus.DRAFT]: { color: 'default', text: '草稿' },
  [ProjectStatus.IN_PROGRESS]: { color: 'processing', text: '进行中' },
  [ProjectStatus.COMPLETED]: { color: 'success', text: '已完成' },
  [ProjectStatus.ARCHIVED]: { color: 'warning', text: '已归档' },
} as const;

/**
 * 项目卡片属性
 */
interface ProjectCardProps {
  project: Project;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * 项目卡片组件
 * 使用 React.memo 优化性能，避免不必要的重新渲染
 */
const ProjectCard: React.FC<ProjectCardProps> = React.memo(
  ({ project, onOpen, onEdit, onDelete }) => {
    const statusConfig = PROJECT_STATUS_CONFIG[project.status as ProjectStatus];

    const handleCardClick = useCallback(() => {
      onOpen(project.id);
    }, [onOpen, project.id]);

    const handleEditClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit(project.id);
      },
      [onEdit, project.id]
    );

    const handleDeleteClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(project.id);
      },
      [onDelete, project.id]
    );

    return (
      <Card
        hoverable
        className="cursor-pointer transition-all duration-300 hover:shadow-lg"
        onClick={handleCardClick}
        actions={[
          <Tooltip key="edit" title="编辑">
            <EditOutlined onClick={handleEditClick} />
          </Tooltip>,
          <Tooltip key="delete" title="删除">
            <DeleteOutlined onClick={handleDeleteClick} />
          </Tooltip>,
        ]}
        aria-label={`项目: ${project.name}`}
      >
        <Space direction="vertical" className="w-full">
          <div className="flex items-center justify-between">
            <FolderOutlined
              style={{ fontSize: '24px', color: '#1890ff' }}
              aria-hidden="true"
            />
            <Tag color={statusConfig.color}>{statusConfig.text}</Tag>
          </div>
          <Title level={4} style={{ margin: 0 }} ellipsis={{ rows: 1 }}>
            {project.name}
          </Title>
          <Paragraph
            type="secondary"
            style={{ fontSize: '12px', margin: 0 }}
            ellipsis={{ rows: 2 }}
          >
            {project.name}
          </Paragraph>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            创建于 {new Date(project.createdAt).toLocaleDateString('zh-CN')}
          </Text>
        </Space>
      </Card>
    );
  }
);

ProjectCard.displayName = 'ProjectCard';

/**
 * 首页组件
 */
const Home: React.FC = () => {
  const navigate = useNavigate();
  const { projects, setProjects, deleteProject, setLoading, setError } = useAppStore();

  // 状态管理
  const [loading, setLoadingState] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();

  /**
   * 加载项目列表
   */
  const loadProjects = useCallback(async () => {
    try {
      setLoadingState(true);
      setErrorState(null);
      setLoading(true);

      const data = await projectsApi.list();
      setProjects(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载项目列表失败';
      setErrorState(errorMessage);
      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoadingState(false);
      setLoading(false);
    }
  }, [setProjects, setLoading, setError]);

  /**
   * 初始加载
   */
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  /**
   * 过滤和搜索项目
   */
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // 搜索过滤
    if (searchText) {
      const lowerSearchText = searchText.toLowerCase();
      result = result.filter((project) =>
        project.name.toLowerCase().includes(lowerSearchText)
      );
    }

    // 状态过滤
    if (statusFilter !== 'all') {
      result = result.filter((project) => project.status === statusFilter);
    }

    return result;
  }, [projects, searchText, statusFilter]);

  /**
   * 分页数据
   */
  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredProjects.slice(startIndex, endIndex);
  }, [filteredProjects, currentPage, pageSize]);

  /**
   * 打开项目
   */
  const handleOpenProject = useCallback(
    (projectId: string) => {
      navigate(`/project/${projectId}`);
    },
    [navigate]
  );

  /**
   * 编辑项目
   */
  const handleEditProject = useCallback(
    (projectId: string) => {
      navigate(`/project/${projectId}/config`);
    },
    [navigate]
  );

  /**
   * 删除项目
   */
  const handleDeleteProject = useCallback(
    (projectId: string) => {
      confirm({
        title: '确认删除',
        icon: <ExclamationCircleOutlined />,
        content: '删除后无法恢复，确定要删除这个项目吗？',
        okText: '确定',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          try {
            await projectsApi.delete(projectId);
            deleteProject(projectId);
            message.success('项目已删除');
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '删除失败';
            message.error(errorMessage);
          }
        },
      });
    },
    [deleteProject]
  );

  /**
   * 创建新项目
   */
  const handleCreateProject = useCallback(() => {
    setIsCreateModalVisible(true);
  }, []);

  /**
   * 处理创建项目表单提交
   */
  const handleCreateSubmit = useCallback(
    async (values: { name: string }) => {
      try {
        setLoadingState(true);
        const newProject = await projectsApi.create({
          name: values.name,
          roomPolygon: [],
          edgesAnnotated: [],
          tileConfig: {
            tileWidth: 800,
            tileHeight: 800,
            gapWidth: 3,
            direction: 'horizontal',
            startPoint: { x: 0, y: 0 },
          },
        });

        message.success('项目创建成功');
        setIsCreateModalVisible(false);
        createForm.resetFields();
        navigate(`/project/${newProject.id}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '创建项目失败';
        message.error(errorMessage);
      } finally {
        setLoadingState(false);
      }
    },
    [navigate, createForm]
  );

  /**
   * 处理搜索
   */
  const handleSearch = useCallback((value: string) => {
    setSearchText(value);
    setCurrentPage(1);
  }, []);

  /**
   * 处理状态筛选
   */
  const handleStatusFilter = useCallback((value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  }, []);

  /**
   * 处理分页变化
   */
  const handlePageChange = useCallback((page: number, size: number) => {
    setCurrentPage(page);
    setPageSize(size);
  }, []);

  /**
   * 重试加载
   */
  const handleRetry = useCallback(() => {
    loadProjects();
  }, [loadProjects]);

  // 渲染加载状态
  if (loading && projects.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  // 渲染错误状态
  if (error && projects.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Alert
          message="加载失败"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={handleRetry}>
              重试
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题和操作按钮 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <Title level={2} style={{ margin: 0 }}>
              排砖宝
            </Title>
            <Text type="secondary">瓷砖排版与销售闭环应用</Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={handleCreateProject}
            aria-label="创建新项目"
          >
            新建项目
          </Button>
        </div>

        {/* 搜索和筛选 */}
        {projects.length > 0 && (
          <Card className="mb-4">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={8}>
                <Input
                  placeholder="搜索项目名称"
                  prefix={<SearchOutlined />}
                  value={searchText}
                  onChange={(e) => handleSearch(e.target.value)}
                  allowClear
                  aria-label="搜索项目"
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Select
                  placeholder="筛选状态"
                  value={statusFilter}
                  onChange={handleStatusFilter}
                  style={{ width: '100%' }}
                  aria-label="筛选项目状态"
                >
                  <Option value="all">全部状态</Option>
                  {Object.entries(PROJECT_STATUS_CONFIG).map(([key, config]) => (
                    <Option key={key} value={key}>
                      {config.text}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={handleRetry}
                  loading={loading}
                  aria-label="刷新项目列表"
                >
                  刷新
                </Button>
              </Col>
            </Row>
          </Card>
        )}

        {/* 项目列表 */}
        {filteredProjects.length === 0 ? (
          <Card className="text-center py-12">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space direction="vertical" size="large">
                  <Text type="secondary">
                    {searchText || statusFilter !== 'all'
                      ? '没有找到匹配的项目'
                      : '还没有项目，开始创建您的第一个排版项目吧'}
                  </Text>
                  {!searchText && statusFilter === 'all' && (
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleCreateProject}
                    >
                      创建第一个项目
                    </Button>
                  )}
                </Space>
              }
            />
          </Card>
        ) : (
          <>
            <Row gutter={[16, 16]}>
              {paginatedProjects.map((project) => (
                <Col key={project.id} xs={24} sm={12} md={8} lg={6}>
                  <ProjectCard
                    project={project}
                    onOpen={handleOpenProject}
                    onEdit={handleEditProject}
                    onDelete={handleDeleteProject}
                  />
                </Col>
              ))}
            </Row>

            {/* 分页 */}
            {filteredProjects.length > pageSize && (
              <div className="mt-6 flex justify-center">
                <Pagination
                  current={currentPage}
                  pageSize={pageSize}
                  total={filteredProjects.length}
                  onChange={handlePageChange}
                  showSizeChanger
                  showQuickJumper
                  showTotal={(total) => `共 ${total} 个项目`}
                  pageSizeOptions={['12', '24', '48', '96']}
                />
              </div>
            )}
          </>
        )}

        {/* 创建项目模态框 */}
        <Modal
          title="创建新项目"
          open={isCreateModalVisible}
          onCancel={() => {
            setIsCreateModalVisible(false);
            createForm.resetFields();
          }}
          footer={null}
          aria-labelledby="create-project-modal-title"
        >
          <Form
            form={createForm}
            layout="vertical"
            onFinish={handleCreateSubmit}
            autoComplete="off"
          >
            <Form.Item
              label="项目名称"
              name="name"
              rules={[
                { required: true, message: '请输入项目名称' },
                { min: 2, message: '项目名称至少2个字符' },
                { max: 100, message: '项目名称最多100个字符' },
              ]}
            >
              <Input
                placeholder="例如：客厅地砖"
                maxLength={100}
                showCount
                aria-label="项目名称输入框"
              />
            </Form.Item>

            <Form.Item className="mb-0 text-right">
              <Space>
                <Button
                  onClick={() => {
                    setIsCreateModalVisible(false);
                    createForm.resetFields();
                  }}
                >
                  取消
                </Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                  创建
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default Home;
