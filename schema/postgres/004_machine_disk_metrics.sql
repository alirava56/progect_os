ALTER TABLE machine_observations
  ADD COLUMN disk_used_bytes BIGINT,
  ADD COLUMN disk_total_bytes BIGINT,
  ADD CONSTRAINT machine_disk_metrics_valid CHECK (
    (disk_used_bytes IS NULL AND disk_total_bytes IS NULL) OR
    (disk_used_bytes IS NOT NULL AND disk_total_bytes IS NOT NULL AND
      disk_used_bytes >= 0 AND disk_total_bytes > 0 AND disk_used_bytes <= disk_total_bytes)
  );
