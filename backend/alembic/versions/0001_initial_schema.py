"""initial_schema

Revision ID: 0001
Create Date: 2026-05-06
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('phone', sa.String(20), unique=True, nullable=False, index=True),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('is_member', sa.Boolean(), server_default='false'),
        sa.Column('member_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table('store_profiles',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('store_name', sa.String(200), nullable=True),
        sa.Column('logo_url', sa.Text(), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('address', sa.String(500), nullable=True),
        sa.Column('qr_code_url', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table('textures',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('original_image_url', sa.Text(), nullable=False),
        sa.Column('processed_image_url', sa.Text(), nullable=True),
        sa.Column('width_mm', sa.Integer(), nullable=True),
        sa.Column('height_mm', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table('products',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('store_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('store_profiles.user_id'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('image_url', sa.Text(), nullable=True),
        sa.Column('texture_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('textures.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table('product_skus',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id'), nullable=False),
        sa.Column('size_x_mm', sa.Integer(), nullable=False),
        sa.Column('size_y_mm', sa.Integer(), nullable=False),
        sa.Column('unit_price', sa.Numeric(10, 2), nullable=True),
        sa.Column('unit', sa.String(10), server_default='片'),
        sa.Column('stock', sa.Integer(), server_default='0'),
    )
    op.create_table('projects',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('room_polygon', postgresql.JSONB(), nullable=True),
        sa.Column('edges_annotated', postgresql.JSONB(), nullable=True),
        sa.Column('tile_config', postgresql.JSONB(), nullable=True),
        sa.Column('show_price', sa.Boolean(), server_default='true'),
        sa.Column('confirmation_data', postgresql.JSONB(), nullable=True),
        sa.Column('status', sa.String(20), server_default='draft'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table('layout_results',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('texture_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('textures.id'), nullable=False),
        sa.Column('tiles', postgresql.JSONB(), nullable=True),
        sa.Column('statistics', postgresql.JSONB(), nullable=True),
        sa.Column('preview_image_url', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table('orders',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('store_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('customer_name', sa.String(100), nullable=True),
        sa.Column('customer_phone', sa.String(20), nullable=True),
        sa.Column('status', sa.String(20), server_default='draft'),
        sa.Column('total_amount', sa.Numeric(12, 2), server_default='0'),
        sa.Column('show_total_price', sa.Boolean(), server_default='false'),
        sa.Column('confirm_token', sa.String(64), unique=True, nullable=True),
        sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table('order_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orders.id'), nullable=False),
        sa.Column('sku_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('product_skus.id'), nullable=False),
        sa.Column('texture_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('textures.id'), nullable=False),
        sa.Column('quantity_whole', sa.Integer(), nullable=False),
        sa.Column('quantity_cut', sa.Integer(), nullable=False),
        sa.Column('price_per_piece', sa.Numeric(10, 2), nullable=False),
        sa.Column('layout_snapshot', postgresql.JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('order_items')
    op.drop_table('orders')
    op.drop_table('layout_results')
    op.drop_table('projects')
    op.drop_table('product_skus')
    op.drop_table('products')
    op.drop_table('textures')
    op.drop_table('store_profiles')
    op.drop_table('users')
