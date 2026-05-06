# 排砖宝 (TileLayout AI)

> 为瓷砖门店和设计师提供"拍照手绘户型→精准排版→真实纹理渲染→下单确认→加工施工图"全链路轻量工具

## 项目简介

排砖宝是一个基于 React + TypeScript + Python FastAPI 的全栈应用，支持 Web PWA、移动端 App (iOS/Android) 和桌面应用 (Windows/macOS/Linux) 三端统一。

### 核心功能

- 📐 **精准排版**：数学几何算法保证排版 100% 精准
- 🎨 **手绘识别**：AI 识别手绘草图转换为可编辑精确多边形
- 🖼️ **纹理渲染**：支持手拍实物瓷砖抠图，真实纹理渲染
- 📄 **确认单生成**：一键生成带产品图、规格、价格、商家信息的标准确认单
- 📱 **三端统一**：Web PWA、手机 App、桌面应用代码复用率 >95%

## 技术栈

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **包管理**: pnpm + Turborepo
- **UI 组件**: Ant Design Mobile + Ant Design
- **2D 交互**: react-konva (Konva.js)
- **移动端**: Capacitor 6
- **桌面端**: Tauri 2.0
- **状态管理**: Zustand
- **路由**: React Router v6
- **样式**: Tailwind CSS

### 后端
- **框架**: FastAPI (Python 3.11+)
- **排版引擎**: Shapely + numpy
- **PPT 生成**: python-pptx
- **图像处理**: rembg, Pillow, opencv-python
- **数据库**: PostgreSQL + SQLAlchemy
- **文件存储**: MinIO / 阿里云 OSS

## 项目结构

```
TileLayout AI/
├── packages/
│   ├── shared/          # 共享业务逻辑与 UI
│   ├── web/             # Web PWA 应用
│   ├── mobile/          # 移动端应用 (Capacitor)
│   └── desktop/         # 桌面端应用 (Tauri)
├── backend/             # 后端服务
├── docs/                # 文档
└── scripts/             # 脚本工具
```

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Python >= 3.11
- PostgreSQL >= 15

### 安装依赖

```bash
# 安装前端依赖
pnpm install

# 安装后端依赖
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 开发模式

```bash
# 启动前端开发服务器
pnpm dev

# 启动后端服务
cd backend
uvicorn app.main:app --reload
```

### 构建生产版本

```bash
# 构建所有应用
pnpm build

# 构建 Web PWA
pnpm --filter @tilelayout/web build

# 构建移动端
pnpm --filter @tilelayout/mobile build:cap

# 构建桌面端
pnpm --filter @tilelayout/desktop tauri build
```

## 开发路线图

### 第一阶段：精确排版核心 (MVP v0.5)
- [ ] 多边形编辑器
- [ ] 输入尺寸
- [ ] 选择砖规格
- [ ] 起铺点拖拽
- [ ] 排版预览 (色块)
- [ ] 基础 PDF 导出 (无纹理)

### 第二阶段：手绘识别 + 在线编辑 (v1.0)
- [ ] 手绘草图上传
- [ ] OCR 尺寸识别
- [ ] 轮廓提取
- [ ] 结果回填编辑器
- [ ] 纹理拍照与抠图
- [ ] 简易在线编辑器

### 第三阶段：纹理渲染 + 确认单 (v1.5)
- [ ] 排版图用真实纹理填充
- [ ] 订单创建
- [ ] 报价计算
- [ ] PPT 确认单生成

### 第四阶段：加工单 + 施工图 + 闭环 (v2.0)
- [ ] 切割加工单 (工厂)
- [ ] 编号施工图
- [ ] 订单状态管理
- [ ] 业主在线确认

### 第五阶段：全平台完善与发布
- [ ] 付费墙
- [ ] 多租户产品库
- [ ] 桌面端离线模式
- [ ] 移动端上架

## 文档

- [项目架构文档](./ARCHITECTURE.md)
- [API 文档](./docs/api/README.md)
- [开发指南](./docs/development/README.md)
- [部署指南](./docs/deployment/README.md)

## 贡献指南

欢迎贡献代码！请查看 [贡献指南](./CONTRIBUTING.md) 了解详情。

## 许可证

[MIT License](./LICENSE)

## 联系方式

- 官网: https://tilelayout.ai
- 邮箱: support@tilelayout.ai
- GitHub: https://github.com/tilelayout-ai

---

**维护者**: TileLayout AI Team
