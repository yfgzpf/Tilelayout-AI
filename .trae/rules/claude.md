排砖宝 · 用户确认单与报价系统 完整项目开发指南及 AI 编程规范
版本: 2.0
适用范围: 全栈项目，支持 Web PWA、手机 App (iOS/Android)、桌面应用 (Windows/macOS/Linux) 三端统一
目标: 为 AI 编程工具 (Cursor、Copilot、Windsurf 等) 提供一份即用型开发手册，指导实现从瓷砖排版到商家自定义报价、生成可在手机打开的确认单的全闭环。

1. 项目定位与核心场景
“排砖宝”在精准瓷砖排版基础上，新增 「方案确认单与报价系统」，核心业务流：

设计师/门店完成排版后，为每款瓷砖填入单片价格（可选），系统自动计算总造价（可选显示）。

一键生成一份带产品图、规格、价格、商家信息的用户确认单。

确认单在手机、平板、电脑上均可流畅查看，并可直接在手机签字确认（未来）。

免费会员无法展示商家品牌信息，仅付费会员可展示 Logo、联系方式等。

最终交付物：一份可在手机 WPS/Office/浏览器中完美打开的 PPT/PDF 文件，同时提供在线 HTML 预览，确保跨设备体验。

2. 总体架构与多端技术选型
2.1 架构总览
text
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
关键原则：核心计算与服务集中后端；前端负责交互与渲染预览；PPT/PDF 生成由后端完成，前端可生成 HTML 预览版用于手机即时查看。

2.2 前端多端统一方案（详细选型理由）
层级	选型	理由
框架	React 18 + TypeScript 严格模式	生态丰富，适合复杂交互，TS 保障大型项目可维护性
构建	Vite 5	极速 HMR，支持多入口和条件编译
包管理	pnpm + Turborepo	Monorepo 下共享代码与独立构建，任务缓存加速 CI
UI 组件	Ant Design Mobile (移动端优先) + Ant Design (桌面)	官方响应式支持，一套组件适配多端，定制主题容易
2D 交互	react-konva (Konva.js)	多边形编辑器、排版图标注渲染，对触摸和鼠标事件统一支持良好
移动端容器	Capacitor 6	将 Web 应用打包为 iOS/Android 原生 App，提供相机、文件系统等原生 API，且无需离开 React 生态
桌面端容器	Tauri 2.0 (Rust 后端壳)	体积小（<10MB），性能好，可调用系统原生对话框、文件保存、自动更新，比 Electron 更适合工具类
PWA 化	vite-plugin-pwa (Workbox)	实现 Web 端离线缓存、可安装到主屏幕，增强移动端网页体验
状态管理	Zustand	轻量、符合 React 心智模型，无模板代码
路由	React Router v6	标准 SPA 路由，支持嵌套
样式	Tailwind CSS + Ant Design token 扩展	原子化样式快速开发，结合 Ant Design 主题保证设计一致性
平台适配策略：通过 Vite 的 resolve.alias 在构建时注入不同平台实现文件（如 platform/capacitor.ts、platform/web.ts），业务组件通过统一接口调用。对原生能力（相机、文件保存）封装为 IPlatform 接口。

手机端为何不用 React Native 或 Flutter？

本产品有大量画布操作和复杂排版渲染，Web 技术（Canvas/Konva）表现最稳定。

Capacitor 提供渐进式增强：核心逻辑一次开发，原生特性仅按需桥接，学习成本最低，三端代码复用率 >95%。

2.3 后端技术选型
服务	选型	说明
API 框架	FastAPI (Python 3.11+)	异步性能好，自动生成 OpenAPI 文档，适合快速迭代
排版引擎	Shapely + numpy	多边形裁剪运算，工业级稳定性
PPT 生成	python-pptx	成熟，可完全程序化创建 PPT，支持图片、表格、样式
PDF 生成	python-pptx 转 PDF 或直接使用 reportlab	手机打开 PPT 有兼容问题，可提供 PDF 作为备用格式（LibreOffice headless 转换或无头 Chromium 打印）
图像处理	rembg (抠图), Pillow, opencv-python	处理手拍瓷砖去背景、透视校正
数据库	PostgreSQL + SQLAlchemy (async)	稳定性、事务支持好，JSONB 适合存储排版数据
缓存/消息	Redis (必要时引入)	可稍后加入
文件存储	MinIO (自建) / 阿里云 OSS	存储用户上传的户型图、纹理、生成的PPT文件
部署	Docker + Gunicorn + Uvicorn	容器化一键部署
2.4 手机端如何打开 PPT？
需求：用户确认单需在手机上查看，不能依赖电脑。

解决方案（三级保障）：

在线 HTML 预览（首选）：用户点击链接直接在手机浏览器中看到一份与 PPT 内容完全一致的网页版确认单，可即时查看、缩放。无需安装任何应用。

PDF 下载：后端同时生成 PDF 版本，手机系统内置阅读器均可打开，版式稳定不跑位。

PPT 原生下载：提供 .pptx 文件下载，若用户手机安装了 WPS/Office，可直接打开编辑。后两者作为备选，满足不同场景。

实现方式：

前端开发一套确认单 HTML 预览组件，按标准幻灯片布局，移动端自适应。

后端 PPT 生成服务同时输出 PDF（通过 LibreOffice 或无头 Chromium 转换，MVP 阶段可优先保证 PDF 质量）。

3. 用户确认单模块详细功能
3.1 核心流程
text
排版完成 → 进入“生成确认单” 
→ 填入单片价格（可选）、选择显示总造价 
→ 商家信息自动填充（会员专享） 
→ 生成在线预览（HTML） 
→ 用户可下载 PPT / PDF / 转发链接给业主 
→ 业主手机查看，确认（未来可电子签名）。
3.2 功能点
价格管理：商家可以为每个材料 SKU 设置单价（元/片），按用量自动计算小计与总造价。

造价显示开关：商家可选择“向业主显示价格”或“隐藏价格”（隐藏时显示“商议”）。

商家信息绑定：会员完善门店信息（Logo、名称、电话、地址），生成时自动填入封面和落款。

免费版限制：封面商家信息处显示灰色占位文案“升级会员，展示您的品牌与联系方式”。

多格式导出：提供在线 HTML 预览链接，下载 PPTX，下载 PDF。

3.3 确认单结构（5页PPT/HTML版）
页码	内容	关键要素
1	封面	项目名称、户型面积、方案编号；商家Logo/名称（会员）或升级提示；日期
2	铺贴效果图	全屏铺贴排版效果图（真实纹理），左上角标注起铺点、铺贴方向
3	材料明细与报价	表：产品缩略图、名称、规格(mm)、用量(片)、单价(元)、金额。合计。若隐藏价格则不显示单价/金额列
4	商家联系信息	会员：Logo、名称、地址、电话、二维码；免费：大面积引导升级文案
5	确认签字区	客户签字线、日期、备注。底部统一有“本方案由排砖宝生成”小字
自适应设计：HTML 预览版将 5 页内容以卡片式纵向排列（手机端）或横向滑动（平板/桌面），保障小屏阅读体验。

4. 数据库模型扩展
在原有 projects, rooms 等基础上新增/修改如下表。

4.1 门店信息表 store_profiles
sql
CREATE TABLE store_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    store_name VARCHAR(200),
    logo_url TEXT,
    phone VARCHAR(20),
    address VARCHAR(500),
    qr_code_url TEXT,   -- 微信二维码图片
    updated_at TIMESTAMP
);
4.2 产品表与 SKU 增强
sql
CREATE TABLE products (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id), -- 归属门店
    name VARCHAR(200),
    category VARCHAR(50), -- 如 tile
    image_url TEXT,
    texture_id UUID REFERENCES textures(id),
    created_at TIMESTAMP
);

CREATE TABLE product_skus (
    id UUID PRIMARY KEY,
    product_id UUID REFERENCES products(id),
    size_x INT NOT NULL,  -- mm
    size_y INT NOT NULL,
    unit_price DECIMAL(10,2),  -- 单片价格，可空
    unit VARCHAR(10) DEFAULT '片',
    stock INT DEFAULT 0
);
4.3 项目表增加确认单关联
sql
ALTER TABLE projects ADD COLUMN show_price BOOLEAN DEFAULT TRUE;  -- 是否显示价格
ALTER TABLE projects ADD COLUMN confirmation_data JSONB;  -- 存储生成确认单时的快照（价格、商家信息等）
4.4 订单表（可选，若需要下单闭环）
sql
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'draft',
    total_amount DECIMAL(12,2),
    confirm_token VARCHAR(64) UNIQUE,
    created_at TIMESTAMP
);
5. API 设计（新增/修改）
Base: /api/v1

5.1 商家信息管理（会员专属）
GET /store/profile → 获取当前门店信息

PUT /store/profile → 更新门店信息（需会员权限，中间件校验）

5.2 产品与价格管理
POST /products → 创建产品（含 SKU 带价格）

PUT /products/{id}/skus/{sku_id} → 更新单价

GET /products → 获取门店产品列表

5.3 排版项目关联产品和价格
PUT /projects/{id}/materials → 为项目中的材料关联产品 SKU，并设置 show_price 开关。Body: { materials: [ { texture_id, product_sku_id, unit_price_override? } ], show_price: true }

5.4 确认单生成
POST /projects/{id}/confirmations → 生成确认单快照，保存到 confirmation_data，返回确认单 ID 及预览链接。

GET /confirmations/{token} → 公开预览链接（无需登录），返回 HTML 页面或 JSON 数据供前端渲染。

GET /projects/{id}/export/ppt → 下载 PPTX 文件

GET /projects/{id}/export/pdf → 下载 PDF 文件

生成 PPT/PDF 时，服务端必须根据 show_price 和用户会员状态决定内容。

5.5 会员中间件
装饰器 @require_member 检查用户 is_member 字段，免费用户调用会员专属接口返回 403。

6. 前端组件与页面设计
在 packages/shared/src/ 中实现。

6.1 确认单 HTML 预览页 ConfirmationPreview
路由：/project/:id/confirmation

通过 API 获取项目、材料、价格、商家信息。

渲染为移动优先的卡片式布局：

封面卡片：背景微纹理，标题，商家信息（会员显示真实信息，免费显示占位）。

效果图卡片：图片全宽，标注浮层。

材料清单卡片：表格形式，若隐藏价格则不显示价格相关列；若为免费且无价格，显示“会员可见”。

商家信息卡片：会员详情，免费版用灰色大文字“升级会员展示联系方式”。

签字区卡片：签名线和日期。

操作按钮：浮动底部“下载 PDF”、“下载 PPT”、“分享链接”（调用平台分享接口）。

6.2 项目配置面板（增设价格与显示开关）
在排版配置页面旁或预览页增加一个“报价设置”抽屉：

列出材料列表，每项可选择产品 SKU（带单价），或手动输入临时单价。

开关：“向客户展示价格”。

保存到后端。

6.3 平台适配
分享功能：调用 Capacitor 的 Share API（移动端）或 Web Share API（Web），桌面端复制链接。

文件下载：桌面端使用 Tauri 原生保存对话框；移动端使用 Capacitor Filesystem 写入临时文件并打开。

7. 后端 PPT 生成引擎详解
7.1 生成流程
接收请求，获取项目数据、排版结果图（前端上传或后端根据数据重新渲染）、材料及价格、商家信息。

校验会员状态：免费用户强制禁用商家真实信息。

使用 python-pptx 构建 PPT：

加载预设模板（可选，或完全代码构建）。

填充封面：标题、日期、会员信息或升级提示。

插入效果图幻灯片：将效果图作为全页背景或大图放于中央。

材料清单页：创建表格，填入数据。若 show_price=False，动态移除单价和金额列。

商家信息页：插入 Logo、文本框。

签字页。

保存到 BytesIO，返回文件流。

7.2 关键技术点
Logo 插入：从 OSS 下载图片到临时文件，slide.shapes.add_picture()。

表格样式：设置单元格边框、合并、字号、对齐。

手机兼容：PPT 尺寸设定为宽屏 16:9，保证在手机横屏查看时效果较好；同时使用通用字体（Arial/微软雅黑）。

PDF 生成：可使用 LibreOffice --headless --convert-to pdf 或使用 playwright 的无头 Chromium 渲染 HTML 预览版并打印为 PDF。推荐后者以便版式与 HTML 预览完全一致。

7.3 HTML 预览版生成（用于公开链接）
前端 React 组件渲染为静态 HTML 字符串？不，更简单方式：提供一套公开的 Next/React 页面，直接通过路由展示数据，无需生成静态文件。对于安全 token 验证，服务端渲染（SSR）或用前端 SPA 模式均可。

8. 免费/会员差异控制清单
对比项	免费用户	付费会员
商家Logo/名称	灰色文字“升级会员，展示您的品牌”	真实 Logo + 店名
联系电话/地址	隐藏或显示“****”	完整显示
材料价格显示	无法设置单价，清单中不显示价格（或显示“会员可见”）	可设置单价，并可选择是否向业主显示
PPT/PDF 水印	底部水印稍明显	仅保留标准“由排砖宝生成”小字
在线预览分享	支持	支持
实现方式：

API 返回的数据中，后端根据 is_member 已过滤敏感字段。

前端仅负责渲染，不参与权限判定（安全）。

9. 开发任务拆解（供 AI 顺序执行）
第一阶段：基础设施与价格系统
1. 实现 store_profiles CRUD API，前端门店信息编辑页（会员中心）。

2. 实现产品与 SKU 管理 API，前端产品管理页。

3. 项目材料关联 SKU 和价格，增加 show_price 开关 API。

4. 数据库迁移，新增上述表及字段。

第二阶段：确认单预览（HTML）
5. 创建 ConfirmationPreview 组件，根据项目数据渲染 5 页卡片。

6. 实现会员 vs 免费的条件渲染差异。

7. 适配移动端布局，测试真机效果。

第三阶段：PPT/PDF 生成
8. 搭建 python-pptx 生成服务，创建基础 5 页模板。

9. 实现效果图插入、材料表格动态生成、价格隐藏逻辑。

10. 添加 PDF 导出端点（基于 HTML 转 PDF 或 LibreOffice）。

11. 前后端联通：预览页“下载”按钮触发 API 下载。

第四阶段：分享与原生体验
12. 生成确认单公开访问链接（token 验证），支持分享。

13. 移动端 Capacitor 集成 Share 和 File 插件。

14. 桌面端 Tauri 实现文件保存对话框。

第五阶段：测试与优化
15. 单元测试：PPT 内容验证，免费会员字段隐藏。

16. 真机测试：iOS Safari、Android Chrome 打开 HTML 预览，以及相应 Office 应用打开 PPT。

10. AI 编程规范与约束
10.1 通用编码风格
TypeScript：严格模式，禁止 any（特殊情况注释说明）。

组件命名：PascalCase；函数、变量：camelCase。

所有组件必须显式声明 Props 接口。

异步操作必须 try/catch，并管理 loading、error 状态。

前端状态管理：优先使用 Zustand，跨组件通信避免 prop drilling。

10.2 目录规范
新增页面放在 packages/shared/src/pages/。

新增组件放在 packages/shared/src/components/Confirmation/。

后端服务层：backend/app/services/ppt_generator.py，backend/app/api/confirmation.py。

10.3 AI 提示指令示例
当使用 Copilot/Cursor 时，可给出如下指令：

text
请根据《排砖宝开发手册》，
现在实现用户确认单HTML预览组件，要求：
1. 项目数据通过 API 获取，使用 React Query 管理。
2. 根据 is_member 状态条件渲染商家信息。
3. 移动端自适应，卡片垂直排列。
4. 视觉效果参考高端商务PPT。
10.4 注意事项
任何涉及价格、商家信息的逻辑须在后端再做一次权限校验，不可信任前端。

PPT 图片质量：确保效果图分辨率不低于 1920x1080。

手机打开 PPT 会弹出选择应用，应明确引导用户使用 WPS/Office，同时强推 HTML 在线预览作为首选方案。

现在，这份完整的开发指南可作为 AI 编程工具的永久性项目规约。将其保存为项目根目录下的 AGENTS.md 或 .cursorrules，AI 将会严格遵循此规范生成代码，实现一个支持三端、包含报价系统的用户确认单功能。
排砖宝 · 项目开发规范 (v1.0)
适用范围：前端（React+TS）、后端（Python/FastAPI）、跨平台壳
遵循级别：所有生成的代码必须符合本规范，违反视为不合格。

1. 通用原则
类型优先：任何变量、函数、接口必须有明确类型，禁用 any (除非有充分注释说明不可行)。

错误必处理：异步操作必须 try/catch 并返回用户友好信息。

状态覆盖：任何请求必须有 loading、error、data 三态处理。

单一职责：组件、函数、类均只做一件事。

早返回：减少嵌套，尽早 return。

不可变性：状态更新必须为不可变操作 (React state, Zustand, Python 返回新对象)。

2. 前端规范 (React + TypeScript)
2.1 命名约定
文件/文件夹：kebab-case (例 tile-editor.tsx，order-confirmation/)

React 组件：PascalCase，函数组件，导出使用 export function ComponentName。

Hooks：useXxx，自定义 Hook 文件夹 hooks/useProject.ts。

类型/接口：PascalCase，明确前缀 I 不用，直接 Project, RoomData。

常量：UPPER_SNAKE_CASE。

事件处理函数：handleXxx (例 handleTileClick)。

CSS 类名：Tailwind 原子类优先，自定义类用 BEM 风格 (.room-editor__canvas--active)。

2.2 组件结构
每个组件文件必须包含：

顶部：导入

Props 接口定义 (export 或内联)

组件函数体

组件底部如有需要：export default 或命名导出

typescript
import React from 'react';
import { Button } from 'antd-mobile';

interface RoomEditorProps {
  room: Room;
  onUpdate: (room: Room) => void;
}

export function RoomEditor({ room, onUpdate }: RoomEditorProps) {
  // ...
}
2.3 目录约定 (packages/shared/src)
text
components/        # 通用UI组件
  Confirmation/    # 确认单相关组件
pages/             # 页面级组件，按路由命名
hooks/             # 自定义 Hook
store/             # Zustand stores
services/          # API 调用函数 (axios)
utils/             # 纯工具函数
platform/          # 平台适配器
types/             # 全局类型定义
styles/            # 全局样式、Tailwind 配置
2.4 样式规范
使用 Tailwind CSS 原子类，禁止行内 style 除非动态计算 (如坐标)。

移动端优先：基础设计为 375px 宽度，使用 md: lg: 断点增强。

交互元素最小触摸区域 44x44px。

Ant Design Mobile 组件可全局配置主题色，不单独覆盖组件样式。

2.5 API 调用规范
所有请求统一通过 services/api.ts 导出的 request 实例，自动携带 JWT，统一错误拦截。

每个 API 函数返回类型为 Promise，明确返回值类型 (泛型)。

错误时返回标准 ApiError 对象，包含 message 和 statusCode。

2.6 平台适配器使用
在组件中通过 import { platform } from '@/platform' 调用原生能力，不直接写平台特定代码。例如文件保存：

typescript
await platform.saveFile(pdfBuffer, '方案确认单.pdf');
3. 后端规范 (Python / FastAPI)
3.1 命名约定
文件名：snake_case (ppt_generator.py)

类：PascalCase (OrderService)

函数/方法：snake_case (def calculate_layout())

变量：snake_case

常量：UPPER_SNAKE_CASE

路由函数：直接描述操作 (create_project, get_order)

3.2 项目结构 (backend/app)
text
api/              # 路由，按模块分文件 (projects.py, orders.py)
core/             # 核心算法 (layout_engine.py)
models/           # SQLAlchemy 模型
schemas/          # Pydantic 请求/响应模型
services/         # 业务逻辑层
utils/            # 工具函数
main.py           # FastAPI 应用入口
config.py         # 设置读取 (pydantic-settings)
3.3 API 设计规则
URL 格式：/api/v1/{resource}，资源用复数 (/projects, /orders)。

HTTP 动词遵循 REST：GET(查)、POST(增)、PUT(全量更新)、PATCH(部分更新)、DELETE(删)。

请求体/响应体必须定义 Pydantic Schema，存放在 schemas/。

所有端点返回统一的 JSON 格式（成功或失败），错误格式：{ "detail": "错误消息" }。

分页：查询列表支持 ?skip=0&limit=20。

权限校验通过依赖注入 (Depends) 实现。

3.4 业务逻辑分离
路由函数只做参数校验和请求转发，业务逻辑全部放在 services/。

数据库操作通过服务层调用，不要直接在路由中使用 SQLAlchemy session。

3.5 价格与权限安全
任何涉及价格的接口，必须校验当前用户是否为会员 (is_member)。

后端生成 PPT/PDF 时，必须再次检查会员状态，绝不可信任前端参数。

商家信息、联系方式仅在会员状态下返回真实值，否则返回掩码或占位符。

4. 数据库规范 (PostgreSQL)
表名：小写蛇形，复数形式 (projects, product_skus)。

列名：小写蛇形 (created_at, store_name)。

主键：统一使用 UUID id，类型为 UUID。

时间戳：所有表包含 created_at TIMESTAMPTZ DEFAULT NOW()。

外键：明确建立，并设置适当的 ON DELETE 行为 (通常为 CASCADE 或 SET NULL)。

JSONB 字段：仅用于存非结构化数据（如排版结果、快照），禁止存关系数据。

迁移：使用 Alembic，生成的文件保留在 backend/migrations/。

5. Git 与协作规范
主分支：main (保护)，develop (日常集成)。

功能分支：feature/ppt-generation，fix/room-editor-adsorb。

提交信息：遵循 Conventional Commits
例：feat: add confirmation PPT export API
fix: correct tile count when room is L-shaped
chore: update dependencies

提交粒度：每个功能点或修复一个提交，不可混入无关变更。

PR 要求：至少 1 人 review，通过 CI 自动 lint / test 后合并。

6. 测试要求
6.1 前端
关键工具函数 (utils/) 必须有单元测试 (Vitest)。

核心组件 (RoomEditor, ConfirmationPreview) 应有基本的渲染测试 (React Testing Library)。

不要求 100% 覆盖率，但用户交互流程必须有测试保障。

6.2 后端
排版引擎 (layout_engine.py) 必须有覆盖多种户型的单元测试，验证数量与坐标。

API 端点应有集成测试 (使用 TestClient + 测试数据库)。

PPT 生成服务须测试：免费版不包含商家真实信息，会员版包含。

7. 环境变量与配置
所有环境变量通过 .env 文件管理，前端使用 VITE_ 前缀，后端使用普通大写字母。

前端 (.env.example)：

text
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_ENABLE_MOCK=false
后端 (.env.example)：

text
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/tilelayout
JWT_SECRET=your-secret
STORAGE_BACKEND=local   # local 或 s3
OSS_ENDPOINT=...
MEMBER_REQUIRED=true    # 是否强制会员才能使用高级功能
配置读取：后端使用 pydantic-settings 的 BaseSettings，前端通过 import.meta.env (类型定义在 env.d.ts)。

8. AI 编程工具使用指南 (Cursor/Copilot 指令)
当要求 AI 生成代码时，使用以下提示：

text
你是一名严谨的全栈工程师，请严格按照《排砖宝开发规范》编写代码。
- 必须使用 TypeScript 严格模式，禁止 any。
- React 组件需包含 Props 类型、加载/错误状态。
- 后端 API 必须包含 Pydantic Schema 和权限检查。
- 所有异步操作有错误处理。
- 生成的代码可直接运行，需手动配置的部分请注释说明。
可将上述规范与项目技术栈需求一起作为上下文，AI 将自动遵守