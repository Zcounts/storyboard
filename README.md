# ShotScribe — Film Storyboard & Shotlist Desktop App

## Full Project Specification

Build a Windows 11 desktop application (using Electron + React) for creating professional film storyboards and shotlists. The app has two primary views — a **Storyboard tab** for visual, card-based shot planning, and a **Shotlist tab** for a traditional AD-style tabular breakdown — both operating on the same shared project data in real time.

---

## Shared Data Model

Every shot in the project is a single shared object used by both tabs. The core fields (used by both views) are:

- Shot ID (e.g. 1A, 1B, 1C — auto-generated sequentially per scene)
- Camera name and color indicator
- Focal length
- SIZE, TYPE, MOVE, EQUIP (specs)
- Notes/description
- Storyboard image (stored as base64)

The following AD-specific fields exist on every shot object but are only surfaced in the Shotlist tab:

- I/E (Interior or Exterior)
- D/N (Day or Night)
- Subject
- Angle
- Coverage
- Script Time
- Setup Time
- Predicted # of Takes
- Shoot Time
- Take # (circle best)
- X (checked-off / completed flag)

All data is stored in a single Zustand store. Both tabs read from and write to this store live — any change in one tab is immediately reflected in the other.

---

## Storyboard Tab

### Layout & Document Structure

The document is a paginated, print-ready storyboard. Each page has:

A page header spanning the full width with three sections:
- Left: Scene label (e.g., "SCENE 1 | CLUB | INT") in large bold text
- Center: A *NOTE and *SHOOT ORDER freetext block for director/AD notes
- Right: Camera designation badge (e.g., "Camera 1 = fx30") + "SHOTLIST" title in large bold

A 4-column grid of shot cards below the header, with as many rows as needed. Cards flow left-to-right, top-to-bottom. A page number centered at the bottom of each page.

### Shot Card Structure

Each shot card contains exactly these elements, stacked vertically:

**Card Header Row** (single line, above the image):
- A small colored square indicator (user can pick color: green, cyan, yellow, red, etc. — used to group/camera-code shots)
- Shot ID + Camera name (e.g., "1A - Camera 1")
- Focal length (e.g., "85mm") right-aligned

**Image Area:**
- A fixed-aspect-ratio (16:9) image placeholder
- Clicking it opens a file picker to upload a local image (JPG, PNG, WEBP)
- Uploaded image fills the area with object-fit: cover
- The image area has a colored border matching the indicator color
- If no image uploaded, show a neutral gray placeholder with a "+" icon

**Specs Table:**
- A 4-column table with bold headers: SIZE | TYPE | MOVE | EQUIP
- One editable row below headers
- SIZE examples: WIDE SHOT, MEDIUM, CLOSE UP, OTS
- TYPE examples: EYE LVL, SHOULDER LVL, CROWD LVL
- MOVE examples: STATIC, PUSH, STATIC or PUSH
- EQUIP examples: STICKS, GIMBAL, STICKS or GIMBAL
- Each cell is a dropdown OR free-text input (user preference toggle in settings)

**Notes/Description Area:**
- Freetext block below the table
- Supports labeled prefixes that render in bold: ACTION:, BGD:, EST:, SHOOT ORDER:
- Multi-line, auto-expanding

### Shot Card Interactions

- **Add Shot:** Button to add a new shot card (appends to end of grid, also appears in Shotlist tab instantly)
- **Delete Shot:** X button on hover in card corner (removes from both tabs)
- **Reorder Shots:** Drag and drop to reorder cards; shot IDs auto-update sequentially in both tabs
- **Duplicate Shot:** Right-click context menu option
- **Card Color:** Color picker on the indicator square to assign camera/group color

### Storyboard Export

- **Export to PDF:** Renders the storyboard to a paginated PDF matching the on-screen card layout exactly, using Puppeteer. Print-ready at A4 or Letter size, landscape.
- **Export to PNG:** Export each storyboard page as a high-res PNG.
- The PDF/PNG export button is context-aware — when the Storyboard tab is active, it exports the storyboard layout.

---

## Shotlist Tab

### Layout & Document Structure

The Shotlist tab displays all shots from all scenes as a dense, scrollable table. Shots are grouped by scene, with a bold scene header row between each group. The scene header shows the scene name, location, and INT/EXT on the left, and a total estimated minutes summary on the right (summed from Script Time values in that scene).

### Columns

The default column set, in order, is:

| Column | Description |
|---|---|
| X | Checkbox to mark a shot as done/crossed off |
| SHOT # | Auto-generated shot ID (e.g. 1A, 1B) — shared with storyboard |
| I/E | Interior or Exterior |
| D/N | Day or Night |
| SUBJECT | Who or what the shot is on |
| ANGLE | Camera angle description |
| LENS | Focal length — shared with storyboard |
| EQUIPMENT | e.g. STICKS, GIMBAL — shared with storyboard |
| MOVEMENT | e.g. STATIC, PUSH — shared with storyboard |
| COVERAGE | e.g. WIDE SHOT, OTS — shared with storyboard |
| NOTES | Freetext notes — shared with storyboard |
| SCRIPT TIME | Estimated screen time of the shot (minutes) |
| SETUP TIME | Estimated crew setup time (minutes) |
| PREDIC # OF TAKES | Anticipated number of takes |
| SHOOT TIME | Total estimated shoot time (auto or manual) |
| TAKE # | Circle-best take number, filled on set |

All cells are directly inline-editable. Clicking a cell activates it for text input or shows a dropdown where appropriate.

### Column Configurability

A "Configure Columns" button opens a panel where the user can toggle individual columns on/off and reorder them via drag and drop. Column configuration is saved as part of the project file and persists across sessions.

### Shot Actions in Shotlist Tab

- **Add Shot:** An "+ Add Shot" row at the bottom of each scene group inserts a new shot into that scene (also appears on the Storyboard instantly)
- **Delete Shot:** A delete control on each row (also removes the card from the Storyboard)
- **Reorder Shots:** Drag and drop rows to reorder; shot IDs update sequentially in both tabs

### Shotlist Export

- **Export to PDF:** Renders the shotlist table to a paginated, print-ready PDF in landscape orientation (A4 or Letter, matching the global export size setting), using Puppeteer.
  - Document header on each page shows the project/film name and export date
  - Scene group headers repeat at the top of a new page if a scene spans multiple pages (no orphaned headers)
  - Only currently visible columns (per the user's column config) are included
  - Visual style is clean and dense, similar to a professional production spreadsheet
- The PDF export button is context-aware — when the Shotlist tab is active, it exports the shotlist layout.

---

## Project Management

- **New Project:** Creates a blank project, prompts for scene name and camera setup
- **Save Project:** Saves to a `.shotlist` JSON file — includes all shot data, AD fields, column config, and embedded storyboard images as base64
- **Load Project:** Opens a `.shotlist` file and fully restores both tabs
- **Auto-save:** Optional auto-save every 60 seconds to a temp file
- **Recent Projects:** List of recently opened files on the home screen
- **File size warning:** Displayed if total project file exceeds 50MB (due to embedded images)

---

## Global Document Settings

- Scene name / location / INT or EXT toggle
- Camera name and body (e.g., "Camera 1 = fx30"), supports multiple cameras
- Default focal length
- Number of storyboard columns (default: 4, allow 2 or 3)
- Export page size (A4 or Letter)
- Font and accent color theme (light/dark background)
- Dropdown vs. free-text input toggle for spec cells

---

## Tech Stack

- Electron + React + TailwindCSS
- Zustand for state management (single shared store for both tabs)
- dnd-kit for drag and drop (storyboard cards and shotlist rows)
- Puppeteer (bundled with Electron) for PDF export
- Images stored as base64 strings inside the JSON project file

---

## Visual Style

Dark chrome toolbar with light document canvas. Clean sans-serif font throughout. Storyboard tab uses a cream/off-white page background with colored card border accents matching each shot's indicator color. Shotlist tab uses a dense table layout with subtle alternating row shading, bold scene header rows, and a professional production-document aesthetic.

---

## Build Sessions

- Session 1: Scaffold ✅
- Session 2: ShotCard component ✅
- Session 3: Page layout and grid ✅
- Session 4: State and interactions ✅
- Session 5: Save/load and settings ✅
- Session 6: Export and final polish ✅
- Session 7: Data model extension + tab infrastructure (Shotlist)
- Session 8: Shotlist table UI
- Session 9: Two-way sync, shot actions, and column config
- Session 10: Shotlist PDF export
