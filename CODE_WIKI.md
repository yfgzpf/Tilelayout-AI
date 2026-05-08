# 排砖宝 (TileLayout AI) — Code Wiki

> 版本: v0.1.0 | 最后更新: 2026-05-08

---

## 目录

- [1. 项目概览](#1-项目概览)
- [2. 技术架构](#2-技术架构)
- [3. 项目目录结构](#3-项目目录结构)
- [4. 后端模块详解](#4-后端模块详解)
  - [4.1 应用入口与配置](#41-应用入口与配置)
  - [4.2 数据模型 (ORM)](#42-数据模型-orm)
  - [4.3 核心基础设施](#43-核心基础设施)
  - [4.4 API 路由层](#44-api-路由层)
  - [4.5 业务服务层](#45-业务服务层)
- [5. 前端模块详解](#5-前端模块详解)
  - [5.1 应用入口与路由](#51-应用入口与路由)
  - [5.2 状态管理](#52-状态管理)
  - [5.3 API 服务层](#53-api-服务层)
  - [5.4 类型系统](#54-类型系统)
  - [5.5 页面组件](#55-页面组件)
  - [5.6 共享组件](#56-共享组件)
- [6. 核心算法详解](#6-核心算法详解)
- [7. 依赖关系图](#7-依赖关系图)
- [8. 部署架构](#8-部署架构)
- [9. 项目运行方式](#9-项目运行方式)
- [10. 免费/会员权限体系](#10-免费会员权限体系)

---

## 1. 项目概览

**排砖宝 (TileLayout AI)** 是一款面向瓷砖门店和设计师的全链路轻量工具，核心功能链路：

```
拍照手绘户型 → 精准排版计算 → 真实纹理渲染 → 报价与确认单 → 加工施工图
```

**核心差异化**：
- 数学几何算法 (Sutherland-Hodgman 裁剪) 保证排版 100% 精准
- 手绘草图 AI 识别 (OpenCV 轮廓提取) 转换为可编辑精确多边形
- 支持手拍实物瓷砖抠图，在排版图中真实纹理渲染
- 一键生成带产品图、规格、价格、商家信息的标准确认单 (PPT/PDF/HTML)
- 完整辅料计算：瓷砖胶、美缝剂、水泥砂、十字卡、防水涂料、踢脚线、门头石

**目标用户**：瓷砖品牌门店、独立设计师、装修公司

---

## 2. 技术架构

```
┌──────────────────────────────────────────────────────────┐
│  前端 Monorepo (pnpm + Turborepo)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Web (PWA)   │  │ Mobile       │  │ Desktop (Tauri)│  │
│  │  Vite+React  │  │ (Capacitor)  │  │  (规划中)      │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │
│         └─────────────────┴──────────────────┘            │
│              packages/shared (共享业务层)                   │
│   组件 · 类型 · 状态(Zustand) · API封装 · Hooks           │
└──────────────────────────┬───────────────────────────────┘
                           │ REST API (JSON + 文件上传)
┌──────────────────────────▼───────────────────────────────┐
│  后端 (Python FastAPI)                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────────┐ │
│  │ 排版引擎      │ │ PPT/PDF 生成  │ │ 图像处理          │ │
│  │ (纯Python     │ │ (python-pptx │ │ (OpenCV/Pillow/   │ │
│  │  几何算法)    │ │  reportlab)  │ │  rembg)           │ │
│  └──────────────┘ └──────────────┘ └───────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  认证/权限 · 订单 · 产品库 · 速率限制 · 辅料计算      │ │
│  └──────────────────────────────────────────────────────┘ │
│              PostgreSQL + Redis + 对象存储                 │
└──────────────────────────────────────────────────────────┘
```

**技术栈总览**：

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 18 + TypeScript | 严格模式，禁止 any |
| 前端构建 | Vite 5 | 极速 HMR，PWA 支持 |
| 前端 UI | Ant Design 5 | 企业级组件库 |
| 2D 渲染 | Konva (react-konva) | Canvas 多边形编辑与排版渲染 |
| 状态管理 | Zustand 4 | 轻量、持久化 |
| 包管理 | pnpm + Turborepo | Monorepo 共享代码 |
| 后端框架 | FastAPI (Python 3.11+) | 异步、自动 OpenAPI 文档 |
| 排版引擎 | 纯 Python 几何算法 | Sutherland-Hodgman 裁剪 |
| PPT 生成 | python-pptx | 5 页标准确认单 |
| PDF 生成 | reportlab | A4 格式确认单 |
| 图像处理 | OpenCV + Pillow | 轮廓提取、水印 |
| 数据库 | PostgreSQL 16 / SQLite | SQLAlchemy async ORM |
| 缓存 | Redis 7 | 速率限制、会话 |
| 文件存储 | MinIO / 腾讯云 COS | 纹理、PPT 文件 |
| 部署 | Docker Compose + Nginx | 容器化一键部署 |

---

## 3. 项目目录结构

```
/workspace/
├── backend/                          # 后端 Python FastAPI
│   ├── main.py                       # FastAPI 应用入口
│   ├── requirements.txt              # Python 依赖
│   ├── Dockerfile                    # 后端容器镜像
│   ├── alembic.ini                   # 数据库迁移配置
│   ├── alembic/
│   │   ├── env.py                    # Alembic 环境配置
│   │   └── versions/
│   │       └── 0001_initial_schema.py # 初始迁移脚本
│   ├── init_db.py                    # SQLite 初始化脚本
│   ├── app/
│   │   ├── api/                      # API 路由层 (12 个模块)
│   │   │   ├── auth.py               # 认证 (注册/登录)
│   │   │   ├── users.py              # 用户信息
│   │   │   ├── textures.py           # 纹理管理
│   │   │   ├── products.py           # 产品与 SKU
│   │   │   ├── projects.py           # 排版项目
│   │   │   ├── orders.py             # 订单管理
│   │   │   ├── confirmation.py       # 确认单生成
│   │   │   ├── materials.py          # 辅料计算
│   │   │   ├── sketch.py             # 手绘识别
│   │   │   ├── store.py              # 门店信息
│   │   │   ├── sales.py              # 销售计算
│   │   │   └── admin.py              # 管理员控制台
│   │   ├── core/                     # 核心基础设施
│   │   │   ├── config.py             # 应用配置 (pydantic-settings)
│   │   │   ├── database.py           # 数据库引擎与会话
│   │   │   ├── security.py           # JWT + 密码加密
│   │   │   ├── permissions.py        # 权限中间件
│   │   │   ├── rate_limit.py         # API 速率限制 (slowapi)
│   │   │   └── free_limits.py        # 免费用户次数限制
│   │   ├── models/
│   │   │   └── models.py             # SQLAlchemy ORM 模型 (8 张表)
│   │   └── services/                 # 业务服务层 (12 个服务)
│   │       ├── layout_engine.py      # 核心排版引擎
│   │       ├── auxiliary_material.py # 辅料计算引擎
│   │       ├── complete_quote.py     # 完整报价单
│   │       ├── ppt_generator.py      # PPT 确认单生成
│   │       ├── pdf_generator.py      # PDF 确认单生成
│   │       ├── sketch_recognition.py # 手绘户型识别
│   │       ├── watermark.py          # 水印服务
│   │       ├── cutting_drawing.py    # 切割加工图
│   │       ├── door_optimizer.py     # 门洞优化器
│   │       ├── layout_optimizer.py   # 排版方案优化
│   │       ├── skirting_calculator.py# 踢脚线计算
│   │       └── wall_avoidance.py     # 通铺避让墙体
│   └── tests/                        # 测试
│       ├── test_layout_engine.py     # 排版引擎单元测试
│       ├── test_api.py               # API 集成测试
│       └── e2e_test.py               # 端到端测试
│
├── packages/                         # 前端 Monorepo
│   ├── web/                          # Web PWA 应用
│   │   ├── package.json
│   │   ├── vite.config.ts            # Vite + PWA 配置
│   │   ├── tsconfig.json
│   │   ├── index.html
│   │   ├── public/
│   │   │   └── manifest.json         # PWA manifest
│   │   └── src/
│   │       ├── main.tsx              # React 入口
│   │       ├── App.tsx               # 路由配置
│   │       ├── index.css             # 全局样式
│   │       ├── services/
│   │       │   └── api.ts            # API 客户端封装
│   │       ├── store/
│   │       │   └── index.ts          # Zustand 全局状态
│   │       ├── types/
│   │       │   └── index.ts          # TypeScript 类型定义
│   │       ├── pages/                # 14 个页面组件
│   │       │   ├── Home.tsx
│   │       │   ├── LoginPage.tsx
│   │       │   ├── RegisterPage.tsx
│   │       │   ├── ProjectEdit.tsx
│   │       │   ├── LayoutPreview.tsx
│   │       │   ├── ConfirmationPreview.tsx
│   │       │   ├── TextureLibrary.tsx
│   │       │   ├── ProductManager.tsx
│   │       │   ├── StoreProfilePage.tsx
│   │       │   ├── OrderListPage.tsx
│   │       │   ├── OrderDetailPage.tsx
│   │       │   ├── UpgradePage.tsx
│   │       │   ├── ContactPage.tsx
│   │       │   └── UserProfilePage.tsx
│   │       └── components/           # Web 专属组件
│   │           ├── DoorManager.tsx
│   │           ├── LayoutPlanComparison.tsx
│   │           ├── Logo.tsx
│   │           └── SkirtingCalculator.tsx
│   │
│   ├── shared/                       # 共享业务包
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts              # 统一导出
│   │       ├── types/
│   │       │   └── index.ts          # 共享类型定义
│   │       ├── store/
│   │       │   └── index.ts          # 共享 Zustand Store
│   │       ├── services/             # 共享 API 服务
│   │       │   ├── index.ts
│   │       │   ├── auth.ts
│   │       │   ├── projects.ts
│   │       │   ├── textures.ts
│   │       │   ├── products.ts
│   │       │   └── orders.ts
│   │       ├── hooks/
│   │       │   ├── index.ts
│   │       │   └── useAsync.ts       # 异步操作 Hook
│   │       ├── components/
│   │       │   ├── RoomEditor/       # 多边形户型编辑器
│   │       │   │   ├── RoomEditor.tsx
│   │       │   │   ├── ProRoomEditor.tsx
│   │       │   │   ├── ErrorBoundary.tsx
│   │       │   │   └── index.ts
│   │       │   └── LayoutRenderer/   # 排版图渲染器
│   │       │       ├── LayoutRenderer.tsx
│   │       │       └── index.ts
│   │       └── pages/                # 共享页面组件
│   │           ├── Home.tsx
│   │           ├── ProjectEdit.tsx
│   │           ├── ProjectConfig.tsx
│   │           ├── LayoutPreview.tsx
│   │           ├── ConfirmationPreview.tsx
│   │           ├── TextureLibrary.tsx
│   │           ├── TextureEditor.tsx
│   │           ├── ProductManager.tsx
│   │           ├── OrderCreate.tsx
│   │           ├── OrderDetail.tsx
│   │           └── OrderConfirm.tsx
│   │
│   ├── mobile/                       # 移动端 (Capacitor, 规划中)
│   │   ├── package.json
│   │   ├── capacitor.config.ts
│   │   └── vite.config.ts
│   │
│   └── desktop/                      # 桌面端 (Tauri, 规划中)
│       ├── package.json
│       └── vite.config.ts
│
├── docker-compose.yml                # 生产环境 Docker 编排
├── nginx.conf                        # Nginx 反向代理配置
├── .env.example                      # 开发环境变量模板
├── .env.production                   # 生产环境变量
├── init-db.sql                       # 数据库初始化 SQL
├── start.sh                          # Linux 启动脚本
├── start.bat                         # Windows 启动脚本
├── package.json                      # Monorepo 根配置
├── pnpm-workspace.yaml               # pnpm 工作区配置
└── turbo.json                        # Turborepo 管道配置
```

---

## 4. 后端模块详解

### 4.1 应用入口与配置

#### [main.py](file:///workspace/backend/main.py)

FastAPI 应用入口，负责：
- 创建 FastAPI 实例，配置 API 文档路径 (`/api/docs`, `/api/redoc`)
- 注册 CORS 中间件 (跨域)
- 挂载静态文件服务 (`/uploads`)
- 初始化速率限制器
- 注册 12 个 API 路由模块

```python
app = FastAPI(title="排砖宝 API", version="0.1.0")
# 路由注册示例:
app.include_router(auth.router, prefix="/api/v1/auth", tags=["认证"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["项目"])
# ... 共 12 个路由模块
```

#### [config.py](file:///workspace/backend/app/core/config.py) — `Settings`

基于 `pydantic-settings` 的配置管理类，从环境变量 / `.env` 文件读取：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./tilelayout.db` | 数据库连接串 |
| `DATABASE_POOL_SIZE` | 5 | 连接池大小 |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis 连接 |
| `SECRET_KEY` | 自动生成 | JWT 签名密钥 |
| `ALGORITHM` | `HS256` | JWT 算法 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 10080 (7天) | Token 过期时间 |
| `MINIO_ENDPOINT` | `localhost:9000` | 对象存储地址 |
| `CORS_ORIGINS` | `localhost:3000/3001/5173` | 允许的跨域来源 |
| `MAX_UPLOAD_SIZE` | 10MB | 上传文件大小限制 |

---

### 4.2 数据模型 (ORM)

#### [models.py](file:///workspace/backend/app/models/models.py)

定义了 8 个 SQLAlchemy ORM 模型，关系图如下：

```
User (用户)
 ├── 1:1 → StoreProfile (门店信息)
 ├── 1:N → Texture (纹理)
 ├── 1:N → Project (项目)
 └── 1:N → Order (订单)

StoreProfile (门店信息)
 └── 1:N → Product (产品)

Texture (纹理)
 └── 1:N → Product (产品)

Product (产品)
 └── 1:N → ProductSKU (产品规格)

Project (项目)
 ├── 1:N → LayoutResult (排版结果)
 └── 1:N → Order (订单)

Order (订单)
 └── 1:N → OrderItem (订单明细)
```

**各模型字段**：

| 模型 | 关键字段 | 说明 |
|------|----------|------|
| `User` | `id`(UUID), `phone`, `hashed_password`, `is_member`, `member_until` | 用户，`is_member` 控制会员权限 |
| `StoreProfile` | `user_id`(FK→User), `store_name`, `logo_url`, `phone`, `address`, `qr_code_url` | 门店信息，与用户一对一 |
| `Texture` | `id`(UUID), `owner_id`(FK→User), `name`, `original_image_url`, `processed_image_url`, `width_mm`, `height_mm` | 纹理，含原图与抠图后图片 |
| `Product` | `id`(UUID), `store_id`(FK→StoreProfile), `name`, `image_url`, `texture_id`(FK→Texture) | 产品，归属门店 |
| `ProductSKU` | `id`(UUID), `product_id`(FK→Product), `size_x_mm`, `size_y_mm`, `unit_price`, `unit`, `stock` | 产品规格与价格 |
| `Project` | `id`(UUID), `user_id`(FK→User), `name`, `room_polygon`(JSON), `tile_config`(JSON), `show_price`, `confirmation_data`(JSON), `status` | 排版项目，`room_polygon` 存顶点坐标 |
| `LayoutResult` | `id`(UUID), `project_id`(FK→Project), `texture_id`(FK→Texture), `tiles`(JSON), `statistics`(JSON), `preview_image_url` | 排版计算结果缓存 |
| `Order` | `id`(UUID), `project_id`(FK→Project), `store_user_id`(FK→User), `customer_name`, `customer_phone`, `status`, `total_amount`, `show_total_price`, `confirm_token` | 订单，`confirm_token` 用于公开链接 |
| `OrderItem` | `id`(UUID), `order_id`(FK→Order), `sku_id`(FK→ProductSKU), `texture_id`, `quantity_whole`, `quantity_cut`, `price_per_piece`, `layout_snapshot`(JSON) | 订单明细，价格快照 |

> `GUID` 类型适配器：自动在 PostgreSQL (`UUID` 类型) 和 SQLite (`CHAR(32)` 存储) 之间切换。

---

### 4.3 核心基础设施

#### [database.py](file:///workspace/backend/app/core/database.py)

- `engine`: SQLAlchemy 异步引擎，支持 PostgreSQL 和 SQLite
- `AsyncSessionLocal`: 异步会话工厂
- `Base`: ORM 声明基类
- `get_db()`: FastAPI 依赖注入的数据库会话生成器，自动 commit/rollback

#### [security.py](file:///workspace/backend/app/core/security.py)

| 函数 | 签名 | 说明 |
|------|------|------|
| `verify_password` | `(plain: str, hashed: str) → bool` | bcrypt 密码验证 |
| `get_password_hash` | `(password: str) → str` | bcrypt 密码哈希 |
| `create_access_token` | `(data: dict, expires_delta?: timedelta) → str` | 生成 JWT Token |
| `decode_access_token` | `(token: str) → Optional[dict]` | 解码 JWT Token |

#### [permissions.py](file:///workspace/backend/app/core/permissions.py)

| 函数 | 说明 | 返回 |
|------|------|------|
| `get_current_user` | 从 Bearer Token 解析当前用户 | `User \| None` |
| `require_user` | 必须登录，否则 401 | `User` |
| `require_member` | 必须是会员，否则 403 | `User` |
| `get_optional_user` | 可选认证，不抛异常 | `User \| None` |

#### [rate_limit.py](file:///workspace/backend/app/core/rate_limit.py)

基于 `slowapi` + Redis 的速率限制：

| 函数 | 默认限制 | 用途 |
|------|----------|------|
| `rate_limit_api` | 100 次/分钟 | 通用 API |
| `rate_limit_auth` | 10 次/分钟 | 认证接口 (防暴力破解) |
| `rate_limit_upload` | 20 次/分钟 | 文件上传 |
| `rate_limit_sketch` | 30 次/分钟 | 手绘识别 |

客户端标识优先使用 JWT `user_id`，回退到 IP 地址。

#### [free_limits.py](file:///workspace/backend/app/core/free_limits.py)

`FreeLimitConfig` 类定义免费用户限制（可通过环境变量配置）：

| 限制项 | 环境变量 | 默认值 |
|--------|----------|--------|
| 每月创建项目数 | `FREE_MONTHLY_PROJECTS` | 3 |
| 每月导出确认单数 | `FREE_MONTHLY_EXPORTS` | 3 |
| 纹理上传总数 | `FREE_TEXTURE_UPLOADS` | 5 |
| 每月手绘识别次数 | `FREE_SKETCH_RECOGNITIONS` | 5 |

关键函数：
- `check_free_project_limit`: 检查项目创建限制
- `check_free_export_limit`: 检查导出限制
- `check_free_texture_limit`: 检查纹理上传限制
- `get_user_usage_stats`: 获取用户使用统计

---

### 4.4 API 路由层

所有 API 遵循 RESTful 规范，Base URL: `/api/v1`

#### 认证模块 — `/api/v1/auth`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/auth/register` | POST | 用户注册 (手机号+密码) |
| `/auth/login` | POST | 用户登录，返回 JWT |

#### 用户模块 — `/api/v1/users`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/users/me` | GET | 获取当前用户信息 (含 is_member, store_profile) |

#### 纹理模块 — `/api/v1/textures`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/textures/upload` | POST | 上传纹理原图，自动抠图 |
| `/textures/` | GET | 获取我的纹理列表 |
| `/textures/{id}` | DELETE | 删除纹理 |

#### 产品模块 — `/api/v1/products`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/products/` | POST | 创建产品 |
| `/products/` | GET | 获取门店产品列表 |
| `/products/{id}/skus` | POST | 添加 SKU 规格 |
| `/products/{id}/skus/{sku_id}` | PUT | 修改 SKU 价格 |

#### 项目模块 — `/api/v1/projects`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/projects/` | POST | 创建项目 |
| `/projects/` | GET | 获取项目列表 |
| `/projects/{id}` | GET | 获取项目详情 |
| `/projects/{id}` | PUT | 更新项目 (户型、配置) |
| `/projects/{id}` | DELETE | 删除项目 |
| `/projects/{id}/calculate` | POST | 执行排版计算 |
| `/projects/{id}/layout` | GET | 获取最新排版结果 |

#### 订单模块 — `/api/v1/orders`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/orders/` | POST | 从项目创建订单 |
| `/orders/` | GET | 获取订单列表 |
| `/orders/{id}` | GET | 获取订单详情 |
| `/orders/{id}/confirm` | GET | 公开确认页 (Token 鉴权) |
| `/orders/{id}/confirm` | POST | 业主确认订单 |
| `/orders/{id}/status` | PUT | 更新订单状态 |

#### 确认单模块 — `/api/v1/confirmations`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/confirmations/` | POST | 生成确认单快照 |
| `/confirmations/{token}` | GET | 公开预览 (无需登录) |

#### 辅料计算模块 — `/api/v1/materials`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/materials/calculate` | POST | 计算辅料用量 |
| `/materials/reference` | GET | 获取辅料参考数据 |

#### 手绘识别模块 — `/api/v1/sketch`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/sketch/recognize` | POST | 上传手绘草图，返回识别结果 |

#### 门店信息模块 — `/api/v1/store`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/store/profile` | GET | 获取门店信息 |
| `/store/profile` | PUT | 更新门店信息 (需会员) |

#### 销售计算模块 — `/api/v1/sales`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/sales/quote` | POST | 生成完整报价单 |
| `/sales/optimize` | POST | 排版方案优化 |

#### 管理员模块 — `/api/v1/admin`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/users` | GET | 查看所有用户 |
| `/admin/stats` | GET | 系统统计数据 |

---

### 4.5 业务服务层

#### [layout_engine.py](file:///workspace/backend/app/services/layout_engine.py) — 核心排版引擎

**纯 Python 数学实现，零外部几何依赖**，使用 Sutherland-Hodgman 多边形裁剪算法。

核心数据结构：
- `Point(x, y)`: 二维点
- `Rect(x, y, w, h)`: 矩形，含 `corners()` 返回四顶点

核心算法函数：

| 函数 | 说明 |
|------|------|
| `clip_rect_by_polygon(rect, polygon)` | Sutherland-Hodgman 裁剪：将矩形用多边形裁剪 |
| `polygon_area(vertices)` | 鞋带公式计算多边形面积 |
| `polygon_bounds(polygon)` | 计算多边形包围盒 |
| `point_in_polygon(point, polygon)` | 射线法判断点是否在多边形内 |

`LayoutEngine` 类：

```python
LayoutEngine(
    room_polygon: List[List[float]],  # 房间顶点坐标 (mm)
    tile_width: float,                # 瓷砖宽度 (mm)
    tile_height: float,               # 瓷砖高度 (mm)
    gap_width: float = 0,             # 留缝宽度 (mm)
    direction: str = "horizontal",    # 铺贴方向
    start_point: Tuple = (0, 0),      # 起铺点
)
```

| 方法 | 说明 |
|------|------|
| `calculate_layout() → Dict` | 执行排版计算，返回 `{tiles, statistics}` |
| `optimize_layout() → Dict` | 尝试多个起铺点偏移，返回损耗最低的方案 |

顶层便捷函数：
```python
calculate_tile_layout(room_polygon, tile_width, tile_height, gap_width, direction, start_point, optimize) → Dict
```

**排版算法流程**：
1. 计算房间多边形包围盒
2. 根据瓷砖尺寸+留缝计算步长
3. 从起铺点开始，逐行逐列遍历候选砖位
4. 对每块候选砖，用 Sutherland-Hodgman 裁剪计算与房间的交集
5. 裁剪后面积 < 瓷砖面积 → 标记为切割砖 (`is_cut`)
6. 统计整砖/切割砖数量、损耗率、总面积

---

#### [auxiliary_material.py](file:///workspace/backend/app/services/auxiliary_material.py) — 辅料计算引擎

`AuxiliaryCalculator` 类，4 项核心辅料计算：

| 方法 | 说明 | 关键参数 |
|------|------|----------|
| `calc_adhesive(area, tile_w, tile_h, substrate_type)` | 瓷砖胶计算 | 基层类型系数 (smooth/normal/rough/uneven) |
| `calc_grout(area, tile_w, tile_h, gap_width, total_tiles)` | 美缝剂计算 | 缝宽、损耗系数 1.1 |
| `calc_cement_sand(area, thickness, mix_ratio)` | 水泥砂浆计算 | 配合比默认 1:3 |
| `calc_spacers(total_tiles, spacers_per_tile, pieces_per_bag)` | 十字卡计算 | 每片砖 5 个定位器 |

`calculate_all()` 整合方法：一次性计算所有辅料，支持 `adhesive`/`cement`/`both` 铺贴方式，可传入单价计算总费用。

**瓷砖胶系数体系**：
- 小砖 (≤300mm): 3.0 kg/m²
- 中砖 (300-600mm): 4.5 kg/m²
- 大砖 (600-1200mm): 6.0 kg/m²
- 超大砖 (>1200mm): 8.0 kg/m²
- 基层系数: smooth=1.0, normal=1.15, rough=1.35, uneven=1.6

---

#### [complete_quote.py](file:///workspace/backend/app/services/complete_quote.py) — 完整报价单

`CompleteQuoteGenerator` 整合所有报价项：

| 方法 | 说明 |
|------|------|
| `calc_waterproof(area, coats, usage_per_sq_m_kg)` | 防水涂料计算 |
| `calc_interface_agent(area, usage_per_sq_m_kg)` | 界面剂计算 |
| `generate_complete_quote(...)` | 生成完整报价单，包含：主砖、辅料、踢脚线、门头石、防水涂料、界面剂 |

返回 `CompleteQuote` 数据类，含 `items` 列表和各项费用小计。

---

#### [ppt_generator.py](file:///workspace/backend/app/services/ppt_generator.py) — PPT 确认单

```python
create_confirmation_ppt(
    project_data: Dict,           # 项目数据
    is_member: bool = False,      # 是否会员
    store_profile: Optional[Dict],# 门店信息
    layout_preview_image: Optional[bytes],  # 效果图
    materials: Optional[List[Dict]],        # 主砖材料
    auxiliary_materials: Optional[Dict],    # 辅料
    show_price: bool = True,      # 是否显示价格
    output_path: Optional[str],   # 输出路径
) → io.BytesIO
```

生成标准 5 页 16:9 PPT：
1. **封面** — 项目名称、面积、方案编号、日期；会员显示 Logo+店名，免费显示升级提示
2. **铺贴效果图** — 全屏排版渲染图
3. **材料明细** — 表格：品名/规格/数量/单位/单价/金额；会员+show_price 才显示价格列
4. **商家信息** — 会员显示门店详情，免费显示升级引导
5. **确认签字区** — 客户/设计师签字线

品牌色系：主色 `#1A365D`，强调色 `#D4A574`。

---

#### [pdf_generator.py](file:///workspace/backend/app/services/pdf_generator.py) — PDF 确认单

```python
create_confirmation_pdf(
    project_data, is_member, store_profile,
    layout_preview_image, materials, auxiliary_materials, show_price
) → io.BytesIO
```

基于 `reportlab` 生成 A4 格式 PDF，内容结构与 PPT 一致。自动检测系统 CJK 字体（微软雅黑/苹方/DroidSans）。

---

#### [sketch_recognition.py](file:///workspace/backend/app/services/sketch_recognition.py) — 手绘识别

`SketchRecognizer` 类，基于 OpenCV：

| 方法 | 说明 |
|------|------|
| `preprocess(image_bytes)` | 预处理：灰度→高斯模糊→OTSU 二值化→形态学闭/开运算 |
| `extract_contours(preprocessed, min_area_ratio)` | 提取外轮廓，按面积排序 |
| `simplify_polygon(contour, epsilon_factor, target_vertices)` | `approxPolyDP` 多边形简化，顺时针排序 |
| `fit_rectangle(points)` | `minAreaRect` 最小外接矩形拟合，返回置信度 |
| `detect_dimensions(preprocessed, original_shape)` | 检测尺寸标注区域 |
| `recognize(image_bytes, simplify, fit_to_rectangle)` | 完整识别流程，返回多边形列表和尺寸信息 |

---

#### [watermark.py](file:///workspace/backend/app/services/watermark.py) — 水印服务

| 函数 | 说明 |
|------|------|
| `add_image_watermark(image_bytes, text, upgrade_text, opacity)` | 为图片添加平铺水印 |
| `add_pdf_watermark(pdf_bytes, text)` | 为 PDF 添加水印 (当前为占位) |
| `should_add_watermark(is_member) → bool` | 免费用户返回 True |

水印文字：`排砖宝 TileLayout AI` + `升级会员去除水印`

---

#### [cutting_drawing.py](file:///workspace/backend/app/services/cutting_drawing.py) — 切割加工图

`CuttingDrawingGenerator` 类：

| 方法 | 说明 |
|------|------|
| `number_tiles(tiles, room_polygon)` | 为瓷砖编号：整砖 W1/W2...，切割砖 C1/C2... |
| `build_cut_list(tiles)` | 按尺寸分组统计切割砖 |
| `to_svg(tiles, room_polygon, w, h)` | 生成 SVG 矢量施工图 |

`generate_cutting_drawing_pdf()` 生成 A4 PDF，包含切割清单表和编号施工图。

---

#### [door_optimizer.py](file:///workspace/backend/app/services/door_optimizer.py) — 门洞优化

`DoorOptimizer` 类：

| 方法 | 说明 |
|------|------|
| `find_optimal_start_point(doors, tile_width)` | 寻找最优起铺点，使门洞不对缝 |
| `calculate_threshold_stone(door, material)` | 计算单个门头石 (长度=门宽+100mm) |
| `calculate_all_thresholds(doors, material)` | 计算所有门洞门头石 |

门头石材质价格：大理石 200 元/m，花岗岩 150 元/m，石英石 250 元/m，瓷砖 80 元/m。

---

#### [layout_optimizer.py](file:///workspace/backend/app/services/layout_optimizer.py) — 排版方案优化

`LayoutOptimizer` 类，支持 4 种铺贴方式：

| 铺贴方式 | 损耗率 | 美观评分 | 说明 |
|----------|--------|----------|------|
| 工字铺 | 5% | 7 | 最常见，性价比高 |
| 错缝铺 | 8% | 8 | 简约现代 |
| 人字铺 | 12% | 9 | 高档铺贴 |
| 菱形铺 | 15% | 10 | 最高档 |

`generate_plans()` 生成多种方案，按成本排序。`optimize_door_position()` 优化入户门位置避免对缝。

---

#### [skirting_calculator.py](file:///workspace/backend/app/services/skirting_calculator.py) — 踢脚线计算

`SkirtingCalculator` 类：

| 方法 | 说明 |
|------|------|
| `calculate_from_main_tile(perimeter, door_width, tile_w, tile_h, skirting_height, tile_price)` | 从主砖切割踢脚线 |
| `calculate_room_perimeter(vertices)` | 从顶点列表计算房间周长 |

默认踢脚线高度 80mm，损耗率 5%。

---

#### [wall_avoidance.py](file:///workspace/backend/app/services/wall_avoidance.py) — 通铺避让

`AutoAvoidWalls` 类，基于 Shapely：

| 方法 | 说明 |
|------|------|
| `generate_layout_with_avoidance(room, walls, pillars, door_gaps, tile_w, tile_h, start_point)` | 生成避让墙体/柱子/门洞的铺贴方案 |
| `optimize_start_point(...)` | 优化起铺点，减少切割砖数量 |

算法流程：用 Shapely `difference` 从房间多边形中减去障碍物，然后逐砖计算 `intersection` 判断整砖/切割砖。

---

## 5. 前端模块详解

### 5.1 应用入口与路由

#### [App.tsx](file:///workspace/packages/web/src/App.tsx)

主路由组件，14 条路由：

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | `Home` | 项目列表首页 |
| `/login` | `LoginPage` | 登录页 |
| `/register` | `RegisterPage` | 注册页 |
| `/project/new` | `ProjectEdit` | 新建项目 |
| `/project/:id` | `ProjectEdit` | 编辑项目 |
| `/project/preview` | `LayoutPreview` | 排版预览 |
| `/confirmation` | `ConfirmationPreview` | 确认单预览 |
| `/textures` | `TextureLibrary` | 纹理库 |
| `/products` | `ProductManager` | 产品管理 |
| `/store/profile` | `StoreProfilePage` | 门店信息 |
| `/orders` | `OrderListPage` | 订单列表 |
| `/orders/:id` | `OrderDetailPage` | 订单详情 |
| `/upgrade` | `UpgradePage` | 升级会员 |
| `/user/profile` | `UserProfilePage` | 用户资料 |

初始化逻辑：从 `localStorage` 读取 token，自动调用 `/users/me` 恢复用户状态。

#### [main.tsx](file:///workspace/packages/web/src/main.tsx)

React 入口，使用 `BrowserRouter` 包裹，配置 Ant Design 中文国际化。

---

### 5.2 状态管理

#### [store/index.ts](file:///workspace/packages/web/src/store/index.ts) — `useAppStore`

基于 Zustand 的全局状态，使用 `persist` + `devtools` 中间件：

**状态 (AppState)**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `user` | `User \| null` | 当前登录用户 |
| `currentProject` | `Project \| null` | 当前编辑项目 |
| `projects` | `Project[]` | 项目列表 |
| `textures` | `Texture[]` | 纹理列表 |
| `products` | `Product[]` | 产品列表 |
| `orders` | `Order[]` | 订单列表 |
| `isLoading` | `boolean` | 全局加载状态 |
| `error` | `string \| null` | 全局错误信息 |

**持久化策略**：仅持久化 `projects` 和 `currentProject` 到 `localStorage`（key: `tilelayout-storage`）。

---

### 5.3 API 服务层

#### [api.ts](file:///workspace/packages/web/src/services/api.ts) — `ApiService`

统一的 HTTP 客户端封装：

| 方法 | 说明 |
|------|------|
| `get<T>(url)` | GET 请求 |
| `post<T>(url, data)` | POST 请求 (JSON) |
| `put<T>(url, data)` | PUT 请求 (JSON) |
| `delete<T>(url)` | DELETE 请求 |
| `upload<T>(endpoint, file)` | 文件上传 (FormData, 30s 超时) |
| `downloadBlob(endpoint)` | 下载文件 (返回 Blob) |
| `setToken(t)` / `getToken()` | JWT Token 管理 |

- 基础路径：`/api/v1`
- 默认超时：15 秒
- 自动携带 `Authorization: Bearer <token>` 头
- 统一错误处理：`ApiError` 类含 `statusCode` 和 `message`

便捷函数：
- `fetchProjects()` / `createProject(data)` / `deleteProjectApi(id)`
- `calculateLayout(projectId, payload)`
- `sendSketch(file)` / `calcAuxiliaryMaterials(data)` / `getMaterialsReference()`

---

### 5.4 类型系统

#### [types/index.ts](file:///workspace/packages/web/src/types/index.ts)

完整的 TypeScript 类型定义，与后端模型一一对应：

| 接口 | 对应后端模型 | 说明 |
|------|-------------|------|
| `User` | `User` | 含 `isMember`, `memberUntil`, `storeProfile` |
| `StoreProfile` | `StoreProfile` | 门店信息 |
| `Texture` | `Texture` | 纹理，含 `originalImageUrl`, `processedImageUrl` |
| `Product` | `Product` | 产品，含 `skus: ProductSKU[]` |
| `ProductSKU` | `ProductSKU` | 规格，含 `unitPrice`, `stock` |
| `Project` | `Project` | 项目，含 `roomPolygon`, `tileConfig`, `showPrice` |
| `TileConfig` | — | 瓷砖配置：尺寸、留缝、方向、起铺点 |
| `LayoutResult` | `LayoutResult` | 排版结果，含 `tiles: Tile[]`, `statistics` |
| `Tile` | — | 单块砖：坐标、尺寸、旋转、是否切割 |
| `LayoutStatistics` | — | 统计：总砖数、整砖、切割砖、损耗率 |
| `Order` | `Order` | 订单，含 `showTotalPrice`, `confirmToken` |
| `OrderItem` | `OrderItem` | 订单明细 |
| `ConfirmationData` | — | 确认单数据 |
| `ApiResponse<T>` | — | 统一 API 响应包装 |

---

### 5.5 页面组件

| 页面 | 文件 | 功能 |
|------|------|------|
| 首页 | `Home.tsx` | 项目列表，创建/删除项目入口 |
| 登录 | `LoginPage.tsx` | 手机号+密码登录 |
| 注册 | `RegisterPage.tsx` | 手机号+密码注册 |
| 项目编辑 | `ProjectEdit.tsx` | 户型多边形编辑器，手绘上传，瓷砖配置 |
| 排版预览 | `LayoutPreview.tsx` | 排版结果可视化，辅料计算，确认单生成 |
| 确认单预览 | `ConfirmationPreview.tsx` | 5 页卡片式确认单，会员/免费差异渲染 |
| 纹理库 | `TextureLibrary.tsx` | 纹理上传、管理、抠图 |
| 产品管理 | `ProductManager.tsx` | 产品与 SKU CRUD |
| 门店信息 | `StoreProfilePage.tsx` | 门店 Logo/名称/电话/地址编辑 |
| 订单列表 | `OrderListPage.tsx` | 订单列表与状态流转 |
| 订单详情 | `OrderDetailPage.tsx` | 订单详情与确认 |
| 升级会员 | `UpgradePage.tsx` | 会员方案介绍与升级引导 |
| 联系我们 | `ContactPage.tsx` | 联系方式 |
| 用户资料 | `UserProfilePage.tsx` | 个人信息与会员状态 |

---

### 5.6 共享组件

| 组件 | 路径 | 功能 |
|------|------|------|
| `RoomEditor` | `shared/components/RoomEditor/` | Canvas 多边形户型编辑器，支持顶点拖拽/添加/删除，边长标注，水平/垂直吸附 |
| `ProRoomEditor` | `shared/components/RoomEditor/` | RoomEditor 增强版 |
| `LayoutRenderer` | `shared/components/LayoutRenderer/` | 排版图渲染器，整砖/切割砖分区显示 |
| `DoorManager` | `web/components/DoorManager.tsx` | 门洞管理组件 |
| `LayoutPlanComparison` | `web/components/LayoutPlanComparison.tsx` | 多方案对比组件 |
| `Logo` | `web/components/Logo.tsx` | 品牌 Logo 组件 |
| `SkirtingCalculator` | `web/components/SkirtingCalculator.tsx` | 踢脚线计算组件 |

---

## 6. 核心算法详解

### 6.1 排版计算算法 (Sutherland-Hodgman)

这是整个系统的核心算法，保证排版 100% 精准。

**输入**：
- 房间多边形顶点列表 `[[x1,y1], [x2,y2], ...]` (单位: mm)
- 瓷砖尺寸 (宽×高)、留缝宽度、铺贴方向、起铺点

**算法步骤**：

```
1. 计算房间包围盒 (min_x, min_y, max_x, max_y)
2. 计算步长 = 瓷砖尺寸 + 留缝宽度
3. 从起铺点开始，按行列遍历候选砖位:
   for row in range(-1, rows+1):
     for col in range(-1, cols+1):
       x = start_x + col * step_x
       y = start_y + row * step_y
4. 对每块候选砖:
   a. 构造矩形 Rect(x, y, tile_w, tile_h)
   b. 用 Sutherland-Hodgman 裁剪: 将矩形用房间多边形裁剪
   c. 若裁剪结果面积 < 0.001 → 跳过 (不在房间内)
   d. 若裁剪面积 ≈ 瓷砖面积 → 整砖 (is_cut=False)
   e. 若裁剪面积 < 瓷砖面积 → 切割砖 (is_cut=True)
5. 统计: 整砖数、切割砖数、损耗率、总面积
```

**Sutherland-Hodgman 裁剪核心**：
```python
def clip_rect_by_polygon(rect, polygon):
    result = rect.corners()  # 矩形四顶点
    for i in range(len(polygon)):
        edge_start = polygon[i]
        edge_end = polygon[(i+1) % len(polygon)]
        result = _clip_polygon_by_edge(result, edge_start, edge_end)
    return result  # 裁剪后的多边形顶点
```

**优化模式** (`optimize_layout`)：尝试 4 种起铺点偏移 (半砖偏移、1/4 偏移等)，选择损耗率最低的方案。

### 6.2 辅料计算算法

**瓷砖胶**：
```
用量 = 面积(m²) × 基础系数(kg/m²) × 基层系数
包数 = ceil(总用量 / 25kg)
```

**美缝剂**：
```
砖缝总长 = (行数-1)×砖宽×列数 + (列数-1)×砖高×行数
每支覆盖 = 参考值 × (2.0 / 缝宽)  // 缝宽越大覆盖越少
支数 = ceil(缝总长 / 每支覆盖 × 损耗系数1.1)
```

**水泥砂浆** (1:3 配合比)：
```
总体积 = 面积 × 厚度(0.03m)
水泥 = 总体积 × (1/4) × 1500 kg/m³
砂子 = 总体积 × (3/4) × 1600 kg/m³
```

**十字卡**：
```
总个数 = 砖数 × 每片5个
包数 = ceil(总个数 / 200)
```

### 6.3 手绘识别算法

```
1. 预处理: 灰度 → 高斯模糊 → OTSU 二值化 → 形态学闭/开运算
2. 轮廓提取: findContours(RETR_EXTERNAL) → 按面积排序
3. 多边形简化: approxPolyDP (逐步增大 epsilon 直到顶点数 ≤ 目标数)
4. 顺时针排序: 以质心为参考，按极角排序
5. 矩形拟合: minAreaRect → 计算置信度
6. 尺寸检测: 筛选面积比 0.1%-5%、长宽比 0.3-8 的区域
```

---

## 7. 依赖关系图

### 7.1 后端服务依赖

```
API 路由层
  ├── projects.py ──→ layout_engine.py (排版计算)
  │                 ──→ auxiliary_material.py (辅料计算)
  │                 ──→ sketch_recognition.py (手绘识别)
  │                 ──→ free_limits.py (次数限制)
  ├── confirmation.py ──→ ppt_generator.py (PPT 生成)
  │                    ──→ pdf_generator.py (PDF 生成)
  │                    ──→ watermark.py (水印)
  ├── materials.py ──→ auxiliary_material.py
  ├── sales.py ──→ complete_quote.py (完整报价)
  │             ──→ auxiliary_material.py
  │             ──→ skirting_calculator.py
  │             ──→ door_optimizer.py
  │             ──→ layout_optimizer.py
  ├── orders.py ──→ permissions.py (会员校验)
  ├── products.py ──→ permissions.py
  ├── store.py ──→ permissions.py
  └── 所有路由 ──→ database.py (数据库会话)
                ──→ security.py (JWT 认证)
                ──→ rate_limit.py (速率限制)

complete_quote.py ──→ auxiliary_material.py
                  ──→ skirting_calculator.py
                  ──→ door_optimizer.py
```

### 7.2 前端模块依赖

```
App.tsx
  ├── pages/* (14 个页面组件)
  │     └── services/api.ts (API 调用)
  │     └── store/index.ts (状态管理)
  │     └── types/index.ts (类型定义)
  ├── services/api.ts ──→ types/index.ts
  └── store/index.ts ──→ types/index.ts

shared/components/RoomEditor ──→ types/index.ts
shared/components/LayoutRenderer ──→ types/index.ts
shared/pages/* ──→ shared/services/index.ts
               ──→ shared/store/index.ts
               ──→ shared/types/index.ts
```

### 7.3 Python 包依赖

```
fastapi + uvicorn          # Web 框架与服务器
sqlalchemy[asyncio]        # 异步 ORM
asyncpg                    # PostgreSQL 异步驱动
alembic                    # 数据库迁移
pydantic + pydantic-settings  # 数据验证与配置
python-jose[cryptography]  # JWT
passlib[bcrypt]            # 密码哈希
python-pptx                # PPT 生成
reportlab                  # PDF 生成
Pillow                     # 图像处理
numpy                      # 数值计算
opencv-python-headless     # 计算机视觉 (可选)
redis                      # 缓存
minio                      # 对象存储
slowapi                    # 速率限制
httpx                      # HTTP 客户端
```

### 7.4 前端包依赖

```
react + react-dom          # UI 框架
react-router-dom           # 路由
antd                       # UI 组件库
zustand                    # 状态管理
konva + react-konva        # Canvas 渲染
dayjs                      # 日期处理
vite + vite-plugin-pwa     # 构建工具与 PWA
typescript                 # 类型系统
```

---

## 8. 部署架构

### 8.1 Docker Compose 服务编排

```
┌─ nginx:1.25-alpine ─────────────────────────┐
│  端口: 80/443                                │
│  SSL 终止 · 反向代理 → backend:8000          │
│  静态资源服务 · 安全头                        │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  FastAPI Backend (Python 3.11)              │
│  端口: 8000 (内部)                           │
│  依赖: postgres, redis                       │
└──────┬──────────────────┬───────────────────┘
       │                  │
┌──────▼──────┐   ┌──────▼──────┐
│ PostgreSQL  │   │   Redis     │
│ 16-alpine   │   │  7-alpine   │
│ 端口: 5432  │   │ 端口: 6379  │
│ 持久卷:pgdata│   │ 持久卷:redis│
└─────────────┘   └─────────────┘
```

### 8.2 Nginx 配置要点

- HTTP → HTTPS 强制跳转
- `/api/` 代理到 `backend:8000`
- `/uploads/` 静态文件服务
- 安全头: `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`
- Gzip 压缩
- 健康检查端点

### 8.3 数据卷

| 卷名 | 挂载点 | 用途 |
|------|--------|------|
| `pgdata` | `/var/lib/postgresql/data` | PostgreSQL 数据 |
| `redisdata` | `/data` | Redis 持久化 |
| `uploads` | `/app/uploads` | 用户上传文件 |

---

## 9. 项目运行方式

### 9.1 开发环境

**前置条件**：Node.js ≥ 18, Python ≥ 3.11, pnpm ≥ 8

```bash
# 1. 安装前端依赖
pnpm install

# 2. 安装后端依赖
cd backend
pip install -r requirements.txt

# 3. 初始化数据库 (SQLite 开发模式)
python init_db.py

# 4. 启动后端 (端口 8000)
uvicorn main:app --reload --port 8000

# 5. 启动前端 (端口 3000，自动代理 /api → 8000)
cd packages/web
pnpm dev
```

或使用启动脚本：
```bash
./start.sh    # Linux/Mac
start.bat     # Windows
```

### 9.2 生产部署 (Docker)

```bash
# 1. 配置环境变量
cp .env.example .env.production
# 编辑 .env.production 填入真实密码和密钥

# 2. 构建并启动
docker-compose --env-file .env.production up -d --build

# 3. 运行数据库迁移
docker-compose exec backend alembic upgrade head

# 4. 验证
curl https://api.paizhuanbao.com/health
```

### 9.3 数据库迁移

```bash
# 创建新迁移
cd backend
alembic revision --autogenerate -m "描述"

# 执行迁移
alembic upgrade head

# 回滚
alembic downgrade -1
```

### 9.4 测试

```bash
# 后端单元测试
cd backend
pytest tests/ -v

# 排版引擎专项测试
pytest tests/test_layout_engine.py -v

# API 集成测试
pytest tests/test_api.py -v
```

---

## 10. 免费/会员权限体系

权限控制在三层实现：

### 10.1 后端强制校验 (安全层)

| 校验点 | 实现方式 | 免费用户 | 会员 |
|--------|----------|----------|------|
| 价格输入 | `require_member` 中间件 | 403 拒绝 | 允许 |
| 门店信息编辑 | `require_member` 中间件 | 403 拒绝 | 允许 |
| PPT 商家信息 | `ppt_generator` 内部检查 | 显示升级提示 | 显示真实信息 |
| PPT 价格列 | `show_price && is_member` | 隐藏 | 可选显示 |
| 水印 | `should_add_watermark()` | 添加水印 | 无水印 |
| 次数限制 | `free_limits.py` 检查 | 月度限制 | 无限制 |

### 10.2 前端条件渲染 (体验层)

- `PriceInput` 组件：非会员禁用并提示升级
- `ConfirmationPreview`：根据 `isMember` 条件渲染商家信息
- `UpgradePrompt`：免费用户功能受限时显示升级引导

### 10.3 限制配置

所有免费限制通过环境变量可配置：

```bash
FREE_MONTHLY_PROJECTS=3       # 每月创建项目数
FREE_MONTHLY_EXPORTS=3        # 每月导出确认单数
FREE_TEXTURE_UPLOADS=5         # 纹理上传总数
FREE_SKETCH_RECOGNITIONS=5     # 每月手绘识别次数
```

---

> 本文档由项目代码自动分析生成，最后更新于 2026-05-08。
