# 排砖宝 (TileLayout AI) — 生产级交付审查报告

**审查日期**: 2026-05-06
**审查范围**: 全栈项目（前端 Monorepo + 后端 FastAPI）
**审查级别**: 生产级交付标准
**审查方法**: 静态代码分析 + 依赖验证 + 架构对齐检查

---

## 一、审查总览

### 1.1 审查维度与评分

| 维度 | 评分 | 状态 | 说明 |
|------|------|------|------|
| 架构设计对齐度 | 85/100 | ✅ | 与技术规范高度一致，三端架构清晰 |
| 前端代码质量 | 72/100 | ⚠️ | Home.tsx 已达生产标准，其他页面需升级 |
| 后端代码质量 | 65/100 | ⚠️ | 排版引擎质量高，API路由大量占位代码 |
| 数据库模型完整性 | 90/100 | ✅ | 9个模型覆盖全部业务，关系定义正确 |
| 安全性 | 60/100 | ❌ | SECRET_KEY硬编码，缺失用户认证实现 |
| 测试覆盖 | 30/100 | ❌ | 仅后端有1个测试脚本，前端无测试 |
| 配置文件完整性 | 80/100 | ✅ | Monorepo/Docker/Env配置完整 |
| 可运行性 | 55/100 | ❌ | Shapely无法安装（权限），pydantic-settings版本不匹配 |

### 1.2 审查结论

**当前状态**: ⚠️ **MVP v0.5 核心框架已就绪，但不符合生产级部署标准**

**核心问题**: 6 个阻塞性、4 个高优先级、3 个中优先级问题已识别

---

## 二、阻塞性问题 (Blocker/P0)

### 2.1 ❌ pydantic-settings 版本不兼容
**文件**: [requirements.txt](file:///f:/目录已检查/TileLayout%20AI/backend/requirements.txt#L8)
**现象**: `requirements.txt` 要求 `pydantic-settings==2.1.0`，实际环境安装的是 `2.12.0`
**影响**: 可能导致 `from pydantic_settings import BaseSettings` 导入失败
**修复**: 更新 requirements.txt 放宽版本约束

### 2.2 ❌ SECRET_KEY 硬编码在生产代码中
**文件**: [config.py](file:///f:/目录已检查/TileLayout%20AI/backend/app/core/config.py#L10)
**现象**: `SECRET_KEY: str = "your-secret-key-change-in-production"`
**风险**: 🔴 CRITICAL - 若部署到生产，JWT 可被伪造
**修复**: 移除默认值，强制从环境变量读取

### 2.3 ❌ 环境变量中数据库密码明文放置
**文件**: [.env.example](file:///f:/目录已检查/TileLayout%20AI/.env.example#L6-L7)
**现象**: `DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/tilelayout`
**风险**: 🔴 泄露即数据库被完全控制
**修复**: 示例文件中使用占位符，不提供真实凭据

### 2.4 ❌ 多个 API 路由仅有占位代码，无业务逻辑
**文件**: [auth.py](file:///f:/目录已检查/TileLayout%20AI/backend/app/api/auth.py#L6-L13), [users.py](file:///f:/目录已检查/TileLayout%20AI/backend/app/api/users.py#L6-L8), [orders.py](file:///f:/目录已检查/TileLayout%20AI/backend/app/api/orders.py#L6-L23), [confirmation.py](file:///f:/目录已检查/TileLayout%20AI/backend/app/api/confirmation.py#L6-L23), [products.py](file:///f:/目录已检查/TileLayout%20AI/backend/app/api/products.py#L6-L21), [textures.py](file:///f:/目录已检查/TileLayout%20AI/backend/app/api/textures.py#L6-L17)
**现象**: 6/7 个 API 路由文件全部返回 `{"message": "xxx endpoint"}` 占位文本
**影响**: 🔴 无法进行任何真实业务流程测试
**修复**: 实现完整的业务逻辑

### 2.5 ❌ Shapely 无法在当前环境安装
**文件**: [requirements.txt](file:///f:/目录已检查/TileLayout%20AI/backend/requirements.txt#L14)
**现象**: `pip install shapely` 失败，错误码 WinError 5（权限拒绝）
**影响**: 排版计算引擎无法运行
**修复**: 重建虚拟环境或使用 `--user` 参数

### 2.6 ❌ 前端类型定义存在严重不一致
**文件**: [types/index.ts](file:///f:/目录已检查/TileLayout%20AI/packages/shared/src/types/index.ts) vs [model.py](file:///f:/目录已检查/TileLayout%20AI/backend/app/models/models.py)
**现象**: 前端 `Product` 的 `storeId` 引用 `store_profiles.user_id`，但 `StoreProfile` 的 `userId` 类型在前端缺失
**影响**: 前后端数据契约不一致，运行时可能出现类型错误
**修复**: 统一前后端类型定义

---

## 三、高优先级问题 (High/P1)

### 3.1 ⚠️ 排版引擎 `is_cut` 判断逻辑有误
**文件**: [layout_engine.py](file:///f:/目录已检查/TileLayout%20AI/backend/app/services/layout_engine.py#L98-L100)
```python
is_cut = not tile_box.equals(intersection)
```
**问题**: 判断条件 `equals` 使用精确相等容差比较，Shapely 的浮点运算可能导致实际上尺寸相同的瓷砖被误判为切割砖
**建议**: 使用 `tile_box.equals_exact(intersection, tolerance=0.01)` 替换

### 3.2 ⚠️ API 服务层缺少重试机制和超时控制
**文件**: [services/index.ts](file:///f:/目录已检查/TileLayout%20AI/packages/shared/src/services/index.ts#L22-L30)
**问题**: `fetch` 无超时控制，无线程/可取消请求控制器，网络不稳定的场景下用户体验差
**修复**: 添加 AbortController + 超时机制

### 3.3 ⚠️ Zustand Store 缺少中间件
**文件**: [store/index.ts](file:///f:/目录已检查/TileLayout%20AI/packages/shared/src/store/index.ts#L1)
**问题**: 无 `devtools`、`persist` 中间件，刷新即丢失状态，调试困难
**建议**: 给核心 Store 添加 `persist` 中间件

### 3.4 ⚠️ LayoutRenderer 组件性能问题
**文件**: [LayoutRenderer.tsx](file:///f:/目录已检查/TileLayout%20AI/packages/shared/src/components/LayoutRenderer/LayoutRenderer.tsx#L23-L29)
**问题**: 每次 render 都重新计算 `scale`，`tiles.length > 0` 时两次 `Math.max(...tiles.map())` 计算
**修复**: 使用 `useMemo` 缓存计算结果

---

## 四、中优先级问题 (Medium/P2)

### 4.1 📝 前端占位页面过多
**文件**: 8个 TSX 页面文件（ConfirmationPreview, OrderConfirm, OrderDetail, OrderCreate, ProductManager, TextureEditor, TextureLibrary, ProjectConfig）
**问题**: 全部返回 `<Card><Title>xxx</Title><Text>...功能开发中</Text></Card>`
**影响**: 路由存在但无实际功能，用户访问会产生困惑

### 4.2 📝 排版引擎 `optimize_layout` 不够高效
**文件**: [layout_engine.py](file:///f:/目录已检查/TileLayout%20AI/backend/app/services/layout_engine.py#L169-L184)
**问题**: 仅尝试 4 种偏移组合（2×2），且 `best_layout` 可能返回 `None`
**修复**: 扩展优化范围

### 4.3 📝 RoomEditor 使用 `useRef<any>`
**文件**: [RoomEditor.tsx](file:///f:/目录已检查/TileLayout%20AI/backend/../packages/shared/src/components/RoomEditor/RoomEditor.tsx#L17)
**问题**: `useRef<any>(null)` - 使用了 `any` 类型
**修复**: 使用 Konva 的 `Stage` 类型定义

---

## 五、架构对齐检查

### 5.1 与规范文档对比

| 规范项 | 状态 | 详情 |
|--------|------|------|
| Monorepo 结构 (pnpm+Turborepo) | ✅ | 完全对齐 |
| 三端架构 (Web/Mobile/Desktop) | ✅ | 目录结构完整 |
| 前端共享包 (packages/shared) | ✅ | 组件/服务/store/types 全覆盖 |
| 后端 FastAPI | ✅ | 路由/模型/服务分层清晰 |
| PostgreSQL + SQLAlchemy | ✅ | 9 个模型关系正确定义 |
| PWA 支持 | ✅ | vite-plugin-pwa 已配置 |
| PPT/PDF 生成 | ❌ | 仅有占位代码 |
| 确认单 5 页结构 | ❌ | 未实现 |
| 免费/会员权限 | ❌ | 未实现 |
| 用户认证 (JWT) | ⚠️ | security.py 有工具函数，API无集成 |
| 文件上传/抠图 | ❌ | 仅占位 |

### 5.2 规范对齐评分: **68/100**

---

## 六、运行时环境验证

### 6.1 Python 环境

| 项目 | 状态 |
|------|------|
| Python 3.14.0 | ✅ 可用 |
| FastAPI 0.128.0 | ✅ 已安装 |
| SQLAlchemy 2.0.45 | ✅ 已安装 |
| pydantic 2.12.5 | ✅ 已安装 |
| pydantic-settings 2.12.0 | ⚠️ 版本不匹配 |
| passlib 1.7.4 | ✅ 已安装 |
| python-jose 3.5.0 | ✅ 已安装 |
| bcrypt 5.0.0 | ✅ 已安装 |
| python-multipart 0.0.21 | ✅ 已安装 |
| shapely | ❌ 未安装（权限拒绝） |
| numpy | ❌ 未验证 |
| rembg | ❌ 未安装 |
| opencv-python-headless | ❌ 未安装 |

### 6.2 前端环境

| 项目 | 状态 |
|------|------|
| Node.js >= 18 | ❓ 未验证 |
| pnpm >= 8 | ❓ 未验证 |
| TypeScript 5.3+ | ❓ 未验证（npm缓存权限问题） |
| ESLint + Prettier | ❓ 配置文件已就绪，未运行 |

### 6.3 排版引擎逻辑验证 (静态审查)

**测试用例 1**: 3m×4m 房间 + 800×800 瓷砖 + 3mm 留缝 + 横向铺贴
- 预期: ~20 块瓷砖，整砖 12-15 块
- 代码路径确认: ✅ 通过静态审查，逻辑正确
- 运行时验证: ❌ 无法运行（Shapely 缺失）

**测试用例 2**: 非矩形多边形 (L 形房间)
- 代码路径确认: ⚠️ `intersection` 逻辑支持任意多边形
- 运行时验证: ❌ 无法运行

---

## 七、安全审查

### 7.1 认证与授权

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 密码加密存储 | ✅ | bcrypt + passlib |
| JWT Token | ✅ | security.py 已实现 |
| API 认证集成 | ❌ | 所有路由无 `Depends(get_current_user)` |
| 会员权限中间件 | ❌ | `@require_member` 未实现 |
| CORS 配置 | ⚠️ | allow_origins 使用了硬编码默认值 |

### 7.2 数据安全

| 检查项 | 状态 | 详情 |
|--------|------|------|
| SQL 注入防护 | ✅ | SQLAlchemy ORM 参数化查询 |
| XSS 防护 | ✅ | React 默认转义 |
| 敏感信息泄露 | ❌ | SECRET_KEY 硬编码 |
| HTTPS | ⚠️ | 未配置，部署时需添加 |
| 文件上传验证 | ❌ | 未实现 |

---

## 八、修复措施

以下为**必须修复才能达到生产级标准**的问题及修复方案：

### 修复 1: 修复 pydantic-settings 版本约束
### 修复 2: 移除 SECRET_KEY 默认值
### 修复 3: 实现用户认证 API 集成
### 修复 4: 为 API 服务添加超时和重试
### 修复 5: 修复排版引擎 `is_cut` 判断
### 修复 6: 为 LayoutRenderer 添加 useMemo 优化
### 修复 7: RoomEditor 消除 `any` 类型

---

**审查人**: AI Code Review System
**审查完成时间**: 2026-05-06
**建议操作**: 修复所有 Blocker/P0 问题后方可进入生产部署
