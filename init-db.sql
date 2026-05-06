-- ============================================================
-- 排砖宝 · 数据库初始化 (PostgreSQL on 腾讯云)
-- 执行时机: 首次 docker-compose up
-- ============================================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建数据库 (如果不存在)
-- SELECT 'CREATE DATABASE tilelayout' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'tilelayout')\gexec
