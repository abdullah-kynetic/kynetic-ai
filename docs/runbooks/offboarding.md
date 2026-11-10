# Offboarding a client

Offboarding is an admin action in the portal. It does not delete the client. `deletion_due_on` is 30 days after `offboarded_at` and is only a date on the screen. Nothing in the app removes the tenant, the rows, or the export file when that date arrives.

## What the portal does when an admin confirms the slug

In one database transaction it:

- turns on that client's outbound kill switch
- sets the client status to suspended
- turns off that client's automations and stops active runs
- revokes active service tokens
- sets `offboarded_at` and `deletion_due_on` the first time only
- writes an audit row `tenant.offboard`

It then queues a `tenant.export` job. The job writes a zip of CSV files under that client's storage prefix: contacts, companies, deals, notes, tasks, appointments, activities, call metadata, and messages. Call recordings and transcripts are not in the zip. The admin downloads a ready export from a short-lived signed URL.

Running the action again does not move the dates and does not start a second export while one is queued or ready.

## Before the 30-day date

1. Confirm the export downloaded and opened, and that it contains only that client.
2. Confirm calls and texts are still blocked (kill switch on, status suspended, and the env switch is still off unless a person has approved sending).
3. Confirm automations are off and service tokens are revoked.
4. Keep the zip somewhere the team already stores client files. Do not put it in Google Drive.

## Deletion is a separate decision

When the date arrives, a person reviews the checklist above. Deleting the client, the database rows, or the stored zip is not part of this action. It needs Abdullah's explicit yes on that deletion, a backup taken first, and a change that names the client. Do not run a delete from this runbook.
