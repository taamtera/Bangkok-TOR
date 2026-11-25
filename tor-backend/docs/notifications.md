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

Repeated calculations for the same user, company, TOR and version do not duplicate alerts or reset their read state. A new TOR version can generate a distinct event. Historical notifications remain stored; opening a TOR loads current details.

While running with its alert worker enabled, the backend checks tracked TOR fields and tag-catalog changes after each scan, with a default 60-second interval. Its first scan establishes a baseline without historical backfill. Profile saves and requirement refreshes also run matching. Recognized awarded and cancelled stages are excluded from new alerts. See [automatic matching and email](automatic-match-alerts.md) for queue behavior and configuration.

Email is optional and requires configured SMTP, `MATCH_ALERT_EMAIL_ENABLED=true`, and explicit user opt-in. The preference panel uses `GET /api/notifications/preferences` and `PATCH /api/notifications/preferences` with `{ "emailAlerts": true }` or false. Recipient identity comes from the authenticated account. Deadline reminders and detailed TOR-change comparison alerts are not implemented by this feature.

Tests: `npm test` includes event-policy tests. To test persistence and ownership
against Atlas, set `RUN_NOTIFICATION_INTEGRATION=true` and run
`node --test tests/notification.integration.test.mjs`. It refuses any database other
than `tor_software_test`, creates isolated fixture users/notifications, and removes
only those fixtures afterward. It never edits existing TORs or company profiles.
