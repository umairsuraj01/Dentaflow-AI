# clinical_preferences.py — Per-user clinical preference defaults (17 settings).

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base

UUID = PG_UUID(as_uuid=True)


class ClinicalPreferences(Base):
    """Default clinical settings per user — auto-applied to new cases."""

    __tablename__ = "clinical_preferences"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    org_id: Mapped[uuid.UUID | None] = mapped_column(UUID, ForeignKey("organizations.id"), nullable=True)

    # 1. Tooth numbering system
    tooth_numbering_system: Mapped[str] = mapped_column(String(20), default="FDI")
    # 2. Tooth size discrepancy
    tooth_size_discrepancy: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # 3. IPR preference
    default_ipr_preference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # 4. IPR limits per contact
    ipr_limit_per_contact: Mapped[float] = mapped_column(Float, default=0.5)
    # 5. Arch expansion
    arch_expansion: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # 6. Proclination
    default_proclination: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # 7. Extraction
    default_extraction: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # 8. Occlusal contacts
    occlusal_contacts: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # 9. Attachment schedule
    attachment_schedule: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # 10. Extraction schedule
    extraction_schedule: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # 11. Movement velocity
    movement_velocity: Mapped[str] = mapped_column(String(50), default="STANDARD")
    # 12. Pontics for open spaces
    pontics_for_open_spaces: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # 13. Virtual power chain
    virtual_power_chain: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # 14. Passive aligners
    passive_aligners_default: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # 15. Terminal molar distortion
    terminal_molar_distortion: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # 16. Overcorrection
    overcorrection: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # 17. Default midline instruction
    default_midline: Mapped[str | None] = mapped_column(String(50), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
