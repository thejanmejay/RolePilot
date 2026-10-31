import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.notification_service import NotificationService
from tests.conftest import USER_A_ID, USER_B_ID, TestingSessionLocal, create_test_token


def _headers(user_id: uuid.UUID):
    token = create_test_token(user_id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_notification_creation_and_listing(client, db_session):
    headers = _headers(USER_A_ID)

    # Create notification
    notif = NotificationService.create_notification(
        db=db_session,
        user_id=USER_A_ID,
        title="Dry Run Verified",
        message="5 matching jobs evaluated without submission.",
        category="automation",
        notification_type="success",
        link="/automation",
        dedup_key="test_run_1",
    )
    assert notif.id is not None
    assert notif.is_read is False

    # Check unread count
    resp = client.get("/api/v1/notifications/unread-count", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["unread_count"] >= 1

    # List notifications
    list_resp = client.get("/api/v1/notifications", headers=headers)
    assert list_resp.status_code == 200
    data = list_resp.json()
    assert data["total"] >= 1
    assert any(item["title"] == "Dry Run Verified" for item in data["items"])


def test_mark_notification_read(client, db_session):
    headers = _headers(USER_A_ID)

    notif = NotificationService.create_notification(
        db=db_session,
        user_id=USER_A_ID,
        title="Profile Tip",
        message="Add 2 more skills",
        category="profile",
    )

    read_resp = client.post(f"/api/v1/notifications/{notif.id}/read", headers=headers)
    assert read_resp.status_code == 200
    assert read_resp.json()["is_read"] is True


def test_mark_all_read(client, db_session):
    headers = _headers(USER_A_ID)

    NotificationService.create_notification(db=db_session, user_id=USER_A_ID, title="Alert 1", message="M1")
    NotificationService.create_notification(db=db_session, user_id=USER_A_ID, title="Alert 2", message="M2")

    resp = client.post("/api/v1/notifications/mark-all-read", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    count_resp = client.get("/api/v1/notifications/unread-count", headers=headers)
    assert count_resp.json()["unread_count"] == 0


def test_archive_notification(client, db_session):
    headers = _headers(USER_A_ID)

    notif = NotificationService.create_notification(
        db=db_session, user_id=USER_A_ID, title="Dismiss Me", message="Old news"
    )

    del_resp = client.delete(f"/api/v1/notifications/{notif.id}", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True


def test_notification_cross_user_isolation(client, db_session):
    """User B cannot access or modify User A's notifications."""
    headers_a = _headers(USER_A_ID)
    headers_b = _headers(USER_B_ID)

    notif_a = NotificationService.create_notification(
        db=db_session,
        user_id=USER_A_ID,
        title="Secret User A Notice",
        message="A private message",
    )

    # User B listing should NOT contain User A's notification
    resp_b = client.get("/api/v1/notifications", headers=headers_b)
    assert resp_b.status_code == 200
    user_b_items = resp_b.json()["items"]
    assert all(item["id"] != str(notif_a.id) for item in user_b_items)

    # User B attempting to mark User A's notification as read should return 404
    read_resp = client.post(f"/api/v1/notifications/{notif_a.id}/read", headers=headers_b)
    assert read_resp.status_code == 404

    # User B attempting to archive User A's notification should return 404
    del_resp = client.delete(f"/api/v1/notifications/{notif_a.id}", headers=headers_b)
    assert del_resp.status_code == 404


def test_notification_deduplication(client, db_session):
    """Creating with the same dedup_key updates the unread row without duplicate entries."""
    dedup = f"dedup_test_{uuid.uuid4().hex[:8]}"

    n1 = NotificationService.create_notification(
        db=db_session,
        user_id=USER_A_ID,
        title="Initial Title",
        message="Initial Message",
        dedup_key=dedup,
    )

    n2 = NotificationService.create_notification(
        db=db_session,
        user_id=USER_A_ID,
        title="Updated Title",
        message="Updated Message",
        dedup_key=dedup,
    )

    assert n1.id == n2.id
    assert n2.title == "Updated Title"
    assert n2.message == "Updated Message"


def test_notification_filter_modes(client, db_session):
    """Validate 'updates', 'unread', and 'read' filter modes."""
    headers = _headers(USER_A_ID)

    NotificationService.create_notification(
        db=db_session,
        user_id=USER_A_ID,
        title="System Notice",
        message="Maintenance window",
        category="system",
    )
    NotificationService.create_notification(
        db=db_session,
        user_id=USER_A_ID,
        title="Run Notice",
        message="Dry run passed",
        category="automation",
    )

    resp_updates = client.get("/api/v1/notifications?filter=updates", headers=headers)
    assert resp_updates.status_code == 200
    updates_items = resp_updates.json()["items"]
    assert any(i["category"] in ["system", "account", "profile"] for i in updates_items)
    assert all(i["category"] not in ["automation", "applications"] for i in updates_items)

