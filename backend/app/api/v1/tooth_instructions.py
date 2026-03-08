# tooth_instructions.py — Route handlers for per-tooth clinical instructions.

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.tooth_instruction import (
    ToothInstructionCreate, ToothInstructionResponse,
    ToothInstructionSummary, ToothInstructionUpdate,
)
from app.services.case_service import CaseService
from app.services.tooth_instruction_service import ToothInstructionService

router = APIRouter(prefix="/cases/{case_id}/tooth-instructions", tags=["Tooth Instructions"])


@router.post("", response_model=ApiResponse[ToothInstructionResponse])
async def add_instruction(
    case_id: str, data: ToothInstructionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[ToothInstructionResponse]:
    """Add a clinical instruction for a tooth."""
    case_svc = CaseService(db)
    case = await case_svc.get(UUID(case_id), user)
    svc = ToothInstructionService(db)
    inst = await svc.add(UUID(case_id), data, user, case.status)
    return ApiResponse(
        success=True, message="Instruction added",
        data=ToothInstructionResponse.model_validate(inst),
    )


@router.get("", response_model=ApiResponse[list[ToothInstructionResponse]])
async def list_instructions(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[list[ToothInstructionResponse]]:
    """List all tooth instructions for a case."""
    case_svc = CaseService(db)
    await case_svc.get(UUID(case_id), user)
    svc = ToothInstructionService(db)
    instructions = await svc.list_by_case(UUID(case_id))
    return ApiResponse(
        success=True, message="Instructions retrieved",
        data=[ToothInstructionResponse.model_validate(i) for i in instructions],
    )


@router.get("/summary", response_model=ApiResponse[ToothInstructionSummary])
async def get_summary(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[ToothInstructionSummary]:
    """Get aggregated instructions grouped by FDI number."""
    case_svc = CaseService(db)
    await case_svc.get(UUID(case_id), user)
    svc = ToothInstructionService(db)
    summary = await svc.get_summary(UUID(case_id))
    return ApiResponse(success=True, message="Summary retrieved", data=summary)


@router.put("/{instruction_id}", response_model=ApiResponse[ToothInstructionResponse])
async def update_instruction(
    case_id: str, instruction_id: str, data: ToothInstructionUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[ToothInstructionResponse]:
    """Update a tooth instruction."""
    case_svc = CaseService(db)
    case = await case_svc.get(UUID(case_id), user)
    svc = ToothInstructionService(db)
    inst = await svc.update(UUID(instruction_id), data, user, case.status)
    return ApiResponse(
        success=True, message="Instruction updated",
        data=ToothInstructionResponse.model_validate(inst),
    )


@router.delete("/{instruction_id}", response_model=ApiResponse[None])
async def delete_instruction(
    case_id: str, instruction_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[None]:
    """Delete a tooth instruction (before submission only)."""
    case_svc = CaseService(db)
    case = await case_svc.get(UUID(case_id), user)
    svc = ToothInstructionService(db)
    await svc.delete(UUID(instruction_id), user, case.status)
    return ApiResponse(success=True, message="Instruction deleted")
