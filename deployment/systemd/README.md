# ProjectOS Linux worker scheduling (NOT automatically enabled)

This installation recipe requires a dedicated `projectos` system user, Node.js 22+, a private
SQLite database directory at `/var/lib/projectos`, and an existing working ProjectOS source
at `/opt/projectos`. Ensure the application itself is not publicly exposed until all gates pass.

1. Place worker environment variables in `/etc/projectos/worker.env` (owner root, mode 0600),
   including `PROJECTOS_DB_PATH=/var/lib/projectos/projectos.sqlite`. Do not put environment files in the repo.
2. Copy `.service` and `.timer` to `/etc/systemd/system/` and review sandbox paths/owner.
3. As administrator run `systemctl daemon-reload`, `systemctl enable --now projectos-maintenance.timer`.
4. Check `systemctl list-timers projectos-maintenance.timer`,
   `journalctl -u projectos-maintenance.service` and the notification_outbox database rows.
5. Uninstall with `systemctl disable --now projectos-maintenance.timer`.

The timer invokes an idempotent scheduled scan. Re-running scans should not create duplicate
incident IDs. Telegram delivery is **at least once** and network timeout may cause repeated messages.
The timer does not establish reliable phone/email delivery or offsite backup. Test on staging first.
