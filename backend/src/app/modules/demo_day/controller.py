"""
Business logic + data access for the demo_day module. Raw SQL
(sqlalchemy.text), not the ORM query builder — see modules/auth/permissions.py
for why.
"""

from __future__ import annotations

import calendar
import datetime

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth.auth import CurrentUser
from ..auth.permissions import get_current_user_role, is_admin, is_startup_member, is_startup_mentee
from .models import DemoDay, DemoDayCreate, Evaluation, EvaluationSubmit, JudgeSummary

# How many calendar months ahead the recurring monthly demo day is kept
# materialized — this runs lazily on every list, no cron needed.
MONTHS_AHEAD = 3

THEMES = [
    "Fintech & Payments",
    "Climate & Deep Tech",
    "Health & Care",
    "Consumer & Creator Tools",
    "B2B SaaS & Dev Tools",
    "AI & Automation",
]

DEFAULT_VENUE = "Foundry HQ — Main Hall"


def _last_friday(year: int, month: int) -> datetime.date:
    last_day = calendar.monthrange(year, month)[1]
    day = datetime.date(year, month, last_day)
    while day.weekday() != 4:  # Monday=0 ... Friday=4
        day -= datetime.timedelta(days=1)
    return day


def _ensure_monthly_demo_days(db: Session) -> None:
    """
    Materializes the recurring monthly demo day (last Friday of the month)
    for the current month and the next couple, if it doesn't already exist,
    so there's always something upcoming for founders/mentors to join.
    """
    today = datetime.date.today()
    for offset in range(MONTHS_AHEAD):
        month_index = today.month - 1 + offset
        year = today.year + month_index // 12
        month = month_index % 12 + 1
        event_date = _last_friday(year, month)
        if event_date < today:
            continue

        existing = db.execute(
            text(
                """
                select 1 from demo_days
                where kind = 'monthly'
                  and date_trunc('month', event_date) = date_trunc('month', cast(:event_date as date))
                """
            ),
            {"event_date": event_date},
        ).first()
        if existing:
            continue

        theme = THEMES[(year * 12 + month) % len(THEMES)]
        db.execute(
            text(
                """
                insert into demo_days (event_name, event_date, venue, theme, kind)
                values (:event_name, :event_date, :venue, :theme, 'monthly')
                """
            ),
            {
                "event_name": f"{event_date.strftime('%B %Y')} Investor Demo Day",
                "event_date": event_date,
                "venue": DEFAULT_VENUE,
                "theme": theme,
            },
        )
    db.commit()


def _judges_for_demo_day(db: Session, demo_day_id: int) -> list[JudgeSummary]:
    rows = db.execute(
        text(
            """
            select u.user_id as mentor_id, u.first_name, u.last_name
            from demo_day_judges j
            join users u on u.user_id = j.mentor_id
            where j.demo_day_id = :demo_day_id
            order by j.created_at
            """
        ),
        {"demo_day_id": demo_day_id},
    ).mappings().all()
    return [JudgeSummary.model_validate(dict(row)) for row in rows]


def _is_judging(db: Session, demo_day_id: int, user_id: str) -> bool:
    row = db.execute(
        text("select 1 from demo_day_judges where demo_day_id = :demo_day_id and mentor_id = :mentor_id"),
        {"demo_day_id": demo_day_id, "mentor_id": user_id},
    ).first()
    return row is not None


def _assigned_judges_for_startup(db: Session, demo_day_id: int, startup_id: int) -> list[JudgeSummary]:
    """
    The judge(s) actually assigned to evaluate this startup — tracked via a
    row in `evaluations` (scores left null until the judge submits them), not
    a separate assignment table, since that's exactly what it's for.
    """
    rows = db.execute(
        text(
            """
            select u.user_id as mentor_id, u.first_name, u.last_name
            from evaluations e
            join users u on u.user_id = e.judge_id
            where e.demo_day_id = :demo_day_id and e.startup_id = :startup_id
            order by e.created_at
            """
        ),
        {"demo_day_id": demo_day_id, "startup_id": startup_id},
    ).mappings().all()
    return [JudgeSummary.model_validate(dict(row)) for row in rows]


def _assign_judge_round_robin(db: Session, demo_day_id: int, startup_id: int) -> None:
    """
    Picks whichever signed-up judge currently has the fewest startups
    assigned for this demo day (ties broken by mentor_id for determinism)
    and records the assignment as an `evaluations` row with scores left
    null — load-balancing, not domain matching, since judges don't carry a
    specialty field to match against.
    """
    already_assigned = db.execute(
        text("select 1 from evaluations where demo_day_id = :demo_day_id and startup_id = :startup_id"),
        {"demo_day_id": demo_day_id, "startup_id": startup_id},
    ).first()
    if already_assigned:
        return

    judge = db.execute(
        text(
            """
            select j.mentor_id
            from demo_day_judges j
            left join evaluations e on e.demo_day_id = j.demo_day_id and e.judge_id = j.mentor_id
            where j.demo_day_id = :demo_day_id
            group by j.mentor_id
            order by count(e.evaluation_id), j.mentor_id
            limit 1
            """
        ),
        {"demo_day_id": demo_day_id},
    ).first()
    if judge is None:
        return

    db.execute(
        text(
            """
            insert into evaluations (demo_day_id, startup_id, judge_id)
            values (:demo_day_id, :startup_id, :judge_id)
            on conflict (demo_day_id, startup_id, judge_id) do nothing
            """
        ),
        {"demo_day_id": demo_day_id, "startup_id": startup_id, "judge_id": judge[0]},
    )


def _date_confirmed_at(db: Session, demo_day_id: int, startup_id: int) -> datetime.datetime | None:
    row = db.execute(
        text(
            "select confirmed_at from demo_day_startups where demo_day_id = :demo_day_id and startup_id = :startup_id"
        ),
        {"demo_day_id": demo_day_id, "startup_id": startup_id},
    ).first()
    return row[0] if row else None


def _to_demo_day(db: Session, row, user_id: str, startup_id: int | None = None) -> DemoDay:
    data = dict(row)
    data["judges"] = _judges_for_demo_day(db, data["demo_day_id"])
    data["am_judging"] = _is_judging(db, data["demo_day_id"], user_id)
    data["assigned_judges"] = (
        _assigned_judges_for_startup(db, data["demo_day_id"], startup_id) if startup_id is not None else []
    )
    data["date_confirmed_at"] = (
        _date_confirmed_at(db, data["demo_day_id"], startup_id) if startup_id is not None else None
    )
    return DemoDay.model_validate(data)


def list_demo_days(db: Session, user: CurrentUser) -> list[DemoDay]:
    _ensure_monthly_demo_days(db)

    rows = db.execute(
        text("select * from demo_days where event_date >= current_date order by event_date"),
    ).mappings().all()
    return [_to_demo_day(db, row, user.id) for row in rows]


def create_demo_day(db: Session, user: CurrentUser, payload: DemoDayCreate) -> DemoDay:
    """Admin-only: a one-off ("special") demo day alongside the recurring monthly ones."""
    if not is_admin(db, user.id):
        raise HTTPException(status_code=403, detail="Only an admin can create a demo day.")

    row = db.execute(
        text(
            """
            insert into demo_days (event_name, event_date, venue, theme, kind)
            values (:event_name, :event_date, :venue, :theme, 'special')
            returning *
            """
        ),
        {
            "event_name": payload.event_name,
            "event_date": payload.event_date,
            "venue": payload.venue,
            "theme": payload.theme,
        },
    ).mappings().first()
    db.commit()
    return _to_demo_day(db, row, user.id)


def join_as_judge(db: Session, user: CurrentUser, demo_day_id: int) -> DemoDay:
    """A judge, mentor, or admin signs themself up to judge — mentors can opt in alongside dedicated judges."""
    role = get_current_user_role(db, user.id)
    if not (role in ("mentor", "judge") or is_admin(db, user.id)):
        raise HTTPException(status_code=403, detail="Only a judge or mentor can sign up to judge a demo day.")

    row = db.execute(
        text("select * from demo_days where demo_day_id = :demo_day_id"), {"demo_day_id": demo_day_id}
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="This demo day doesn't exist.")

    db.execute(
        text(
            """
            insert into demo_day_judges (demo_day_id, mentor_id)
            values (:demo_day_id, :mentor_id)
            on conflict (demo_day_id, mentor_id) do nothing
            """
        ),
        {"demo_day_id": demo_day_id, "mentor_id": user.id},
    )
    db.commit()

    return _to_demo_day(db, row, user.id)


def withdraw_as_judge(db: Session, user: CurrentUser, demo_day_id: int) -> DemoDay:
    row = db.execute(
        text("select * from demo_days where demo_day_id = :demo_day_id"), {"demo_day_id": demo_day_id}
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="This demo day doesn't exist.")

    db.execute(
        text("delete from demo_day_judges where demo_day_id = :demo_day_id and mentor_id = :mentor_id"),
        {"demo_day_id": demo_day_id, "mentor_id": user.id},
    )
    db.commit()

    return _to_demo_day(db, row, user.id)


def join_startup(db: Session, user: CurrentUser, startup_id: int, demo_day_id: int) -> DemoDay:
    """
    A founder/teammate (mentee) marks their own startup as ready for a demo
    day — gated on at least one judge having already signed up, so a startup
    can't join a demo day with nobody there to evaluate it.
    """
    if not (is_admin(db, user.id) or is_startup_mentee(db, user.id, startup_id)):
        raise HTTPException(status_code=403, detail="Only this startup's team can join a demo day.")

    row = db.execute(
        text("select * from demo_days where demo_day_id = :demo_day_id"), {"demo_day_id": demo_day_id}
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="This demo day doesn't exist.")

    judges = _judges_for_demo_day(db, demo_day_id)
    if not judges:
        raise HTTPException(status_code=409, detail="This demo day doesn't have any judges signed up yet.")

    db.execute(
        text(
            """
            insert into demo_day_startups (demo_day_id, startup_id)
            values (:demo_day_id, :startup_id)
            on conflict (demo_day_id, startup_id) do nothing
            """
        ),
        {"demo_day_id": demo_day_id, "startup_id": startup_id},
    )
    _assign_judge_round_robin(db, demo_day_id, startup_id)
    db.commit()

    return _to_demo_day(db, row, user.id, startup_id=startup_id)


def confirm_date(db: Session, user: CurrentUser, startup_id: int, demo_day_id: int) -> DemoDay:
    """The startup's team locks in the date — surfaced back on the idea page once confirmed."""
    if not (is_admin(db, user.id) or is_startup_mentee(db, user.id, startup_id)):
        raise HTTPException(status_code=403, detail="Only this startup's team can confirm the date.")

    existing = db.execute(
        text("select 1 from demo_day_startups where demo_day_id = :demo_day_id and startup_id = :startup_id"),
        {"demo_day_id": demo_day_id, "startup_id": startup_id},
    ).first()
    if existing is None:
        raise HTTPException(status_code=404, detail="This startup hasn't joined this demo day.")

    db.execute(
        text(
            """
            update demo_day_startups
            set confirmed_at = coalesce(confirmed_at, now())
            where demo_day_id = :demo_day_id and startup_id = :startup_id
            """
        ),
        {"demo_day_id": demo_day_id, "startup_id": startup_id},
    )
    db.commit()

    row = db.execute(
        text("select * from demo_days where demo_day_id = :demo_day_id"), {"demo_day_id": demo_day_id}
    ).mappings().first()
    return _to_demo_day(db, row, user.id, startup_id=startup_id)


def get_current_for_startup(db: Session, user: CurrentUser, startup_id: int) -> DemoDay | None:
    """The demo day this startup has most recently joined, if any — drives the founder's 'You're in' view."""
    if not (is_admin(db, user.id) or is_startup_member(db, user.id, startup_id)):
        raise HTTPException(status_code=403, detail="Not a member of this startup.")

    row = db.execute(
        text(
            """
            select d.*
            from demo_day_startups ds
            join demo_days d on d.demo_day_id = ds.demo_day_id
            where ds.startup_id = :startup_id
            order by ds.created_at desc
            limit 1
            """
        ),
        {"startup_id": startup_id},
    ).mappings().first()

    if row is None:
        return None
    return _to_demo_day(db, row, user.id, startup_id=startup_id)


_EVALUATION_SELECT = """
    select e.evaluation_id, e.demo_day_id, d.event_name, d.event_date,
           e.startup_id, s.startup_name,
           e.innovation_score, e.technical_score, e.business_score,
           e.presentation_score, e.overall_remarks
    from evaluations e
    join demo_days d on d.demo_day_id = e.demo_day_id
    join startups s on s.startup_id = e.startup_id
"""


def list_my_evaluations(db: Session, user: CurrentUser) -> list[Evaluation]:
    """Every startup this judge has been assigned (round-robin) to score."""
    rows = db.execute(
        text(_EVALUATION_SELECT + " where e.judge_id = :judge_id order by d.event_date, s.startup_name"),
        {"judge_id": user.id},
    ).mappings().all()
    return [Evaluation.model_validate(dict(row)) for row in rows]


def submit_evaluation(db: Session, user: CurrentUser, evaluation_id: int, payload: EvaluationSubmit) -> Evaluation:
    """Only the assigned judge may score, and not after the demo day has passed."""
    row = db.execute(
        text(
            """
            select e.judge_id, d.event_date
            from evaluations e
            join demo_days d on d.demo_day_id = e.demo_day_id
            where e.evaluation_id = :evaluation_id
            """
        ),
        {"evaluation_id": evaluation_id},
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="This evaluation doesn't exist.")
    if str(row[0]) != user.id:
        raise HTTPException(status_code=403, detail="Only the assigned judge can score this startup.")
    if row[1] < datetime.date.today():
        raise HTTPException(status_code=409, detail="This demo day has already passed.")

    db.execute(
        text(
            """
            update evaluations
            set innovation_score = :innovation_score,
                technical_score = :technical_score,
                business_score = :business_score,
                presentation_score = :presentation_score,
                overall_remarks = :overall_remarks,
                updated_at = now()
            where evaluation_id = :evaluation_id
            """
        ),
        {**payload.model_dump(), "evaluation_id": evaluation_id},
    )
    db.commit()

    updated = db.execute(
        text(_EVALUATION_SELECT + " where e.evaluation_id = :evaluation_id"),
        {"evaluation_id": evaluation_id},
    ).mappings().first()
    return Evaluation.model_validate(dict(updated))
