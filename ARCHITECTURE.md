# 排砖宝 (TileLayout AI) - 项目架构文档

## 1. 项目概述

### 1.1 产品定位
排砖宝是一个为瓷砖门店和设计师提供的全链路轻量工具，核心功能包括：
- 拍照手绘户型识别
- 精准排版计算
- 真实纹理渲染
- 用户确认单生成
- 下单与施工图生成

### 1.2 核心差异化
- **数学几何算法**：保证排版 100% 精准
- **AI 识别**：手绘草图转换为可编辑精确多边形
- **真实纹理渲染**：支持手拍实物瓷砖抠图
- **一键确认单**：生成带产品图、规格、价格、商家信息的标准确认单
- **三端统一**：Web PWA、手机 App、桌面应用

### 1.3 目标用户
- 瓷砖品牌门店
- 独立设计师
- 装修公司

### 1.4 商业模式
- **免费版**：核心排版带水印，次数限制，商家信息隐藏
- **设计师个人版**：19元/月或99元/年，无水印，无限排版
- **门店专业版**：199元/月起，多子账号、产品库管理、API对接

## 2. 技术架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────┐
│                   前端 Monorepo (React + TS)         │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Web PWA  │  │ Mobile   │  │  Desktop (Tauri) │   │
│  │          │  │(Capacitor)│  │                  │   │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│       │              │                │               │
│       └──────────────┴────────────────┘               │
│               共享业务层 (packages/shared)              │
│    • 排版预览 • 确认单预览(HTML) • 状态管理 • API     │
└───────────────────────┬──────────────────────────────┘
                        │ HTTPS (REST API + 文件上传)
┌───────────────────────▼──────────────────────────────┐
│                  后端 (Python FastAPI)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │ 排版引擎     │  │ PPT/PDF生成  │  │ 图像处理     │ │
│  │ (Shapely)    │  │ (python-pptx) │  │ (rembg/PIL)  │ │
│  └─────────────┘  └─────────────┘  └──────────────┘ │
│  ┌─────────────────────────────────────────────────┐ │
│  │              认证/订单/产品库/存储               │ │
│  └─────────────────────────────────────────────────┘ │
│                     PostgreSQL + OSS/S3               │
└──────────────────────────────────────────────────────┘
```

### 2.2 技术栈详情

#### 前端技术栈
| 层级 | 选型 | 理由 |
|------|------|------|
| 框架 | React 18 + TypeScript 严格模式 | 生态丰富，适合复杂交互，TS 保障大型项目可维护性 |
| 构建 | Vite 5 | 极速 HMR，支持多入口和条件编译 |
| 包管理 | pnpm + Turborepo | Monorepo 下共享代码与独立构建，任务缓存加速 CI |
| UI 组件 | Ant Design Mobile + Ant Design | 官方响应式支持，一套组件适配多端 |
| 2D 交互 | react-konva (Konva.js) | 多边形编辑器、排版图标注渲染 |
| 移动端容器 | Capacitor 6 | 将 Web 应用打包为 iOS/Android 原生 App |
| 桌面端容器 | Tauri 2.0 (Rust 后端壳) | 体积小（<10MB），性能好 |
| PWA 化 | vite-plugin-pwa (Workbox) | 实现离线缓存、可安装到主屏幕 |
| 状态管理 | Zustand | 轻量、符合 React 心智模型 |
| 路由 | React Router v6 | 标准 SPA 路由，支持嵌套 |
| 样式 | Tailwind CSS + Ant Design token 扩展 | 原子化样式快速开发 |

#### 后端技术栈
| 服务 | 选型 | 说明 |
|------|------|------|
| API 框架 | FastAPI (Python 3.11+) | 异步性能好，自动生成 OpenAPI 文档 |
| 排版引擎 | Shapely + numpy | 多边形裁剪运算，工业级稳定性 |
| PPT 生成 | python-pptx | 成熟，可完全程序化创建 PPT |
| PDF 生成 | reportlab 或 LibreOffice headless | 手机打开 PDF 兼容性好 |
| 图像处理 | rembg, Pillow, opencv-python | 处理手拍瓷砖去背景、透视校正 |
| 数据库 | PostgreSQL + SQLAlchemy (async) | 稳定性、事务支持好，JSONB 适合存储排版数据 |
| 缓存/消息 | Redis (必要时引入) | 可稍后加入 |
| 文件存储 | MinIO (自建) / 阿里云 OSS | 存储用户上传的户型图、纹理、生成的PPT文件 |
| 部署 | Docker + Gunicorn + Uvicorn | 容器化一键部署 |

### 2.3 平台适配策略
通过 Vite 的 `resolve.alias` 在构建时注入不同平台实现文件：
- `platform/capacitor.ts` - 移动端实现
- `platform/web.ts` - Web 端实现
- `platform/tauri.ts` - 桌面端实现

业务组件通过统一接口 `IPlatform` 调用原生能力（相机、文件保存）。

## 3. 目录结构

```
TileLayout AI/
├── packages/
│   ├── shared/                    # 共享业务逻辑与 UI
│   │   ├── src/
│   │   │   ├── components/        # 通用 UI 组件
│   │   │   │   ├── Confirmation/  # 确认单相关组件
│   │   │   │   ├── RoomEditor/    # 多边形编辑器
│   │   │   │   ├── LayoutRenderer/# 排版图渲染
│   │   │   │   ├── MaterialPicker/# 纹理/产品选择器
│   │   │   │   ├── PriceInput/    # 价格输入组件
│   │   │   │   ├── StoreInfoForm/ # 门店信息编辑表单
│   │   │   │   └── UpgradePrompt/ # 升级提示
│   │   │   ├── pages/             # 页面组件
│   │   │   │   ├── Home.tsx
│   │   │   │   ├── ProjectEdit.tsx
│   │   │   │   ├── ProjectConfig.tsx
│   │   │   │   ├── LayoutPreview.tsx
│   │   │   │   ├── TextureLibrary.tsx
│   │   │   │   ├── TextureEditor.tsx
│   │   │   │   ├── ProductManager.tsx
│   │   │   │   ├── OrderCreate.tsx
│   │   │   │   ├── OrderDetail.tsx
│   │   │   │   ├── OrderConfirm.tsx
│   │   │   │   └── ConfirmationPreview.tsx
│   │   │   ├── platform/          # 平台适配器
│   │   │   ├── store/             # Zustand 状态
│   │   │   ├── services/          # API 调用封装
│   │   │   ├── hooks/             # 自定义 Hooks
│   │   │   ├── types/             # TypeScript 类型定义
│   │   │   └── utils/             # 工具函数
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── web/                       # Web PWA 应用
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   └── App.tsx
│   │   ├── vite.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── mobile/                    # 移动端应用 (Capacitor)
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   └── App.tsx
│   │   ├── capacitor.config.ts
│   │   ├── vite.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── desktop/                   # 桌面端应用 (Tauri)
│       ├── src/
│       │   ├── main.tsx
│       │   └── App.tsx
│       ├── src-tauri/
│       │   ├── Cargo.toml
│       │   └── tauri.conf.json
│       ├── vite.config.ts
│       ├── package.json
│       └── tsconfig.json
│
├── backend/                       # 后端服务
│   ├── app/
│   │   ├── api/                   # API 路由
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── textures.py
│   │   │   ├── products.py
│   │   │   ├── projects.py
│   │   │   ├── orders.py
│   │   │   └── confirmation.py
│   │   ├── models/                # 数据库模型
│   │   │   ├── user.py
│   │   │   ├── texture.py
│   │   │   ├── product.py
│   │   │   ├── project.py
│   │   │   └── order.py
│   │   ├── services/              # 业务逻辑
│   │   │   ├── layout_engine.py
│   │   │   ├── image_processor.py
│   │   │   ├── ppt_generator.py
│   │   │   └── pdf_generator.py
│   │   ├── core/                  # 核心配置
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   └── database.py
│   │   ├── schemas/               # Pydantic 模型
│   │   └── utils/                 # 工具函数
│   ├── alembic/                   # 数据库迁移
│   ├── tests/                     # 测试
│   ├── requirements.txt
│   └── main.py
│
├── docs/                          # 文档
│   ├── api/                       # API 文档
│   ├── design/                    # 设计文档
│   └── deployment/                # 部署文档
│
├── scripts/                       # 脚本工具
│   ├── setup.sh
│   └── deploy.sh
│
├── pnpm-workspace.yaml            # pnpm 工作区配置
├── turbo.json                     # Turborepo 配置
├── package.json                   # 根 package.json
├── tsconfig.json                  # 根 TypeScript 配置
├── .eslintrc.js                   # ESLint 配置
├── .prettierrc                    # Prettier 配置
├── .gitignore
├── README.md
└── ARCHITECTURE.md                # 本文档
```

## 4. 数据库设计

### 4.1 核心表结构

#### 用户与门店
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    is_member BOOLEAN DEFAULT FALSE,
    member_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE store_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    store_name VARCHAR(200),
    logo_url TEXT,
    phone VARCHAR(20),
    address VARCHAR(500),
    qr_code_url TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 材质库
```sql
CREATE TABLE textures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id),
    name VARCHAR(200) NOT NULL,
    original_image_url TEXT NOT NULL,
    processed_image_url TEXT,
    width_mm INT,
    height_mm INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 产品与 SKU
```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES store_profiles(user_id),
    name VARCHAR(200) NOT NULL,
    image_url TEXT,
    texture_id UUID REFERENCES textures(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_skus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id),
    size_x_mm INT NOT NULL,
    size_y_mm INT NOT NULL,
    unit_price DECIMAL(10,2),
    unit VARCHAR(10) DEFAULT '片',
    stock INT DEFAULT 0
);
```

#### 项目
```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name VARCHAR(200) NOT NULL,
    room_polygon JSONB,
    edges_annotated JSONB,
    tile_config JSONB,
    show_price BOOLEAN DEFAULT TRUE,
    confirmation_data JSONB,
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 排版结果
```sql
CREATE TABLE layout_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    texture_id UUID REFERENCES textures(id),
    tiles JSONB,
    statistics JSONB,
    preview_image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 订单
```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    store_user_id UUID REFERENCES users(id),
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'draft',
    total_amount DECIMAL(12,2),
    show_total_price BOOLEAN DEFAULT FALSE,
    confirm_token VARCHAR(64) UNIQUE,
    confirmed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    sku_id UUID REFERENCES product_skus(id),
    texture_id UUID REFERENCES textures(id),
    quantity_whole INT,
    quantity_cut INT,
    price_per_piece DECIMAL(10,2),
    layout_snapshot JSONB
);
```

## 5. API 设计

### 5.1 认证与用户
- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `GET /api/v1/users/me` - 获取当前用户信息

### 5.2 商家信息管理
- `GET /api/v1/store/profile` - 获取门店信息
- `PUT /api/v1/store/profile` - 更新门店信息（会员专属）

### 5.3 材质管理
- `POST /api/v1/textures/upload` - 上传原图，自动抠图
- `POST /api/v1/textures/{id}/process` - 手动编辑后保存
- `GET /api/v1/textures` - 获取纹理列表

### 5.4 产品与 SKU
- `POST /api/v1/products` - 创建产品
- `POST /api/v1/products/{id}/skus` - 添加规格与价格
- `PUT /api/v1/products/{id}/skus/{sku_id}` - 修改价格
- `GET /api/v1/products` - 获取产品列表

### 5.5 排版项目
- `POST /api/v1/projects` - 创建新项目
- `PUT /api/v1/projects/{id}` - 更新户型、配置
- `POST /api/v1/projects/{id}/calculate` - 执行排版计算
- `GET /api/v1/projects/{id}/layout` - 获取最新排版结果
- `PUT /api/v1/projects/{id}/materials` - 关联产品和价格

### 5.6 确认单生成
- `POST /api/v1/projects/{id}/confirmations` - 生成确认单
- `GET /api/v1/confirmations/{token}` - 公开预览链接
- `GET /api/v1/projects/{id}/export/ppt` - 下载 PPTX
- `GET /api/v1/projects/{id}/export/pdf` - 下载 PDF

### 5.7 订单
- `POST /api/v1/orders` - 从项目创建订单
- `GET /api/v1/orders/{id}/confirm` - 获取订单确认页数据
- `POST /api/v1/orders/{id}/confirm` - 业主确认
- `PUT /api/v1/orders/{id}/status` - 更新订单状态

## 6. 开发流程

### 6.1 环境准备
1. 安装 Node.js 18+
2. 安装 pnpm: `npm install -g pnpm`
3. 安装 Python 3.11+
4. 安装 PostgreSQL 15+
5. 安装 Docker (可选)

### 6.2 本地开发
```bash
# 安装依赖
pnpm install

# 启动前端开发服务器
pnpm dev

# 启动后端服务
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 6.3 构建与部署
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

## 7. 分阶段开发路线图

### 第一阶段：精确排版核心 (MVP v0.5)
- 多边形编辑器
- 输入尺寸
- 选择砖规格
- 起铺点拖拽
- 排版预览 (色块)
- 基础 PDF 导出 (无纹理)

### 第二阶段：手绘识别 + 在线编辑 (v1.0)
- 手绘草图上传
- OCR 尺寸识别
- 轮廓提取
- 结果回填编辑器
- 纹理拍照与抠图
- 简易在线编辑器

### 第三阶段：纹理渲染 + 确认单 (v1.5)
- 排版图用真实纹理填充
- 订单创建
- 报价计算
- PPT 确认单生成 (商家信息、价格可配置)

### 第四阶段：加工单 + 施工图 + 闭环 (v2.0)
- 切割加工单 (工厂)
- 编号施工图
- 订单状态管理
- 业主在线确认

### 第五阶段：全平台完善与发布
- 付费墙
- 多租户产品库
- 桌面端离线模式
- 移动端上架

## 8. 权限控制

### 8.1 免费/会员差异
| 功能点 | 免费版 | 会员版 |
|--------|--------|--------|
| 排版计算 & 预览 | 每月3次，带水印 | 无限，去水印 |
| 纹理上传与抠图 | 5张 | 无限 |
| 产品库 & SKU 管理 | 不可用 | 可用 |
| 价格输入 | 不可用 | 可用 |
| 确认单中价格显示 | 强制隐藏 | 可选显示 |
| 确认单商家信息 | 隐藏，展示升级引导 | 完整门店信息、Logo、联系方式 |
| 高清 PDF / PPT 导出 | 水印版 | 无水印 |
| API 对接 | 不支持 | 提供 |

### 8.2 权限实现
- API 层通过 `Depends(get_current_user)` 校验会员身份
- 前端根据用户状态渲染 UI
- 后端强制校验，不信任前端数据

## 9. 安全考虑

### 9.1 认证与授权
- JWT Token 认证
- 密码使用 bcrypt 加密
- 敏感操作需要二次验证

### 9.2 数据安全
- 所有 API 使用 HTTPS
- 敏感数据加密存储
- SQL 注入防护
- XSS 防护

### 9.3 文件上传
- 文件类型验证
- 文件大小限制
- 病毒扫描 (可选)

## 10. 性能优化

### 10.1 前端优化
- 代码分割与懒加载
- 图片压缩与 CDN
- 虚拟列表
- Service Worker 缓存

### 10.2 后端优化
- 数据库索引优化
- Redis 缓存热点数据
- 异步任务队列
- 文件存储使用 OSS/CDN

## 11. 监控与日志

### 11.1 应用监控
- 错误追踪 (Sentry)
- 性能监控 (APM)
- 用户行为分析

### 11.2 日志管理
- 结构化日志
- 日志分级 (DEBUG, INFO, WARNING, ERROR)
- 日志归档与检索

## 12. 测试策略

### 12.1 前端测试
- 单元测试 (Vitest)
- 组件测试 (React Testing Library)
- E2E 测试 (Playwright)

### 12.2 后端测试
- 单元测试 (pytest)
- API 测试 (TestClient)
- 性能测试 (locust)

## 13. 部署架构

### 13.1 生产环境
```
┌─────────────┐
│   Nginx     │ (反向代理 + SSL)
└──────┬──────┘
       │
┌──────▼──────┐
│  Frontend   │ (静态文件 + PWA)
└──────┬──────┘
       │
┌──────▼──────┐
│  Backend    │ (FastAPI + Gunicorn + Uvicorn)
└──────┬──────┘
       │
┌──────▼──────┐
│ PostgreSQL  │
└──────┬──────┘
       │
┌──────▼──────┐
│  MinIO/OSS  │ (文件存储)
└─────────────┘
```

### 13.2 容器化部署
- Docker Compose 本地开发
- Kubernetes 生产部署 (可选)

---

**文档版本**: 1.0  
**最后更新**: 2026-05-06  
**维护者**: TileLayout AI Team
