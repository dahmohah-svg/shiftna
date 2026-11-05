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
| `012_open_hospitals.sql` | Any approved doctor adds hospitals (5 a day, no duplicates); `hospital_trust()` credibility levels; admin alert |
| `013_merge_hospitals.sql` | Admin merges duplicate hospitals (moves shifts, ratings, teams, logbook); similar-name suggestions (pg_trgm) |
| `014_hospital_insert_from_sql.sql` | Hospitals added from the SQL Editor keep their values (doctors in the app are still unverified, 5 a day) |
| `015_doctors_verified.sql` | `doctors_verified()`: yes/no "Syndicate verified" for many doctors at once (documents approved and current) |
| `016_everything_free.sql` | Pilot: every approved doctor counts as Premium (create teams, see others' rank). The file shows how to undo it |
| `017_open_teams.sql` | Teams work straight away (proof optional); admin verifies, pauses or resumes them later; alerts for each |
| `018_private_phone_numbers.sql` | `show_phone` setting and `contact_phones()`: a number only for yourself, the admin, or the other doctor in a confirmed booking |
| `019_lock_phone_column.sql` | Doctors can no longer read `profiles.phone` directly (run after the app that uses `contact_phones()` is live) |
| `020_growth_dashboard.sql` | `track_open()` (one 'open' event per doctor per day), `admin_growth()` weekly numbers and `admin_growth_summary()` for the admin Growth tab |
| `021_specialties_and_interns.sql` | Specialties (6) with sub-specialties on doctors, shifts and alerts; intern grade and internship letter; grade/specialty locked after approval |

Files 001 to 005 are exactly as printed in the build guide; copy them from
there if you need to set up a second project (for example staging).

After changing the database, regenerate the app's types into
`src/lib/supabase/database.types.ts`.
