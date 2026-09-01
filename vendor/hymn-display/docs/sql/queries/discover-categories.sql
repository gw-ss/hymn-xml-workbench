-- Parameters: ?1 source_id, ?2 collection_id, ?3 edition_id, ?4 requested language.
SELECT
  c.category_id,
  COALESCE(
    (SELECT n.name FROM category_names AS n WHERE n.category_id = c.category_id AND n.language = ?4),
    (SELECT a.alias_text FROM search_aliases AS a WHERE a.owner_type = 'category_name' AND a.owner_id = c.category_id AND a.field_language = ?4 ORDER BY a.alias_id LIMIT 1),
    (SELECT n.name FROM category_names AS n WHERE n.category_id = c.category_id AND n.language = 'en'),
    (SELECT n.name FROM category_names AS n WHERE n.category_id = c.category_id AND n.language = 'zh-Hant'),
    (SELECT n.name FROM category_names AS n WHERE n.category_id = c.category_id AND n.language = 'zh-Hans'),
    (SELECT n.name FROM category_names AS n WHERE n.category_id = c.category_id ORDER BY n.language LIMIT 1)
  ) AS display_name,
  COUNT(h.hymn_id) AS hymn_count
FROM categories AS c
JOIN hymns AS h ON h.category_id = c.category_id
WHERE c.lifecycle_state = 'active'
  AND h.source_id = ?1
  AND h.collection_id = ?2
  AND h.edition_id = ?3
GROUP BY c.category_id
ORDER BY c.sequence, display_name, c.category_id;
