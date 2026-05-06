# 排砖宝·AI开发规则 (最高优先级)

你正在开发「排砖宝 (TileLayout AI)」—— 瓷砖排版与销售闭环轻量工具。

## 铁的纪律
1. **零占位符**: 所有生成的代码必须是真实可运行的，不允许任何"即将上线""TODO""开发中"的占位
2. **辅料不可少**: 每次涉及材料计算必须包含瓷砖胶、美缝剂、水泥砂、十字卡四项
3. **权限后端校验**: 价格/商家信息必须后端 Depends(require_member) 二次检查，不可信任前端
4. **类型完整**: 禁止 any，所有变量/函数/组件显式类型

## 当前项目状态 (2026-05-06)
- 后端: ✅ FastAPI + SQLAlchemy async + SQLite/PostgreSQL
- 排版引擎: ✅ 纯Python Sutherland-Hodgman 裁剪
- 辅料计算: ✅ 瓷砖胶/美缝剂/水泥砂/十字卡
- PPT生成: ✅ python-pptx 5页确认单
- PDF生成: ✅ reportlab
- 手绘识别: ✅ OpenCV 轮廓提取 (PaddleOCR待安装)
- 前端户型编辑: ✅ Canvas 多边形编辑器 (顶点吸附/拖拽)
- 前端确认单预览: ✅ ConfirmationPreview 组件
- 腾讯云部署: ✅ docker-compose + Nginx + 配置文件

## 待修复P0项 (立即执行)
1. PWA: 安装 vite-plugin-pwa + 配置 manifest.json
2. API频率限制: slowapi 中间件
3. 起铺点前端拖拽交互
4. 手机号公开链接脱敏
5. 免费次数限制可配置

## 命名规范
- 前端: kebab-case | 后端: snake_case
- React组件: PascalCase | API函数: snake_case
- 不含I前缀, 不含any类型

## 文件引用格式
使用 [filename](file:///absolute-path#Lstart-Lend) 格式
