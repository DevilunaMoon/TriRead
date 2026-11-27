// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
// OverlayTransform is used by CanvasOverlay to apply transformations
// to points/bounds before drawing is done.
// The reason why we cannot use canvasRenderingContext2D.transform() is it
// does not support coordinate values bigger than 2^24 - 1 and if we use it in this
// regime the renders will be incorrect. At least in Calc it is possible to have pixel
// coordinates greater than this limit at higher zooms near the bottom of the sheet.
class OverlayTransform {
    constructor() {
        this.translationAmount = new cool.Point(0, 0);
        this.scaleAmount = new cool.Point(1, 1);
    }
    translate(x, y) {
        this.translationAmount.x = x;
        this.translationAmount.y = y;
    }
    scale(sx, sy) {
        this.scaleAmount.x = sx;
        this.scaleAmount.y = sy;
    }
    reset() {
        this.translationAmount.x = 0;
        this.translationAmount.y = 0;
        this.scaleAmount.x = 1;
        this.scaleAmount.y = 1;
    }
    applyToPoint(point) {
        // 'scale first then translation' model.
        return new cool.Point(point.x * this.scaleAmount.x - this.translationAmount.x, point.y * this.scaleAmount.y - this.translationAmount.y);
    }
    applyToBounds(bounds) {
        return new cool.Bounds(this.applyToPoint(bounds.min), this.applyToPoint(bounds.max));
    }
}
// This allows the overlay section to use multiple transformations to be applied
// one after the other on a point or bounds.
class TransformationsList {
    constructor() {
        this.list = [];
    }
    add(tx) {
        this.list.push(tx);
    }
    addNew(translate, scale) {
        const tx = new OverlayTransform();
        tx.translate(translate.x, translate.y);
        tx.scale(scale.x, scale.y);
        this.add(tx);
    }
    reset() {
        this.list = [];
    }
    applyToPoint(point) {
        let tPoint = point.clone();
        this.list.forEach((tx) => {
            tPoint = tx.applyToPoint(tPoint);
        });
        return tPoint;
    }
    applyToBounds(bounds) {
        let tBounds = bounds.clone();
        this.list.forEach((tx) => {
            tBounds = tx.applyToBounds(tBounds);
        });
        return tBounds;
    }
}
// CanvasOverlay handles CPath rendering and mouse events handling via overlay-section of the main canvas.
// where overlays like cell-cursors, cell-selections, edit-cursors are instances of CPath or its subclasses.
class CanvasOverlay extends CanvasSectionObject {
    constructor(mapObject, canvasContext) {
        super(app.CSections.Overlays.name);
        this.processingOrder = app.CSections.Overlays.processingOrder;
        this.drawingOrder = app.CSections.Overlays.drawingOrder;
        this.zIndex = app.CSections.Overlays.zIndex;
        this.anchor = ['top', 'left'];
        this.boundToSection = 'tiles';
        this.map = mapObject;
        this.ctx = canvasContext;
        this.tsManager = this.map.getTileSectionMgr();
        this.sectionProperties.docLayer = this.map._docLayer;
        this.sectionProperties.tsManager = this.tsManager;
        this.paths = new Map();
        this.transformList = new TransformationsList();
        this.updateCanvasBounds();
    }
    onResize() {
        this.paths.forEach(function (path) {
            path.onResize();
        });
        // A relayout of the sections runs outside a draw pass, with the pen of the canvas left
        // where the last drawn section put it. The paths are drawn in the next draw pass, where
        // the pen sits at this section and the clip covers the document area only.
        this.containerObject.requestReDraw();
    }
    onDraw() {
        // No need to "erase" previous drawings because tiles are draw first via its onDraw.
        this.draw();
    }
    onMouseMove(position) {
        var mousePos = new cool.Point(position.pX, position.pY);
        var overlaySectionBounds = this.bounds.clone();
        var splitPos = this.tsManager.getSplitPos();
        if (this.isCalcRTL()) {
            // Mirror the mouse position in overlay section coordinates.
            mousePos.x = overlaySectionBounds.max.x - overlaySectionBounds.min.x - mousePos.x;
        }
        // overlay section coordinates -> document coordinates
        if (mousePos.x > splitPos.x)
            mousePos.x += overlaySectionBounds.min.x;
        if (mousePos.y > splitPos.y)
            mousePos.y += overlaySectionBounds.min.y;
        this.paths.forEach(function (path) {
            var pathBounds = path.getBounds();
            if (!pathBounds.isValid())
                return;
            var mouseOverPath = pathBounds.contains(mousePos);
            if (mouseOverPath && !path.isUnderMouse()) {
                path.onMouseEnter(mousePos);
                path.setUnderMouse(true);
            }
            else if (!mouseOverPath && path.isUnderMouse()) {
                path.onMouseLeave(mousePos);
                path.setUnderMouse(false);
            }
        });
    }
    setPenOnOverlay() {
        this.containerObject.setPenPosition(this);
    }
    initPath(path) {
        var pathId = path.getId();
        this.paths.set(pathId, path);
        path.setRenderer(this);
        this.setPenOnOverlay();
        path.updatePathAllPanes();
    }
    initPathGroup(pathGroup) {
        pathGroup.forEach(function (path) {
            this.initPath(path);
        }.bind(this));
    }
    removePath(path) {
        // This does not get called via onDraw, so ask section container to redraw everything.
        path.setDeleted();
        this.paths.delete(path.getId());
        this.containerObject.requestReDraw();
    }
    removePathGroup(pathGroup) {
        pathGroup.forEach(function (path) {
            this.removePath(path);
        }.bind(this));
    }
    updatePath(path, oldBounds) {
        this.redraw(path, oldBounds);
    }
    updateStyle(path, oldBounds) {
        this.redraw(path, oldBounds);
    }
    paintRegion(paintArea) {
        this.draw(paintArea);
    }
    getSplitPanesContext() {
        return this.map.getSplitPanesContext();
    }
    // The panes of the view in document core pixels. The paths hold pixels of the zoom the
    // document was at when they were built, and a zoom animation scales those pixels frame by
    // frame from the zoom start, so during an animation the panes are those of the zoom start.
    getPaneBoundsList() {
        if (this.tsManager._inZoomAnim && this.tsManager._paintContext)
            return this.tsManager._paintContext().paneBoundsList;
        var spc = this.getSplitPanesContext();
        return spc ? spc.getPxBoundList() : [this.getBounds().clone()];
    }
    getFixedBounds() {
        return new cool.Bounds(new cool.Point(0, 0), this.getBounds().getSize());
    }
    onNewDocumentTopLeft() {
        GraphicSelection.refreshDarkOverlay();
    }
    isPathVisible(path) {
        var pathBounds = path.getBounds();
        if (!pathBounds.isValid())
            return false;
        if (path.fixed)
            return pathBounds.intersects(this.getFixedBounds());
        return this.intersectsVisible(pathBounds);
    }
    intersectsVisible(queryBounds) {
        this.updateCanvasBounds();
        return this.getPaneBoundsList().some(function (paneBounds) {
            return queryBounds.intersects(paneBounds);
        });
    }
    static renderOrderComparator(a, b) {
        if (a.viewId === -1 && b.viewId === -1) {
            // Both are 'own' / 'self' paths.
            // Both paths are part of the same group, use their zindex to break the tie.
            if (a.groupType === b.groupType)
                return a.zIndex - b.zIndex;
            return a.groupType - b.groupType;
        }
        else if (a.viewId === -1) {
            // a is an 'own' path and b is not => draw a on top of b.
            return 1;
        }
        else if (b.viewId === -1) {
            // b is an 'own' path and a is not => draw b on top of a.
            return -1;
        }
        // Both a and b belong to other views.
        if (a.viewId === b.viewId) {
            // Both belong to the same view.
            // Both paths are part of the same group, use their zindex to break the tie.
            if (a.groupType === b.groupType)
                return a.zIndex - b.zIndex;
            return a.groupType - b.groupType;
        }
        // a and b belong to different views.
        return a.viewId - b.viewId;
    }
    draw(paintArea) {
        var orderedPaths = Array();
        this.paths.forEach((path) => {
            orderedPaths.push(path);
        });
        // Sort them w.r.t. rendering order.
        orderedPaths.sort(CanvasOverlay.renderOrderComparator);
        orderedPaths.forEach((path) => {
            if (this.isPathVisible(path))
                path.updatePathAllPanes(paintArea);
        }, this);
    }
    redraw(path, oldBounds) {
        if (!this.isPathVisible(path) && (!oldBounds.isValid() || !this.intersectsVisible(oldBounds)))
            return;
        // This does not get called via onDraw(ie, tiles aren't painted), so ask tileSection to "erase" by painting over.
        // Repainting the whole canvas is not necessary but finding the minimum area to paint over
        // is potentially expensive to compute (think of overlapped path objects).
        // TODO: We could repaint the area on the canvas occupied by all the visible path-objects
        // and paint tiles just for that, but need a more general version of _tilesSection.onDraw() and callees.
        this.containerObject.requestReDraw();
    }
    updateCanvasBounds() {
        this.bounds = app.activeDocument.activeLayout.getViewportCorePixelBounds();
    }
    getBounds() {
        this.updateCanvasBounds();
        return this.bounds;
    }
    // Applies canvas translation so that polygons/circles can be drawn using core-pixel coordinates.
    ctStart(clipArea, paneBounds, fixed, freezePane) {
        this.updateCanvasBounds();
        this.transformList.reset();
        this.ctx.save();
        if (!paneBounds)
            paneBounds = this.bounds.clone();
        const transform = new OverlayTransform();
        const { freezeX, freezeY } = freezePane ?? { freezeX: false, freezeY: false };
        if (this.tsManager._inZoomAnim && !fixed) {
            // zoom-animation is in progress : so draw overlay on main canvas
            // at the current frame's zoom level.
            var splitPos = this.tsManager.getSplitPos();
            var scale = this.tsManager.zoomFrameScale();
            const docPos = this.tsManager._getZoomDocPos(this.tsManager._newCenter, this.tsManager._layer._pinchStartCenter, paneBounds, { freezeX, freezeY }, splitPos, scale, false /* findFreePaneCenter? */);
            const clipTopLeft = new cool.Point(docPos.topLeft.x, docPos.topLeft.y);
            // Original pane size.
            var paneSize = paneBounds.getSize();
            var clipSize = paneSize.clone();
            if (!freezeX) {
                // Pane's "free" size will shrink(expand) as we zoom in(out)
                // respectively because fixed pane size expand(shrink).
                clipSize.x = (paneSize.x - splitPos.x * (scale - 1)) / scale;
                docPos.topLeft.x -= splitPos.x;
            }
            if (!freezeY) {
                // See comment regarding pane width above.
                clipSize.y = (paneSize.y - splitPos.y * (scale - 1)) / scale;
                docPos.topLeft.y -= splitPos.y;
            }
            // Force clip area to the zoom frame area of the pane specified.
            clipArea = new cool.Bounds(clipTopLeft, clipTopLeft.add(clipSize));
            transform.scale(scale, scale);
            transform.translate(scale * docPos.topLeft.x, scale * docPos.topLeft.y);
        }
        else if (this.tsManager._inZoomAnim && fixed) {
            var scale = this.tsManager.zoomFrameScale();
            transform.scale(scale, scale);
            if (clipArea) {
                clipArea = new cool.Bounds(clipArea.min.divideBy(scale), clipArea.max.divideBy(scale));
            }
        }
        else {
            transform.translate(paneBounds.min.x ? this.bounds.min.x : 0, paneBounds.min.y ? this.bounds.min.y : 0);
        }
        this.transformList.add(transform);
        if (this.isCalcRTL()) {
            const sectionWidth = this.size[0];
            // Apply horizontal flip transformation.
            this.transformList.addNew(new cool.Point(-sectionWidth, 0), new cool.Point(-1, 1));
        }
        if (clipArea) {
            this.ctx.beginPath();
            clipArea = this.transformList.applyToBounds(clipArea);
            var clipSize = clipArea.getSize();
            this.ctx.rect(clipArea.min.x, clipArea.min.y, clipSize.x, clipSize.y);
            this.ctx.clip();
        }
    }
    // Undo the canvas translation done by ctStart().
    ctEnd() {
        this.ctx.restore();
    }
    updatePoly(path, closed = false, clipArea, paneBounds, freezePane) {
        var i;
        var j;
        var len2;
        var part;
        var parts = path.getParts();
        var len = parts.length;
        if (!len)
            return;
        this.ctStart(clipArea, paneBounds, path.fixed, freezePane);
        this.ctx.beginPath();
        for (i = 0; i < len; i++) {
            for (j = 0, len2 = parts[i].length; j < len2; j++) {
                part = this.transformList.applyToPoint(parts[i][j]);
                this.ctx[j ? 'lineTo' : 'moveTo'](part.x, part.y);
            }
            if (closed) {
                this.ctx.closePath();
            }
        }
        this.fillStroke(path);
        this.ctEnd();
    }
    updateCircle(path, clipArea, paneBounds, freezePane) {
        if (path.empty())
            return;
        this.ctStart(clipArea, paneBounds, path.fixed, freezePane);
        var point = this.transformList.applyToPoint(path.point);
        var r = path.radius;
        var s = (path.radiusY || r) / r;
        if (s !== 1) {
            this.ctx.save();
            this.ctx.scale(1, s);
        }
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y / s, r, 0, Math.PI * 2, false);
        if (s !== 1) {
            this.ctx.restore();
        }
        this.fillStroke(path);
        this.ctEnd();
    }
    fillStroke(path) {
        if (path.fill) {
            this.ctx.globalAlpha = path.fillOpacity;
            this.ctx.fillStyle = path.fillColor || path.color;
            this.ctx.fill(path.fillRule || 'evenodd');
        }
        if (path.stroke && path.weight !== 0) {
            this.ctx.globalAlpha = path.opacity;
            this.ctx.lineWidth = path.weight;
            this.ctx.strokeStyle = path.color;
            this.ctx.lineCap = path.lineCap;
            this.ctx.lineJoin = path.lineJoin;
            this.ctx.stroke();
        }
    }
    bringToFront(path) {
        // TODO: Implement this.
    }
    bringToBack(path) {
        // TODO: Implement this.
    }
    getMap() {
        return this.map;
    }
}
