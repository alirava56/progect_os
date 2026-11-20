ALTER TABLE records DROP CONSTRAINT records_kind_check;
ALTER TABLE records ADD CONSTRAINT records_kind_check CHECK (kind IN (
  'projects', 'tasks', 'resources', 'secrets', 'reminders', 'incidents',
  'expenses', 'charges', 'contracts', 'revenues', 'docs', 'preferences', 'invoices', 'payments'
));
