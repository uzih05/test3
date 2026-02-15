"""
Dashboard Widget CRUD Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.dashboard_widget import DashboardWidget

router = APIRouter()

# Widget catalog (code constant, not DB table)
WIDGET_CATALOG = [
    {"type": "token_usage", "name": "Token Usage", "sizes": ["S", "M", "L"], "default_size": "M"},
    {"type": "cache_hit", "name": "Cache Hit Rate", "sizes": ["S", "M", "L"], "default_size": "M"},
    {"type": "error_rate", "name": "Error Rate", "sizes": ["S", "M", "L"], "default_size": "M"},
    {"type": "execution_timeline", "name": "Execution Timeline", "sizes": ["M", "L"], "default_size": "L"},
    {"type": "function_distribution", "name": "Function Distribution", "sizes": ["M", "L"], "default_size": "M"},
    {"type": "recent_errors", "name": "Recent Errors", "sizes": ["M", "L"], "default_size": "M"},
    {"type": "system_status", "name": "System Status", "sizes": ["S", "M"], "default_size": "S"},
    {"type": "kpi_overview", "name": "KPI Overview", "sizes": ["M", "L"], "default_size": "M"},
]


class WidgetCreate(BaseModel):
    widget_type: str
    size: str = "M"


class WidgetUpdate(BaseModel):
    size: str | None = None
    position_order: int | None = None


class WidgetReorder(BaseModel):
    widget_ids: list[str]


@router.get("/catalog")
async def get_widget_catalog():
    """List available widget types."""
    return {"items": WIDGET_CATALOG}


@router.get("")
async def list_widgets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List user's pinned dashboard widgets."""
    result = await db.execute(
        select(DashboardWidget)
        .where(DashboardWidget.user_id == user.id)
        .order_by(DashboardWidget.position_order)
    )
    widgets = result.scalars().all()

    return {
        "items": [
            {
                "id": w.id,
                "widget_type": w.widget_type,
                "position_order": w.position_order,
                "size": w.size,
            }
            for w in widgets
        ],
    }


@router.post("")
async def add_widget(
    request: WidgetCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pin a widget to the dashboard."""
    valid_types = [w["type"] for w in WIDGET_CATALOG]
    if request.widget_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Unknown widget type: {request.widget_type}")
    if request.size not in ("S", "M", "L"):
        raise HTTPException(status_code=400, detail="Size must be S, M, or L")

    # Get next position order
    result = await db.execute(
        select(DashboardWidget)
        .where(DashboardWidget.user_id == user.id)
        .order_by(DashboardWidget.position_order.desc())
    )
    last = result.scalars().first()
    next_order = (last.position_order + 1) if last else 0

    widget = DashboardWidget(
        user_id=user.id,
        widget_type=request.widget_type,
        size=request.size,
        position_order=next_order,
    )
    db.add(widget)
    await db.commit()
    await db.refresh(widget)

    return {
        "id": widget.id,
        "widget_type": widget.widget_type,
        "position_order": widget.position_order,
        "size": widget.size,
    }


# Static path "/reorder" must come BEFORE parameterized "/{widget_id}"
@router.put("/reorder")
async def reorder_widgets(
    request: WidgetReorder,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reorder widgets by providing widget IDs in desired order."""
    result = await db.execute(
        select(DashboardWidget).where(DashboardWidget.user_id == user.id)
    )
    widgets = {w.id: w for w in result.scalars().all()}

    for i, wid in enumerate(request.widget_ids):
        if wid in widgets:
            widgets[wid].position_order = i

    await db.commit()
    return {"status": "reordered"}


@router.put("/{widget_id}")
async def update_widget(
    widget_id: str,
    request: WidgetUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update widget size or position."""
    result = await db.execute(
        select(DashboardWidget).where(
            DashboardWidget.id == widget_id,
            DashboardWidget.user_id == user.id,
        )
    )
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    if request.size is not None:
        if request.size not in ("S", "M", "L"):
            raise HTTPException(status_code=400, detail="Size must be S, M, or L")
        widget.size = request.size
    if request.position_order is not None:
        widget.position_order = request.position_order

    await db.commit()
    return {"status": "updated", "id": widget.id}


@router.delete("/{widget_id}")
async def remove_widget(
    widget_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unpin a widget from the dashboard."""
    result = await db.execute(
        select(DashboardWidget).where(
            DashboardWidget.id == widget_id,
            DashboardWidget.user_id == user.id,
        )
    )
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    await db.delete(widget)
    await db.commit()
    return {"status": "deleted", "id": widget_id}
