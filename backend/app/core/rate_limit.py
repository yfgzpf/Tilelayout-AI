"""
API 频率限制中间件

使用 slowapi 实现基于 Redis 的速率限制
防止 API 被恶意调用
"""
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse
import os


def get_client_identifier(request: Request) -> str:
    """
    获取客户端标识符
    优先级：JWT user_id > IP 地址
    """
    if hasattr(request.state, "current_user") and request.state.current_user:
        return f"user:{request.state.current_user.id}"
    
    client_ip = request.client.host if request.client else "unknown"
    return f"ip:{client_ip}"


limiter = Limiter(
    key_func=get_client_identifier,
    default_limits=[
        os.getenv("DEFAULT_RATE_LIMIT", "200/minute"),
    ],
    storage_uri=os.getenv("REDIS_URL", "memory://"),
)


async def rate_limit_api(request: Request):
    """
    API 接口速率限制
    默认：100 次/分钟
    """
    limit = os.getenv("API_RATE_LIMIT", "100/minute")
    request.state.rate_limit = limit
    return limiter.limit(limit)(lambda: None)()


async def rate_limit_auth(request: Request):
    """
    认证接口速率限制（更严格）
    默认：10 次/分钟（防止暴力破解）
    """
    limit = os.getenv("AUTH_RATE_LIMIT", "10/minute")
    request.state.rate_limit = limit
    return limiter.limit(limit)(lambda: None)()


async def rate_limit_upload(request: Request):
    """
    上传接口速率限制
    默认：20 次/分钟
    """
    limit = os.getenv("UPLOAD_RATE_LIMIT", "20/minute")
    request.state.rate_limit = limit
    return limiter.limit(limit)(lambda: None)()


async def rate_limit_sketch(request: Request):
    """
    手绘识别接口速率限制
    默认：30 次/分钟
    """
    limit = os.getenv("SKETCH_RATE_LIMIT", "30/minute")
    request.state.rate_limit = limit
    return limiter.limit(limit)(lambda: None)()


async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """
    自定义速率限制异常处理器
    返回友好的错误信息
    """
    return JSONResponse(
        status_code=429,
        content={
            "error": "请求过于频繁",
            "detail": str(exc.detail),
            "retry_after": 60,
            "message": "请稍后再试",
        },
        headers={
            "Retry-After": "60",
            "X-RateLimit-Limit": str(getattr(request.state, 'rate_limit', 'unknown')),
        },
    )


def init_rate_limiter(app):
    """
    初始化速率限制器
    必须在创建 FastAPI 应用后调用
    """
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, custom_rate_limit_handler)
