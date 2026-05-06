# ============================================================
# 排砖宝 · 腾讯云部署指南
# ============================================================

## 前置条件
1. 腾讯云 CVM (Ubuntu 22.04, 2核4G+)
2. 域名已备案 (如 paizhuanbao.com)
3. SSL 证书 (腾讯云免费 SSL 或 Let's Encrypt)
4. COS 存储桶已创建 (存储纹理/手绘图/确认单)

## 第一步: 服务器初始化
```bash
ssh ubuntu@your-server-ip

# 安装 Docker
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER
newgrp docker

# 安装 Docker Compose
sudo apt install docker-compose-plugin -y
```

## 第二步: 上传代码
```bash
# 在本地打包上传
cd TileLayout\ AI
tar --exclude='node_modules' --exclude='.venv' --exclude='venv' --exclude='dist' --exclude='.git' -czf deploy.tar.gz .

# 上传到服务器
scp deploy.tar.gz ubuntu@your-server-ip:~/
ssh ubuntu@your-server-ip

# 解压
mkdir -p /opt/tilelayout
tar -xzf ~/deploy.tar.gz -C /opt/tilelayout
cd /opt/tilelayout
```

## 第三步: 配置环境变量
```bash
# 复制模板
cp .env.production .env

# 编辑 .env 填入真实值
vim .env

# 生成随机密钥
python3 -c "import secrets; print('JWT_SECRET=' + secrets.token_hex(32))"
python3 -c "import secrets; print('DB_PASSWORD=' + secrets.token_hex(16))"
python3 -c "import secrets; print('REDIS_PASSWORD=' + secrets.token_hex(16))"
```

## 第四步: 配置 SSL 证书
```bash
# 将证书文件放入 ssl 目录
mkdir -p ssl
# 腾讯云: 下载证书后重命名为 fullchain.pem 和 privkey.pem
mv your_domain.crt ssl/fullchain.pem
mv your_domain.key ssl/privkey.pem
chmod 600 ssl/privkey.pem
```

## 第五步: 构建前端并放入 nginx 静态目录
```bash
# 在本地构建
cd packages/web
npm run build

# 上传到服务器
scp -r dist/* ubuntu@your-server-ip:/opt/tilelayout/dist/
```

## 第六步: 启动服务
```bash
docker compose up -d

# 查看状态
docker compose ps
docker compose logs -f backend

# 运行数据库迁移 (容器的 CMD 已自动执行)
docker exec tilelayout-api python -m alembic upgrade head
```

## 第七步: 验证
```bash
# 健康检查
curl https://api.paizhuanbao.com/health

# API 文档
open https://api.paizhuanbao.com/api/docs

# 辅料计算
curl -X POST https://api.paizhuanbao.com/api/v1/materials/calculate \
  -H "Content-Type: application/json" \
  -d '{"area_sq_m":12,"tile_width_mm":800,"tile_height_mm":800,"gap_width_mm":3}'
```

## 常用运维命令
```bash
# 查看日志
docker compose logs -f --tail=100

# 重启单个服务
docker compose restart backend

# 重新构建
docker compose up -d --build

# 备份数据库
docker exec tilelayout-db pg_dump -U tilelayout tilelayout > backup.sql

# 进入容器调试
docker exec -it tilelayout-api bash
docker exec -it tilelayout-db psql -U tilelayout
```

## COS 存储桶 CORS 配置
```json
[
  {
    "AllowedOrigins": ["https://app.paizhuanbao.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## CDN 配置建议
- HTML/JSON: 不缓存或 Cache-Control: no-cache
- JS/CSS (带 hash): 长期缓存 Cache-Control: max-age=31536000
- 图片/纹理: Cache-Control: max-age=604800
- PPT/PDF: Cache-Control: max-age=3600

## 监控告警
在腾讯云控制台配置:
- CPU > 80% 持续 5 分钟 → 短信通知
- 内存 > 80% → 企业微信通知
- 磁盘 > 85% → 邮件通知
- 5xx 错误率 > 5% → 即时告警
