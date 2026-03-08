# tooth_transform.py — Per-tooth 3D transform for a treatment step.

import uuid

from sqlalchemy import Float, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

UUID = PG_UUID(as_uuid=True)


class ToothTransform(Base):
    """3D position and rotation for a single tooth in a treatment step."""

    __tablename__ = "tooth_transforms"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, default=uuid.uuid4,
    )
    step_id: Mapped[uuid.UUID] = mapped_column(
        UUID, ForeignKey("treatment_steps.id"), nullable=False, index=True,
    )
    fdi_number: Mapped[int] = mapped_column(Integer, nullable=False)
    pos_x: Mapped[float] = mapped_column(Float, default=0.0)
    pos_y: Mapped[float] = mapped_column(Float, default=0.0)
    pos_z: Mapped[float] = mapped_column(Float, default=0.0)
    rot_x: Mapped[float] = mapped_column(Float, default=0.0)  # degrees
    rot_y: Mapped[float] = mapped_column(Float, default=0.0)
    rot_z: Mapped[float] = mapped_column(Float, default=0.0)

    step: Mapped["TreatmentStep"] = relationship(  # noqa: F821
        "TreatmentStep", back_populates="transforms",
    )
