"""Browser acceptance against disposable local Firebase emulators (see S2-AUTH-SESSION-HANDOFF.md)."""
import json
import os
import secrets
import time
from datetime import datetime
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright

UI = "http://127.0.0.1:5173"
API = "http://127.0.0.1:3000/api/v1"
AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1"
STORE = "http://127.0.0.1:8080/v1/projects/demo-libraryflow/databases/(default)/documents"
ADMIN = {"Authorization": "Bearer owner"}


def require(response, status):
    if response.status != status:
        raise AssertionError(f"Expected HTTP {status}, got {response.status} at {response.url.split('?')[0]}")
    return response.json()


def login(page, email, password):
    page.get_by_label("Email address").fill(email)
    page.get_by_label("Password", exact=True).fill(password)
    page.get_by_role("button", name="Sign In", exact=True).click()


def signed_in(page):
    expect(page.get_by_role("button", name="Log out")).to_be_visible(timeout=15000)


def run(browser):
    reader = browser.new_page()
    moderator = browser.new_page()
    # Use a separate new user for each execution and only configure roles in the emulator.
    suffix = uuid4().hex[:12]
    email = f"reader-{suffix}@example.test"
    mod_email = f"mod-{suffix}@example.test"
    password = secrets.token_urlsafe(18) + "Aa9!"
    http = reader.request
    # Check the browser-facing Auth emulator before creating any fixtures.
    require(http.get("http://127.0.0.1:9099/emulator/v1/projects/demo-libraryflow/config"), 200)
    for address in (email, mod_email):
        require(http.post(API + "/auth/register", data={
            "email": address, "password": password, "requestedRole": "reader"
        }), 201)
    record = require(http.post(AUTH + "/accounts:lookup", headers=ADMIN, data={"email": [mod_email]}), 200)
    require(http.post(AUTH + "/accounts:update", headers=ADMIN, data={
        "localId": record["users"][0]["localId"], "customAttributes": json.dumps({"role": "moderator"})
    }), 200)

    reader.goto(UI)
    login(reader, email, password)
    signed_in(reader)
    with reader.expect_response(lambda r: r.url == API + "/auth/session" and r.status == 200) as restored:
        reader.reload()
    signed_in(reader)
    uid = restored.value.json()["data"]["user"]["id"]
    print("PASS reader sign-in and session restoration on reload", flush=True)

    # Backdate only this disposable reader's active session inside the emulator.
    sessions = require(http.post(STORE + ":runQuery", headers=ADMIN, data={"structuredQuery": {
        "from": [{"collectionId": "authSessions"}],
        "where": {"fieldFilter": {"field": {"fieldPath": "uid"}, "op": "EQUAL", "value": {"stringValue": uid}}}
    }}), 200)
    for result in sessions:
        session = result["document"]
        path = session["name"].split("/documents/")[1]
        require(http.patch(STORE + "/" + path + "?updateMask.fieldPaths=lastActivityAt", headers=ADMIN,
                           data={"fields": {"lastActivityAt": {"integerValue": str(int(time.time()*1000)-1800001)}}}), 200)
    with reader.expect_response(lambda r: r.url == API + "/auth/session" and r.status == 401):
        reader.reload()
    expect(reader.get_by_role("button", name="Sign In", exact=True)).to_be_visible()
    print("PASS 30-minute inactivity cutoff using a backdated Firestore fixture", flush=True)

    time.sleep(1.1)  # Firebase auth_time has one-second resolution.
    login(reader, email, password)
    signed_in(reader)
    with reader.expect_response(lambda r: r.url == API + "/auth/logout" and r.status == 200):
        reader.get_by_role("button", name="Log out").click()
    reader.reload()
    expect(reader.get_by_role("button", name="Sign In", exact=True)).to_be_visible()
    print("PASS logout and signed-out reload", flush=True)

    time.sleep(1.1)
    # Account settings is another owner's UI. Start deletion through the actual API.
    fixture = require(http.post(API + "/auth/login", data={"email": email, "password": password}), 200)
    deletion = require(http.post(API + "/account/deletion-request",
                       headers={"Authorization": "Bearer " + fixture["data"]["token"]}, data={"confirm": True}), 200)["data"]
    delta = datetime.fromisoformat(deletion["permanentDeletionAt"]) - datetime.fromisoformat(deletion["deletionRequestedAt"])
    assert delta.total_seconds() == 30 * 86400
    time.sleep(1.1)
    login(reader, email, password)
    cancel = reader.get_by_role("button", name="Request deletion cancellation")
    with reader.expect_response(lambda r: r.url == API + "/account/deletion-cancel" and r.status == 202):
        cancel.click()
    expect(reader.get_by_text("Your request is pending moderator approval.", exact=False)).to_be_visible()
    login(reader, email, password)
    expect(cancel).to_be_visible()
    print("PASS 30-day deadline and restricted login before and after cancellation request", flush=True)

    moderator.goto(UI)
    login(moderator, mod_email, password)
    signed_in(moderator)
    row = moderator.get_by_role("listitem").filter(has_text=uid)
    moderator.once("dialog", lambda dialog: dialog.accept())
    row.get_by_role("button", name="Approve restoration").click()
    expect(moderator.get_by_text("Restoration approved. The user must sign in again.")).to_be_visible()
    time.sleep(1.1)
    login(reader, email, password)
    signed_in(reader)
    print("PASS moderator approval and fresh reader sign-in", flush=True)


if __name__ == "__main__":
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.getenv("CHROMIUM_PATH") or None)
        try:
            run(browser)
        finally:
            browser.close()
