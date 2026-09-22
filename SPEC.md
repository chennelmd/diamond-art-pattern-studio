# Diamond Art Pattern Studio Specification

## Professional Print Size and Exact Grid Scaling

### Purpose

The application must preserve the exact physical size of the diamond-painting drill grid when preparing files for professional printing.

Professional printers may require finished print dimensions to be entered as whole numbers in inches, while diamond-painting patterns are typically defined in centimeters. The application must account for this difference without stretching or scaling the drill grid.

### Core Rule

The **diamond drill grid is the authoritative measurement**.

The application must never stretch, shrink, or proportionally scale the drill grid simply to make it fill the selected professional print size.

The professional print area and the diamond-painting drill area must be treated as two separate dimensions.

### Diamond Area Size

The user will continue to select the desired finished diamond-painting area in centimeters.

Example:

- Diamond area: 30 × 40 cm
- Drill pitch: 2.5 mm
- Grid size: 120 × 160 drills

The application must calculate the drill count from the physical dimensions and selected drill pitch.

Formula:

**Drill Count = Physical Size in mm ÷ Drill Pitch in mm**

For a 2.5 mm drill pitch:

- 30 cm = 300 mm ÷ 2.5 = 120 drills
- 40 cm = 400 mm ÷ 2.5 = 160 drills

The resulting drill count must always be a whole number.

If a requested physical dimension does not produce a whole-number drill count, the application should notify the user and recommend the nearest compatible size.

### Inch Conversion

After determining the exact diamond area, the application must convert the dimensions to inches for professional printing.

Formula:

**Inches = Centimeters ÷ 2.54**

Example:

30 × 40 cm converts to approximately:

- Width: 11.811 inches
- Height: 15.748 inches

These dimensions represent the exact physical size of the diamond drill area and must not be rounded for scaling purposes.

### Professional Print Size

The application must provide a separate **Professional Print Size** setting.

If the printer requires whole-inch dimensions, the application should select or recommend a whole-inch print size large enough to contain the exact diamond area.

Example:

Diamond area:

- 30 × 40 cm
- 11.811 × 15.748 inches

Recommended whole-inch print size:

- 12 × 16 inches

The diamond grid remains exactly 11.811 × 15.748 inches inside the 12 × 16-inch print file.

The remaining area becomes margin or border space.

### Automatic Margins

When the professional print size is larger than the diamond area, the application should center the diamond area by default.

For a 30 × 40 cm pattern inside a 12 × 16-inch print:

Horizontal extra space:

12 − 11.811 = 0.189 inches

Centered margin:

0.189 ÷ 2 = approximately 0.0945 inches per side

Vertical extra space:

16 − 15.748 = 0.252 inches

Centered margin:

0.252 ÷ 2 = approximately 0.126 inches at the top and bottom

Margins must not affect the drill grid dimensions.

### Professional Print Layout

Add a **Professional Print Layout** option to the export workflow.

The application should automatically display:

- Requested diamond size in centimeters
- Exact diamond area in millimeters
- Exact diamond area in inches
- Drill count across and down
- Drill pitch
- Recommended whole-inch print dimensions
- Margin size on each side
- Export resolution
- DPI
- Scaling status

Example:

- **Diamond Area:** 30 × 40 cm
- **Drill Grid:** 120 × 160 drills
- **Drill Pitch:** 2.5 mm
- **Exact Print Area:** 11.811 × 15.748 in
- **Professional Print File:** 12 × 16 in
- **Horizontal Margin:** 0.0945 in per side
- **Vertical Margin:** 0.126 in per side
- **Scaling:** 100%
- **Grid Scaling:** Locked

### Scaling Protection

The application must prevent accidental scaling of the diamond grid.

The following rules apply:

- The drill grid must always print at its calculated physical size.
- The grid must not be stretched to fill the professional print dimensions.
- The grid must not use “Fit to Page.”
- The grid must not be resized based on the printer's page size.
- Increasing the canvas or print size should add border space only.
- Decreasing the print size below the required diamond area should generate a warning and prevent export unless the diamond size itself is intentionally changed.

### Print Instructions

Professional-print exports should include or display the instruction:

**Print at 100% / Actual Size. Do Not Scale, Resize, Fit to Page, or Stretch Artwork.**

Where possible, the exported file should contain metadata or dimensions that preserve the intended physical size.

### Export Resolution

The application must calculate raster export dimensions based on the selected DPI while preserving the exact physical drill area.

Formula:

**Pixel Dimension = Physical Size in Inches × DPI**

Pixel dimensions must ultimately be whole numbers.

Any pixel rounding must occur at the raster-export level and must not alter the drill count or intended physical dimensions.

When possible, vector-based grid elements should be used for print output to minimize raster rounding issues.

### Recommended Workflow

The application's size-processing order should be:

**Requested cm size → Exact drill count → Exact mm dimensions → Exact inch dimensions → Whole-inch professional print size → Margins → DPI/pixel export**

The application must not use the printer's whole-inch dimensions as the basis for calculating drill size.

### Future Print Presets

The application should support configurable professional-printer presets.

A printer preset may include:

- Printer/company name
- Available whole-inch print sizes
- Maximum print dimensions
- Minimum print dimensions
- Required DPI
- Accepted file formats
- Bleed requirements
- Safe-area requirements
- Color profile
- Maximum file size

The application can then automatically select the smallest compatible professional print size that safely contains the requested diamond area.

### Acceptance Criteria

The feature is considered complete when:

1. A user can enter a diamond-painting size in centimeters.
2. The application calculates a whole-number drill grid.
3. The application converts the exact active area to inches.
4. The application recommends a compatible whole-inch professional print size.
5. The diamond grid remains at its exact intended physical dimensions.
6. Additional print area becomes margin rather than enlarging the pattern.
7. The export screen clearly displays both the diamond area and professional print size.
8. The application warns when a selected print size is too small.
9. The exported pattern can be printed at 100% / Actual Size without changing drill spacing.
10. No conversion between centimeters, inches, DPI, or pixels causes the drill grid to be unintentionally resized.
