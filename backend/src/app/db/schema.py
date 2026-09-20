"""
SQLAlchemy models mirroring the hand-written SQL migrations under db/migrations/.
Like the TypeScript backend's Drizzle schema, these do NOT own the schema — the
SQL migrations do. This is just a typed query layer; if you change a table, update
the migration first, then this file to match.

Not used by default — routes/permissions here use raw SQL (sqlalchemy.text) plus
small Pydantic models. Reach for this file (or regenerate it with `sqlacodegen`
against the live DB) only where actual ORM behavior — relationship loading,
identity map, etc. — earns its keep.

DB table/column names are lowercase snake_case; Python attribute names are also
snake_case per normal Python convention (unlike the TS schema, which uses
camelCase attributes over the same snake_case columns).
"""

from __future__ import annotations

import datetime
import decimal
import uuid

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class Role(Base):
    __tablename__ = "roles"
    __table_args__ = (
        UniqueConstraint("role_name", name="role_name_unique"),
        CheckConstraint("length(trim(role_name)) > 0", name="role_name_not_blank"),
    )

    role_id: Mapped[int] = mapped_column(primary_key=True)
    role_name: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("length(trim(first_name)) > 0", name="user_first_name_not_blank"),
        CheckConstraint("length(trim(last_name)) > 0", name="user_last_name_not_blank"),
    )

    # No longer FKs to auth.users — this backend owns credentials directly
    # (see modules/auth/), Supabase is purely the Postgres database.
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.role_id"), nullable=False)
    first_name: Mapped[str] = mapped_column(String(50), nullable=False)
    last_name: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True)
    department: Mapped[str | None] = mapped_column(String(100))
    registration_date: Mapped[datetime.date | None] = mapped_column(Date)
    status: Mapped[str | None] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)


class Startup(Base):
    __tablename__ = "startups"
    __table_args__ = (
        CheckConstraint("length(trim(startup_name)) > 0", name="startup_name_not_blank"),
    )

    startup_id: Mapped[int] = mapped_column(primary_key=True)
    startup_name: Mapped[str] = mapped_column(String(100), nullable=False)
    domain: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    registration_date: Mapped[datetime.date | None] = mapped_column(Date)
    registration_status: Mapped[str | None] = mapped_column(String(20))
    current_stage: Mapped[str | None] = mapped_column(String(50))
    registered_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL")
    )


class StartupMembership(Base):
    __tablename__ = "startup_memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "startup_id", name="membership_unique_user_per_startup"),
        CheckConstraint(
            "project_role in ('founder', 'member')", name="membership_project_role_check"
        ),
    )

    membership_id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False
    )
    startup_id: Mapped[int] = mapped_column(
        ForeignKey("startups.startup_id", ondelete="CASCADE"), nullable=False
    )
    project_role: Mapped[str | None] = mapped_column(String(50))
    join_date: Mapped[datetime.date | None] = mapped_column(Date)


class Milestone(Base):
    __tablename__ = "milestones"
    __table_args__ = (
        UniqueConstraint(
            "startup_id", "milestone_name", name="milestone_unique_name_per_startup"
        ),
        CheckConstraint(
            "length(trim(milestone_name)) > 0", name="milestone_name_not_blank"
        ),
        CheckConstraint(
            "completion_date is null or status = 'completed'",
            name="milestone_completion_needs_completed_status",
        ),
    )

    milestone_id: Mapped[int] = mapped_column(primary_key=True)
    startup_id: Mapped[int] = mapped_column(
        ForeignKey("startups.startup_id", ondelete="CASCADE"), nullable=False
    )
    milestone_name: Mapped[str] = mapped_column(String(100), nullable=False)
    due_date: Mapped[datetime.date | None] = mapped_column(Date)
    completion_date: Mapped[datetime.date | None] = mapped_column(Date)
    status: Mapped[str | None] = mapped_column(String(20))
    verification_status: Mapped[str | None] = mapped_column(String(20))
    mentor_remarks: Mapped[str | None] = mapped_column(Text)


class MentorRequest(Base):
    __tablename__ = "mentor_requests"
    __table_args__ = (
        CheckConstraint(
            "status in ('pending', 'approved', 'rejected')",
            name="mentor_request_status_check",
        ),
        CheckConstraint(
            "decision_date is null or status in ('approved', 'rejected')",
            name="mentor_request_decision_needs_decided_status",
        ),
    )

    mentor_request_id: Mapped[int] = mapped_column(primary_key=True)
    startup_id: Mapped[int] = mapped_column(
        ForeignKey("startups.startup_id", ondelete="CASCADE"), nullable=False
    )
    requested_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False
    )
    required_skills: Mapped[str | None] = mapped_column(Text)
    request_description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    decided_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL")
    )
    decision_date: Mapped[datetime.date | None] = mapped_column(Date)
    remarks: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class MentorAssignment(Base):
    __tablename__ = "mentor_assignments"
    __table_args__ = (
        UniqueConstraint(
            "mentor_request_id", "mentor_id", name="mentor_assignment_unique_request_mentor"
        ),
        CheckConstraint(
            "status in ('active', 'completed', 'cancelled')",
            name="mentor_assignment_status_check",
        ),
        CheckConstraint(
            "end_date is null or end_date >= assigned_date",
            name="mentor_assignment_end_after_assigned",
        ),
    )

    assignment_id: Mapped[int] = mapped_column(primary_key=True)
    mentor_request_id: Mapped[int] = mapped_column(
        ForeignKey("mentor_requests.mentor_request_id", ondelete="CASCADE"), nullable=False
    )
    mentor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False
    )
    assigned_date: Mapped[datetime.date] = mapped_column(
        Date, nullable=False, server_default=func.current_date()
    )
    end_date: Mapped[datetime.date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Meeting(Base):
    __tablename__ = "meetings"
    __table_args__ = (
        CheckConstraint(
            "status in ('scheduled', 'completed', 'cancelled')",
            name="meeting_status_check",
        ),
    )

    meeting_id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(
        ForeignKey("mentor_assignments.assignment_id", ondelete="CASCADE"), nullable=False
    )
    meeting_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    meeting_time: Mapped[datetime.time | None] = mapped_column(Time)
    agenda: Mapped[str | None] = mapped_column(Text)
    discussion: Mapped[str | None] = mapped_column(Text)
    action_items: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="scheduled")
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class FundingRequest(Base):
    __tablename__ = "funding_requests"
    __table_args__ = (
        CheckConstraint("requested_amount > 0", name="funding_request_amount_positive"),
        CheckConstraint(
            "status in ('pending', 'approved', 'rejected')",
            name="funding_request_status_check",
        ),
        CheckConstraint(
            "approved_amount is null or status = 'approved'",
            name="funding_request_approved_amount_needs_approved_status",
        ),
        CheckConstraint(
            "approved_amount is null or approved_amount > 0",
            name="funding_request_approved_amount_positive",
        ),
        CheckConstraint(
            "decision_date is null or status in ('approved', 'rejected')",
            name="funding_request_decision_needs_decided_status",
        ),
    )

    funding_request_id: Mapped[int] = mapped_column(primary_key=True)
    startup_id: Mapped[int] = mapped_column(
        ForeignKey("startups.startup_id", ondelete="CASCADE"), nullable=False
    )
    requested_amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    purpose: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    approved_amount: Mapped[decimal.Decimal | None] = mapped_column(Numeric(12, 2))
    decided_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL")
    )
    decision_date: Mapped[datetime.date | None] = mapped_column(Date)
    remarks: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class DemoDay(Base):
    __tablename__ = "demo_days"
    __table_args__ = (
        CheckConstraint("length(trim(event_name)) > 0", name="demo_day_event_name_not_blank"),
    )

    demo_day_id: Mapped[int] = mapped_column(primary_key=True)
    event_name: Mapped[str] = mapped_column(String(150), nullable=False)
    event_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    venue: Mapped[str | None] = mapped_column(String(150))
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Evaluation(Base):
    __tablename__ = "evaluations"
    __table_args__ = (
        UniqueConstraint(
            "demo_day_id",
            "startup_id",
            "judge_id",
            name="evaluation_unique_judge_per_startup_per_day",
        ),
        CheckConstraint(
            "innovation_score is null or innovation_score between 0 and 10",
            name="evaluation_innovation_score_range",
        ),
        CheckConstraint(
            "technical_score is null or technical_score between 0 and 10",
            name="evaluation_technical_score_range",
        ),
        CheckConstraint(
            "business_score is null or business_score between 0 and 10",
            name="evaluation_business_score_range",
        ),
        CheckConstraint(
            "presentation_score is null or presentation_score between 0 and 10",
            name="evaluation_presentation_score_range",
        ),
    )

    evaluation_id: Mapped[int] = mapped_column(primary_key=True)
    demo_day_id: Mapped[int] = mapped_column(
        ForeignKey("demo_days.demo_day_id", ondelete="CASCADE"), nullable=False
    )
    startup_id: Mapped[int] = mapped_column(
        ForeignKey("startups.startup_id", ondelete="CASCADE"), nullable=False
    )
    judge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False
    )
    innovation_score: Mapped[decimal.Decimal | None] = mapped_column(Numeric(4, 2))
    technical_score: Mapped[decimal.Decimal | None] = mapped_column(Numeric(4, 2))
    business_score: Mapped[decimal.Decimal | None] = mapped_column(Numeric(4, 2))
    presentation_score: Mapped[decimal.Decimal | None] = mapped_column(Numeric(4, 2))
    overall_remarks: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
