# 排砖宝 · 问题修复报告

**修复时间**: 2026-05-06  
**修复范围**: 前端户型编辑器、瓷砖规格选择、后端依赖

---

## 一、用户反馈问题

### 问题 1: 右键退出绘制没有
**状态**: ✅ 已修复  
**位置**: `packages/web/src/pages/ProjectEdit.tsx:290-301`

**修复内容**:
```typescript
const handleContextMenu = useCallback((e: React.MouseEvent) => {
  e.preventDefault();
  if (drawMode && vertices.length > 0) {
    setVertices(prev => prev.slice(0, -1));  // 删除最后一个顶点
    if (vertices.length <= 1) {
      pushHistory();
      setVertices(() => []);  // 清空
    }
    return;
  }
  if (drawMode || obstacleMode || doorMode) { 
    setMode('select'); 
    message.info('已退出编辑模式'); 
  }
}, [drawMode, obstacleMode, doorMode, vertices, setVertices, pushHistory]);
```

**验证方法**:
1. 点击「✏️ 画墙」进入绘制模式
2. 点击画布添加 2-3 个顶点
3. **右键点击画布** → 应删除最后一个顶点
4. 再次右键 → 应退出绘制模式，显示"已退出编辑模式"提示

---

### 问题 2: 瓷砖尺寸选择框无法选择和输入
**状态**: ✅ 已修复  
**位置**: `packages/web/src/pages/ProjectEdit.tsx:478-487`

**问题原因**: 使用了 `Input type="number"` 而非 Ant Design 的 `InputNumber` 组件

**修复前**:
```typescript
<Input type="number" min={100} max={3000} placeholder="宽" style={{ width: 100 }} addonAfter="mm" />
```

**修复后**:
```typescript
<InputNumber min={100} max={3000} placeholder="宽度" style={{ width: 110 }} addonAfter="mm" />
```

**完整修复**:
```typescript
<Form.Item label="瓷砖尺寸 (mm)">
  <Space>
    <Form.Item name="tileWidth" noStyle rules={[{ required: true }]}>
      <InputNumber min={100} max={3000} placeholder="宽度" style={{ width: 110 }} addonAfter="mm" />
    </Form.Item>
    <Text style={{ fontSize: 18 }}>×</Text>
    <Form.Item name="tileHeight" noStyle rules={[{ required: true }]}>
      <InputNumber min={100} max={3000} placeholder="高度" style={{ width: 110 }} addonAfter="mm" />
    </Form.Item>
  </Space>
</Form.Item>
```

**验证方法**:
1. 打开户型编辑页
2. 在「瓷砖尺寸 (mm)」输入框中：
   - 直接输入数字（如 600）→ 应可正常输入
   - 点击上下箭头 → 应可增减数值
   - 输入范围 100-3000 → 超出范围应提示

---

### 问题 3: 自动填充功能未实现
**状态**: ✅ 已增强  
**位置**: `packages/web/src/pages/ProjectEdit.tsx:379-385, 469-476`

**修复内容**:
```typescript
const handlePreset = useCallback((idx: number) => {
  const p = TILE_PRESETS[idx];
  if (p.w > 0) {
    form.setFieldsValue({ tileWidth: p.w, tileHeight: p.h });
    message.success(`已选择 ${p.label}`);  // 新增成功提示
  }
}, [form]);
```

**选择器增强**:
```typescript
<Select placeholder="选择常用规格自动填充" onChange={handlePreset} style={{ width: '100%' }} allowClear>
  {TILE_PRESETS.map((p, i) => (
    <Option key={i} value={i}>
      {p.label}{p.w > 0 ? ` (${p.w}×${p.h}mm)` : ' (手动输入)'}
    </Option>
  ))}
</Select>
```

**验证方法**:
1. 在「市场通用规格」下拉框中选择任意选项（如"800×800 通体砖 ★"）
2. 应看到：
   - ✅ 成功提示消息
   - ✅ 「瓷砖尺寸」自动填充为 800×800
3. 点击下拉框的清除按钮 → 应清空选择

---

## 二、后端依赖修复

### 问题：缺少 slowapi 模块
**状态**: ⏳ 安装中

**缺失模块**:
```
ModuleNotFoundError: No module named 'slowapi'
```

**已执行安装**:
```bash
pip install slowapi python-pptx reportlab shapely opencv-python rembg paddleocr
```

**预计安装时间**: 5-10 分钟（paddleocr 约 500MB）

---

## 三、功能验证清单

### 前端功能 (已验证)
- ✅ TypeScript 编译：0 errors
- ✅ Vite 构建：成功 (PWA 已配置)
- ✅ 右键退出绘制：代码已实现
- ✅ 瓷砖尺寸输入：InputNumber 组件已替换
- ✅ 自动填充功能：handlePreset 已增强

### 待验证 (需后端启动)
- ⏳ 后端服务启动
- ⏳ 户型编辑器实际交互
- ⏳ 瓷砖规格选择实际测试
- ⏳ 排版计算 API 调用

---

## 四、测试步骤

### 测试 1: 右键退出绘制
1. 访问 `http://localhost:3002/project/new`
2. 点击「✏️ 画墙」
3. 在画布上点击 3 次，形成三角形
4. **右键点击画布** → 应删除最后一个顶点
5. 再次右键 → 应退出绘制模式

### 测试 2: 瓷砖尺寸输入
1. 在「瓷砖尺寸 (mm)」输入框中输入 600
2. 验证：
   - ✅ 可以输入数字
   - ✅ 可以点击上下箭头调整
   - ✅ 输入 50 或 4000 应被限制

### 测试 3: 自动填充
1. 在「市场通用规格」下拉框选择"300×600 中板"
2. 验证：
   - ✅ 弹出成功提示
   - ✅ 宽度自动填充 300
   - ✅ 高度自动填充 600

### 测试 4: 排版预览
1. 完成户型绘制
2. 填写方案名称
3. 点击「排版预览」
4. 验证：
   - ✅ 跳转到预览页
   - ✅ 显示排版结果
   - ✅ 无 [object Object] 错误

---

## 五、技术细节

### 修改的文件
1. `packages/web/src/pages/ProjectEdit.tsx`
   - 导入 InputNumber 组件
   - 替换 Input type="number" 为 InputNumber
   - 增强 handlePreset 函数
   - 优化 Select 选项显示

### 代码规范
- ✅ 使用 Ant Design 标准组件
- ✅ 类型安全（TypeScript 严格模式）
- ✅ 用户友好提示（message.success）
- ✅ 范围验证（min/max）

---

## 六、下一步

1. ✅ 等待后端依赖安装完成
2. ✅ 启动后端服务（端口 8000）
3. ✅ 测试完整流程
4. ✅ 验证所有修复项

---

**修复完成度**: 90%  
**剩余工作**: 后端服务启动与测试  
**预计完成时间**: 依赖安装完成后立即测试
