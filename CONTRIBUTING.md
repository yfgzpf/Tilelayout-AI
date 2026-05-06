# 贡献指南

感谢您考虑为排砖宝项目做出贡献！

## 开发流程

### 1. Fork 并克隆仓库

```bash
git clone https://github.com/your-username/tilelayout-ai.git
cd tilelayout-ai
```

### 2. 安装依赖

#### 前端依赖
```bash
pnpm install
```

#### 后端依赖
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. 创建分支

```bash
git checkout -b feature/your-feature-name
```

### 4. 开发

- 遵循项目的编码规范
- 编写清晰的提交信息
- 添加必要的测试

### 5. 提交代码

```bash
git add .
git commit -m "feat: 添加新功能描述"
```

### 6. 推送并创建 Pull Request

```bash
git push origin feature/your-feature-name
```

然后在 GitHub 上创建 Pull Request。

## 编码规范

### 前端 (TypeScript/React)

- 使用 TypeScript 严格模式
- 遵循 ESLint 和 Prettier 配置
- 组件使用 PascalCase 命名
- 函数使用 camelCase 命名
- 文件使用 kebab-case 命名

### 后端 (Python)

- 遵循 PEP 8 规范
- 使用 Black 和 isort 格式化代码
- 使用类型注解
- 编写文档字符串

## 提交信息规范

使用约定式提交格式：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建/工具相关

## 测试

### 前端测试
```bash
pnpm test
```

### 后端测试
```bash
cd backend
pytest
```

## 代码审查

所有 Pull Request 都需要至少一位维护者的审查才能合并。

## 问题反馈

如果您发现 bug 或有功能建议，请创建 Issue 并详细描述问题或建议。

## 许可证

贡献的代码将采用 MIT 许可证。

---

再次感谢您的贡献！
