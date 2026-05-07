#!/usr/bin/env bash
# Manage the Synapse GitHub project board (bogdanws/projects/4).
#
# Commands:
#
#   add: Create a new draft card. User story IDs are in docs/USER_STORIES.md; use "N/A (infrastructure)" or "N/A (documentation)" for non-feature cards.
#     ./scripts/project.sh add "<title>" "<body>" "<user_story>"
#
#   status: Move a card to a different column (Todo, In Progress, or Done).
#     ./scripts/project.sh status <item_id> <status>
#
#   list: Print all cards, optionally filtered to a single status column.
#     ./scripts/project.sh list [status]
#
#   show: Print the full details of a single card (title, status, user story, and body) by its item ID.
#     ./scripts/project.sh show <item_id>
#
#   edit: Update a single field on an existing card. Supported fields: title, body, user-story.
#     ./scripts/project.sh edit <item_id> title|body|user-story "<value>"
#
#   delete: Remove a card from the board permanently.
#     ./scripts/project.sh delete <item_id>
#
# Statuses: Todo | In Progress | Done

set -euo pipefail

PROJECT_ID="PVT_kwHOAyj0fc4BSrE1"
FIELD_STATUS="PVTSSF_lAHOAyj0fc4BSrE1zhAI12c"
FIELD_USER_STORY="PVTF_lAHOAyj0fc4BSrE1zhAJDeg"

STATUS_TODO="f75ad846"
STATUS_IN_PROGRESS="47fc9ee4"
STATUS_DONE="98236657"

status_id() {
  case "$1" in
    "Todo")        echo "$STATUS_TODO" ;;
    "In Progress") echo "$STATUS_IN_PROGRESS" ;;
    "Done")        echo "$STATUS_DONE" ;;
    *) echo "Unknown status: $1. Use: Todo | In Progress | Done" >&2; exit 1 ;;
  esac
}

cmd_add() {
  local title="$1" body="$2" user_story="$3"

  local item_id
  item_id=$(gh api graphql \
    -f query='mutation($pid: ID!, $t: String!, $b: String!) {
      addProjectV2DraftIssue(input: { projectId: $pid title: $t body: $b }) {
        projectItem { id }
      }
    }' \
    -f pid="$PROJECT_ID" -f t="$title" -f b="$body" \
    --jq '.data.addProjectV2DraftIssue.projectItem.id')

  gh api graphql \
    -f query='mutation($pid: ID!, $iid: ID!, $fid: ID!, $val: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $pid itemId: $iid fieldId: $fid value: { text: $val }
      }) { projectV2Item { id } }
    }' \
    -f pid="$PROJECT_ID" -f iid="$item_id" -f fid="$FIELD_USER_STORY" -f val="$user_story" \
    > /dev/null

  echo "Created: $item_id — $title"
}

cmd_status() {
  local item_id="$1" status_name="$2"
  local opt_id
  opt_id=$(status_id "$status_name")

  gh api graphql \
    -f query='mutation($pid: ID!, $iid: ID!, $fid: ID!, $oid: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $pid itemId: $iid fieldId: $fid
        value: { singleSelectOptionId: $oid }
      }) { projectV2Item { id } }
    }' \
    -f pid="$PROJECT_ID" -f iid="$item_id" -f fid="$FIELD_STATUS" -f oid="$opt_id" \
    > /dev/null

  echo "Updated $item_id → $status_name"
}

cmd_list() {
  local filter="${1:-}"

  gh project item-list 4 --owner bogdanws --limit 200 --format json \
    | jq -r --arg f "$filter" '
        .items[]
        | select($f == "" or .status == $f)
        | "\(.status)\t\(.id)\t\(.title)"
      ' \
    | column -t -s $'\t'
}

cmd_show() {
  local item_id="$1"

  gh api graphql \
    -f query='query($id: ID!) {
      node(id: $id) {
        ... on ProjectV2Item {
          content {
            ... on DraftIssue { id title body }
          }
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldTextValue {
                text field { ... on ProjectV2Field { name } }
              }
              ... on ProjectV2ItemFieldSingleSelectValue {
                name field { ... on ProjectV2SingleSelectField { name } }
              }
            }
          }
        }
      }
    }' \
    -f id="$item_id" \
    | jq -r '
        .data.node
        | (.content.title) as $title
        | (.content.body) as $body
        | (.fieldValues.nodes | map(select(.field.name == "Status")) | first | .name) as $status
        | (.fieldValues.nodes | map(select(.field.name == "User story")) | first | .text) as $us
        | "Title:      \($title)\nStatus:     \($status)\nUser Story: \($us)\n\nBody:\n\($body)"
      '
}

cmd_edit() {
  local item_id="$1" field="$2" value="$3"

  case "$field" in
    title|body)
      local draft_id
      draft_id=$(gh api graphql \
        -f query='query($id: ID!) {
          node(id: $id) { ... on ProjectV2Item { content { ... on DraftIssue { id } } } }
        }' \
        -f id="$item_id" \
        --jq '.data.node.content.id')

      gh api graphql \
        -f query="mutation(\$id: ID!, \$val: String!) {
          updateProjectV2DraftIssue(input: { draftIssueId: \$id $field: \$val }) {
            draftIssue { id }
          }
        }" \
        -f id="$draft_id" -f val="$value" \
        > /dev/null
      ;;
    user-story)
      gh api graphql \
        -f query='mutation($pid: ID!, $iid: ID!, $fid: ID!, $val: String!) {
          updateProjectV2ItemFieldValue(input: {
            projectId: $pid itemId: $iid fieldId: $fid value: { text: $val }
          }) { projectV2Item { id } }
        }' \
        -f pid="$PROJECT_ID" -f iid="$item_id" -f fid="$FIELD_USER_STORY" -f val="$value" \
        > /dev/null
      ;;
    *)
      echo "Unknown field: $field. Use: title | body | user-story" >&2
      exit 1
      ;;
  esac

  echo "Updated $item_id ($field)"
}

cmd_delete() {
  local item_id="$1"

  gh api graphql \
    -f query='mutation($pid: ID!, $iid: ID!) {
      deleteProjectV2Item(input: { projectId: $pid itemId: $iid }) {
        deletedItemId
      }
    }' \
    -f pid="$PROJECT_ID" -f iid="$item_id" \
    > /dev/null

  echo "Deleted $item_id"
}

case "${1:-}" in
  add)    cmd_add "$2" "$3" "$4" ;;
  status) cmd_status "$2" "$3" ;;
  list)   cmd_list "${2:-}" ;;
  show)   cmd_show "$2" ;;
  edit)   cmd_edit "$2" "$3" "$4" ;;
  delete) cmd_delete "$2" ;;
  *)
    echo "Usage:"
    echo "  $0 add \"<title>\" \"<body>\" \"<user_story>\""
    echo "  $0 status <item_id> <status>"
    echo "  $0 list [Todo|In Progress|Done]"
    echo "  $0 show <item_id>"
    echo "  $0 edit <item_id> title|body|user-story \"<value>\""
    echo "  $0 delete <item_id>"
    exit 1
    ;;
esac
