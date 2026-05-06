1. 项目总体概述
产品名称: 排砖宝 (TileLayout AI)
一句话定位: 为瓷砖门店和设计师提供“拍照手绘户型→精准排版→真实纹理渲染→下单确认→加工施工图”全链路轻量工具
核心差异化:

数学几何算法保证排版 100% 精准

手绘草图 AI 识别转换为可编辑精确多边形

支持手拍实物瓷砖抠图，在排版图中真实纹理渲染

一键生成带产品图、规格、价格、商家信息的标准确认单 (PPT)

三端统一：Web PWA、手机 App (iOS/Android)、桌面应用 (Win/Mac/Linux)

免费/会员权限控制，商家信息、价格显示可配置

目标用户: 瓷砖品牌门店、独立设计师、装修公司
商业模式:

免费版：核心排版带水印，次数限制，商家信息隐藏

设计师个人版：19元/月或99元/年，无水印，无限排版，高清PDF，可显示价格

门店专业版：199元/月起，多子账号、产品库管理、自定义确认单品牌信息、API对接

2. 技术架构总览
text
┌──────────────────────────────────────────┐
│  前端 Monorepo (React + TypeScript)        │
│  - packages/shared (所有业务逻辑与UI)      │
│  - apps/web (PWA)                         │
│  - apps/mobile (Capacitor)                │
│  - apps/desktop (Tauri)                   │
└──────────────────┬───────────────────────┘
                   │ REST API
┌──────────────────▼───────────────────────┐
│  后端 Python FastAPI                       │
│  - 排版计算引擎 (Shapely)                │
│  - 图像处理服务 (rembg, OpenCV)          │
│  - OCR识别 (PaddleOCR)                   │
│  - 订单与用户系统                        │
│  - PPT/PDF 生成 (python-pptx, ReportLab) │
└──────────────────┬───────────────────────┘
                   │
┌──────────────────▼───────────────────────┐
│  数据层: PostgreSQL + Redis + 对象存储    │
└──────────────────────────────────────────┘
关键设计原则:

前端轻量，重交互；后端重计算与文件生成

核心几何算法完全独立，确保精确，不依赖 AI 随机性

平台差异通过接口适配器隔离，共享代码 >95%

所有功能模块均考虑免费/会员差异

3. 分阶段开发路线图
第一阶段：精确排版核心 (MVP v0.5)
目标：跑通手动户型输入 → 数学排版 → 基础出图
功能：多边形编辑器、输入尺寸、选择砖规格、起铺点拖拽、排版预览 (色块)、基础 PDF 导出 (无纹理)

第二阶段：手绘识别 + 在线编辑 (v1.0)
功能：手绘草图上传、OCR尺寸识别、轮廓提取、结果回填编辑器、纹理拍照与抠图、简易在线编辑器

第三阶段：纹理渲染 + 确认单 (v1.5)
功能：排版图用真实纹理填充、订单创建、报价计算、PPT 确认单生成 (商家信息、价格可配置)

第四阶段：加工单 + 施工图 + 闭环 (v2.0)
功能：切割加工单 (工厂)、编号施工图、订单状态管理、业主在线确认

第五阶段：全平台完善与发布
功能：付费墙、多租户产品库、桌面端离线模式、移动端上架

本文档覆盖完整 v2.0 全部需求的规范定义，AI 可按阶段执行。

4. 完整数据模型 (SQLAlchemy/ORM)
python
# 用户与门店
class User:
    id: UUID
    phone: str
    hashed_password: str
    is_member: bool = False
    member_until: datetime = None
    store_profile: Optional[StoreProfile]

class StoreProfile:
    id: UUID
    user_id: UUID (unique)
    store_name: str
    logo_url: str
    contact_phone: str
    address: str
    qr_code_url: str = None

# 材质库
class Texture:
    id: UUID
    owner_id: UUID (User)
    name: str
    original_image_url: str
    processed_image_url: str  # 抠图去背后的纹理
    width_mm: int
    height_mm: int
    created_at: datetime

# 产品 (门店可维护)
class Product:
    id: UUID
    store_id: UUID (StoreProfile)
    name: str
    image_url: str
    texture_id: UUID (nullable)
    created_at: datetime

class ProductSKU:
    id: UUID
    product_id: UUID
    size_x_mm: int
    size_y_mm: int
    price_per_piece: Decimal  # 单片价格，商家填入
    unit: str = "片"
    stock: int = 0

# 项目
class Project:
    id: UUID
    user_id: UUID
    name: str
    room_polygon: JSON  # 存储顶点列表 [[x1,y1],...] (mm)
    edges_annotated: JSON  # 各边标注长度
    tile_config: JSON  # 砖规格、留缝、方向、起铺点等
    status: str = "draft"

# 排版结果 (可缓存)
class LayoutResult:
    id: UUID
    project_id: UUID
    texture_id: UUID  # 使用的纹理
    tiles: JSON  # 瓷砖列表及坐标
    statistics: JSON  # 用量统计
    preview_image_url: str  # 预览图

# 订单
class Order:
    id: UUID
    project_id: UUID
    store_user_id: UUID
    customer_name: str
    customer_phone: str
    status: str = "draft"
    total_amount: Decimal = 0
    show_total_price: bool = False  # 是否在确认单中显示总价
    confirm_token: str (unique)
    confirmed_at: datetime = None

class OrderItem:
    id: UUID
    order_id: UUID
    sku_id: UUID
    texture_id: UUID
    quantity_whole: int
    quantity_cut: int
    price_per_piece: Decimal  # 快照价格
    layout_snapshot: JSON  # 该材料对应的砖列表
价格字段权限:

商家在 ProductSKU.price_per_piece 设置单价，并在创建订单时自动带入 OrderItem.price_per_piece。

订单有个开关 show_total_price，控制确认单及前端预览是否展示价格列和总金额。免费版即使创建订单也无法显示价格（或强制不显示），会员可选择显示。

5. API 设计 (RESTful, Base: /api/v1)
5.1 认证与用户
POST /auth/register

POST /auth/login

GET /users/me 返回用户信息及 is_member, store_profile

5.2 材质管理
POST /textures/upload 上传原图，自动抠图，返回 texture 对象

POST /textures/{id}/process 手动编辑后保存 (如透视校正)

GET /textures 列出我的纹理

5.3 产品与SKU (门店版)
POST /products 创建产品

POST /products/{id}/skus 添加规格与价格

PUT /products/{id}/skus/{sku_id} 修改价格等

GET /products 获取门店产品列表

5.4 排版项目
POST /projects 创建新项目

PUT /projects/{id} 更新户型、配置

POST /projects/{id}/calculate 执行排版计算，需传入 texture_id 和 sku_id (可选)
Request: { "texture_id": "...", "config": {...} }
Response: LayoutResult

GET /projects/{id}/layout 获取最新排版结果

5.5 导出
POST /projects/{id}/export/pdf 生成排版施工图 PDF

POST /projects/{id}/export/confirmation-ppt 生成确认单 PPT
参数: include_quote (bool), show_total (该订单或项目的价格显示开关)
自动根据会员状态决定是否填入商家信息。

5.6 订单
POST /orders 从项目创建订单
Body: { project_id, items: [{sku_id, texture_id, quantity...}], show_total_price, customer_name, phone }

GET /orders/{id}/confirm 公开确认页数据 (token)

POST /orders/{id}/confirm 业主确认 (可能包含签名图片)

PUT /orders/{id}/status 门店更新进度

6. 前端页面与组件树
tree
src/
├── pages/
│   ├── Home.tsx                 # 项目列表
│   ├── ProjectEdit.tsx          # 户型编辑 (RoomEditor)
│   ├── ProjectConfig.tsx        # 参数配置
│   ├── LayoutPreview.tsx        # 排版预览与纹理选择
│   ├── TextureLibrary.tsx       # 材质库
│   ├── TextureEditor.tsx        # 在线抠图编辑
│   ├── ProductManager.tsx       # 产品与SKU管理
│   ├── OrderCreate.tsx          # 发起下单
│   ├── OrderDetail.tsx          # 订单详情
│   ├── OrderConfirm.tsx         # 业主确认页
│   └── ConfirmationPreview.tsx  # PPT 预览页
├── components/
│   ├── RoomEditor/              # 多边形编辑器 (Konva)
│   ├── LayoutRenderer/          # 排版图渲染 (纹理填充)
│   ├── MaterialPicker/          # 纹理/产品选择器
│   ├── PriceInput/              # 价格输入组件 (仅会员可见)
│   ├── StoreInfoForm/           # 门店信息编辑表单
│   └── UpgradePrompt/           # 升级提示
├── platform/                    # 平台适配器
├── store/                       # Zustand 状态
└── services/                    # API 调用封装
价格输入与显示逻辑组件:

PriceInput: 在 SKU 编辑表单中，仅当用户是会员且已关联门店时可用。若不是会员，输入框禁用并提示升级。

OrderCreate 页: 有一个开关 “在确认单中显示总价”，默认关闭。免费用户该开关强制关并提示。

LayoutPreview 中如果关联了 SKU 且允许显示，可在砖块列表侧边显示小计。

7. 核心交互与业务规则 (逐步细化)
7.1 排版计算与材质关联
用户进入预览页，从材质库选择纹理 (或先上传纹理)。

排版计算时传入 texture_id，后端记录到 LayoutResult。

前端渲染时，用纹理图片在 Konva 中以 Pattern 填充多边形。

7.2 下单与价格设置
在 ProjectConfig 页或专门的 “发起订单” 页，门店选择使用的产品 SKU，该 SKU 带有 price_per_piece。

系统自动根据排版统计的整砖/切割砖数量计算总价 (公式: (整砖数 + 切割砖数) * 单价)。

门店可选择是否在确认单中显示价格总价 (show_total_price)。

生成确认单 (PPT) 时：

若 show_total_price 为 true 且会员有效，则在材料清单表显示单价与金额列，并显示总计。

否则隐藏价格列，或显示 “未设定”。

7.3 免费/会员权限差异汇总
功能点	免费版	会员版
排版计算 & 预览	每月3次，带水印	无限，去水印
纹理上传与抠图	5张	无限
产品库 & SKU 管理	不可用	可用
价格输入	不可用	可用
确认单中价格显示	强制隐藏	可选显示
确认单商家信息	隐藏，展示升级引导	完整门店信息、Logo、联系方式
高清 PDF / PPT 导出	水印版	无水印
API 对接	不支持	提供
权限确认在 API 层通过 Depends(get_current_user) 校验会员身份，前端根据用户状态渲染 UI。

8. PPT 确认单生成详细规范 (python-pptx)
8.1 幻灯片结构 (标准 16:9)
封面页

方案效果图页 (排版渲染图)

材料明细清单页 (表格)

商家信息与售后页 (仅会员)

客户确认签字页

8.2 生成逻辑伪代码
python
def create_confirmation_ppt(order, project, layout, textures):
    prs = Presentation()
    # 幻灯片大小 16:9
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # 封面
    slide1 = prs.slides.add_slide(blank_layout)
    if user.is_member and store:
        # 插入 Logo, 名称，电话地址
        pass
    else:
        # 插入灰色占位符 “升级会员展示品牌”
        pass
    # 添加项目标题、日期

    # 效果图
    slide2 = prs.slides.add_slide(blank_layout)
    add_image(slide2, layout.preview_image_url)

    # 材料清单
    slide3 = prs.slides.add_slide(blank_layout)
    table = slide3.shapes.add_table(rows=len(items)+1, cols=6, ...).table
    # 表头: 产品图 | 名称 | 规格 | 数量 | 单价 | 金额
    if order.show_total_price and user.is_member:
        # 填充单价与金额，计算合计
    else:
        # 单价与金额列显示 “-” 或隐藏
    # 插入产品缩略图到表格第一列

    # 商家页
    if user.is_member:
        add_store_page(slide4, store)
    # 签字页
    add_sign_page(slide5)

    # 返回二进制流
8.3 前端预览器 (ConfirmationPreview)
使用三个 div 模拟幻灯片，通过 CSS 样式呈现纸张效果。

根据当前用户会员状态和 show_total_price 动态渲染价格列。

提供 “下载PPT文件” 按钮，调用 API。

9. 平台适配指南
9.1 Web (PWA)
使用 vite-plugin-pwa 生成 Service Worker，缓存核心资源。

图片处理由后端执行。

文件下载使用 <a> 标签触发。

9.2 Mobile (Capacitor)
调用 Camera 插件拍照，Filesystem 保存导出的文件。

分享功能可使用 Share 插件。

离线能力: 排版预览可缓存，下单需网络。

9.3 Desktop (Tauri)
Tauri 文件保存对话框用于下载 PPT/PDF。

后期可集成 Python 后端为 sidecar 实现完全离线排版。

10. AI 编程执行指令 (System Prompt)
将此段置于 AI 对话的开头或项目规则文件：

text
你是一名资深全栈工程师，精通 React、TypeScript、Python、FastAPI、几何计算、图像处理。你需要严格按照以下项目规范，从零开始构建一个名为“排砖宝”的瓷砖排版与销售闭环应用。

项目采用 pnpm monorepo 架构，前端共享代码，后端独立。请按阶段顺序生成代码，每完成一个阶段暂停并等待我确认，再继续下一个。

关键要求：
- 所有代码必须完整类型定义、错误处理、加载状态。
- 核心排版算法使用 Python Shapely 实现纯数学逻辑。
- 价格输入和总价显示功能必须遵循免费/会员差异，后端强制。
- PPT 生成严格遵循 5 页结构，商家信息和价格根据权限填充。
- 多平台适配器代码清晰分离。

请从第一阶段项目初始化开始，生成目录结构、配置文件、基础共享包。
以上即是完整的《从头开始的项目开发指南与AI编程规范》，覆盖了所有需求，可直接交付AI执行