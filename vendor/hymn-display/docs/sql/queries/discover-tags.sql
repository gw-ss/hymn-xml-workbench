-- Parameters: ?1 source_id, ?2 collection_id, ?3 edition_id, ?4 requested language.
SELECT
  t.tag_id,
  COALESCE(
    (SELECT n.name FROM tag_names AS n WHERE n.tag_id = t.tag_id AND n.language = ?4),
    (SELECT a.alias_text FROM search_aliases AS a WHERE a.owner_type = 'tag_name' AND a.owner_id = t.tag_id AND a.field_language = ?4 ORDER BY a.alias_id LIMIT 1),
    (SELECT n.name FROM tag_names AS n WHERE n.tag_id = t.tag_id AND n.language = 'en'),
    (SELECT n.name FROM tag_names AS n WHERE n.tag_id = t.tag_id AND n.language = 'zh-Hant'),
    (SELECT n.name FROM tag_names AS n WHERE n.tag_id = t.tag_id AND n.language = 'zh-Hans'),
    (SELECT n.name FROM tag_names AS n WHERE n.tag_id = t.tag_id ORDER BY n.language LIMIT 1)
  ) AS display_name,
  COUNT(DISTINCT h.hymn_id) AS hymn_count
FROM tags AS t
JOIN hymn_tags AS ht ON ht.tag_id = t.tag_id
JOIN hymns AS h ON h.hymn_id = ht.hymn_id
WHERE t.lifecycle_state = 'active'
  AND h.source_id = ?1
  AND h.collection_id = ?2
  AND h.edition_id = ?3
GROUP BY t.tag_id
ORDER BY t.sequence, display_name, t.tag_id;
