"""
Google Flow selector map.
Google's UI changes often. When automation breaks:
1. Open http://<vps>:6080 (noVNC)
2. Open Chrome inside, go to https://labs.google/fx/tools/flow
3. Right-click → Inspect the failing element
4. Update the selector below and restart the worker: `docker compose restart worker`
"""

FLOW_URL = "https://labs.google/fx/tools/flow"

# --- Project / dashboard page (labs.google/fx/tools/flow) ---
NEW_PROJECT_BUTTON = 'button:has-text("New project"), button:has-text("Create")'
PROJECT_TILE_BY_NAME = 'div[role="button"]:has-text("{name}"), a:has-text("{name}")'
PROJECT_NAME_INPUT = 'input[placeholder*="name" i], input[type="text"]'
CREATE_CONFIRM_BUTTON = 'button:has-text("Create"), button:has-text("Continue")'

# --- Inside a project — prompt page ---
# Google Flow uses a large textarea or contenteditable div for the prompt
PROMPT_INPUT = 'textarea, div[contenteditable="true"][role="textbox"]'
GENERATE_BUTTON = 'button:has-text("Generate"), button[aria-label*="Generate" i], button:has-text("Run")'

# --- Settings gear (top-right) that opens Agent Settings ---
SETTINGS_GEAR = 'button[aria-label*="Settings" i], button:has(svg[data-icon*="settings" i])'
SETTINGS_SAVE = 'button:has-text("Save")'

# Aspect ratio buttons inside settings modal
ASPECT_16_9 = 'button:has-text("16:9")'
ASPECT_4_3 = 'button:has-text("4:3")'
ASPECT_1_1 = 'button:has-text("1:1")'
ASPECT_3_4 = 'button:has-text("3:4")'
ASPECT_9_16 = 'button:has-text("9:16")'
COUNT_1X = 'button:has-text("1x")'
COUNT_X2 = 'button:has-text("x2")'
COUNT_X3 = 'button:has-text("x3")'
COUNT_X4 = 'button:has-text("x4")'

# --- Generated image ---
# Images typically appear as <img> inside a grid or gallery region
GENERATED_IMAGE = 'img[src*="storage.googleapis.com"], img[src*="labs.google"], img[alt*="generated" i]'
# Download button (may be right-click, or a hover button)
DOWNLOAD_BUTTON = 'button[aria-label*="Download" i], a[download]'
