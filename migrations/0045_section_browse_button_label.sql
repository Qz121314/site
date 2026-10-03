ALTER TABLE sections ADD COLUMN browse_button_label TEXT NOT NULL DEFAULT '';

UPDATE sections
SET browse_button_label = CASE lower(slug)
  WHEN 'escorts' THEN 'Browse Escorts'
  WHEN 'dating' THEN 'Explore Dating'
  ELSE 'Explore ' || name
END;
