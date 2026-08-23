"""Unit tests for the recurring-task date engine (pure function, no DB)."""
import pytest

from app.routers.tasks import _next_due


def test_daily_on_time_completion():
    # Completing on the due date yields due + one period
    assert _next_due("2026-08-20", "daily", "2026-08-20") == "2026-08-21"


def test_daily_overdue_fast_forwards_past_today():
    # A long-overdue daily chore respawns for tomorrow, not yesterday
    assert _next_due("2026-08-01", "daily", "2026-08-23") == "2026-08-24"


def test_weekly_preserves_weekday_anchor():
    # 2026-08-18 is a Tuesday; next occurrence after 2026-09-02 is Tue 09-08
    assert _next_due("2026-08-18", "weekly", "2026-09-02") == "2026-09-08"


def test_weekly_on_time_completion():
    assert _next_due("2026-08-18", "weekly", "2026-08-18") == "2026-08-25"


def test_weekly_completed_early_still_advances_from_due():
    # Completed two days before due: next stays anchored one week after due
    assert _next_due("2026-08-25", "weekly", "2026-08-23") == "2026-09-01"


def test_monthly_clamps_to_short_month():
    # Jan 31 → Feb 28 (2026 is not a leap year)
    assert _next_due("2026-01-31", "monthly", "2026-01-31") == "2026-02-28"


def test_monthly_recovers_anchor_after_clamp():
    # Overdue past February: the clamped Feb 28 is skipped, anchor day returns
    assert _next_due("2026-01-31", "monthly", "2026-03-01") == "2026-03-31"


def test_monthly_year_rollover():
    assert _next_due("2026-12-15", "monthly", "2026-12-15") == "2027-01-15"


def test_result_is_strictly_after_today():
    # Today equals a would-be occurrence: it must be skipped
    assert _next_due("2026-08-09", "weekly", "2026-08-16") == "2026-08-23"


def test_unknown_recurrence_raises():
    with pytest.raises(ValueError):
        _next_due("2026-08-20", "yearly", "2026-08-20")
