-- Parameters: ?1 source_id, ?2 collection_id, ?3 edition_id, ?4 digit prefix.
SELECT h.hymn_id, h.hymn_number, m.digits
FROM melodies AS m
JOIN hymn_melodies AS hm ON hm.melody_id = m.melody_id
JOIN hymns AS h ON h.hymn_id = hm.hymn_id
WHERE h.source_id = ?1
  AND h.collection_id = ?2
  AND h.edition_id = ?3
  AND m.lifecycle_state <> 'disabled'
  AND length(?4) BETWEEN 1 AND 20
  AND ?4 NOT GLOB '*[^0-9]*'
  AND m.digits LIKE ?4 || '%'
ORDER BY length(m.digits), m.digits, h.number_sort_key, h.hymn_number, h.hymn_id;
