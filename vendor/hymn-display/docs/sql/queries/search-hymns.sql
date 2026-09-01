-- Parameters: ?1 source_id, ?2 collection_id, ?3 edition_id,
-- ?4 normalized text query (empty allowed), ?5 hymn-number query (empty allowed),
-- ?6 category_id (NULL means no Category constraint),
-- ?7 JSON array of Tag IDs (empty array means no Tag constraint).
WITH text_matches AS (
  SELECT
    owner_id AS hymn_id,
    MIN(CASE
      WHEN normalized_key = ?4 AND owner_type = 'hymn_title' THEN 3
      WHEN owner_type = 'hymn_title' THEN 4
      ELSE 5
    END) AS text_rank
  FROM search_aliases
  WHERE owner_type IN ('hymn_title','hymn_first_line')
    AND ?4 <> ''
    AND instr(normalized_key, ?4) > 0
  GROUP BY owner_id
), eligible AS (
  SELECT h.*
  FROM hymns AS h
  WHERE h.source_id = ?1
    AND h.collection_id = ?2
    AND h.edition_id = ?3
    AND (?6 IS NULL OR h.category_id = ?6)
    AND (
      json_array_length(?7) = 0
      OR EXISTS (
        SELECT 1
        FROM hymn_tags AS ht
        JOIN json_each(?7) AS selected_tag ON selected_tag.value = ht.tag_id
        WHERE ht.hymn_id = h.hymn_id
      )
    )
)
SELECT
  e.hymn_id,
  e.hymn_number,
  e.number_sort_key,
  e.category_id,
  MAX(CASE WHEN t.language = 'zh-Hant' THEN t.title END) AS title_zh_hant,
  MAX(CASE WHEN t.language = 'zh-Hans' THEN t.title END) AS title_zh_hans,
  MAX(CASE WHEN t.language = 'en' THEN t.title END) AS title_en,
  CASE
    WHEN ?5 <> '' AND e.hymn_number = ?5 THEN 1
    WHEN ?5 <> '' AND e.hymn_number LIKE ?5 || '%' THEN 2
    WHEN ?4 <> '' THEN tm.text_rank
    ELSE 6
  END AS match_rank
FROM eligible AS e
LEFT JOIN text_matches AS tm ON tm.hymn_id = e.hymn_id
LEFT JOIN hymn_titles AS t ON t.hymn_id = e.hymn_id
WHERE (?4 = '' AND ?5 = '')
   OR (?5 <> '' AND e.hymn_number LIKE ?5 || '%')
   OR (?4 <> '' AND tm.hymn_id IS NOT NULL)
GROUP BY e.hymn_id
ORDER BY match_rank, e.number_sort_key, e.hymn_number, COALESCE(title_en, title_zh_hant, title_zh_hans, ''), e.hymn_id;
