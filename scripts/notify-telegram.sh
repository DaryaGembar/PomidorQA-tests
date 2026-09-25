set -euo pipefail

SEND=false
[[ "${1:-}" == "--send" ]] && SEND=true

escape_html() {
  local s="$1"
  s="${s//&/&amp;}"
  s="${s//</&lt;}"
  s="${s//>/&gt;}"
  printf '%s' "$s"
}

badge() {
  case "$1" in
    success) printf '✓' ;;
    failure) printf '✗' ;;
    *)       printf '–' ;;
  esac
}

duration() {
  local start="${1:-}" now end d
  now=$(date +%s)
  if [[ ! "$start" =~ ^[0-9]+$ ]]; then start=$now; fi
  d=$(( now - start ))
  if (( d < 0 )); then d=0; fi
  printf '%dм %02dс' $(( d / 60 )) $(( d % 60 ))
}

TOTAL=0; FAILURES=0; SKIPPED=0; PASSED=0
if [[ -f results.xml ]]; then
  TOTAL=$(grep -oE 'tests="[0-9]+"' results.xml | head -1 | grep -oE '[0-9]+' || true)
  FAILURES=$(grep -oE 'failures="[0-9]+"' results.xml | head -1 | grep -oE '[0-9]+' || true)
  SKIPPED=$(grep -oE 'skipped="[0-9]+"' results.xml | head -1 | grep -oE '[0-9]+' || true)
  : "${TOTAL:=0}"; : "${FAILURES:=0}"; : "${SKIPPED:=0}"
  PASSED=$(( TOTAL - FAILURES - SKIPPED ))
fi


FAILED_NAMES=$(python3 - <<'PY'
import xml.etree.ElementTree as ET

try:
    root = ET.parse('results.xml').getroot()
except Exception:
    raise SystemExit

names = []
for case in root.iter('testcase'):
    if case.find('failure') is not None or case.find('error') is not None:
        suite = (case.get('classname') or '').replace('.spec.ts', '')
        names.append(f"{suite} › {case.get('name', '')}")

for name in names[:5]:
    print(f" • {name}")
if len(names) > 5:
    print(f" • …и ещё {len(names) - 5}")
PY
)

UNIT_BADGE=$(badge "$UNIT_RESULT")
API_BADGE=$(badge "$API_RESULT")
E2E_BADGE=$(badge "$E2E_RESULT")
BRANCH_ESC=$(escape_html "$BRANCH")
REPO_ESC=$(escape_html "$REPO")
COMMITTER_ESC=$(escape_html "$COMMITTER")

SILENT=false
if [[ "$UNIT_RESULT" == "success" && "$API_RESULT" == "success" && "$E2E_RESULT" == "success" ]]; then
  HEAD="🟢 Пайплайн зелёный"; SILENT=true
else
  HEAD="🔴 Пайплайн красный"
fi

SEPARATOR='────────────────────────'

TEXT="<b>${HEAD}</b>
Репозиторий: <code>${REPO_ESC}</code> · ветка: <code>${BRANCH_ESC}</code>
Запустил: ${COMMITTER_ESC}🦒
${SEPARATOR}

Unit ${UNIT_BADGE} · API ${API_BADGE} · E2E ${E2E_BADGE}

Длительность:
Lint $(duration "$LINT_START_TS") 
Unit $(duration "$UNIT_START_TS")
API $(duration "$API_START_TS") 
E2E $(duration "$E2E_START_TS")
${SEPARATOR}

e2e: всего ${TOTAL}, ✓ ${PASSED}, ✗ ${FAILURES}, пропуск ${SKIPPED}"

if [[ -n "$FAILED_NAMES" ]]; then
  TEXT="${TEXT}

<b>Упавшие тесты:</b>
${FAILED_NAMES}"
fi

PAYLOAD_FILE=$(mktemp)
python3 - "$TEXT" "https://github.com/${REPO}/actions/runs/${RUN_ID}" \
  "https://github.com/${REPO}/commit/${COMMIT_SHA}" "$SILENT" "$TELEGRAM_CHAT_ID" \
  > "$PAYLOAD_FILE" <<'PY'
import json
import sys

text, run_url, commit_url, silent, chat_id = sys.argv[1:6]
payload = {
    "chat_id": chat_id,
    "parse_mode": "HTML",
    "disable_notification": silent == "true",
    "text": text,
    "reply_markup": {
        "inline_keyboard": [[
            {"text": "📊 Прогон", "url": run_url},
            {"text": "💬 Коммит", "url": commit_url},
        ]],
    },
}
print(json.dumps(payload, ensure_ascii=False))
PY

if [[ "$SEND" == true ]]; then
  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
    echo "Для --send нужны TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID." >&2
    exit 1
  fi

  curl --fail -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H 'Content-Type: application/json' \
    --data-binary "@${PAYLOAD_FILE}"

  PHOTO=$(find test-results -name 'test-failed-*.png' 2>/dev/null | head -1 || true)
  if [[ -n "$PHOTO" ]]; then
    curl --fail -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto" \
      -F chat_id="${TELEGRAM_CHAT_ID}" \
      -F photo="@${PHOTO}" \
      -F caption="${HEAD} — скриншот падения" \
      -F parse_mode="HTML" \
      -F disable_notification="${SILENT}" || true
  fi
else
  cat "$PAYLOAD_FILE"
fi

rm -f "$PAYLOAD_FILE"
