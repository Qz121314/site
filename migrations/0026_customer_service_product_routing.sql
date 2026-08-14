PRAGMA foreign_keys = ON;

UPDATE conversion_groups
SET remote_group_id = NULL,
    remote_group_name = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE mode = 'customer_service'
  AND (remote_group_id IS NOT NULL OR remote_group_name IS NOT NULL);
