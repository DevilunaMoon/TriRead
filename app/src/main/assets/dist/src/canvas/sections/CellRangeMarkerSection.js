// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
class CellRangeMarkerSection extends CanvasSectionObject {
    constructor() {
        super(app.CSections.CellRangeMarker.name);
        this.processingOrder = app.CSections.CellRangeMarker.processingOrder;
        this.drawingOrder = app.CSections.CellRangeMarker.drawingOrder;
        this.zIndex = app.CSections.CellRangeMarker.zIndex;
        this.documentObject = true;
        this.interactable = false;
        this.position = [0, 0];
        this.sectionProperties.markers = new Map();
        this.sectionProperties.handleCounts = new Map();
        this.isAlwaysVisible = true;
    }
    // Replace the ranges drawn under name.
    setMarkers(name, cellRanges, part, style) {
        this.sectionProperties.markers.set(name, { cellRanges, part, style });
        this.syncHandles(name);
        this.containerObject?.requestReDraw();
    }
    clearMarkers(name) {
        if (!this.sectionProperties.markers.delete(name))
            return;
        this.syncHandles(name);
        this.containerObject?.requestReDraw();
    }
    handleName(name, index) {
        return name + ' handle ' + index;
    }
    // One handle section per range, and none for a marker without a handle, on another sheet,
    // or in a document that cannot be edited. Adding and removing sections lays the container
    // out again, so a marker change is what calls this.
    syncHandles(name) {
        const markers = this.sectionProperties.markers.get(name);
        const sheetGeometry = app.map._docLayer.sheetGeometry;
        const wanted = markers &&
            markers.style.handleCommand &&
            markers.part === app.map._docLayer._selectedPart &&
            app.map.isEditMode()
            ? markers.cellRanges.length
            : 0;
        const current = this.sectionProperties.handleCounts.get(name) ?? 0;
        for (let i = current; i < wanted; i++)
            app.sectionContainer.addSection(new app.definitions.CellRangeHandleSection(this.handleName(name, i), this));
        for (let i = wanted; i < current; i++)
            app.sectionContainer.removeSection(this.handleName(name, i));
        this.sectionProperties.handleCounts.set(name, wanted);
        if (wanted && sheetGeometry)
            this.positionHandles(name, markers, sheetGeometry);
    }
    // A handle sits with its bottom-right corner on the corner of the range's last cell.
    positionHandles(name, markers, sheetGeometry) {
        const count = this.sectionProperties.handleCounts.get(name) ?? 0;
        for (let i = 0; i < count; i++) {
            const handle = app.sectionContainer.getSectionWithName(this.handleName(name, i));
            if (!handle)
                continue;
            const endCell = sheetGeometry.getCellSimpleRectangle(markers.cellRanges[i].max.x, markers.cellRanges[i].max.y);
            handle.calculatePositionViaCellCursor([endCell.pX2, endCell.pY2]);
            handle.setCellRange(markers.cellRanges[i], markers.part, markers.style.handleCommand);
        }
    }
    // The range a handle drag is heading for, drawn by the client alone while the drag lasts.
    showDragRange(cellRange, part, color) {
        this.setMarkers('HandleDrag', [cellRange], part, { color, dashed: true });
    }
    hideDragRange() {
        this.clearMarkers('HandleDrag');
    }
    drawMarkers(markers, sheetGeometry) {
        if (!markers.style.color)
            return;
        this.context.strokeStyle = markers.style.color;
        this.context.fillStyle = markers.style.color;
        const dashLength = 4 * app.roundedDpiScale;
        this.context.setLineDash(markers.style.dashed ? [dashLength, dashLength] : []);
        for (const cellRange of markers.cellRanges) {
            const startCell = sheetGeometry.getCellSimpleRectangle(cellRange.min.x, cellRange.min.y);
            const endCell = sheetGeometry.getCellSimpleRectangle(cellRange.max.x, cellRange.max.y);
            const rectangle = new cool.SimpleRectangle(startCell.x1, startCell.y1, endCell.x2 - startCell.x1, endCell.y2 - startCell.y1);
            if (markers.style.fillOpacity) {
                this.context.globalAlpha = markers.style.fillOpacity;
                this.drawViewRectangle(rectangle, true);
                this.context.globalAlpha = 1;
            }
            else
                this.drawViewRectangle(rectangle);
        }
    }
    onDraw() {
        const docLayer = app.map._docLayer;
        if (!docLayer.sheetGeometry)
            return;
        this.context.save();
        this.context.setTransform(1, 0, 0, 1, 0, 0);
        this.context.lineJoin = 'miter';
        this.context.lineCap = 'butt';
        this.context.lineWidth = app.roundedDpiScale;
        this.sectionProperties.markers.forEach((markers, name) => {
            if (markers.part !== docLayer._selectedPart)
                return;
            this.drawMarkers(markers, docLayer.sheetGeometry);
            this.positionHandles(name, markers, docLayer.sheetGeometry);
        });
        this.context.restore();
    }
}
