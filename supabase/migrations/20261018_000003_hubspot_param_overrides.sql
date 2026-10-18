-- HubSpot curated parameter overrides (from the live Contacts/Deals 2026-09
-- specs, verified with scripts/connector-overrides.mjs against
-- https://api.hubapi.com/public/api/spec/v2/specs/release/{165147,165150}/version/2026-09).
-- HubSpot specs carry no operationId: names are synthesized from the path and
-- embed the API date-version, so entries use glob keys (`*`) to survive
-- quarterly version churn. Object-family specs name records differently —
-- Contacts uses the literal path `/contacts`, while most other objects use
-- HubSpot's stable object-type IDs (0-1 contacts, 0-2 companies, 0-3 deals,
-- 0-5 tickets) which become `01`, `02`, `03`, `05` in synthesised names.
UPDATE public.connectors SET param_overrides = '{
  "*_contacts_search": {
    "description": "Search contacts with the HubSpot search DSL: body {filterGroups:[{filters:[{propertyName,operator,value}]}], sorts, query, properties, limit, after}. Not a plain listing — use the list endpoint (get_...) for simple pagination.",
    "params": {
      "body.filterGroups": { "description": "AND/OR filter groups: [{filters:[{propertyName, operator (EQ|NEQ|CONTAINS_TOKEN|GT|GTE|LT|LTE|IN|NOT_IN|HAS_PROPERTY|NOT_HAS_PROPERTY), value|values}]}]" },
      "body.properties": { "description": "Property names to return per contact (e.g. email, firstname, lastname)" },
      "body.limit": { "description": "Results per page, default 10, max 100" },
      "body.after": { "description": "Paging cursor from a previous search response" }
    }
  },
  "*_01_search": {
    "description": "Search objects with the HubSpot search DSL: body {filterGroups:[{filters:[{propertyName,operator,value}]}], sorts, query, properties, limit, after}."
  },
  "*_02_search": {
    "description": "Search objects with the HubSpot search DSL: body {filterGroups:[{filters:[{propertyName,operator,value}]}], sorts, query, properties, limit, after}."
  },
  "*_03_search": {
    "description": "Search objects with the HubSpot search DSL: body {filterGroups:[{filters:[{propertyName,operator,value}]}], sorts, query, properties, limit, after}."
  },
  "*_05_search": {
    "description": "Search objects with the HubSpot search DSL: body {filterGroups:[{filters:[{propertyName,operator,value}]}], sorts, query, properties, limit, after}."
  },
  "*_merge": {
    "description": "Merge one record into another. Body: {primaryObjectId, objectIdToMerge} — objectIdToMerge values are copied onto primary, then the source record is retired."
  },
  "*_gdpr*": {
    "description": "GDPR delete — permanently erases the record for compliance (no soft delete). Body: {idProperty?, objectId}."
  },
  "get_*_contacts": {
    "params": {
      "query.limit": { "description": "Maximum results per page (default 10)" },
      "query.after": { "description": "The paging cursor token (returned as paging.next.after of a paged response)" },
      "query.properties": { "description": "Comma-separated list of properties to return (e.g. email,firstname); unknown names are ignored" },
      "query.associations": { "description": "Comma-separated object types to retrieve associated IDs for (e.g. companies)" }
    }
  },
  "get_*_01": {
    "params": {
      "query.limit": { "description": "Maximum results per page (default 10)" },
      "query.after": { "description": "The paging cursor token (returned as paging.next.after of a paged response)" },
      "query.properties": { "description": "Comma-separated list of properties to return; unknown names are ignored" }
    }
  },
  "get_*_02": {
    "params": {
      "query.limit": { "description": "Maximum results per page (default 10)" },
      "query.after": { "description": "The paging cursor token (returned as paging.next.after of a paged response)" },
      "query.properties": { "description": "Comma-separated list of properties to return; unknown names are ignored" }
    }
  },
  "get_*_03": {
    "params": {
      "query.limit": { "description": "Maximum results per page (default 10)" },
      "query.after": { "description": "The paging cursor token (returned as paging.next.after of a paged response)" },
      "query.properties": { "description": "Comma-separated list of properties to return; unknown names are ignored" }
    }
  },
  "get_*_05": {
    "params": {
      "query.limit": { "description": "Maximum results per page (default 10)" },
      "query.after": { "description": "The paging cursor token (returned as paging.next.after of a paged response)" },
      "query.properties": { "description": "Comma-separated list of properties to return; unknown names are ignored" }
    }
  }
}'::jsonb
WHERE slug = 'hubspot';

-- Sanity: the same overrides must never apply to other connectors.
UPDATE public.connectors SET param_overrides = '{}'::jsonb WHERE slug = 'hubspot' AND jsonb_typeof(param_overrides) IS DISTINCT FROM 'object';
