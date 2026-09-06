DELETE FROM ai_suggestions
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY transaction_id
        ORDER BY created_at DESC, id DESC
      ) AS row_number
    FROM ai_suggestions
  )
  WHERE row_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_suggestions_transaction_unique_idx
  ON ai_suggestions(transaction_id);
