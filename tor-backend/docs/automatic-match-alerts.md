# Automatic match alerts

The API process checks shared MongoDB TOR records every minute. Keep the backend running; no additional n8n flow is required. AI extraction remains owned by the existing workflow.

The first scan records a baseline without sending historical alerts. Later new or changed TORs and catalog changes trigger rules-based matching against company profiles, at most 20 TORs per scan. Profile saves already refresh that company. Failed scans retain unprocessed changes for retry. A shared MongoDB lease coordinates backend instances.

Positive requirement coverage creates an in-app notification. Awarded and cancelled stages are excluded. Coverage is not proof of eligibility or an open bidding period. Deduplication uses company, user, TOR and version, preserving read state on repeat checks. A changed TOR with the same version updates matches but does not create another notification for an already notified user.

## Email

Use the existing SMTP settings in the backend ignored .env. Never commit SMTP credentials. Set MATCH_ALERT_EMAIL_ENABLED=true to make the option available. New accounts start opted out. Existing email channel preferences alone are insufficient: each account must explicitly enable matchEmailOptIn through the notification panel. Emails go to the account email and link to the project. Turning alerts off cancels queued deliveries when the worker next checks them.

The match_email_outbox collection persists delivery attempts and uses unique event IDs. Multiple dispatchers claim work atomically. Definite connection failures retry up to three times. Ambiguous delivery failures and interrupted sends are marked uncertain and require inspection rather than risking duplicate mail. Authentication or recipient errors are marked failed. SMTP acceptance does not prove inbox delivery.

MATCH_ALERT_WORKER_ENABLED=false disables the worker. MATCH_ALERT_INTERVAL_MS defaults to 60000 and is bounded between 15000 and 3600000. Email defaults off unless explicitly enabled. match_alert_state stores the scan baseline and lease; do not delete it casually because doing so resets the baseline.

## Validation

Run node --test tests/automatic-alerts.test.mjs tests/notification-events.test.mjs tests/password-reset-email.test.mjs. AUTO_ALERT_DB_TEST=1 enables automatic-alerts.integration.test.mjs, which creates and deletes only a randomly named disposable database. All email tests use mock senders and send no real mail. The integration test checks baseline, retry checkpoints, locking, duplicate delivery prevention, opt-out, failure states and authenticated preference controls.
