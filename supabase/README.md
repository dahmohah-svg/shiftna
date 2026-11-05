# Database

The live database is the Supabase project **shiftna-dev**. These migrations
have been applied there, in this order:

| File | What it does |
| --- | --- |
| `001_init.sql` | Tables, helper functions and security rules (build guide, Part 3) |
| `002_upgrades.sql` | Subspecialty, cancellations, overlap blocking, hospital staff, alerts (Part 3b) |
| `003_private_groups.sql` | Private groups for institutes (Part 3c) |
| `004_trust_insights.sql` | Selfie, document expiry, disputes, usage tracking, pay ranges (Part 3d) |
| `004b_daily_jobs.sql` | Daily pg_cron jobs |
| `005_elite.sql` | Instant booking, invites, badges, logbook, rotas (Part 3e) |
| `006_lock_down_function_access.sql` | Only signed-in users can call app functions |
| `007_app_support.sql` | `refuse_offer` function and live chat (Realtime on `messages`) |
| `008_notifications.sql` | In-app notifications: read tracking, triggers that create them, shift-alert matching, Realtime |
| `009_urgent_alert_fix.sql` | Urgent "needs cover" alerts skip the doctor who cancelled and include hospital and time |
| `010_team_notifications.sql` | Alerts for Teams (the app's name for private groups): approved/rejected, join requests, accepted, new team shift |
| `011_team_manager_tools.sql` | Renew invite code, re-add removed doctors, let leavers rejoin; accepting only works on pending requests |

Files 001 to 005 are exactly as printed in the build guide; copy them from
there if you need to set up a second project (for example staging).

After changing the database, regenerate the app's types into
`src/lib/supabase/database.types.ts`.
