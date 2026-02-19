from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from app.core.dependencies import get_user_weaviate_client
from app.dashboard.archiver import ArchiverService

router = APIRouter()


@router.get("/preview")
async def archive_preview(
    function_name: str | None = Query(None),
    include_golden: bool = Query(False),
    limit: int = Query(5, ge=1, le=20),
    client=Depends(get_user_weaviate_client),
):
    service = ArchiverService(client)
    return service.get_preview(
        function_name=function_name,
        include_golden=include_golden,
        limit=limit,
    )


@router.get("/export")
async def archive_export(
    function_name: str | None = Query(None),
    include_golden: bool = Query(False),
    client=Depends(get_user_weaviate_client),
):
    service = ArchiverService(client)
    filename = f"vectorwave_finetune{'_' + function_name if function_name else ''}.jsonl"

    return StreamingResponse(
        service.generate_jsonl(
            function_name=function_name,
            include_golden=include_golden,
        ),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
