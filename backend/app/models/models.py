from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Numeric, Text, JSON, TypeDecorator, CHAR
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.core.database import Base


class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses PostgreSQL's UUID type, otherwise uses
    CHAR(32), storing as string.
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(UUID())
        else:
            return dialect.type_descriptor(CHAR(32))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return str(value)
        else:
            if isinstance(value, uuid.UUID):
                return value.hex
            else:
                return uuid.UUID(value).hex

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if isinstance(value, uuid.UUID):
                return value
            else:
                return uuid.UUID(value) if len(str(value)) == 36 else uuid.UUID(hex=value)


class User(Base):
    __tablename__ = "users"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    phone = Column(String(20), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_member = Column(Boolean, default=False)
    member_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    store_profile = relationship("StoreProfile", back_populates="user", uselist=False)
    textures = relationship("Texture", back_populates="owner")
    projects = relationship("Project", back_populates="user")
    orders = relationship("Order", back_populates="store_user")


class StoreProfile(Base):
    __tablename__ = "store_profiles"

    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True
    )
    store_name = Column(String(200), nullable=True)
    logo_url = Column(Text, nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(String(500), nullable=True)
    qr_code_url = Column(Text, nullable=True)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user = relationship("User", back_populates="store_profile")
    products = relationship("Product", back_populates="store")


class Texture(Base):
    __tablename__ = "textures"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    owner_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)
    original_image_url = Column(Text, nullable=False)
    processed_image_url = Column(Text, nullable=True)
    width_mm = Column(Integer, nullable=True)
    height_mm = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="textures")
    products = relationship("Product", back_populates="texture")


class Product(Base):
    __tablename__ = "products"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    store_id = Column(
        UUID(as_uuid=True), ForeignKey("store_profiles.user_id"), nullable=False
    )
    name = Column(String(200), nullable=False)
    image_url = Column(Text, nullable=True)
    texture_id = Column(GUID(), ForeignKey("textures.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    store = relationship("StoreProfile", back_populates="products")
    texture = relationship("Texture", back_populates="products")
    skus = relationship("ProductSKU", back_populates="product")


class ProductSKU(Base):
    __tablename__ = "product_skus"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    product_id = Column(GUID(), ForeignKey("products.id"), nullable=False)
    size_x_mm = Column(Integer, nullable=False)
    size_y_mm = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=True)
    unit = Column(String(10), default="片")
    stock = Column(Integer, default=0)

    product = relationship("Product", back_populates="skus")


class Project(Base):
    __tablename__ = "projects"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)
    room_polygon = Column(JSON, nullable=True)
    edges_annotated = Column(JSON, nullable=True)
    tile_config = Column(JSON, nullable=True)
    components = Column(JSON, nullable=True)
    show_price = Column(Boolean, default=True)
    confirmation_data = Column(JSON, nullable=True)
    status = Column(String(20), default="draft")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user = relationship("User", back_populates="projects")
    layout_results = relationship("LayoutResult", back_populates="project")
    orders = relationship("Order", back_populates="project")


class LayoutResult(Base):
    __tablename__ = "layout_results"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    project_id = Column(GUID(), ForeignKey("projects.id"), nullable=False)
    texture_id = Column(GUID(), ForeignKey("textures.id"), nullable=True)
    tiles = Column(JSON, nullable=True)
    statistics = Column(JSON, nullable=True)
    preview_image_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="layout_results")


class Order(Base):
    __tablename__ = "orders"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    project_id = Column(GUID(), ForeignKey("projects.id"), nullable=False)
    store_user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    customer_name = Column(String(100), nullable=True)
    customer_phone = Column(String(20), nullable=True)
    status = Column(String(20), default="draft")
    total_amount = Column(Numeric(12, 2), default=0)
    show_total_price = Column(Boolean, default=False)
    confirm_token = Column(String(64), unique=True, nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="orders")
    store_user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    order_id = Column(GUID(), ForeignKey("orders.id"), nullable=False)
    sku_id = Column(GUID(), ForeignKey("product_skus.id"), nullable=False)
    texture_id = Column(GUID(), ForeignKey("textures.id"), nullable=False)
    quantity_whole = Column(Integer, nullable=False)
    quantity_cut = Column(Integer, nullable=False)
    price_per_piece = Column(Numeric(10, 2), nullable=False)
    layout_snapshot = Column(JSON, nullable=True)

    order = relationship("Order", back_populates="items")
