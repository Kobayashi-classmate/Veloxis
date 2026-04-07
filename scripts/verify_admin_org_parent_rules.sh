#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${BASE_URL:-}" || -z "${TOKEN:-}" ]]; then
  echo "Usage: BASE_URL=http://localhost:8080 TOKEN=<directus_token> [PARENT_ID=<same_scope_parent_id>] [CROSS_ORG_ID=<other_org_id>] $0"
  exit 1
fi

API_URL="${BASE_URL%/}/api/items/org_units"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

request_case() {
  local name="$1"
  local payload="$2"
  local expect="$3"
  local body_file="$TMP_DIR/${name}.json"

  local status
  status=$(curl -sS -o "$body_file" -w "%{http_code}" \
    -X POST "$API_URL" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    --data "$payload")

  local ok="false"
  if [[ "$expect" == "success" ]]; then
    [[ "$status" =~ ^2[0-9][0-9]$ ]] && ok="true"
  else
    [[ ! "$status" =~ ^2[0-9][0-9]$ ]] && ok="true"
  fi

  echo "[$name] status=$status expect=$expect pass=$ok"
  echo "[$name] payload=$payload"
  echo "[$name] body=$(cat "$body_file")"
  echo
}

# 1) root create without organization_id: should succeed for single-scope token, or fail when token has no resolvable current scope
request_case "root_without_org" '{"name":"rule_root_no_org","code":"RULE_ROOT_NO_ORG","parent_id":null}' "success"

# 2) child create under valid parent, without organization_id: should follow parent scope
if [[ -n "${PARENT_ID:-}" ]]; then
  request_case "child_with_valid_parent" "{\"name\":\"rule_child_valid_parent\",\"code\":\"RULE_CHILD_VALID_PARENT\",\"parent_id\":\"$PARENT_ID\"}" "success"
else
  echo "[child_with_valid_parent] skipped (set PARENT_ID to run this case)"
  echo
fi

# 3) child create with invalid parent id: should fail
request_case "child_with_invalid_parent" '{"name":"rule_child_invalid_parent","code":"RULE_CHILD_INVALID_PARENT","parent_id":"__not_exists_parent__"}' "failure"

# 4) cross-org mount attempt: should fail when CROSS_ORG_ID is provided
if [[ -n "${PARENT_ID:-}" && -n "${CROSS_ORG_ID:-}" ]]; then
  request_case "child_cross_org_parent" "{\"name\":\"rule_child_cross_org\",\"code\":\"RULE_CHILD_CROSS_ORG\",\"organization_id\":\"$CROSS_ORG_ID\",\"parent_id\":\"$PARENT_ID\"}" "failure"
else
  echo "[child_cross_org_parent] skipped (set both PARENT_ID and CROSS_ORG_ID to run this case)"
  echo
fi

echo "Done."
