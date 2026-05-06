from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import os
from app.core.config import settings
from app.core.rate_limit import init_rate_limiter, rate_limit_sketch
from app.api import auth, users, textures, products, projects, orders, confirmation, sketch, materials, store

app = FastAPI(
    title="排砖宝 API",
    description="瓷砖排版与销售闭环应用后端 API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads/textures", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

init_rate_limiter(app)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["认证"])
app.include_router(users.router, prefix="/api/v1/users", tags=["用户"])
app.include_router(textures.router, prefix="/api/v1/textures", tags=["材质"])
app.include_router(products.router, prefix="/api/v1/products", tags=["产品"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["项目"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["订单"])
app.include_router(confirmation.router, prefix="/api/v1/confirmations", tags=["确认单"])
app.include_router(sketch.router, prefix="/api/v1/sketch", tags=["手绘识别"])
app.include_router(materials.router, prefix="/api/v1/materials", tags=["辅料计算"])
app.include_router(store.router, prefix="/api/v1/store", tags=["门店信息"])


@app.get("/")
async def root():
    return {"message": "排砖宝 API", "version": "0.1.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
