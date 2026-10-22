# Password reset email

The backend sends reset emails through SMTP using Nodemailer. The frontend never
receives SMTP credentials or raw reset tokens from the API. Forgot-password always
returns the same public message for registered and unknown addresses. Delivery
failures are logged on the backend without credentials or reset links.

## Gmail setup

1. Turn on 2-Step Verification for the Google account that will send emails.
2. Create an App Password at https://myaccount.google.com/apppasswords and name it
   `Thailand TOR local development`.
3. In `tor-backend/.env`, set:

   ```dotenv
   EMAIL_DELIVERY=smtp
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=your-sender@gmail.com
   SMTP_PASSWORD=your-google-app-password
   EMAIL_FROM=your-sender@gmail.com
   ```

   Use the App Password without display spaces. Do not use your Google login
   password. Keep `.env` local; it is ignored by Git.
4. Put the frontend URL first in `FRONTEND_ORIGIN` (for this local setup,
   `http://localhost:3001`) so reset links open the right site.
5. Restart the backend to load settings. Request a reset for a registered address,
   check its inbox/spam, open the link, choose a password, and log in again.

The sending account and the recipient account can be different. Gmail may restrict
App Password availability for managed accounts or accounts with Advanced Protection.
See https://support.google.com/accounts/answer/185833 for current Google guidance.

## Team development and release

Choose one team-controlled sending account. Each teammate runs their own backend
with the team's SMTP settings supplied privately in their ignored `.env` file;
they do not need to create personal SMTP accounts. Keep local frontend origins
pointing to each developer's frontend. Commit `.env.example` and the sender code,
never the real `.env` or App Password. For the final hosted release, configure
these same variables once in the hosting platform's secret settings and set
`FRONTEND_ORIGIN` to the real HTTPS website. This requires no sender code changes.

SMTP acceptance means the provider accepted the message, not guaranteed inbox
placement. Inbox delivery still needs to be checked with the configured account.

## Local terminal mode

Set `EMAIL_DELIVERY=console` explicitly to print links instead of sending email.
This mode cannot be used in production. SMTP delivery never prints reset links.
