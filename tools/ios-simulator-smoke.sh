#!/usr/bin/env bash
# Native process smoke only: screenshot is evidence for later human visual review.
set -euo pipefail
trap 'echo "::error::iOS simulator smoke failed at line $LINENO"' ERR
test "${CI:-}" = true || { echo 'Only run in isolated CI'; exit 1; }
mkdir -p test-results/ios
app=/tmp/nymeria-ios-derived/Build/Products/Debug-iphonesimulator/App.app
test -d "$app"
udid=$(xcrun simctl list devices available -j | python3 -c 'import json,sys; d=json.load(sys.stdin); phones=[x for runtime,values in d["devices"].items() if "iOS" in runtime for x in values if x["name"].startswith("iPhone")]; assert phones,"No available iPhone simulator"; print(next((x for x in phones if "Pro" in x["name"]),phones[0])["udid"])')
cleanup() { xcrun simctl shutdown "$udid" >/dev/null 2>&1 || true; }
trap cleanup EXIT
xcrun simctl boot "$udid"
xcrun simctl bootstatus "$udid" -b
xcrun simctl status_bar "$udid" override --time '9:41' --batteryState charged --batteryLevel 100
xcrun simctl install "$udid" "$app"
launch_check() {
  local response pid
  response=$(xcrun simctl launch "$udid" com.nymeria.game)
  echo "$response" | tee -a test-results/ios/launch.txt
  pid=${response##*: }
  sleep 5
  kill -0 "$pid"
  ps -p "$pid" -o pid,comm,etime > test-results/ios/process.txt
}
launch_check
xcrun simctl io "$udid" screenshot test-results/ios/first-launch.png
xcrun simctl terminate "$udid" com.nymeria.game
launch_check
xcrun simctl io "$udid" screenshot test-results/ios/reopened.png
xcrun simctl spawn "$udid" log show --last 3m --style compact --predicate 'process == "App"' > test-results/ios/app.log
xcrun simctl list devices -j > test-results/ios/devices.json
printf '%s\n' 'PASS simulator install, launch, process alive, terminate/relaunch.' 'NOT TESTED: touch navigation, gameplay, save creation, safe-area visual correctness or physical iPhone.' | tee test-results/ios/result.txt
