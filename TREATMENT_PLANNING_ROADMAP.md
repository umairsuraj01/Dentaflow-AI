# DentaFlow AI — Treatment Planning Roadmap

## How Professional Dental Treatment Planning Actually Works

Based on research from 3Shape Ortho System, OnyxCeph, ArchForm, SoftSmile, and Deltaface — here is the **real clinical workflow** that professional clear aligner software follows, from scan to manufacturing:

---

## The Complete Professional Workflow (10 Steps)

### Step 1: Digital Scan Import
- Import intraoral STL scan (upper jaw, lower jaw, bite registration)
- Support for both single-arch and dual-arch scans
- Quality check: detect holes, noise, scan artifacts
- **We have:** File upload + STL loading. **Missing:** Bite registration, dual-arch support, scan quality check.

### Step 2: Model Preparation (Auto Base)
- Create a "horseshoe base" — a flat platform under the teeth for 3D printing
- Trim excess gum tissue from scan edges
- Orient the model consistently (occlusal plane alignment)
- **We have:** Nothing. **Missing:** Auto-base generation, model trimming, occlusal plane detection.

### Step 3: AI Tooth Segmentation
- Automatically identify and separate each tooth from the gum
- Label each tooth with correct FDI number (11-48)
- Clearly separate: **gum tissue** vs **individual tooth crowns**
- Allow manual correction if AI misclassifies
- **We have:** MeshSegNet architecture but NO trained weights (running mock mode). **Missing:** Real trained model, manual correction UI.

### Step 4: Crown Completion & Root Estimation
- Each segmented tooth crown is "completed" — the interproximal contact areas and lingual surfaces not captured by the scanner are filled in
- Virtual roots are estimated (from average tooth morphology or CBCT data)
- This creates a complete 3D tooth object that can be moved independently
- **We have:** Nothing. **Missing:** Crown completion, root estimation.

### Step 5: Dental Analysis & Diagnostics
Before any movement, the software analyzes the current state:
- **Bolton Analysis** — Measures tooth-size discrepancy between upper and lower arches
- **Space Analysis** — Calculates crowding/spacing per arch segment
- **Arch Form Analysis** — Compares current arch to ideal arch forms (Brader, Catenary, etc.)
- **Overjet/Overbite** — Measures horizontal and vertical overlap of front teeth
- **Midline Assessment** — Checks if upper/lower midlines align
- **PAR Score** — Peer Assessment Rating for treatment need severity
- **We have:** Nothing. **Missing:** All diagnostic analysis.

### Step 6: Virtual Setup (Target Outcome)
The doctor defines the desired final tooth positions:
- Move teeth individually with 6 DOF (translation XYZ + rotation XYZ)
- **Arch form overlay** — Fit teeth to an ideal arch curve
- **IPR simulation** — Simulate interproximal reduction (shaving 0.1-0.5mm between teeth to create space)
- **Extraction simulation** — Remove teeth if needed
- **Occlusal contacts** — Ensure proper bite in final position
- **Collision detection** — Prevent teeth from overlapping
- **We have:** Basic per-tooth transform sliders. **Missing:** Arch form, IPR, extraction sim, occlusion, collision detection.

### Step 7: Auto-Staging (Movement Subdivision)
The total movement is divided into incremental stages:
- **Clinical limits per stage:** 0.25mm translation, 2° rotation (per aligner tray, ~2 weeks)
- **Movement sequencing** — Not all teeth move simultaneously; posterior teeth may anchor while anteriors align first
- **Collision avoidance** — Each intermediate stage must be collision-free
- **Overcorrection** — Final stages may overcorrect by 10-20% to account for relapse
- **We have:** Basic linear interpolation auto-staging. **Missing:** Sequencing, collision avoidance per stage, overcorrection.

### Step 8: Attachment Planning
- Place virtual attachments (small bumps bonded to teeth) to improve aligner grip
- Different attachment types: rectangular, ellipsoid, beveled for different movement types
- Auto-suggest attachments based on planned movements
- **We have:** Nothing. **Missing:** Entire attachment system.

### Step 9: Doctor Review & Approval
- Animated 3D playback of full treatment (what we're trying to build)
- Side-by-side comparison: initial vs final
- Treatment report: movement table per tooth, IPR schedule, attachment list
- Doctor can request modifications → loop back to Step 6
- **We have:** Basic animation playback. **Missing:** Comparison view, treatment report, modification loop.

### Step 10: Manufacturing Output
- Export STL models for each stage (for 3D printing or thermoforming)
- Generate cut lines for aligner trimming
- ID tagging (stage number printed on each aligner)
- Hollowing for 3D print optimization
- **We have:** Nothing. **Missing:** STL export per stage, manufacturing prep.

---

## What We Currently Have vs What's Needed

| Feature | Status | Priority |
|---------|--------|----------|
| File upload & STL import | DONE | — |
| Auth, cases, patients | DONE | — |
| Tooth instructions | DONE | — |
| MeshSegNet model architecture | DONE (no weights) | Critical |
| **Real trained segmentation model** | MISSING | P0 |
| **Gum vs tooth separation** | MISSING (mock) | P0 |
| **Individual tooth identification** | MISSING (mock) | P0 |
| Model preparation (auto-base) | MISSING | P1 |
| Crown completion | MISSING | P2 |
| Bolton/space/arch analysis | MISSING | P1 |
| Virtual setup (target positions) | PARTIAL (sliders) | P0 |
| Arch form overlay | MISSING | P1 |
| IPR simulation | MISSING | P1 |
| Collision detection | MISSING | P1 |
| Auto-staging | PARTIAL (basic linear) | P0 |
| Movement sequencing | MISSING | P2 |
| Attachment planning | MISSING | P2 |
| Treatment review animation | PARTIAL (basic) | P0 |
| Doctor approval workflow | MISSING | P1 |
| Manufacturing STL export | MISSING | P3 |

---

## Implementation Phases

### PHASE A: Real Tooth Segmentation (CRITICAL — Everything depends on this)
**Goal:** Replace mock with real AI segmentation that properly separates gum and teeth.

**Option 1: Use Pre-trained Open Source Model (Fastest)**
- Use [DilatedToothSegNet](https://github.com/LucasKre/dilated_tooth_seg_net) — published 2024, open source with pretrained weights
- OR use original [MeshSegNet](https://github.com/Tai-Hsien/MeshSegNet) with their shared weights
- Adapt our pipeline to use their inference format
- Estimated effort: 2-3 days

**Option 2: Train Our Own MeshSegNet**
- Need labeled training data (minimum 50-100 segmented scans)
- Use [Teeth3DS+ dataset](https://crns-smartvision.github.io/teeth3ds/) — 1,800 labeled 3D intraoral scans
- Train our existing MeshSegNet architecture on this data
- Estimated effort: 1-2 weeks (data download + training + validation)

**Option 3: Use Cloud API**
- Use a dental AI API service (e.g., Overjet, Pearl, or similar)
- Pros: Production quality immediately
- Cons: Cost per scan, dependency on external service

**Deliverables:**
- [ ] Clean gum/tooth separation
- [ ] Correct FDI labeling for each tooth
- [ ] Individual tooth meshes with no overlap
- [ ] Manual correction UI for misclassified teeth

---

### PHASE B: Model Preparation & Analysis
**Goal:** Proper 3D model setup and clinical diagnostics.

**B1: Occlusal Plane Detection & Model Orientation**
- Detect the occlusal plane (biting surface) automatically
- Orient model consistently for all cases
- Backend: numpy/scipy plane fitting on tooth centroids

**B2: Auto-Base Generation**
- Create horseshoe-shaped base under the dental arch
- Trim excess gum tissue at scan edges
- Backend: trimesh convex hull + offset

**B3: Dental Analysis**
- Space analysis: sum of tooth widths vs available arch length
- Bolton analysis: upper vs lower tooth size ratio
- Arch form: fit current teeth to ideal arch curve
- Measure overjet, overbite, midline deviation
- Backend: pure geometry calculations from tooth centroids + widths

**Deliverables:**
- [ ] Auto-oriented model with base
- [ ] Space analysis (crowding/spacing mm)
- [ ] Bolton ratio (anterior + overall)
- [ ] Arch form comparison overlay in 3D viewer

---

### PHASE C: Virtual Setup (Target Design)
**Goal:** Professional tools for the doctor to define the treatment outcome.

**C1: Arch Form Tool**
- Display ideal arch form overlay (Brader, Catenary, custom)
- Allow doctor to snap teeth to the arch curve
- Auto-calculate space needed for alignment

**C2: IPR Simulation**
- Detect interproximal contacts (collision detection between adjacent teeth)
- Allow doctor to specify reduction amount per contact (0.1-0.5mm)
- Visually show teeth moving together after IPR

**C3: Collision Detection**
- Real-time mesh-mesh intersection testing between adjacent teeth
- Highlight collisions in red in the 3D viewer
- Prevent invalid setups

**C4: Improved Transform Controls**
- 3D gizmo handles (drag arrows/rings) instead of sliders
- Constraint modes: move along arch, rotate around tooth axis
- Undo/redo stack

**Deliverables:**
- [ ] Arch form overlay + snap-to-arch
- [ ] IPR tool with per-contact amounts
- [ ] Real-time collision highlighting
- [ ] 3D drag handles for tooth movement

---

### PHASE D: Smart Staging & Attachments
**Goal:** Clinically correct intermediate stages.

**D1: Improved Auto-Staging**
- Movement sequencing (not all teeth at once)
- Posterior anchorage support
- Per-stage collision checking
- Overcorrection on final stages

**D2: Attachment Auto-Placement**
- Suggest attachments based on planned movements
- Attachment types: rectangular, ellipsoid, beveled, optimized
- Auto-place based on movement direction and force requirements

**D3: Movement Validation**
- Validate each stage against clinical limits
- Flag dangerous movements (excessive intrusion, root torque)
- Suggest alternatives

**Deliverables:**
- [ ] Smart sequenced staging
- [ ] Attachment suggestions with 3D visualization
- [ ] Per-stage validation report

---

### PHASE E: Doctor Review & Output
**Goal:** Professional review experience and manufacturing output.

**E1: Treatment Review UI**
- Side-by-side: initial vs final outcome
- Animated playback (what we partially have)
- Superimposition overlay view
- Treatment summary report (PDF export)

**E2: Doctor Approval Workflow**
- Doctor reviews → approves or requests changes
- Comment system per stage
- Version history of treatment plans

**E3: Manufacturing Export**
- Export per-stage STL models (for 3D printing)
- Aligner cut-line generation
- Stage numbering/ID tags
- Hollowing optimization for printing

**Deliverables:**
- [ ] Professional review UI with comparisons
- [ ] Approval workflow with comments
- [ ] STL export per stage for production

---

## Recommended Order of Implementation

```
PHASE A: Real Segmentation ← START HERE (2-5 days)
   ↓
PHASE B: Model Prep & Analysis (1 week)
   ↓
PHASE C: Virtual Setup Tools (1-2 weeks)
   ↓
PHASE D: Staging & Attachments (1-2 weeks)
   ↓
PHASE E: Review & Output (1 week)
```

**Total estimated time: 5-8 weeks for a functional MVP**

The absolute first priority is **Phase A** — without real tooth segmentation, everything else is built on sand. The mock data we've been using will never produce usable results.

---

## Key Technical Decisions Needed

1. **Segmentation model:** Use pretrained open-source (fast) vs train our own (better long-term)?
2. **Collision detection:** Simple bounding-box (fast, approximate) vs mesh-mesh intersection (accurate, expensive)?
3. **Arch form:** Use standard templates (Brader/Catenary) vs custom AI-predicted arch?
4. **Deployment:** Local GPU inference vs cloud GPU endpoint?

---

## References

- [3Shape Clear Aligner Studio](https://www.3shape.com/en/software/clear-aligner-studio)
- [OnyxCeph Segmentation Wiki](https://www.onyxwiki.net/doku.php?id=en:segmentation)
- [ArchForm Software](https://www.archform.com/software)
- [SoftSmile](https://softsmile.com/)
- [MeshSegNet (GitHub)](https://github.com/Tai-Hsien/MeshSegNet)
- [DilatedToothSegNet (GitHub)](https://github.com/LucasKre/dilated_tooth_seg_net)
- [Teeth3DS+ Dataset](https://crns-smartvision.github.io/teeth3ds/)
- [Deltaface Aligner Software](https://deltaface.com/aligner-clear-aligner-design-software/)
