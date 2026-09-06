UPDATE imported_rows
SET raw_data_json = '{}'
WHERE raw_data_json <> '{}';

DELETE FROM imported_rows
WHERE status IN ('imported', 'duplicate');
