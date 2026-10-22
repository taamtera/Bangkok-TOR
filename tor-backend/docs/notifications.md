# In-app notifications

The bell opens a persisted inbox with pagination, unread counts, individual read
controls and mark-all-as-read. The frontend refreshes the unread count every 30
seconds while signed in. Signing out clears the local count and closes the inbox.
Clicking an alert loads the TOR, marks the notification read, and opens its details.

Authenticated API (recipient identity always comes from the session):

- `GET /api/notifications?page=1&limit=20` — items, unread count, pagination.
- `PATCH /api/notifications/:id/read` — idempotently mark your notification read.
- `PATCH /api/notifications/read-all` — mark your delivered in-app notifications read.

The existing database `notifications` validator and unique `eventKey` index are
required. Use the repository's normal database setup/verification procedure.

## Alert trigger

After the existing rules matcher successfully saves results, it publishes an
initial `new_match` alert for positive, compared requirement coverage. Each active
company member who opted into both `in_app` and `new_match` receives their own
alert. Zero, unassessed and AI recommendation results do not produce these alerts.
The percentage describes requirement coverage, not bid eligibility or AI suitability.

Repeated refreshes, concurrent requests, profile edits and TOR versions do not
duplicate the initial alert or reset its read state. Notifications already delivered
remain historical; opening a TOR loads its current details. Recalculate matches to
produce alerts: profile updates and requirement refreshes already call this path.
Direct crawler/database writes alone do not run the matcher. A crawler or future AI
worker must invoke the existing matching refresh flow after its results are saved.
There is no background matching scheduler or automatic backfill of old matches.

This first version implements `new_match` in-app alerts. Email notifications,
deadline reminders, TOR-change alerts and a preference editor are separate work;
the existing stored preferences are respected. No Gmail credentials are required.

Tests: `npm test` includes event-policy tests. To test persistence and ownership
against Atlas, set `RUN_NOTIFICATION_INTEGRATION=true` and run
`node --test tests/notification.integration.test.mjs`. It refuses any database other
than `tor_software_test`, creates isolated fixture users/notifications, and removes
only those fixtures afterward. It never edits existing TORs or company profiles.
