#!/usr/bin/env bash
# Copy Portal Workspace native plugin into BigTits Capacitor iOS project.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS="$ROOT/ios"
PLUGIN_SRC="$ROOT/native/portal-workspace-ios"
ASSETS_SRC="$ROOT/native/portal-workspace/assets"
DEST="$IOS/App/App/PortalWorkspace"
PBXPROJ="$IOS/App/App.xcodeproj/project.pbxproj"
CAP_JSON="$IOS/App/App/capacitor.config.json"

if [[ ! -d "$IOS/App/App" ]]; then
  echo "iOS project missing. Run: cd app && npm run build && npx cap add ios"
  exit 1
fi

mkdir -p "$DEST/adapters"
cp "$PLUGIN_SRC/"*.swift "$DEST/"
cp "$ASSETS_SRC/autofill.js" "$DEST/"
cp "$ASSETS_SRC/adapters/"* "$DEST/adapters/"

python3 - "$PBXPROJ" <<'PY'
import sys

pbx = sys.argv[1]
with open(pbx) as f:
    content = f.read()

if "PortalWorkspacePlugin.swift" in content:
    print("Xcode project already includes Portal Workspace — skipping pbxproj patch.")
    sys.exit(0)

# Stable UUIDs for Portal Workspace entries
IDS = {
    "group_pw": "PW1EC0011FED796500168501",
    "group_adapters": "PW1EC0021FED796500168502",
    "ref_plugin": "PW1EC0111FED796500168511",
    "ref_support": "PW1EC0121FED796500168512",
    "ref_vc": "PW1EC0131FED796500168513",
    "ref_autofill": "PW1EC0141FED796500168514",
    "ref_adapter": "PW1EC0151FED796500168515",
    "build_plugin": "PW1EC0211FED796500168521",
    "build_support": "PW1EC0221FED796500168522",
    "build_vc": "PW1EC0231FED796500168523",
    "build_autofill": "PW1EC0241FED796500168524",
    "build_adapter": "PW1EC0251FED796500168525",
}

def insert_after(marker: str, block: str) -> None:
    global content
    if marker not in content:
        raise SystemExit(f"marker not found in pbxproj: {marker}")
    content = content.replace(marker, marker + block, 1)

insert_after(
    "/* End PBXBuildFile section */",
    f"""
\t\t{IDS['build_plugin']} /* PortalWorkspacePlugin.swift in Sources */ = {{isa = PBXBuildFile; fileRef = {IDS['ref_plugin']} /* PortalWorkspacePlugin.swift */; }};
\t\t{IDS['build_support']} /* PortalWorkspaceSupport.swift in Sources */ = {{isa = PBXBuildFile; fileRef = {IDS['ref_support']} /* PortalWorkspaceSupport.swift */; }};
\t\t{IDS['build_vc']} /* PortalWorkspaceViewController.swift in Sources */ = {{isa = PBXBuildFile; fileRef = {IDS['ref_vc']} /* PortalWorkspaceViewController.swift */; }};
\t\t{IDS['build_autofill']} /* autofill.js in Resources */ = {{isa = PBXBuildFile; fileRef = {IDS['ref_autofill']} /* autofill.js */; }};
\t\t{IDS['build_adapter']} /* edistrict_income_certificate_v1.json in Resources */ = {{isa = PBXBuildFile; fileRef = {IDS['ref_adapter']} /* edistrict_income_certificate_v1.json */; }};
""",
)

insert_after(
    "/* End PBXFileReference section */",
    f"""
\t\t{IDS['ref_plugin']} /* PortalWorkspacePlugin.swift */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PortalWorkspacePlugin.swift; sourceTree = "<group>"; }};
\t\t{IDS['ref_support']} /* PortalWorkspaceSupport.swift */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PortalWorkspaceSupport.swift; sourceTree = "<group>"; }};
\t\t{IDS['ref_vc']} /* PortalWorkspaceViewController.swift */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PortalWorkspaceViewController.swift; sourceTree = "<group>"; }};
\t\t{IDS['ref_autofill']} /* autofill.js */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.javascript; path = autofill.js; sourceTree = "<group>"; }};
\t\t{IDS['ref_adapter']} /* edistrict_income_certificate_v1.json */ = {{isa = PBXFileReference; lastKnownFileType = text.json; path = edistrict_income_certificate_v1.json; sourceTree = "<group>"; }};
""",
)

insert_after(
    "/* End PBXGroup section */",
    f"""
\t\t{IDS['group_pw']} /* PortalWorkspace */ = {{
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\t{IDS['ref_plugin']} /* PortalWorkspacePlugin.swift */,
\t\t\t\t{IDS['ref_support']} /* PortalWorkspaceSupport.swift */,
\t\t\t\t{IDS['ref_vc']} /* PortalWorkspaceViewController.swift */,
\t\t\t\t{IDS['ref_autofill']} /* autofill.js */,
\t\t\t\t{IDS['group_adapters']} /* adapters */,
\t\t\t);
\t\t\tpath = PortalWorkspace;
\t\t\tsourceTree = "<group>";
\t\t}};
\t\t{IDS['group_adapters']} /* adapters */ = {{
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\t{IDS['ref_adapter']} /* edistrict_income_certificate_v1.json */,
\t\t\t);
\t\t\tpath = adapters;
\t\t\tsourceTree = "<group>";
\t\t}};
""",
)

insert_after(
    "\t\t\t50B271D01FEDC1A000F3C39B /* public */,\n",
    f"\t\t\t\t{IDS['group_pw']} /* PortalWorkspace */,\n",
)

insert_after(
    "\t\t\t504EC3081FED79650016851F /* AppDelegate.swift in Sources */,\n",
    f"""\t\t\t{IDS['build_plugin']} /* PortalWorkspacePlugin.swift in Sources */,
\t\t\t{IDS['build_support']} /* PortalWorkspaceSupport.swift in Sources */,
\t\t\t{IDS['build_vc']} /* PortalWorkspaceViewController.swift in Sources */,
""",
)

insert_after(
    "\t\t\t2FAD9763203C412B000D30F8 /* config.xml in Resources */,\n",
    f"""\t\t\t{IDS['build_autofill']} /* autofill.js in Resources */,
\t\t\t{IDS['build_adapter']} /* edistrict_income_certificate_v1.json in Resources */,
""",
)

with open(pbx, "w") as f:
    f.write(content)
print("Patched Xcode project with Portal Workspace sources and resources.")
PY

# cap sync only scans node_modules plugins — register our in-app plugin manually.
python3 - "$CAP_JSON" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path) as f:
    data = json.load(f)

classes = data.setdefault("packageClassList", [])
if "PortalWorkspacePlugin" not in classes:
    classes.append("PortalWorkspacePlugin")
    with open(path, "w") as f:
        json.dump(data, f, indent="\t")
        f.write("\n")
    print("Registered PortalWorkspacePlugin in capacitor.config.json packageClassList.")
else:
    print("PortalWorkspacePlugin already in packageClassList.")
PY

echo "Portal Workspace plugin installed into app/ios."