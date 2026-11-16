from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AssignmentCreate(BaseModel):
    courseId: str
    unitId: str
    title: str = Field(min_length=3)
    instructions: str = ""
    dueDate: datetime
    maxGrade: int = Field(default=100, ge=1)
    allowedFormats: list[str] = Field(
        default_factory=lambda: [".pdf", ".zip"]
    )
    status: Literal["draft"] = "draft"


class Assignment(AssignmentCreate):
    id: str
    createdAt: datetime
