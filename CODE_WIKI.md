# 排砖宝 (TileLayout AI) — Code Wiki

> 版本: v2.0 | 更新日期: 2026-05-08
> 产品定位: 为瓷砖门店和设计师提供"拍照手绘户型→精准排版→真实纹理渲染→下单确认→加工施工图"全链路轻量工具

---

## 目录

1. [项目整体架构](#1-项目整体架构)
2. [目录结构总览](#2-目录结构总览)
3. [后端模块详解](#3-后端模块详解)
   - 3.1 [应用入口与配置](#31-应用入口与配置)
   - 3.2 [数据模型 (ORM)](#32-数据模型-orm)
   - 3.3 [核心算法服务](#33-核心算法服务)
   - 3.4 [API 路由层](#34-api-路由层)
   - 3.5 [权限与安全](#35-权限与安全)
4. [前端模块详解](#4-前端模块详解)
   - 4.1 [Monorepo 结构](#41-monorepo-结构)
   - 4.2 [Web 应用 (packages/web)](#42-web-应用-packagesweb)
   - 4.3 [共享包 (packages/shared)](#43-共享包-packagesshared)
   - 4.4 [状态管理](#44-状态管理)
   - 4.5 [API 调用层](#45-api-调用层)
   - 4.6 [类型系统](#46-类型系统)
5. [核心业务流程](#5-核心业务流程)
6. [依赖关系图](#6-依赖关系图)
7. [项目运行方式](#7-项目运行方式)
8. [部署架构](#8-部署架构)
9. [免费/会员权限体系](#9-免费会员权限体系)

---

## 1. 项目整体架构

```
┌──────────────────────────────────────────────────────┐
│              前端 Monorepo (React + TypeScript)        │
│                                                        │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Web PWA  │  │ Mobile       │  │ Desktop (Tauri)│  │
│  │ (Vite)   │  │ (Capacitor)  │  │                │  │
│  └────┬─────┘  └──────┬───────┘  └───────┬────────┘  │
│       └────────────────┴──────────────────┘           │
│            共享业务层 (packages/shared)                 │
│  • 排版预览 • 确认单预览 • 状态管理 • API 封装        │
└────────────────────────┬──────────────────────────────┘
                         │ REST API (HTTPS)
┌────────────────────────▼──────────────────────────────┐
│               后端 (Python FastAPI)                     │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────┐ │
│  │ 排版引擎      │ │ PPT/PDF 生成  │ │ 图像处理      │ │
│  │ (纯Python)   │ │ (python-pptx) │ │ (rembg/PIL)   │ │
│  └──────────────┘ └──────────────┘ └───────────────┘ │
│  ┌──────────────────────────────────────────────────┐ │
│  │         认证 / 订单 / 产品库 / 门店 / 辅料       │ │
│  └──────────────────────────────────────────────────┘ │
│              PostgreSQL + Redis + 对象存储             │
└──────────────────────────────────────────────────────┘
```

**关键设计原则**:
- 前端轻量重交互，后端重计算与文件生成
- 核心几何算法纯 Python 实现，不依赖 AI 随机性
- 平台差异通过接口适配器隔离，共享代码 >95%
- 价格/商家信息权限由后端强制校验

---

## 2. 目录结构总览

```
/workspace/
├── backend/                    # Python FastAPI 后端
│   ├── main.py                 # 应用入口
│   ├── requirements.txt        # Python 依赖
│   ├── Dockerfile              # 后端容器构建
│   ├── alembic.ini             # 数据库迁移配置
│   ├── alembic/                # Alembic 迁移脚本
│   │   └── versions/
│   │       └── 0001_initial_schema.py
│   ├── app/
│   │   ├── api/                # API 路由层 (12个模块)
│   │   │   ├── auth.py         # 认证 (注册/登录)
│   │   │   ├── users.py        # 用户信息
│   │   │   ├── projects.py     # 项目 CRUD + 排版计算 + 导出
│   │   │   ├── textures.py     # 纹理上传/抠图/管理
│   │   │   ├── products.py     # 产品与 SKU 管理
│   │   │   ├── orders.py       # 订单创建/查询/状态
│   │   │   ├── confirmation.py # 确认单生成/公开预览
│   │   │   ├── sketch.py       # 手绘识别
│   │   │   ├── materials.py    # 辅料计算
│   │   │   ├── store.py        # 门店信息管理
│   │   │   ├── admin.py        # 管理员控制台
│   │   │   └── sales.py        # 销售计算 (踢脚线/门头石/报价)
│   │   ├── core/               # 核心基础设施
│   │   │   ├── config.py       # 配置 (pydantic-settings)
│   │   │   ├── database.py     # 数据库连接 (SQLAlchemy async)
│   │   │   ├── security.py     # JWT + 密码哈希
│   │   │   ├── permissions.py  # 权限依赖 (get_current_user/require_member)
│   │   │   ├── rate_limit.py   # API 频率限制 (slowapi)
│   │   │   └── free_limits.py  # 免费用户次数限制
│   │   ├── models/             # SQLAlchemy ORM 模型
│   │   │   └── models.py       # 全部数据表定义
│   │   └── services/           # 业务逻辑服务层 (12个模块)
│   │       ├── layout_engine.py        # ★ 排版计算引擎
│   │       ├── auxiliary_material.py   # ★ 辅料计算引擎
│   │       ├── complete_quote.py       # 完整报价单生成
│   │       ├── ppt_generator.py        # PPT 确认单生成
│   │       ├── pdf_generator.py        # PDF 确认单生成
│   │       ├── cutting_drawing.py      # 加工施工图生成
│   │       ├── sketch_recognition.py   # 手绘识别 (OpenCV)
│   │       ├── layout_optimizer.py     # 智能排版优化
│   │       ├── door_optimizer.py       # 门洞优化/门头石
│   │       ├── skirting_calculator.py  # 踢脚线计算
│   │       ├── wall_avoidance.py       # 通铺避让 (Shapely)
│   │       └── watermark.py            # 水印服务
│   └── tests/                  # 测试
│       ├── test_layout_engine.py
│       ├── test_api.py
│       └── e2e_test.py
│
├── packages/                   # 前端 Monorepo
│   ├── web/                    # Web PWA 应用 (主入口)
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx         # 路由定义
│   │       ├── main.tsx        # 入口
│   │       ├── index.css
│   │       ├── pages/          # 14 个页面组件
│   │       │   ├── Home.tsx
│   │       │   ├── ProjectEdit.tsx
│   │       │   ├── LayoutPreview.tsx
│   │       │   ├── ConfirmationPreview.tsx
│   │       │   ├── LoginPage.tsx / RegisterPage.tsx
│   │       │   ├── TextureLibrary.tsx
│   │       │   ├── ProductManager.tsx
│   │       │   ├── StoreProfilePage.tsx
│   │       │   ├── OrderListPage.tsx / OrderDetailPage.tsx
│   │       │   ├── UpgradePage.tsx
│   │       │   ├── ContactPage.tsx
│   │       │   └── UserProfilePage.tsx
│   │       ├── components/     # 业务组件
│   │       │   ├── DoorManager.tsx
│   │       │   ├── LayoutPlanComparison.tsx
│   │       │   ├── Logo.tsx
│   │       │   └── SkirtingCalculator.tsx
│   │       ├── services/
│   │       │   └── api.ts      # API 调用封装
│   │       ├── store/
│   │       │   └── index.ts    # Zustand 状态管理
│   │       └── types/
│   │           └── index.ts    # TypeScript 类型定义
│   │
│   ├── shared/                 # 跨端共享包
│   │   ├── package.json
│   │   └── src/
│   │       ├── components/
│   │       │   ├── RoomEditor/         # 多边形编辑器
│   │       │   │   ├── RoomEditor.tsx
│   │       │   │   ├── ProRoomEditor.tsx
│   │       │   │   └── ErrorBoundary.tsx
│   │       │   └── LayoutRenderer/     # 排版图渲染
│   │       │       └── LayoutRenderer.tsx
│   │       ├── pages/          # 共享页面 (11个)
│   │       ├── hooks/          # 自定义 Hooks
│   │       │   ├── useAsync.ts
│   │       │   └── index.ts
│   │       ├── services/       # API 调用封装
│   │       ├── store/          # Zustand Store
│   │       └── types/          # 类型定义
│   │
│   ├── mobile/                 # 移动端 (Capacitor)
│   │   ├── capacitor.config.ts
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── desktop/                # 桌面端 (Tauri)
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
│
├── docker-compose.yml          # 生产环境容器编排
├── nginx.conf                  # Nginx 反向代理配置
├── .env.example                # 环境变量模板
├── .env.production             # 生产环境变量
├── pnpm-workspace.yaml         # pnpm Monorepo 配置
├── turbo.json                  # Turborepo 配置
├── package.json                # 根 package.json
└── tsconfig.json               # 根 TypeScript 配置
```

---

## 3. 后端模块详解

### 3.1 应用入口与配置

#### [main.py](file:///workspace/backend/main.py)

FastAPI 应用入口，负责：
- 创建 FastAPI 实例，配置 CORS、静态文件挂载
- 初始化 API 频率限制器 (slowapi)
- 注册 12 个 API 路由模块，统一前缀 `/api/v1`
- 健康检查端点 `/health`

```python
app = FastAPI(title="排砖宝 API", version="0.1.0")
app.include_router(auth.router, prefix="/api/v1/auth", tags=["认证"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["项目"])
# ... 共 12 个路由模块
```

#### [config.py](file:///workspace/backend/app/core/config.py) — `Settings`

使用 `pydantic-settings` 的 `BaseSettings`，从环境变量 / `.env` 文件读取配置：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./tilelayout.db` | 数据库连接串 (支持 PostgreSQL) |
| `SECRET_KEY` | 自动生成 | JWT 签名密钥 |
| `ALGORITHM` | `HS256` | JWT 算法 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` (7天) | Token 过期时间 |
| `CORS_ORIGINS` | `["http://localhost:3000", ...]` | 允许的前端域名 |
| `UPLOAD_DIR` | `uploads` | 文件上传目录 |
| `MAX_UPLOAD_SIZE` | `10MB` | 上传文件大小限制 |

#### [database.py](file:///workspace/backend/app/core/database.py)

SQLAlchemy 异步引擎 + 会话管理：
- `create_async_engine` 创建异步引擎 (支持 SQLite / PostgreSQL)
- `AsyncSessionLocal` 异步会话工厂
- `get_db()` 依赖注入：自动 commit / rollback / close

### 3.2 数据模型 (ORM)

#### [models.py](file:///workspace/backend/app/models/models.py)

所有数据表定义，共 8 个模型：

```
User ──1:1── StoreProfile ──1:N── Product ──1:N── ProductSKU
  │                              │
  ├──1:N── Texture               └── N:1 ── Texture
  ├──1:N── Project ──1:N── LayoutResult
  │           │
  │           └──1:N── Order ──1:N── OrderItem
  └──1:N── Order
```

**核心模型说明**:

| 模型 | 表名 | 关键字段 | 说明 |
|------|------|----------|------|
| `User` | `users` | `phone`, `is_member`, `member_until` | 用户，会员状态控制权限 |
| `StoreProfile` | `store_profiles` | `store_name`, `logo_url`, `phone`, `address` | 门店信息 (会员专属) |
| `Texture` | `textures` | `original_image_url`, `processed_image_url`, `width_mm` | 纹理，支持抠图处理 |
| `Product` | `products` | `name`, `image_url`, `texture_id` | 产品，关联纹理 |
| `ProductSKU` | `product_skus` | `size_x_mm`, `size_y_mm`, `unit_price` | 产品规格与单价 |
| `Project` | `projects` | `room_polygon`, `tile_config`, `show_price`, `components` | 排版项目 |
| `LayoutResult` | `layout_results` | `tiles`, `statistics`, `preview_image_url` | 排版计算结果 |
| `Order` | `orders` | `total_amount`, `show_total_price`, `confirm_token` | 订单 |
| `OrderItem` | `order_items` | `quantity_whole`, `quantity_cut`, `price_per_piece` | 订单明细 |

**跨数据库兼容**: `GUID` 类型装饰器自动适配 PostgreSQL 的 `UUID` 类型和 SQLite 的 `CHAR(32)`。

### 3.3 核心算法服务

#### ★ [layout_engine.py](file:///workspace/backend/app/services/layout_engine.py) — 排版计算引擎

纯 Python 数学实现，零外部几何依赖。核心算法：

| 函数/类 | 说明 |
|---------|------|
| `Point` | 二维点数据类 |
| `Rect` | 矩形数据类，含 `corners()` 获取四角坐标 |
| `clip_rect_by_polygon()` | **Sutherland-Hodgman 裁剪算法** — 将矩形用多边形裁剪，得到实际铺贴区域 |
| `polygon_area()` | **鞋带公式** — 计算多边形面积 |
| `point_in_polygon()` | **射线法** — 判断点是否在多边形内 |
| `LayoutEngine` | 排版引擎主类 |
| `LayoutEngine.calculate_layout()` | 执行排版计算，返回砖块列表和统计信息 |
| `LayoutEngine.optimize_layout()` | 优化排版，尝试 4 种偏移量取最优 |
| `calculate_tile_layout()` | 顶层函数，创建引擎并执行计算 |

**排版计算流程**:
1. 根据起铺点和砖规格生成网格
2. 对每块砖用 Sutherland-Hodgman 算法裁剪到房间多边形内
3. 计算裁剪后面积判断整砖/切割砖
4. 统计总砖数、整砖数、切割砖数、损耗率

#### ★ [auxiliary_material.py](file:///workspace/backend/app/services/auxiliary_material.py) — 辅料计算引擎

| 类/方法 | 说明 |
|---------|------|
| `AuxiliaryCalculator.calc_adhesive()` | 瓷砖胶计算 — 按砖规格选择系数 × 基层系数 × 面积 |
| `AuxiliaryCalculator.calc_grout()` | 美缝剂计算 — 砖缝总长 ÷ 每支覆盖长度 × 损耗系数 |
| `AuxiliaryCalculator.calc_cement_sand()` | 水泥砂浆计算 — 体积 × 配合比 × 密度 |
| `AuxiliaryCalculator.calc_spacers()` | 十字卡计算 — 砖数 × 每片用量 ÷ 每包数量 |
| `AuxiliaryCalculator.calculate_all()` | 一键计算全部辅料，含价格汇总 |

**瓷砖胶系数表**:

| 砖规格 | 基础用量 (kg/m²) | 铺贴方式 |
|--------|-------------------|----------|
| ≤300mm | 3.0 | 薄贴法 |
| 300-600mm | 4.5 | 组合法 |
| 600-1200mm | 6.0 | 厚贴法 |
| >1200mm | 8.0 | 重型齿刀 |

**基层系数**: smooth=1.0, normal=1.15, rough=1.35, uneven=1.6

#### [complete_quote.py](file:///workspace/backend/app/services/complete_quote.py) — 完整报价单生成器

整合主砖 + 踢脚线 + 门头石 + 辅料 + 防水涂料 + 界面剂，生成 `CompleteQuote` 对象。

| 类/方法 | 说明 |
|---------|------|
| `CompleteQuoteGenerator.generate_complete_quote()` | 生成完整报价单 |
| `CompleteQuoteGenerator.calc_waterproof()` | 防水涂料计算 |
| `CompleteQuoteGenerator.calc_interface_agent()` | 界面剂计算 |

#### [ppt_generator.py](file:///workspace/backend/app/services/ppt_generator.py) — PPT 确认单生成

生成标准 5 页 16:9 PPT 确认单：

| 页码 | 内容 | 权限控制 |
|------|------|----------|
| 1 | 封面 (项目名/面积/编号/商家Logo) | 免费版显示升级提示 |
| 2 | 铺贴效果图 | 全部可见 |
| 3 | 材料明细表格 (6列/4列) | 价格列仅会员+show_price时显示 |
| 4 | 商家联系信息 | 免费版显示升级引导 |
| 5 | 客户确认签字区 | 全部可见 |

**品牌色系**: 主色 `#1A365D` (深蓝), 辅色 `#D4A574` (金棕)

#### [pdf_generator.py](file:///workspace/backend/app/services/pdf_generator.py) — PDF 确认单生成

基于 reportlab，结构与 PPT 一致。自动注册 CJK 字体 (微软雅黑/苹方/DroidSans)。

#### [cutting_drawing.py](file:///workspace/backend/app/services/cutting_drawing.py) — 加工施工图

| 类/方法 | 说明 |
|---------|------|
| `CuttingDrawingGenerator.number_tiles()` | 为砖块编号 (W1/W2...整砖, C1/C2...切割砖) |
| `CuttingDrawingGenerator.build_cut_list()` | 按尺寸分组切割砖清单 |
| `CuttingDrawingGenerator.to_svg()` | 生成编号施工图 SVG |
| `generate_cutting_drawing_pdf()` | 生成加工单 PDF |

#### [sketch_recognition.py](file:///workspace/backend/app/services/sketch_recognition.py) — 手绘识别

| 类/方法 | 说明 |
|---------|------|
| `SketchRecognizer.preprocess()` | 图片预处理 (灰度→高斯模糊→OTSU二值化→形态学) |
| `SketchRecognizer.extract_contours()` | 轮廓提取 (cv2.findContours) |
| `SketchRecognizer.simplify_polygon()` | 多边形简化 (approxPolyDP) |
| `SketchRecognizer.fit_rectangle()` | 最小外接矩形拟合 |
| `SketchRecognizer.recognize()` | 完整识别流程 |

#### [layout_optimizer.py](file:///workspace/backend/app/services/layout_optimizer.py) — 智能排版优化

生成多种铺贴方案 (工字铺/错缝铺/人字铺/菱形铺)，按成本排序。

#### [door_optimizer.py](file:///workspace/backend/app/services/door_optimizer.py) — 门洞优化

| 类/方法 | 说明 |
|---------|------|
| `DoorOptimizer.find_optimal_start_point()` | 寻找最优起铺点，避免门洞对缝 |
| `DoorOptimizer.calculate_threshold_stone()` | 计算门头石 (大理石/花岗岩/石英石/瓷砖) |

#### [skirting_calculator.py](file:///workspace/backend/app/services/skirting_calculator.py) — 踢脚线计算

从主砖切割踢脚线，计算用量和成本。

#### [wall_avoidance.py](file:///workspace/backend/app/services/wall_avoidance.py) — 通铺避让

基于 Shapely 的多边形裁剪和碰撞检测，处理墙体、柱子、门洞等障碍物。

#### [watermark.py](file:///workspace/backend/app/services/watermark.py) — 水印服务

免费版导出图片添加"排砖宝 TileLayout AI"水印，会员版不添加。

### 3.4 API 路由层

所有 API 遵循 RESTful 规范，基础路径 `/api/v1`，返回统一格式 `{ success: bool, data: T }`。

#### 认证模块 — [auth.py](file:///workspace/backend/app/api/auth.py)

| 端点 | 方法 | 说明 | 频率限制 |
|------|------|------|----------|
| `/auth/register` | POST | 手机号注册，返回 JWT | 10/min |
| `/auth/login` | POST | 手机号登录，返回 JWT | 10/min |

#### 项目模块 — [projects.py](file:///workspace/backend/app/api/projects.py)

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/projects/` | GET | 获取项目列表 | 登录 |
| `/projects/` | POST | 创建项目 | 登录 |
| `/projects/{id}` | GET | 获取项目详情 | 登录+所有者 |
| `/projects/{id}` | PUT | 更新项目 | 登录+所有者 |
| `/projects/{id}` | DELETE | 删除项目 | 登录+所有者 |
| `/projects/{id}/calculate` | POST | 执行排版计算 | 登录+所有者 |
| `/projects/{id}/layout` | GET | 获取最新排版结果 | 登录 |
| `/projects/{id}/materials` | PUT | 更新材料关联/价格开关 | 登录+所有者 |
| `/projects/{id}/export/pdf` | GET | 导出 PDF 确认单 | 登录+所有者 |
| `/projects/{id}/export/ppt` | GET | 导出 PPT 确认单 | 登录+所有者 |

#### 辅料计算模块 — [materials.py](file:///workspace/backend/app/api/materials.py)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/materials/calculate` | POST | 一键计算全部辅料 |
| `/materials/adhesive` | POST | 仅计算瓷砖胶 |
| `/materials/grout` | POST | 仅计算美缝剂 |
| `/materials/cement-sand` | POST | 仅计算水泥砂浆 |
| `/materials/spacers` | POST | 仅计算十字卡 |
| `/materials/reference` | GET | 获取计算系数参考表 |

#### 销售计算模块 — [sales.py](file:///workspace/backend/app/api/sales.py)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/sales/skirting/calculate` | POST | 踢脚线计算 |
| `/sales/threshold/calculate` | POST | 门头石计算 |
| `/sales/layout/optimize` | POST | 多方案排版优化 |
| `/sales/doors/optimize-start` | POST | 门洞起铺点优化 |
| `/sales/wall-avoidance/generate` | POST | 通铺避让方案 |
| `/sales/quote/complete` | POST | 完整报价单生成 |

#### 订单模块 — [orders.py](file:///workspace/backend/app/api/orders.py)

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/orders/` | POST | 创建订单 | 会员 |
| `/orders/` | GET | 获取订单列表 | 登录 |
| `/orders/{id}` | GET | 获取订单详情 | 登录+所有者 |
| `/orders/{id}/status` | PUT | 更新订单状态 | 登录+所有者 |
| `/orders/{id}/public` | GET | 公开查看 (Token鉴权, 手机号脱敏) | 无需登录 |

#### 确认单模块 — [confirmation.py](file:///workspace/backend/app/api/confirmation.py)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/confirmations/{project_id}` | POST | 生成确认单快照 |
| `/confirmations/{token}` | GET | 公开预览 (手机号脱敏) |

#### 门店模块 — [store.py](file:///workspace/backend/app/api/store.py)

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/store/profile` | GET | 获取门店信息 | 登录 |
| `/store/profile` | POST | 创建门店信息 | 会员 |
| `/store/profile` | PUT | 更新门店信息 | 会员 |
| `/store/upload-logo` | POST | 上传 Logo | 会员 |

#### 纹理模块 — [textures.py](file:///workspace/backend/app/api/textures.py)

| 端点 | 方法 | 说明 | 频率限制 |
|------|------|------|----------|
| `/textures/` | GET | 获取纹理列表 | - |
| `/textures/{id}` | GET | 获取纹理详情 | - |
| `/textures/upload` | POST | 上传纹理图片 | 20/min |
| `/textures/{id}` | DELETE | 删除纹理 | - |
| `/textures/{id}/process` | POST | 抠图处理 (rembg) | - |

#### 管理员模块 — [admin.py](file:///workspace/backend/app/api/admin.py)

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/admin/statistics` | GET | 系统统计 | 超管 |
| `/admin/users` | GET | 用户列表 | 超管 |
| `/admin/orders` | GET | 订单列表 | 超管 |
| `/admin/users/{id}/toggle-member` | PUT | 切换会员状态 | 超管 |

### 3.5 权限与安全

#### [security.py](file:///workspace/backend/app/core/security.py)

- `verify_password()` / `get_password_hash()` — bcrypt 密码哈希
- `create_access_token()` — 生成 JWT (payload 含 `sub`=user_id, `exp`=过期时间)
- `decode_access_token()` — 解码验证 JWT

#### [permissions.py](file:///workspace/backend/app/core/permissions.py)

提供 4 个 FastAPI 依赖注入函数：

| 依赖函数 | 说明 | 失败响应 |
|----------|------|----------|
| `get_current_user` | 从 Bearer Token 解析用户，可选 | 401 |
| `require_user` | 必须登录 | 401 |
| `require_member` | 必须是付费会员 | 403 |
| `get_optional_user` | 尝试解析用户，失败返回 None | 不抛异常 |

#### [rate_limit.py](file:///workspace/backend/app/core/rate_limit.py)

基于 slowapi 的 API 频率限制：

| 接口类型 | 默认限制 | 环境变量 |
|----------|----------|----------|
| 全局默认 | 200/min | `DEFAULT_RATE_LIMIT` |
| API 接口 | 100/min | `API_RATE_LIMIT` |
| 认证接口 | 10/min | `AUTH_RATE_LIMIT` |
| 上传接口 | 20/min | `UPLOAD_RATE_LIMIT` |
| 手绘识别 | 30/min | `SKETCH_RATE_LIMIT` |

#### [free_limits.py](file:///workspace/backend/app/core/free_limits.py)

免费用户使用次数限制 (可通过环境变量配置)：

| 限制项 | 默认值 | 环境变量 |
|--------|--------|----------|
| 每月创建项目数 | 3 | `FREE_MONTHLY_PROJECTS` |
| 每月导出确认单数 | 3 | `FREE_MONTHLY_EXPORTS` |
| 纹理上传总数 | 5 | `FREE_TEXTURE_UPLOADS` |
| 每月手绘识别次数 | 5 | `FREE_SKETCH_RECOGNITIONS` |

---

## 4. 前端模块详解

### 4.1 Monorepo 结构

使用 **pnpm + Turborepo** 管理 Monorepo：

```
pnpm-workspace.yaml → packages: ['packages/*']
turbo.json → 配置构建流水线 (dev/build/lint/type-check)
```

| 包 | 说明 | 构建工具 |
|----|------|----------|
| `packages/web` | Web PWA 主应用 | Vite 5 |
| `packages/shared` | 跨端共享代码 | TypeScript |
| `packages/mobile` | 移动端壳 (Capacitor) | Vite 5 |
| `packages/desktop` | 桌面端壳 (Tauri) | Vite 5 |

### 4.2 Web 应用 (packages/web)

#### 路由结构 — [App.tsx](file:///workspace/packages/web/src/App.tsx)

| 路径 | 页面组件 | 说明 |
|------|----------|------|
| `/` | `Home` | 首页 (项目列表 + 功能介绍 + 定价) |
| `/login` | `LoginPage` | 登录 |
| `/register` | `RegisterPage` | 注册 |
| `/project/new` | `ProjectEdit` | 新建项目 (户型编辑) |
| `/project/:id` | `ProjectEdit` | 编辑项目 |
| `/project/preview` | `LayoutPreview` | 排版预览 |
| `/confirmation` | `ConfirmationPreview` | 确认单预览 |
| `/textures` | `TextureLibrary` | 纹理库 |
| `/products` | `ProductManager` | 产品管理 |
| `/store/profile` | `StoreProfilePage` | 门店信息 |
| `/orders` | `OrderListPage` | 订单列表 |
| `/orders/:id` | `OrderDetailPage` | 订单详情 |
| `/upgrade` | `UpgradePage` | 升级会员 |
| `/contact` | `ContactPage` | 联系我们 |
| `/user/profile` | `UserProfilePage` | 用户资料 |

#### 核心页面

**[Home.tsx](file:///workspace/packages/web/src/pages/Home.tsx)** — 首页
- 功能特性展示 (精确排版/三端统一/一键确认单/加工施工图)
- 三档定价 (免费版/设计师版¥19/月/门店专业版¥199/月)
- 项目列表 (CRUD + 搜索)
- 登录状态管理

**[ProjectEdit.tsx](file:///workspace/packages/web/src/pages/ProjectEdit.tsx)** — 户型编辑器
- Canvas 多边形绘制 (顶点拖拽/添加/删除)
- 预设瓷砖规格 (300×300 到 750×1500)
- 铺贴方向选择 (横/竖/斜)
- 门洞/窗户组件管理
- 手绘识别上传
- 缩放/平移操作

### 4.3 共享包 (packages/shared)

#### 核心组件

**[RoomEditor/](file:///workspace/packages/shared/src/components/RoomEditor/)** — 多边形编辑器
- `RoomEditor.tsx` — 基础编辑器
- `ProRoomEditor.tsx` — 增强版 (含吸附/拖拽)
- `ErrorBoundary.tsx` — 错误边界

**[LayoutRenderer/](file:///workspace/packages/shared/src/components/LayoutRenderer/)** — 排版图渲染器
- `LayoutRenderer.tsx` — 渲染排版结果 (整砖/切割砖区分显示)

### 4.4 状态管理

使用 **Zustand** + `persist` + `devtools` 中间件：

```typescript
// store/index.ts
interface AppState {
  user: User | null;
  currentProject: Project | null;
  projects: Project[];
  textures: Texture[];
  products: Product[];
  orders: Order[];
  isLoading: boolean;
  error: string | null;
}
```

**持久化策略**: `projects`、`currentProject`、`textures` 持久化到 localStorage，其余状态仅内存。

### 4.5 API 调用层

#### Web 端 — [api.ts](file:///workspace/packages/web/src/services/api.ts)

`ApiService` 类封装：
- 自动携带 JWT Bearer Token
- 请求超时控制 (普通 15s, 上传 30s)
- 统一错误处理 (`ApiError` 含 statusCode)
- `upload()` — FormData 文件上传
- `downloadBlob()` — 文件下载 (PDF/PPT)

快捷函数：`fetchProjects()`, `createProject()`, `deleteProjectApi()`, `calculateLayout()`, `sendSketch()`, `calcAuxiliaryMaterials()`

#### 共享端 — [services/index.ts](file:///workspace/packages/shared/src/services/index.ts)

与 Web 端类似的 `ApiService` 类，通过构造函数注入 `baseUrl`，导出各模块 API 函数。

### 4.6 类型系统

#### [types/index.ts](file:///workspace/packages/web/src/types/index.ts)

核心类型定义：

| 接口 | 说明 |
|------|------|
| `User` | 用户 (含 isMember, storeProfile) |
| `StoreProfile` | 门店信息 |
| `Texture` | 纹理 |
| `Product` / `ProductSKU` | 产品与规格 |
| `Project` | 项目 (含 roomPolygon, tileConfig, showPrice) |
| `TileConfig` | 瓷砖配置 (宽/高/缝/方向/起铺点) |
| `LayoutResult` / `Tile` | 排版结果与砖块 |
| `LayoutStatistics` | 排版统计 |
| `Order` / `OrderItem` | 订单与明细 |
| `ConfirmationData` / `ConfirmationMaterial` | 确认单数据 |
| `ApiResponse<T>` | 统一 API 响应格式 |

---

## 5. 核心业务流程

### 5.1 排版计算流程

```
用户绘制户型多边形 → 设置砖规格/方向/起铺点
    → POST /projects/{id}/calculate
    → LayoutEngine.calculate_layout()
        → 生成砖块网格
        → Sutherland-Hodgman 裁剪每块砖到房间内
        → 判断整砖/切割砖
        → 统计用量
    → 保存 LayoutResult → 返回 tiles + statistics
    → 前端 LayoutRenderer 渲染
```

### 5.2 确认单生成流程

```
排版完成 → POST /confirmations/{project_id} 生成快照
    → 前端 ConfirmationPreview 渲染 HTML 预览
    → GET /projects/{id}/export/ppt → 下载 PPT
    → GET /projects/{id}/export/pdf → 下载 PDF
    → 生成时根据 is_member + show_price 控制内容
```

### 5.3 订单与报价流程

```
创建订单 (POST /orders/) → 关联 SKU + 价格
    → 自动计算 total_amount
    → 生成 confirm_token (公开链接)
    → 业主通过 /orders/{id}/public?token=xxx 查看
    → PUT /orders/{id}/status 更新状态
```

### 5.4 手绘识别流程

```
上传手绘草图 → POST /sketch/recognize
    → SketchRecognizer.recognize()
        → 预处理 (灰度/二值化/形态学)
        → 轮廓提取 (findContours)
        → 多边形简化 (approxPolyDP)
        → 可选矩形拟合
    → 返回 polygons + dimensions
    → 前端回填到编辑器
```

---

## 6. 依赖关系图

### 后端 Python 依赖

```
FastAPI ─── uvicorn
  ├── SQLAlchemy[asyncio] ─── asyncpg (PostgreSQL) / aiosqlite (SQLite)
  ├── Alembic (数据库迁移)
  ├── pydantic / pydantic-settings (数据验证与配置)
  ├── python-jose[cryptography] (JWT)
  ├── passlib[bcrypt] (密码哈希)
  ├── python-pptx (PPT 生成)
  ├── reportlab (PDF 生成)
  ├── Pillow (图像处理)
  ├── numpy (数值计算)
  ├── opencv-python-headless (手绘识别)
  ├── rembg (抠图, 可选)
  ├── Shapely (通铺避让几何计算)
  ├── slowapi (API 频率限制)
  ├── redis (缓存/频率限制存储)
  ├── minio (对象存储)
  └── httpx (HTTP 客户端)
```

### 前端依赖

```
React 18 + TypeScript 5.3
  ├── react-router-dom v6 (路由)
  ├── zustand v4 (状态管理)
  ├── antd v5 (UI 组件库)
  ├── konva + react-konva (Canvas 2D 渲染)
  ├── dayjs (日期处理)
  ├── vite v5 (构建)
  ├── vite-plugin-pwa (PWA 支持)
  └── Turborepo (Monorepo 构建)
```

### 模块间调用关系

```
API 路由层 (api/)
    │
    ├── 直接调用 → services/ (业务逻辑)
    │                  ├── layout_engine.py (排版)
    │                  ├── auxiliary_material.py (辅料)
    │                  ├── complete_quote.py ──→ skirting_calculator.py
    │                  │                      ──→ door_optimizer.py
    │                  │                      ──→ auxiliary_material.py
    │                  ├── ppt_generator.py (PPT)
    │                  ├── pdf_generator.py (PDF)
    │                  ├── cutting_drawing.py (施工图)
    │                  ├── sketch_recognition.py (手绘识别)
    │                  ├── layout_optimizer.py (排版优化)
    │                  ├── wall_avoidance.py (避让, 依赖 Shapely)
    │                  └── watermark.py (水印)
    │
    ├── 依赖注入 → core/permissions.py → core/security.py
    │              core/rate_limit.py
    │              core/free_limits.py
    │
    └── 数据访问 → models/models.py → core/database.py
```

---

## 7. 项目运行方式

### 7.1 本地开发

**后端启动**:

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# 安装依赖
pip install -r requirements.txt

# 初始化数据库
python init_db.py

# 启动开发服务器
uvicorn main:app --reload --port 8000
```

后端 API 文档: http://localhost:8000/api/docs

**前端启动**:

```bash
# 安装 pnpm (如未安装)
npm install -g pnpm

# 安装依赖
pnpm install

# 启动 Web 开发服务器
cd packages/web
pnpm dev
# 或从根目录
pnpm dev
```

前端访问: http://localhost:5173

### 7.2 Docker 部署

```bash
# 配置环境变量
cp .env.example .env.production
# 编辑 .env.production 填入实际值

# 启动全部服务
docker-compose up -d

# 查看日志
docker-compose logs -f backend
```

服务列表：
- PostgreSQL: `localhost:5432` (仅本地)
- Redis: `localhost:6379` (仅本地)
- FastAPI: `localhost:8000` (仅本地)
- Nginx: `localhost:80/443` (对外)

### 7.3 数据库迁移

```bash
cd backend

# 生成迁移脚本
alembic revision --autogenerate -m "description"

# 执行迁移
alembic upgrade head

# 回滚
alembic downgrade -1
```

---

## 8. 部署架构

### Docker Compose 服务编排

```
┌─────────────────────────────────────────────────┐
│  Nginx (反向代理 + SSL + 静态文件)               │
│  :80 → 301 → :443                               │
│  :443 → /api/ → backend:8000                    │
│  :443 → /uploads/ → backend:8000                │
│  :443 → / → 前端静态文件                         │
├─────────────────────────────────────────────────┤
│  Backend (FastAPI + Gunicorn + Uvicorn)          │
│  4 workers, timeout 120s                         │
│  → PostgreSQL + Redis + 本地文件存储              │
├─────────────────────────────────────────────────┤
│  PostgreSQL 16 (数据持久化, 健康检查)             │
│  Redis 7 (频率限制存储, AOF持久化)                │
└─────────────────────────────────────────────────┘
```

### Nginx 配置要点

- HTTP 强制跳转 HTTPS
- API 请求代理到后端 (含频率限制 `30r/s`)
- 上传文件 1 小时缓存
- 前端静态资源 7 天缓存
- Gzip 压缩 (json/css/js/svg)
- 安全头 (X-Frame-Options, HSTS, XSS-Protection)
- 文件上传限制 20MB

---

## 9. 免费/会员权限体系

### 权限控制层级

```
1. 前端渲染层: 根据 user.isMember 条件渲染 (升级提示/占位符)
2. API 路由层: Depends(require_member) 强制校验
3. 服务逻辑层: PPT/PDF 生成时再次检查 is_member
4. 数据返回层: 公开接口手机号脱敏, 价格字段按权限过滤
```

### 功能差异对照

| 功能点 | 免费版 | 会员版 |
|--------|--------|--------|
| 排版计算 | 每月 3 次 | 无限 |
| 纹理上传 | 5 张 | 无限 |
| 产品库/SKU 管理 | 不可用 | 可用 |
| 价格输入 | 不可用 | 可用 |
| 确认单价格显示 | 强制隐藏 | 可选显示 |
| 商家信息展示 | 灰色升级提示 | 完整门店信息 |
| PPT/PDF 水印 | 有水印 | 仅"由排砖宝生成"小字 |
| 手绘识别 | 每月 5 次 | 无限 |
| API 对接 | 不支持 | 支持 |

### 后端权限校验关键点

- **订单创建**: `Depends(require_member)` — 仅会员可创建
- **门店信息编辑**: `Depends(require_member)` — 仅会员可编辑
- **PPT/PDF 导出**: 服务层检查 `is_member`，免费版隐藏商家真实信息和价格
- **公开链接**: `customer_phone` 脱敏 (`138****1234`)
- **免费次数**: `free_limits.py` 通过数据库查询当月使用量，超限返回 403
