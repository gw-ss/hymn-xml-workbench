-- Parameters:
-- ?1 report_id, ?2 report_timezone, ?3 start_utc_ms (inclusive),
-- ?4 end_utc_exclusive_ms, ?5 snapshot_through_record_sequence.
WITH ranked_annotations AS (
  SELECT
    a.*,
    ROW_NUMBER() OVER (
      PARTITION BY a.occurrence_id
      ORDER BY a.annotated_at_ms DESC, a.annotation_id DESC
    ) AS rank_latest
  FROM occurrence_annotations AS a
), latest_annotations AS (
  SELECT * FROM ranked_annotations WHERE rank_latest = 1
), qualified AS (
  SELECT
    o.*,
    a.annotation_id,
    a.action AS annotation_action,
    a.reason AS annotation_reason,
    CASE
      WHEN a.action = 'include' THEN 'manually_included'
      WHEN a.action = 'exclude' THEN 'excluded'
      WHEN o.uncertain = 0 AND o.duration_ms >= 10000 THEN 'counted'
      WHEN o.uncertain = 1 THEN 'uncertain'
      ELSE 'transient_correction'
    END AS final_classification
  FROM presentation_occurrences AS o
  LEFT JOIN latest_annotations AS a ON a.occurrence_id = o.occurrence_id
  WHERE o.render_confirmed_at_ms >= ?3
    AND o.render_confirmed_at_ms < ?4
    AND o.record_sequence <= ?5
    AND o.ended_at_ms IS NOT NULL
    AND o.unit_kind IN ('verse','chorus','refrain')
)
SELECT
  ?1 AS report_id,
  ?2 AS report_timezone,
  'display-qualification' AS policy_id,
  '1' AS policy_version,
  10000 AS threshold_ms,
  COALESCE(g.congregation_id, '') AS congregation_id,
  COALESCE(c.display_name_snapshot, '') AS congregation_name,
  g.gathering_id,
  COALESCE(g.display_name, '') AS gathering_name,
  q.occurrence_id,
  q.sequence AS occurrence_sequence,
  strftime('%Y-%m-%dT%H:%M:%fZ', q.render_confirmed_at_ms / 1000.0, 'unixepoch') AS render_confirmed_at_utc,
  strftime('%Y-%m-%dT%H:%M:%fZ', q.ended_at_ms / 1000.0, 'unixepoch') AS ended_at_utc,
  q.duration_ms,
  q.final_classification AS classification,
  CASE WHEN q.final_classification = 'manually_included' THEN COALESCE(q.annotation_id, '') ELSE '' END AS classification_annotation_id,
  CASE WHEN q.final_classification = 'manually_included' THEN COALESCE(q.annotation_reason, '') ELSE '' END AS classification_reason,
  s.hymn_id,
  s.hymn_number_snapshot AS hymn_number,
  COALESCE(s.title_zh_hant_snapshot, '') AS title_zh_hant,
  COALESCE(s.title_zh_hans_snapshot, '') AS title_zh_hans,
  COALESCE(s.title_en_snapshot, '') AS title_en,
  s.source_id,
  s.source_name_snapshot AS source_name,
  s.collection_id,
  s.collection_name_snapshot AS collection_name,
  s.edition_id,
  s.edition_name_snapshot AS edition_name,
  q.release_id,
  q.unit_kind,
  q.section_id,
  q.verse_number,
  COALESCE(q.unit_label_snapshot, '') AS unit_label,
  q.navigation_cause,
  q.end_reason,
  s.selected_by_actor_id
FROM qualified AS q
JOIN gatherings AS g ON g.gathering_id = q.gathering_id
LEFT JOIN congregations AS c ON c.congregation_id = g.congregation_id
JOIN hymn_selections AS s ON s.selection_id = q.selection_id
WHERE q.final_classification IN ('counted','manually_included')
ORDER BY q.render_confirmed_at_ms, q.record_sequence, q.occurrence_id;
