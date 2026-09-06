#!/usr/bin/env bash
# tnAI Read API smoke test - proves the API is up, locked, and serving real data.
# Run it on the VM (or anywhere that can reach the API) after any deploy:
#
#   bash scripts/api-smoke.sh http://localhost:4000 [bearer-token]
#
# With AUTH_MODE=entra there is no static token; run without one and the script
# verifies reachability + that every data endpoint correctly REJECTS anonymous
# calls. Full data checks then happen by opening the dashboard as a signed-in user.
set -u
API="${1:?usage: api-smoke.sh <api-base-url> [token]}"
TOKEN="${2:-}"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); printf 'PASS  %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf 'FAIL  %s\n' "$1"; }

code() { curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$@"; }

# 1. Reachability: /health is open by design and proves the process is up.
c=$(code "$API/health")
[ "$c" = "200" ] && ok "API reachable ($API/health -> 200)" || bad "API unreachable ($API/health -> $c)"

# 2. The door is locked: data endpoints must reject anonymous requests.
c=$(code "$API/api/accounts")
[ "$c" = "401" ] && ok "auth enforced (/api/accounts without token -> 401)" || bad "auth NOT enforced (/api/accounts anonymous -> $c, expected 401)"

if [ -z "$TOKEN" ]; then
  echo "No token supplied - skipping data checks (fine under AUTH_MODE=entra)."
  echo "Verify data by signing in to the dashboard: if it shows accounts, the DB chain works."
else
  # 3. Auth accepted + database chain: every read endpoint should return JSON with rows.
  for ep in me accounts projects signals calls risks weekly-reports associates; do
    body=$(curl -s --max-time 20 -H "Authorization: Bearer $TOKEN" "$API/api/$ep")
    if [ -z "$body" ]; then bad "/api/$ep returned empty"; continue; fi
    n=$(printf '%s' "$body" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    print(len(d) if isinstance(d,list) else 1 if isinstance(d,dict) and d else 0)
except Exception:
    print(-1)")
    if [ "$n" = "-1" ]; then bad "/api/$ep returned non-JSON"
    elif [ "$n" = "0" ]; then bad "/api/$ep returned no data"
    else ok "/api/$ep -> $n row(s)"
    fi
  done
fi

echo
echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" = "0" ]
