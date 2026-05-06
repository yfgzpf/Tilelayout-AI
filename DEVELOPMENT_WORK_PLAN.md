# 排砖宝 深度开发工作计划

**生成日期**: 2026-05-06  
**审查范围**: 前后端全量源码对照项目规范  
**当前版本**: MVP v0.5 → 目标 v2.0

---

## 一、审查总览

### 1.1 当前实现状态汇总

| 层级 | 文件/模块 | 状态 | 完成度 |
|------|----------|------|--------|
| **后端核心** | | | |
| | `core/config.py` | ✅ 生产级 | 100% |
| | `core/database.py` | ✅ 可用 | 80% (缺连接池监控/重试) |
| | `core/security.py` | ✅ JWT+bcrypt | 100% |
| | `models/models.py` | ✅ 9表完整 | 100% |
| | `main.py` | ✅ FastAPI | 100% |
| **后端服务** | | | |
| | `services/layout_engine.py` | ✅ 纯Python引擎 | 100% |
| | `services/ppt_generator.py` | ❌ 不存在 | 0% |
| | `services/pdf_generator.py` | ❌ 不存在 | 0% |
| | `services/image_processor.py` | ❌ 不存在 | 0% |
| **后端API** | | | |
| | `api/auth.py` | ✅ 注册/登录 | 90% |
| | `api/projects.py` | ⚠️ 部分实现 | 40% |
| | `api/users.py` | ⚠️ 工具函数有,端点占位 | 25% |
| | `api/products.py` | ❌ 全部占位 | 0% |
| | `api/textures.py` | ❌ 全部占位 | 0% |
| | `api/orders.py` | ❌ 全部占位 | 0% |
| | `api/confirmation.py` | ❌ 全部占位 | 0% |
| **后端测试** | | | |
| | `tests/test_layout_engine.py` | ✅ 22用例 | 100% |
| | `tests/test_api.py` | ✅ 12用例 | 100% |
| **前端Web** | | | |
| | `pages/Home.tsx` | ✅ 完整 | 100% |
| | `pages/ProjectEdit.tsx` | ⚠️ 仅表单 | 30% (缺画布) |
| | `pages/LayoutPreview.tsx` | ✅ 排版预览 | 80% |
| | `types/index.ts` | ✅ 类型完整 | 100% |
| | `store/index.ts` | ✅ Zustand | 100% |
| | `services/api.ts` | ✅ 超时+错误 | 100% |
| | `index.css` | ✅ 品牌系统 | 100% |
| **前端缺失页面** | | | |
| | TextureLibrary | ❌ 不存在 | 0% |
| | TextureEditor | ❌ 不存在 | 0% |
| | ProductManager | ❌ 不存在 | 0% |
| | OrderCreate | ❌ 不存在 | 0% |
| | OrderDetail | ❌ 不存在 | 0% |
| | OrderConfirm | ❌ 不存在 | 0% |
| | ConfirmationPreview | ❌ 不存在 | 0% |
| | ProjectConfig | ❌ 不存在 | 0% |
| **Shared包遗留** | | | |
| | `RoomEditor` | ⚠️ 完整konva但未接入 | 90% |
| | `LayoutRenderer` | ⚠️ 完整konva但未接入 | 90% |
| | 8个页面 | ❌ 全部占位 | 0% |

### 1.2 整体完成度

```
已完成:  ████████░░░░░░░░░░  42%
占位代码: ██████░░░░░░░░░░░░  30%
未实现:   ██████░░░░░░░░░░░░  28%
```

---

## 二、缺失功能详细清单

### 🔴 P0 - 阻塞部署

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 1 | **5个API路由全部占位代码** | products/textures/orders/confirmation/users | 无法进行任何业务流程 |
| 2 | **无文件上传服务** | 缺失`services/image_processor.py` | 纹理上传/抠图不可用 |
| 3 | **无PPT/PDF生成服务** | 缺失`services/ppt_generator.py`, `pdf_generator.py` | 确认单导出不可用 |
| 4 | **无数据库迁移脚本** | 缺失`alembic/`目录 | 无法在生产创建表 |
| 5 | **前端与Shared包断开** | web独立,shared组件未接入 | RoomEditor等核心组件浪费 |
| 6 | **无会员权限中间件** | 缺失`@require_member`装饰器 | 免费/付费无法区分 |

### 🟡 P1 - 核心功能缺失

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 7 | ProjectEdit页无画布编辑器 | `web/src/pages/ProjectEdit.tsx` | 无法绘制户型 |
| 8 | 缺8个前端业务页面 | `web/src/pages/` | 纹理库/产品/订单/确认单不可用 |
| 9 | API缺少输入验证schema | 各API路由 | 数据安全教育 |
| 10 | 无全局异常处理中间件 | `main.py` | 500错误无日志 |
| 11 | 无日志系统 | 整个后端 | 生产排障困难 |
| 12 | 排版引擎不支持对角线铺贴 | `layout_engine.py:L76` | `elif self.direction == "diagonal": pass` 有注释但未实现逻辑 |

### 🟢 P2 - 质量提升

| # | 问题 | 位置 |
|---|------|------|
| 13 | 数据库连接无重试/健康检查 | `core/database.py` |
| 14 | CORS origin使用硬编码默认值 | `core/config.py` |
| 15 | 无API rate limiting | `main.py` |
| 16 | 前端无单元测试 | 整个web |
| 17 | 无CI/CD配置 | 整个项目 |
| 18 | 无Docker生产部署配置 | `Dockerfile`仅开发用 |

---

## 三、深度开发工作计划

### 第1周：后端业务核心补齐

#### Day 1-2: 数据库迁移 + API补齐

```
1.1 初始化Alembic并生成初始迁移脚本
    - 安装alembic并init
    - 生成9张表的初次迁移
    - 添加种子数据脚本(测试用)

1.2 实现 products API (完整CRUD+SKU管理)
    POST   /api/v1/products/                   创建产品
    GET    /api/v1/products/                   产品列表(分页+搜索)
    GET    /api/v1/products/{id}               产品详情
    PUT    /api/v1/products/{id}               更新产品
    DELETE /api/v1/products/{id}               删除产品
    POST   /api/v1/products/{id}/skus          添加SKU(带价格)
    PUT    /api/v1/products/{id}/skus/{sku_id} 更新SKU价格
    DELETE /api/v1/products/{id}/skus/{sku_id} 删除SKU
    - 全部含Pydantic验证、错误处理、DB操作

1.3 实现 textures API (上传+管理)
    POST   /api/v1/textures/upload             上传纹理图片(保存到本地uploads/)
    GET    /api/v1/textures/                   纹理列表
    GET    /api/v1/textures/{id}               纹理详情
    DELETE /api/v1/textures/{id}               删除纹理
    - 文件大小/类型验证
    - 保存到uploads/目录
```

#### Day 3-4: 订单 + 确认单 API

```
2.1 实现 orders API
    POST   /api/v1/orders/                     创建订单(关联项目+SKU)
    GET    /api/v1/orders/                     订单列表
    GET    /api/v1/orders/{id}                 订单详情
    PUT    /api/v1/orders/{id}/status          更新状态
    POST   /api/v1/orders/{id}/confirm          业主确认
    - 生成唯一confirm_token
    - 关联Project→LayoutResult→OrderItem

2.2 实现 confirmation API
    POST   /api/v1/projects/{id}/confirmations 生成确认单快照
    GET    /api/v1/confirmations/{token}        公开预览(token验证)
    - 保存confirmation_data到Project JSONB字段
```

#### Day 5: 权限 + 用户

```
3.1 实现会员权限中间件
    @require_member 装饰器 → 检查 is_member 字段
    免费用户返回 HTTP 403
    应用到: products, orders, confirmation等路由

3.2 完善 users API
    GET    /api/v1/users/me                     返回完整用户+会员+门店信息
    PUT    /api/v1/users/me                     更新个人信息
    GET    /api/v1/store/profile                门店信息(会员)
    PUT    /api/v1/store/profile                更新门店信息(会员)
```

---

### 第2周：前端核心业务页面

#### Day 1-2: 整合Shared包 + 户型编辑器

```
4.1 将shared包组件接入web
    - RoomEditor (konva多边形编辑器)
    - LayoutRenderer (konva排版渲染)
    - 从shared/src复制到web/src/components/
    - 集成到ProjectEdit页替换占位画布

4.2 补全LayoutPreview
    - 从后端API获取排版数据
    - 替换静态HTML div为Canvas渲染
    - 整合LayoutRenderer组件
```

#### Day 3-4: 纹理 + 产品管理

```
5.1 TextureLibrary 页面
    - 纹理卡片网格展示
    - 上传按钮(调textures/upload API)
    - 删除确认

5.2 ProductManager 页面
    - 产品列表+搜索
    - 新增产品(名称+图片+关联纹理)
    - SKU管理(规格+价格)
    - 仅会员可用(UI权限控制)
```

#### Day 5: 订单流程

```
6.1 OrderCreate 页面
    - 选择项目和排版方案
    - 选择SKU/纹理
    - 输入客户信息
    - show_total_price开关(会员)
    - 价格预览

6.2 OrderDetail 页面
    - 订单状态展示
    - 产品清单
    - 确认链接分享
```

---

### 第3周：确认单 + 导出 + 测试

#### Day 1-2: 确认单实现

```
7.1 PPT生成引擎
    services/ppt_generator.py
    - 5页幻灯片: 封面/效果图/材料表/商家信息/签字
    - 使用python-pptx
    - 价格列条件显示
    - 商家信息条件显示
    - 返回BytesIO流

7.2 PDF生成
    services/pdf_generator.py
    - 基于reportlab
    - 或HTML转PDF方式

7.3 确认单预览页(前端)
    ConfirmationPreview.tsx
    - 5页卡片式布局
    - 自适应移动端
    - 根据会员状态条件渲染
```

#### Day 3-4: 完整测试

```
8.1 后端测试补齐
    - test_products_api.py (产品CRUD)
    - test_orders_api.py (订单流程)
    - test_auth_api.py (注册/登录)
    - test_permissions.py (会员中间件)

8.2 前端测试
    - 配置vitest
    - Home页渲染测试
    - API service mock测试
    - Store状态测试
```

#### Day 5: 修复 + 集成验证

```
9.1 修复排版引擎diagonal模式
    - layout_engine.py中补全对角铺贴逻辑
    - 添加diagonal测试用例

9.2 端到端验证
    - 注册→登录→创建项目→计算排版→预览→导出PDF
    - 完整业务链路测试
```

---

### 第4周：质量加固 (P2项)

```
10.1 日志系统
    - Python logging配置
    - 请求日志中间件
    - 错误追踪(Sentry可选)

10.2 API Rate Limiting
    - 使用slowapi或手动实现
    - 免费版3次/月排版限制

10.3 数据库连接池监控
    - 健康检查端点返回DB状态

10.4 Docker生产配置
    - nginx反向代理
    - 多阶段构建
    - 环境变量注入

10.5 CI/CD
    - GitHub Actions
    - 前端构建+后端测试+部署
```

---

## 四、优先级排序

| 优先级 | 内容 | 工作量 | 依赖 |
|--------|------|--------|------|
| P0-1 | API补齐(products/textures/orders/confirmation) | 3天 | 无 |
| P0-2 | 文件上传服务 | 1天 | P0-1 |
| P0-3 | PPT/PDF生成引擎 | 2天 | P0-1 |
| P0-4 | Alembic迁移 | 0.5天 | 无 |
| P0-5 | 前端接入画布编辑器 | 1天 | 无 |
| P0-6 | 会员权限中间件 | 0.5天 | P0-1 |
| P1-1 | 8个前端业务页面 | 3天 | P0-1 |
| P1-2 | 后端完整测试 | 1天 | P0-1 |
| P1-3 | 排版引擎diagonal修复 | 0.5天 | 无 |
| P2-1 | 日志+限流+监控 | 1.5天 | P0-1 |
| P2-2 | Docker+CI/CD | 1天 | 全部 |

---

## 五、建议执行顺序

```
Week 1:  P0-4 → P0-1 → P0-6 → P0-2 → P0-3
         (迁移→API→权限→上传→导出)

Week 2:  P0-5 → P1-1(纹理库+产品) 
         (画布→页面)

Week 3:  P1-1(订单+确认单) → P1-2 → P1-3
         (页面→测试→修复)

Week 4:  P2-1 → P2-2
         (质量→部署)
```

---

## 六、立即可开始的第一项任务

**Alembic初始化 + Products API完整实现**

这个任务：
- 依赖为0（alembic已安装, models已定义）
- 完成后立即可验证（API返回真实数据）
- 为后续products/textures/orders/confirmation全部API打基础

预计工时: 1.5天

---

**审查完成。以上计划覆盖了从当前42%完成度到v2.0生产级交付的全部工作。**
