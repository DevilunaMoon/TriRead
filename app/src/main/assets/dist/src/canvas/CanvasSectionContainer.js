// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
// Below class and CanvasSectionObject class are for managing the canvas layout.
/*
    Potential values are separated with '|'
    All pixels are in core pixels.
    Supports multi touch with 2 fingers.
    This class uses only native events. There is: No timer for anything & no longpress for desktop & no doubleclick for touch screen & no wheel for touchscreen etc.

    Propagated events:  All events are propagated between "bound sections".
                        If 2 sections overlap but not bound, only top section gets the event.

    lowestPropagatedBoundSection:
            This property applies to bound sections.
            Bound sections are like layers. They overlap entirely.
            Every bound section should share same zIndex unless there is a very good reason for different zIndex values.
            To make a section "bound" to another, one can use "boundToSection" property (section name - string).
            When 2 or more sections are bound, the top section will get the event first.
            If a section handles the event and calls stopPropagating function, the bound sections after that section won't get the event.
            Example scenario:
                Event: drag
                Top section handles event.
                Middle section handles the event and then calls "stopPropagating" function. From this point, top section still handles the event until the end of the event.
                Bottom section doesn't get the event.

            If stopPropagating function is called, it is valid until the end of the event. So for events like dragging, calling
            the function only once is enough. When the event is lasted, lowestPropagatedBoundSection variable is set to null automatically.

    New section's options:
    name: 'tiles' | 'row headers' | 'column headers' | 'markers & cursor' | 'shapes' | 'scroll' etc.
    anchor: 'top left' | 'top right' | 'bottom left' | 'bottom right' (Examples: For row & column headers, anchor will be 'top left'; If we would want to draw something sticked to bottom, it would be 'bottom left' or 'bottom right').
        One can also anchor sections to other sections' edges.
        Order is important, first variables are related to top or bottom, next ones are related to left or right.
        Examples:
        1- [["column header", "bottom", "some section name", "top", "top"], "left"]
            ^ If "column header" section exists, its bottom will be section's top
            If "some section name" exists, its top will be section's top.
            If none of them exists, canvas's top will be used as anchor.
            Canvas's left will be used as horizontal anchor.
        2- [["column header", "bottom", "ruler", "bottom", "top"], ["row header", "right", "left"]]
        It is also possible to position a section's right edge anchor to another section's left edge by using a special option '-left'.

    position: [0, 0] | [10, 50] | [x, y] // Related to anchor. Example 'bottom right': P(0, 0) is bottom right etc. myTopLeft is updated according to position and anchor.

    documentObject:
        * This means that the section is a document object. So its anchor can only be "top left", it doesn't need to be set.
        * Container's documentAnchorSectionName should be set for enabling document objects.
        * For this type of sections, only "size" and "position" are meaningful.
        * Position is the object's position inside the document.
        * So a document object is not a UI element, other sections are UI elements and their positions and sizes can be managed by the section container.
        * Document objects' positions and sizes are not managed by the section container.
        * When "onDraw" function of a document-object section is called, the canvas pen is positioned to the coordinate of the document object. So the section can draw from point (0, 0)
        * Before "onDraw" function is called, section's "isVisible" property is set. If the object is visible inside the viewed area (even partially), the property value will be true, if not, it will be false.

    windowSection:	Bound sections overlap entirely, their sizes and locations are the same.
                    Events are propagated "only" between bound sections.
                    When an event occurs, the target section is found and local coordinates are calculated.
                    Since the same coordinates are valid for the bound sections beneath the target section, we can easily propagate the event to those bound sections.
                    If 2 sections intersect but not bound, the top section gets the event and event is not propagated to the intersecting section.
                    This type of propagation reduces the computational load of the CanvasSectionContainer.

                    Now, the document is placed inside TilesSection and we need to scroll / zoom the document.
                    If we bind the ScrollSection to TilesSection, we can easily scroll the document using event propagation.
                    But now we have CommentListSection next to TilesSection. We also want to be able to scroll the document when mouse is above CommentListSection.
                    This request needs a top handler to be met.
                    Top handlers (sections) will handle events like scroll & zoom universally.
                    Users will be able to scroll the document while the mouse pointer is above CommentListSection.
                    So the solution to problems like scrolling is using "windowSection"s.

                    A window section is always the first to handle an event and its size is equal to canvas element's size.
                    An event is propagated for the target section after window section handles it.
                    A window section can stop propagation of the event.
                    "Window section"s drawing order and zIndex can be set. So it will be drawn accordingly.

                    If:
                        We don't want to handle the event with the window section while mouse is above "section X".
                            Check canvasSectionContainer.targetSection property. It shows the actual target of the event.
                                Example:	A document object is being moved and window section shouldn't scroll the document.
                                            Window section will check the containerObject.targetSection (string) and see it is a document object.
                        We are handling keyboard events with a window section so there is no target section?
                            Check the containerObject.activeSection property, if it is not included in your list, don't handle the keyboard event with the window section.
                            One should set and keep up to date the containerObject.activeSection (string) property accordingly.

    size: [100, 100] | [10, 20] | [maxX, maxY] // This doesn't restrict the drawable area, that is up to implementation. Size is not important for expanded directions. Expandable size is assigned after calculations.
    zIndex: Elements with highest zIndex will be drawn on top.
    expand: '' | 'right' | 'left' | 'top' | 'bottom' | 'left right top bottom' (any combination)
    interactable: true | false // If false, only general events will be fired (onDraw, newDocumentTopLeft, onResize). Example: editing mode, background drawings etc.
    drawingOrder: Sections with the same zIndex value are drawn according to their drawing order values.
        Section with the highest drawing order is drawn on top (for specific zIndex).
        So, in terms of being drawn on top, priority is: zIndex > drawingOrder.
    processingOrder:

    Processing order feature is tricky, let's say you want something like this:

    --------------------
    |     top bar      |
    --------------------
    --------- ----------
    | left  | | tiles  |
    | bar   | | area   |
    --------- ----------

    Top bar's height will be static most probably. It needs to be drawn first, so it can be expanded to right.
    If top bar is processed after tiles area, since "tiles area" will most probably be expanded to all directions, it will leave no space for top bar.
    So, tiles area will be processed last.
    For above situation, processing orders would be (with the same zIndex):
    * top bar -> 1
    * left bar -> 2
    * tiles area -> 3

    And "expand" properties would be like below:
        top bar: 'right' from position (0, 0)
        left bar: 'top bottom' from position (0, 200) -> So it will go up and find where top bar ends, then go down and find where canvas ends.
        tiles area: 'top bottom left right' from position like (300, 300) -> So it won't overlap with resulting positions of others (or it can stuck inside one of them).

    Expandable sections' dimensions are calculated according to other sections with the same zIndex.

    Below events trigger a redraw:
    * Adding a new section.
    * Click.
    * Double click.
    * Renewing all sections (optional redraw).
    * Requesting a redraw.

    Every section has a "section" property inside "sectionProperties".

    Event handling:
        Mouse event combinations:
            mouse down + mouse up + click
            mouse down + mouse up + click + mouse down + mouse up + click + double click
            mouse move (if mouse is down, "draggingSomething" = true)
            mouse down + mouse move (dragging) + mouse up
            mouse wheel
            mouse enter
            mouse leave

        Touch event combinations:
            mouse down + mouse up + click
            mouse down + long press + mouse up
            mouse down + mouse move (it means dragging, "draggingSomething" = true) + mouse up // There is no "mouse move" event without dragging (for touch events)
            mouse down + multi touch start + multi touch move + multi touch end
*/
class CanvasSectionContainer {
    constructor(canvasDOMElement, disableDrawing) {
        /*
            All events will be cached by this class and propagated to sections.
            This class should work also mouse & touch enabled (at the same time) devices. Users should be able to use both.
        */
        this.sections = new Array(0);
        this.sectionsByName = new Map();
        this.needsResize = false;
        this.positionOnMouseDown = null;
        this.positionOnMouseUp = null;
        this.positionOnClick = null;
        this.positionOnDoubleClick = null;
        this.mousePosition = null;
        this.dragDistance = null;
        this.draggingSomething = false; // This will be managed by container, used by sections.
        this.sectionOnMouseDown = null; // (Will contain section name) When dragging, user can leave section borders, dragging will continue. Target section will be informed.
        this.sectionUnderMouse = null; // For mouse enter & leave events.
        this.draggingTolerance = 5; // This is for only desktop, mobile browsers seem to distinguish dragging and clicking nicely.
        this.multiTouch = false;
        this.touchCenter = null;
        this.longPressTimer = null;
        this.clearColor = '#f8f9fa';
        this.documentBackgroundColor = '#ffffff'; // This is the background color of the document
        this.useCSSForBackgroundColor = true;
        this.touchEventInProgress = false; // This prevents multiple calling of mouse down and up events.
        this.activePointerId = null;
        this.testing = false; // If this set to true, container will create a div element for every section. So, cypress tests can find where to click etc.
        this.lowestPropagatedBoundSection = null; // Event propagating to bound sections. The first section which stops propagating and the sections those are on top of that section, get the event.
        this.targetSection = null;
        this.activeSection = null;
        this.scrollLineHeight = 30; // This will be overridden.
        this.mouseIsInside = false;
        this.inZoomAnimation = false;
        this.postZoomReplay = false;
        this.documentAnchorSectionName = null; // This section's top left point declares the point where document starts.
        this.documentAnchor = null; // This is the point where document starts inside canvas element. Initial value shouldn't be [0, 0].
        // Above 2 properties can be used with documentBounds.
        this.drawRequest = null;
        this.drawingPaused = 0;
        this.drawingEnabled = true;
        this.deferredDrawCallback = null;
        this.inRedrawCallback = false;
        this.sectionsDirty = false;
        this.framesRendered = 0; // Total frame count for debugging
        // For window sections.
        this.windowSectionList = [];
        // Below variables are related to animation feature.
        this.animatingSectionName = null; // The section that called startAnimating function. This variable is null when animations are not running.
        this.lastFrameStamp = null;
        this.continueAnimating = null;
        this.frameCount = null; // Frame count of the current animation.
        this.duration = null; // Duration for the animation.
        this.elapsedTime = null; // Time that passed since the animation started.
        this.dpiListener = new DPIChangeListener(() => {
            if (window.devicePixelRatio !== app.dpiScale)
                this.onResize(0, 0);
        });
        // True between a middle-button press on the canvas and its release.
        this.middleButtonDownOnCanvas = false;
        // True when the mouse was over a hyperlink at the last middle-button
        // press on the canvas.
        this.middleClickOnHyperlink = false;
        // Canvas-locale position of the previous step of a middle-button pan of the overview
        // page, or null when no pan is running.
        this.middlePanPosition = null;
        this.canvas = canvasDOMElement;
        this.context = canvasDOMElement.getContext('2d', { alpha: false });
        this.context.setTransform(1, 0, 0, 1, 0, 0);
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.onmousedown = this.onMouseDown.bind(this);
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.onclick = this.onClick.bind(this);
        this.canvas.onauxclick = this.onAuxClick.bind(this);
        this.canvas.ondblclick = this.onDoubleClick.bind(this);
        this.canvas.oncontextmenu = this.onContextMenu.bind(this);
        this.canvas.onwheel = this.onMouseWheel.bind(this);
        this.canvas.onmouseleave = this.onMouseLeave.bind(this);
        this.canvas.onmouseenter = this.onMouseEnter.bind(this);
        this.canvas.addEventListener('pointerdown', (e) => {
            if (e.button === 0 && e.isPrimary)
                this.activePointerId = e.pointerId;
        });
        this.canvas.addEventListener('pointerup', () => { this.activePointerId = null; });
        this.canvas.addEventListener('pointercancel', () => { this.activePointerId = null; });
        this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
        this.canvas.addEventListener('touchcancel', this.onTouchCancel.bind(this));
        this.canvas.ondrop = this.onDrop.bind(this);
        this.canvas.ondragover = this.onDragOver.bind(this);
        window.addEventListener('blur', this.onWindowBlur.bind(this));
        // Some explanation first.
        // When the user uses the mouse wheel for scrolling, different browsers use different technics for calculating the deltaY and deltaX values.
        // For example FireFox uses "deltaMode=1" which corresponds to "lines". So it creates the event with the number of lines to scroll.
        // Chrome uses "deltaMode=0" which corresponds to "pixels". So it creates the event with the number of pixels to scroll.
        // When "deltaMode=1" is used, we need to know the height of the line, so we will convert it to pixels.
        // For that purpose, we'll create a temporary div element, get the font size and delete the temporary element.
        const tempElement = document.createElement('div');
        tempElement.style.fontSize = 'initial'; // IE doesn't support this property, but it uses "deltaMode=0" (so we don't need to get the line height).
        tempElement.style.display = 'none';
        document.body.appendChild(tempElement);
        this.scrollLineHeight = parseInt(window.getComputedStyle(tempElement).fontSize);
        document.body.removeChild(tempElement); // Remove the temporary element.
        this.clearColor = window.getComputedStyle(document.documentElement).getPropertyValue('--color-canvas');
        // Set document background color to the app background color for now until we get the real color from the kit
        // through a LOK_CALLBACK_DOCUMENT_BACKGROUND_COLOR
        this.documentBackgroundColor = window.getComputedStyle(document.documentElement).getPropertyValue('--color-background-document');
        // If CanvasTileLayer.js:this._layer.isCalc()
        if (disableDrawing) {
            // On Calc cells have no color, so let's set canvas color with document bg
            this.clearColor = this.documentBackgroundColor;
            this.disableDrawing();
        }
        this.dpiListener.start();
    }
    clearCanvas() {
        this.context.fillStyle = this.clearColor;
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    getContext() {
        return this.context;
    }
    // Where the mouse was last seen, in the coordinates of this container, or null while it has not
    // been seen at all.
    getMousePosition() {
        return this.mousePosition;
    }
    setDocumentAnchorSection(sectionName) {
        var section = this.getSectionWithName(sectionName);
        if (section) {
            this.documentAnchorSectionName = sectionName;
        }
        else {
            this.documentAnchorSectionName = null;
            this.documentAnchor = null;
            if (app.activeDocument?.activeLayout)
                app.activeDocument.activeLayout.documentAnchorPosition = [0, 0];
        }
    }
    getDocumentAnchorSection() {
        return this.getSectionWithName(this.documentAnchorSectionName);
    }
    getViewSize() {
        return [this.width, this.height];
    }
    setBackgroundColorMode(useCSSVars = true) {
        this.useCSSForBackgroundColor = useCSSVars;
    }
    setClearColor(color) {
        if (!this.useCSSForBackgroundColor)
            this.clearColor = color;
    }
    getClearColor() {
        return this.clearColor;
    }
    setDocumentBackgroundColor(color) {
        this.documentBackgroundColor = color;
    }
    getDocumentBackgroundColor() {
        return this.documentBackgroundColor;
    }
    getCanvasStyle() {
        return this.canvas.style;
    }
    setInZoomAnimation(inZoomAnimation) {
        this.inZoomAnimation = inZoomAnimation;
    }
    isInZoomAnimation() {
        return this.inZoomAnimation;
    }
    setPostZoomReplay(postZoomReplay) {
        this.postZoomReplay = postZoomReplay;
    }
    isPostZoomReplay() {
        return this.postZoomReplay;
    }
    drawingAllowed() {
        return this.drawingEnabled && this.drawingPaused <= 0;
    }
    // This is used for making sure rendering does not happen for multiple runs of
    // Socket._emitSlurpedEvents(). Currently this is used in Calc to disable rendering
    // from docload till we get tiles of the correct view area to render.
    // After calling this, only enableDrawing() can undo this call.
    disableDrawing() {
        if (this.drawRequest) {
            cancelAnimationFrame(this.drawRequest);
            this.drawRequest = null;
        }
        this.drawingEnabled = false;
    }
    enableDrawing() {
        if (this.drawingEnabled)
            return;
        this.drawingEnabled = true;
        if (this.drawingPaused === 0) {
            // Trigger a forced repaint as drawing is not paused currently.
            this.paintOnResumeOrEnable();
        }
    }
    pauseDrawing() {
        if (this.drawRequest) {
            cancelAnimationFrame(this.drawRequest);
            this.drawRequest = null;
        }
        this.drawingPaused++;
    }
    // set topLevel if we are sure that we are the top of call nesting
    // eg. in a browser event handler. Avoids JS exceptions poisoning
    // the count, since we have no RAII helpers here.
    resumeDrawing(topLevel) {
        var wasNonZero = this.drawingPaused !== 0;
        if (topLevel)
            this.drawingPaused = 0;
        else if (this.drawingPaused > 0) // ensure non-negative value.
            this.drawingPaused--;
        if (this.drawingEnabled && wasNonZero && this.drawingPaused === 0) {
            this.paintOnResumeOrEnable();
        }
        else {
            // This is unusual, make it visible in the logs
            let log = 'Skipped paint on resume.';
            log += '\nDrawing Enabled: ' + (this.drawingEnabled ? 'YES' : 'NO');
            log += '\nDrawing Paused: ' + (this.drawingPaused > 0 ? 'YES' : 'NO');
            app.console.debug(log);
        }
    }
    // Drawing requests will call this callback instead of queueing a redraw. Set the
    // callback to null to resume the standard drawing chain.
    deferDrawing(callback) {
        this.deferredDrawCallback = callback;
    }
    paintOnResumeOrEnable() {
        if (this.sectionsDirty) {
            this.updateBoundSectionLists();
            this.reNewAllSections(false);
            this.sectionsDirty = false;
        }
        var scrollSection = this.getSectionWithName(app.CSections.Scroll.name);
        if (scrollSection)
            scrollSection.completePendingScroll(); // No painting, only dirtying.
        this.requestReDraw();
    }
    clearMousePositions() {
        this.positionOnClick = this.positionOnDoubleClick = this.positionOnMouseDown = this.positionOnMouseUp = this.dragDistance = this.sectionOnMouseDown = null;
        this.touchCenter = null;
        this.draggingSomething = false;
        this.touchEventInProgress = false;
        this.lowestPropagatedBoundSection = null;
        this.targetSection = null;
    }
    convertPositionToSectionLocale(section, point) {
        return [point[0] - section.myTopLeft[0], point[1] - section.myTopLeft[1]];
    }
    // Bound sections can have different origins: a document object section moves with the document.
    convertPositionBetweenSections(from, to, position) {
        if (!position)
            return null;
        return cool.SimplePoint.fromCorePixels([
            position[0] + from.myTopLeft[0] - to.myTopLeft[0],
            position[1] + from.myTopLeft[1] - to.myTopLeft[1],
        ]);
    }
    convertPositionToCanvasLocale(e) {
        var rect = this.canvas.getBoundingClientRect();
        var x, y;
        if (e.touches !== undefined && e.touches.length > 0) {
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        }
        else if (e.changedTouches !== undefined && e.changedTouches.length > 0) {
            x = e.changedTouches[0].clientX - rect.left;
            y = e.changedTouches[0].clientY - rect.top;
        }
        else {
            x = e.clientX - rect.left;
            y = e.clientY - rect.top;
        }
        return [Math.round(x * app.dpiScale), Math.round(y * app.dpiScale)];
    }
    convertPointToCanvasLocale(point) {
        var rect = this.canvas.getBoundingClientRect();
        var x, y;
        x = point[0] - rect.left;
        y = point[1] - rect.top;
        return [Math.round(x * app.dpiScale), Math.round(y * app.dpiScale)];
    }
    getSectionWithName(name) {
        if (name) {
            var section = this.sectionsByName.get(name);
            if (section) {
                return section;
            }
            return null;
        }
        else {
            return null;
        }
    }
    getDocumentAnchor() {
        return [this.documentAnchor[0], this.documentAnchor[1]];
    }
    getCanvasBoundingClientRect() {
        return this.canvas.getBoundingClientRect();
    }
    getWidth() {
        return this.width;
    }
    getHeight() {
        return this.height;
    }
    isDraggingSomething() {
        return this.draggingSomething;
    }
    /*
        Ends a drag that is under way without waiting for the button to come up, as Escape does.
        The section that started it is told, so what it shows of the drag goes with it.
    */
    cancelDragging() {
        if (!this.draggingSomething)
            return;
        const section = this.getSectionWithName(this.sectionOnMouseDown);
        this.clearMousePositions();
        if (section) {
            // A drag reaches the sections bound to the one it started on, and each of them may be
            // showing something of it, so each of them is told that it is off.
            section.onDragCancel();
            for (let i = 0; i < section.boundsList.length; i++) {
                if (section.boundsList[i] !== section)
                    section.boundsList[i].onDragCancel();
            }
        }
        this.requestReDraw();
    }
    // Capture/release can throw if the pointer is gone or was never captured;
    // we ignore that and carry on.
    capturePointerForDrag() {
        if (this.activePointerId !== null) {
            try {
                this.canvas.setPointerCapture(this.activePointerId);
            }
            catch (_) { /* ignore */ }
        }
    }
    releasePointerForDrag() {
        if (this.activePointerId !== null) {
            try {
                this.canvas.releasePointerCapture(this.activePointerId);
            }
            catch (_) { /* ignore */ }
        }
    }
    getDragDistance() {
        return [...this.dragDistance];
    }
    getPositionOnMouseUp() {
        return [...this.positionOnMouseUp];
    }
    isDocumentObjectVisible(section) {
        return section.isAlwaysVisible ||
            app.isRectangleVisibleInTheDisplayedArea([
                Math.round(section.position[0] * app.pixelsToTwips),
                Math.round(section.position[1] * app.pixelsToTwips),
                Math.round(section.size[0] * app.pixelsToTwips),
                Math.round(section.size[1] * app.pixelsToTwips)
            ]);
    }
    // For window sections, there is a "targetSection" property in CanvasSectionContainer.
    // Because a window section is above all sections and cover entire canvas, it may need to act according to the actual target of the event.
    // In this case, "targetSection" property gives the window section the first target of the event.
    // This (below) function gives the window section if a section will sooner or later get the event.
    // But this function cannot know if the event will be stopped by a prior section before the event reaches the section specified with the "sectionName" variable.
    // This function doesn't neither check the "interactable" property of the section in question ("sectionName"). Though that check can be added here, as an optional one.
    targetBoundSectionListContains(sectionName) {
        if (!this.targetSection)
            return false;
        else {
            var section = this.getSectionWithName(this.targetSection);
            if (section && section.boundsList) {
                for (var i = 0; i < section.boundsList.length; i++) {
                    if (section.boundsList[i].name === sectionName)
                        return true;
                }
                return false;
            }
            else
                return false;
        }
    }
    updateBoundSectionList(section, sectionList = null) {
        if (sectionList === null)
            sectionList = new Array(0);
        sectionList.push(section);
        var tempSectionList = new Array(0);
        if (section.boundToSection) {
            var tempSection = this.getSectionWithName(section.boundToSection);
            if (tempSection && tempSection.isLocated) {
                if (!sectionList.includes(tempSection))
                    tempSectionList.push(tempSection);
            }
        }
        for (var i = 0; i < this.sections.length; i++) {
            if (this.sections[i].isLocated && this.sections[i].boundToSection === section.name) {
                if (!sectionList.includes(this.sections[i]))
                    tempSectionList.push(this.sections[i]);
            }
        }
        for (var i = 0; i < tempSectionList.length; i++) {
            this.updateBoundSectionList(tempSectionList[i], sectionList);
        }
        return sectionList;
    }
    orderBoundsList(section) {
        // According to zIndex & drawingOrder.
        for (var i = 0; i < section.boundsList.length - 1; i++) {
            for (var j = i + 1; j < section.boundsList.length; j++) {
                if (section.boundsList[i].zIndex > section.boundsList[j].zIndex
                    || (section.boundsList[i].zIndex === section.boundsList[j].zIndex && section.boundsList[i].drawingOrder > section.boundsList[j].drawingOrder)) {
                    var temp = section.boundsList[i];
                    section.boundsList[i] = section.boundsList[j];
                    section.boundsList[j] = temp;
                }
            }
        }
        // Remove the sections those are above this section. Events will not be propagated to them.
        for (var i = section.boundsList.length - 1; i > -1; i--) {
            if (section.boundsList[i].name !== section.name) {
                section.boundsList.splice(i, 1);
            }
            else {
                break;
            }
        }
    }
    // Should only be called by CanvasSectionObject member functions!
    // HACK: Typescript does not have the concept of friend classes hence this has to be public.
    updateBoundSectionLists() {
        for (var i = 0; i < this.sections.length; i++) {
            this.sections[i].boundsList = null;
            this.sections[i].boundsList = this.updateBoundSectionList(this.sections[i]);
            this.orderBoundsList(this.sections[i]);
        }
    }
    flushLayoutingTasks() {
        const layoutingService = app.layoutingService;
        if (layoutingService.hasTasksPending())
            layoutingService.cancelFrame();
        while (layoutingService.runTheTopTask())
            ;
        // Trigger drain callbacks since we bypassed the normal async flow
        layoutingService.triggerDrainCallbacks();
    }
    isCanvasSizeValidAfterDisplayChange() {
        /*
            In some situations, we receive resize events that cause the canvas to size to 0x0 and we don't receive a subsequent
            resize event when the size is restored. As a work-around, if we have a zero-sized canvas,
            double-check the document container size to see if we've missed a resize event
        */
        if (this.width === 0 || this.height === 0) {
            app.console.warn('Canvas width or height is zero.');
            const documentContainer = document.getElementById('document-container');
            if (documentContainer && documentContainer.clientWidth !== 0 || documentContainer.clientHeight !== 0) {
                if (app.map._docLayer) {
                    app.map._docLayer._syncTileContainerSize();
                    app.activeDocument.activeLayout.sendClientVisibleArea();
                    this.requestReDraw();
                    return false;
                }
            }
        }
        return true;
    }
    resizeCanvas() {
        if (!this.needsResize)
            return;
        this.needsResize = false;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        // CSS pixels can be fractional, but need to round to the same real pixels
        var cssWidth = this.width / app.dpiScale; // NB. beware
        var cssHeight = this.height / app.dpiScale;
        this.canvas.style.width = cssWidth.toFixed(4) + 'px';
        this.canvas.style.height = cssHeight.toFixed(4) + 'px';
        // Avoid black default background.
        this.clearCanvas();
    }
    redrawCallback(timestamp) {
        app.enterRAF();
        this.drawRequest = null;
        if (!this.isCanvasSizeValidAfterDisplayChange()) {
            app.exitRAF();
            return;
        }
        app.console.debug('CSC: set inRedrawCallback = true');
        this.inRedrawCallback = true;
        this.flushLayoutingTasks();
        this.resizeCanvas();
        this.drawSections();
        // animate() legitimately requests the next frame, so clear the flag
        // before it runs or its requestReDraw would be dropped.
        this.inRedrawCallback = false;
        app.console.debug('CSC: set inRedrawCallback = false');
        this.canvas.style.visibility = 'unset';
        // need to check if we should continue animation
        this.animate(timestamp);
        app.exitRAF();
    }
    requestReDraw() {
        if (!this.drawingAllowed())
            return;
        if (this.deferredDrawCallback) {
            this.deferredDrawCallback();
            return;
        }
        if (this.inRedrawCallback) {
            // Unusual - please verify the case
            // We should already recalculate and process all data BEFORE we draw
            // If inside drawing code we made change -> possibly it's good to review
            app.console.debug('CSC: inRedrawCallback active already');
        }
        if (this.drawRequest === null)
            this.drawRequest = requestAnimationFrame(this.redrawCallback.bind(this));
    }
    // Paint now instead of in an animation frame. A hidden view gets no frames.
    redrawNow() {
        if (!this.drawingAllowed())
            return;
        if (this.drawRequest !== null)
            cancelAnimationFrame(this.drawRequest);
        this.redrawCallback(performance.now());
    }
    propagateCursorPositionChanged() {
        // There is no target section for cursor position change, this event comes from core side.
        // Sections with interactable = false will not be targeted.
        // Window sections can still stop the propagation of the event. Others cannot.
        var propagate = true;
        for (var j = 0; j < this.windowSectionList.length; j++) {
            var windowSection = this.windowSectionList[j];
            if (windowSection.interactable)
                windowSection.onCursorPositionChanged(app.file.textCursor.rectangle.clone());
            if (this.lowestPropagatedBoundSection === windowSection.name)
                propagate = false; // Window sections can not stop the propagation of the event for other window sections.
        }
        if (propagate) {
            for (var i = this.sections.length - 1; i > -1; i--) {
                if (this.sections[i].interactable)
                    this.sections[i].onCursorPositionChanged(app.file.textCursor.rectangle.clone());
            }
        }
    }
    propagateCellAddressChanged() {
        // There is no target section for cell address change, this event comes from core side.
        // Sections with interactable = false will not be targeted.
        // Window sections can still stop the propagation of the event. Others cannot.
        var propagate = true;
        for (var j = 0; j < this.windowSectionList.length; j++) {
            var windowSection = this.windowSectionList[j];
            windowSection.onCellAddressChanged();
            if (this.lowestPropagatedBoundSection === windowSection.name)
                propagate = false; // Window sections can not stop the propagation of the event for other window sections.
        }
        if (propagate) {
            for (var i = this.sections.length - 1; i > -1; i--) {
                this.sections[i].onCellAddressChanged();
            }
        }
    }
    // Deliver a click-like event to the window sections and then to the bound
    // sections of the target, honouring the same interactable and propagation
    // stopping rules for every kind of click. The deliver callback picks which
    // section handler receives the event, for example onClick or onMiddleClick.
    propagateClickLike(section, position, e, deliver) {
        this.targetSection = section.name;
        let propagate = true;
        const windowPosition = position ? cool.SimplePoint.fromCorePixels([position[0] + section.myTopLeft[0], position[1] + section.myTopLeft[1]]) : null;
        for (let j = 0; j < this.windowSectionList.length; j++) {
            const windowSection = this.windowSectionList[j];
            if (windowSection.interactable)
                deliver(windowSection, windowPosition, e);
            if (this.lowestPropagatedBoundSection === windowSection.name)
                propagate = false; // Window sections can not stop the propagation of the event for other window sections.
        }
        if (propagate) {
            for (let i = section.boundsList.length - 1; i > -1; i--) {
                if (section.boundsList[i].interactable)
                    deliver(section.boundsList[i], this.convertPositionBetweenSections(section, section.boundsList[i], position), e);
                if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
                    break; // Stop propagation.
            }
        }
    }
    propagateOnClick(section, position, e) {
        this.propagateClickLike(section, position, e, (target, point, ev) => target.onClick(point, ev));
    }
    propagateOnMiddleClick(section, position, e, openHyperlink) {
        this.propagateClickLike(section, position, e, (target, point, ev) => target.onMiddleClick(point, ev, openHyperlink));
    }
    propagateOnDoubleClick(section, position, e) {
        this.targetSection = section.name;
        var propagate = true;
        var windowPosition = position ? cool.SimplePoint.fromCorePixels([position[0] + section.myTopLeft[0], position[1] + section.myTopLeft[1]]) : null;
        for (var j = 0; j < this.windowSectionList.length; j++) {
            var windowSection = this.windowSectionList[j];
            if (windowSection.interactable)
                windowSection.onDoubleClick(windowPosition, e);
            if (this.lowestPropagatedBoundSection === windowSection.name)
                propagate = false; // Window sections can not stop the propagation of the event for other window sections.
        }
        if (propagate) {
            for (var i = section.boundsList.length - 1; i > -1; i--) {
                if (section.boundsList[i].interactable)
                    section.boundsList[i].onDoubleClick(this.convertPositionBetweenSections(section, section.boundsList[i], position), e);
                if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
                    break; // Stop propagation.
            }
        }
    }
    propagateOnMouseLeave(section, position, e) {
        this.targetSection = section.name;
        var windowPosition = position ? cool.SimplePoint.fromCorePixels([position[0] + section.myTopLeft[0], position[1] + section.myTopLeft[1]]) : null;
        if (!windowPosition) { // This event is valid only if the windowPosition is null for window sections. Otherwise mouse cannot leave from a section that is covering entire canvas element.
            for (var j = 0; j < this.windowSectionList.length; j++) {
                var windowSection = this.windowSectionList[j];
                if (windowSection.interactable)
                    windowSection.onMouseLeave(windowPosition, e);
                // This event's propagation shouldn't be cancelled.
            }
        }
        for (var i = section.boundsList.length - 1; i > -1; i--) {
            if (section.boundsList[i].interactable)
                section.boundsList[i].onMouseLeave(this.convertPositionBetweenSections(section, section.boundsList[i], position), e);
            if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
                break; // Stop propagation.
        }
    }
    propagateOnMouseEnter(section, position, e) {
        this.targetSection = section.name;
        // This event is handled in the mouseEnter event of the canvas itself (for window sections).
        for (var i = section.boundsList.length - 1; i > -1; i--) {
            if (section.boundsList[i].interactable)
                section.boundsList[i].onMouseEnter(this.convertPositionBetweenSections(section, section.boundsList[i], position), e);
            if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
                break; // Stop propagation.
        }
    }
    propagateOnMouseMove(section, position, dragDistance, e) {
        this.targetSection = section.name;
        var propagate = true;
        var windowPosition = position ? cool.SimplePoint.fromCorePixels([position[0] + section.myTopLeft[0], position[1] + section.myTopLeft[1]]) : null;
        for (var j = 0; j < this.windowSectionList.length; j++) {
            var windowSection = this.windowSectionList[j];
            if (windowSection.interactable)
                windowSection.onMouseMove(windowPosition, dragDistance, e);
            if (this.lowestPropagatedBoundSection === windowSection.name)
                propagate = false; // Window sections can not stop the propagation of the event for other window sections.
        }
        if (propagate) {
            for (var i = section.boundsList.length - 1; i > -1; i--) {
                if (section.boundsList[i].interactable)
                    section.boundsList[i].onMouseMove(this.convertPositionBetweenSections(section, section.boundsList[i], position), dragDistance, e);
                if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
                    break; // Stop propagation.
            }
        }
        this.lowestPropagatedBoundSection = null; // onMouseMove event doesn't clear the mouse positions, so we need to clear the property here.
    }
    propagateOnMouseDown(section, position, e) {
        this.targetSection = section.name;
        var propagate = true;
        var windowPosition = position ? cool.SimplePoint.fromCorePixels([position[0] + section.myTopLeft[0], position[1] + section.myTopLeft[1]]) : null;
        for (var j = 0; j < this.windowSectionList.length; j++) {
            var windowSection = this.windowSectionList[j];
            if (windowSection.interactable)
                windowSection.onMouseDown(windowPosition, e);
            if (this.lowestPropagatedBoundSection === windowSection.name)
                propagate = false; // Window sections can not stop the propagation of the event for other window sections.
        }
        if (propagate) {
            for (var i = section.boundsList.length - 1; i > -1; i--) {
                if (section.boundsList[i].interactable)
                    section.boundsList[i].onMouseDown(this.convertPositionBetweenSections(section, section.boundsList[i], position), e);
                if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
                    break; // Stop propagation.
            }
        }
    }
    propagateOnMouseUp(section, position, e) {
        this.targetSection = section.name;
        var propagate = true;
        var windowPosition = position ? cool.SimplePoint.fromCorePixels([position[0] + section.myTopLeft[0], position[1] + section.myTopLeft[1]]) : null;
        for (var j = 0; j < this.windowSectionList.length; j++) {
            var windowSection = this.windowSectionList[j];
            if (windowSection.interactable)
                windowSection.onMouseUp(windowPosition, e);
            if (this.lowestPropagatedBoundSection === windowSection.name)
                propagate = false; // Window sections can not stop the propagation of the event for other window sections.
        }
        if (propagate) {
            for (var i = section.boundsList.length - 1; i > -1; i--) {
                if (section.boundsList[i].interactable)
                    section.boundsList[i].onMouseUp(this.convertPositionBetweenSections(section, section.boundsList[i], position), e);
                if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
                    break; // Stop propagation.
            }
        }
    }
    propagateOnContextMenu(section, position, e) {
        this.targetSection = section.name;
        var propagate = true;
        const windowPosition = position ? cool.SimplePoint.fromCorePixels([position[0] + section.myTopLeft[0], position[1] + section.myTopLeft[1]]) : null;
        for (var j = 0; j < this.windowSectionList.length; j++) {
            var windowSection = this.windowSectionList[j];
            if (windowSection.interactable)
                windowSection.onContextMenu(windowPosition, e);
            if (this.lowestPropagatedBoundSection === windowSection.name)
                propagate = false; // Window sections can not stop the propagation of the event for other window sections.
        }
        if (propagate) {
            for (var i = section.boundsList.length - 1; i > -1; i--) {
                if (section.boundsList[i].interactable)
                    section.boundsList[i].onContextMenu(this.convertPositionBetweenSections(section, section.boundsList[i], position), e);
                if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
                    break; // Stop propagation.
            }
        }
    }
    propagateOnMouseWheel(section, position, delta, e) {
        this.targetSection = section.name;
        var propagate = true;
        var windowPosition = position ? cool.SimplePoint.fromCorePixels([position[0] + section.myTopLeft[0], position[1] + section.myTopLeft[1]]) : null;
        for (var j = 0; j < this.windowSectionList.length; j++) {
            var windowSection = this.windowSectionList[j];
            if (windowSection.interactable)
                windowSection.onMouseWheel(windowPosition, delta, e);
            if (this.lowestPropagatedBoundSection === windowSection.name)
                propagate = false; // Window sections can not stop the propagation of the event for other window sections.
        }
        if (propagate) {
            for (var i = section.boundsList.length - 1; i > -1; i--) {
                if (section.boundsList[i].interactable)
                    section.boundsList[i].onMouseWheel(this.convertPositionBetweenSections(section, section.boundsList[i], position), delta, e);
                if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
                    break; // Stop propagation.
            }
        }
    }
    propagateOnMultiTouchStart(section, e) {
        this.targetSection = section.name;
        var propagate = true;
        for (var j = 0; j < this.windowSectionList.length; j++) {
            var windowSection = this.windowSectionList[j];
            if (windowSection.interactable)
                windowSection.onMultiTouchStart(e);
            if (this.lowestPropagatedBoundSection === windowSection.name)
                propagate = false; // Window sections can not stop the propagation of the event for other window sections.
        }
        if (propagate) {
            for (var i = section.boundsList.length - 1; i > -1; i--) {
                if (section.boundsList[i].interactable)
                    section.boundsList[i].onMultiTouchStart(e);
                if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
                    break; // Stop propagation.
            }
        }
    }
    propagateOnMultiTouchMove(section, position, distance, e) {
        this.targetSection = section.name;
        var propagate = true;
        var windowPosition = position ? cool.SimplePoint.fromCorePixels([position[0] + section.myTopLeft[0], position[1] + section.myTopLeft[1]]) : null;
        for (var j = 0; j < this.windowSectionList.length; j++) {
            var windowSection = this.windowSectionList[j];
            if (windowSection.interactable)
                windowSection.onMultiTouchMove(windowPosition, distance, e);
            if (this.lowestPropagatedBoundSection === windowSection.name)
                propagate = false; // Window sections can not stop the propagation of the event for other window sections.
        }
        if (propagate) {
            for (var i = section.boundsList.length - 1; i > -1; i--) {
                if (section.boundsList[i].interactable)
                    section.boundsList[i].onMultiTouchMove(this.convertPositionBetweenSections(section, section.boundsList[i], position), distance, e);
                if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
                    break; // Stop propagation.
            }
        }
    }
    propagateOnMultiTouchEnd(section, e) {
        this.targetSection = section.name;
        var propagate = true;
        for (var j = 0; j < this.windowSectionList.length; j++) {
            var windowSection = this.windowSectionList[j];
            if (windowSection.interactable)
                windowSection.onMultiTouchEnd(e);
            if (this.lowestPropagatedBoundSection === windowSection.name)
                propagate = false; // Window sections can not stop the propagation of the event for other window sections.
        }
        if (propagate) {
            for (var i = section.boundsList.length - 1; i > -1; i--) {
                if (section.boundsList[i].interactable)
                    section.boundsList[i].onMultiTouchEnd(e);
                if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
                    break; // Stop propagation.
            }
        }
    }
    propagateOnDrop(section, position, e) {
        this.targetSection = section.name;
        var propagate = true;
        const windowPosition = position ? cool.SimplePoint.fromCorePixels([position[0] + section.myTopLeft[0], position[1] + section.myTopLeft[1]]) : null;
        for (var j = 0; j < this.windowSectionList.length; j++) {
            var windowSection = this.windowSectionList[j];
            if (windowSection.interactable)
                windowSection.onDrop(windowPosition, e);
            if (this.lowestPropagatedBoundSection === windowSection.name)
                propagate = false; // Window sections can not stop the propagation of the event for other window sections.
        }
        if (propagate) {
            for (var i = section.boundsList.length - 1; i > -1; i--) {
                if (section.boundsList[i].interactable)
                    section.boundsList[i].onDrop(this.convertPositionBetweenSections(section, section.boundsList[i], position), e);
                if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
                    break; // Stop propagation.
            }
        }
    }
    /*
        Cursor position is sent from the core side.
        The event is handled in CanvasTileLayer file.
        CanvasTileLayer then informs CanvasSectionContainer.
        This is for Writer. Other apps may need other functions. To be checked..
    */
    onCursorPositionChanged() {
        if (app.map._docLayer._docType === 'text') {
            // Global state holder should already have the latest information: app.file.textCursor.rectangle.
            this.propagateCursorPositionChanged();
        }
    }
    getMyTopLeftForDocumentObject(section) {
        if (this.documentAnchor === null)
            return;
        return [section.documentPosition.vX, section.documentPosition.vY];
    }
    // Called when document position is changed.
    onNewDocumentTopLeft() {
        // Refresh the layout's view-area geometry before any section reacts
        if (app.activeDocument?.activeLayout)
            app.activeDocument.activeLayout.refreshViewArea();
        for (var i = 0; i < this.sections.length; i++) {
            var section = this.sections[i];
            if (section.documentObject === true) {
                section.myTopLeft = this.getMyTopLeftForDocumentObject(section);
                const isVisible = this.isDocumentObjectVisible(section);
                if (isVisible !== section.isVisible) {
                    section.isVisible = isVisible;
                    section.onDocumentObjectVisibilityChange();
                }
                if (this.testing)
                    this.createUpdateSingleDivElement(section);
            }
            this.sections[i].onNewDocumentTopLeft();
        }
    }
    /*
        Cell position is sent from the core side.
        The event is handled in CanvasTileLayer file.
        This is for Calc.
    */
    onCellAddressChanged() {
        if (app.map._docLayer._docType === 'spreadsheet') {
            // We should have set the variable to latest state already.
            this.propagateCellAddressChanged();
        }
    }
    onClick(e) {
        if (this.touchEventInProgress) {
            Object.defineProperty(e, 'pointerType', {
                value: 'touch',
                writable: false
            });
        }
        if (!this.draggingSomething) { // Prevent click event after dragging.
            if (this.positionOnMouseDown !== null && this.positionOnMouseUp !== null) {
                this.positionOnClick = this.convertPositionToCanvasLocale(e);
                var s1 = this.findSectionContainingPoint(this.positionOnMouseDown);
                var s2 = this.findSectionContainingPoint(this.positionOnMouseUp);
                if (s1 && s2 && s1 == s2) { // Allow click event if only mouse was above same section while clicking.
                    var section = this.findSectionContainingPoint(this.positionOnClick);
                    if (section) { // "interactable" property is checked while propagating the event.
                        this.propagateOnClick(section, this.convertPositionToSectionLocale(section, this.positionOnClick), e);
                    }
                }
            }
            this.requestReDraw();
        }
        this.clearMousePositions();
    }
    // The 'pointer' shape is the hand over a hyperlink. It comes from the shapes while
    // they answer for the pointer, otherwise from the engine.
    isPointerOverHyperlink() {
        if (RenderGeometrySection.answersPointer() && this.mousePosition)
            return RenderGeometrySection.pointerAtCanvasPoint(this.mousePosition) === 'pointer';
        return app.map && app.map._docLayer
            && app.map._docLayer._coreMousePointer === 'pointer';
    }
    startMiddlePan(e) {
        this.middlePanPosition = this.convertPositionToCanvasLocale(e);
        this.canvas.style.cursor = 'grabbing';
    }
    stopMiddlePan() {
        this.middlePanPosition = null;
        // An empty style lets the sections claim the cursor again on the next
        // mouse move.
        this.canvas.style.cursor = '';
    }
    onAuxClick(e) {
        // Only the middle button is handled here. The right button opens the
        // context menu through its own path.
        if (e.button !== 1)
            return;
        // A press that grabbed the overview page ends here. Consuming the
        // click keeps the browser from pasting the primary selection where
        // the pan happened to stop.
        if (this.middlePanPosition !== null) {
            this.stopMiddlePan();
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        // A middle click that did not land on a hyperlink is left to the
        // browser, so pasting the primary selection keeps working.
        if (!this.middleClickOnHyperlink)
            return;
        this.middleClickOnHyperlink = false;
        // Consume the click; on some platforms the primary-selection paste
        // is the default action of this event.
        e.preventDefault();
        e.stopPropagation();
        const mousePosition = this.convertPositionToCanvasLocale(e);
        const section = this.findSectionContainingPoint(mousePosition);
        if (section) {
            this.propagateOnMiddleClick(section, this.convertPositionToSectionLocale(section, mousePosition), e, /* openHyperlink */ true);
        }
        this.clearMousePositions();
    }
    onDoubleClick(e) {
        this.positionOnDoubleClick = this.convertPositionToCanvasLocale(e);
        var section = this.findSectionContainingPoint(this.positionOnDoubleClick);
        if (section) {
            this.propagateOnDoubleClick(section, this.convertPositionToSectionLocale(section, this.positionOnDoubleClick), e);
        }
        this.clearMousePositions();
        this.requestReDraw();
    }
    isLongPressActive() {
        return !!this.longPressTimer;
    }
    startLongPress(e) {
        this.stopLongPress();
        this.longPressTimer = setTimeout(function () {
            e.clientX = e.touches[0].clientX;
            e.clientY = e.touches[0].clientY;
            this.onMouseMove(e);
        }.bind(this), app.LOUtil.longPressTime);
    }
    stopLongPress() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }
    onMouseMove(e) {
        if (this.middlePanPosition !== null) {
            if ((e.buttons & 4) === 0) {
                // The release happened where no handler saw it, so the first
                // move without the middle button ends the pan.
                this.stopMiddlePan();
            }
            else {
                const position = this.convertPositionToCanvasLocale(e);
                // The grabbed page follows the mouse, so the view scrolls the
                // opposite way.
                app.activeDocument.activeLayout.scroll(this.middlePanPosition[0] - position[0], this.middlePanPosition[1] - position[1], true);
                this.middlePanPosition = position;
                return;
            }
        }
        // Early exit. If mouse is outside and "draggingSomething = false", then there is no reason to check further.
        // Add an exception for leaflet, check after removing it.
        if (!this.mouseIsInside && !this.draggingSomething && !this.isLongPressActive())
            return;
        if (!this.isLongPressActive()) {
            if (!this.touchEventInProgress) {
                this.mousePosition = this.convertPositionToCanvasLocale(e);
                if (this.positionOnMouseDown !== null && !this.draggingSomething) {
                    var dragDistance = [this.mousePosition[0] - this.positionOnMouseDown[0], this.mousePosition[1] - this.positionOnMouseDown[1]];
                    if (Math.abs(dragDistance[0]) >= this.draggingTolerance || Math.abs(dragDistance[1]) >= this.draggingTolerance) {
                        this.draggingSomething = true;
                    }
                }
                var section;
                if (this.draggingSomething) {
                    this.dragDistance = [this.mousePosition[0] - this.positionOnMouseDown[0], this.mousePosition[1] - this.positionOnMouseDown[1]];
                    section = this.getSectionWithName(this.sectionOnMouseDown);
                }
                else {
                    section = this.findSectionContainingPoint(this.mousePosition);
                }
                if (section && section.boundsList) {
                    if (section.name !== this.sectionUnderMouse) {
                        if (this.sectionUnderMouse !== null) {
                            var previousSection = this.getSectionWithName(this.sectionUnderMouse);
                            if (previousSection)
                                this.propagateOnMouseLeave(previousSection, this.convertPositionToSectionLocale(previousSection, this.mousePosition), e);
                        }
                        this.sectionUnderMouse = section.name;
                        this.propagateOnMouseEnter(section, this.convertPositionToSectionLocale(section, this.mousePosition), e);
                    }
                    this.propagateOnMouseMove(section, this.convertPositionToSectionLocale(section, this.mousePosition), this.dragDistance, e);
                }
                else if (this.sectionUnderMouse !== null) {
                    var previousSection = this.getSectionWithName(this.sectionUnderMouse);
                    if (previousSection)
                        this.propagateOnMouseLeave(previousSection, this.convertPositionToSectionLocale(previousSection, this.mousePosition), e);
                    this.sectionUnderMouse = null;
                }
            }
        }
        else {
            this.mousePosition = this.convertPositionToCanvasLocale(e);
            var section = this.findSectionContainingPoint(this.mousePosition);
            if (section) {
                this.stopLongPress();
                this.propagateOnContextMenu(section, this.convertPositionToSectionLocale(section, this.mousePosition), e);
            }
        }
    }
    onMouseDown(e) {
        if (e.button === 1) {
            this.middleButtonDownOnCanvas = true;
            // The hand pointer shows while the mouse is over a hyperlink.
            // Only then does the middle button act as a click that opens
            // the link: consume the press here, before the browser would
            // start the autoscroll.
            this.middleClickOnHyperlink = this.isPointerOverHyperlink();
            if (this.middleClickOnHyperlink) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            // On the overview page the middle button grabs the page: the view
            // follows the mouse while the button stays held. Consuming the
            // press keeps the browser from starting its own autoscroll.
            if (OverviewNavigation.isOverviewActive()) {
                this.startMiddlePan(e);
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            // A middle-button press elsewhere is left to the browser, so
            // pasting the primary selection keeps working, but the paste is
            // that press's own default action - it happens before any event
            // fired after this one, such as auxclick. Move the cell or text
            // cursor to the pointer now, the same as a left click would, so
            // the paste lands there instead of wherever the cursor was left
            // before.
            const mousePosition = this.convertPositionToCanvasLocale(e);
            const section = this.findSectionContainingPoint(mousePosition);
            if (section) {
                this.propagateOnMiddleClick(section, this.convertPositionToSectionLocale(section, mousePosition), e, /* openHyperlink */ false);
            }
            return;
        }
        if (e.button === 0 && !this.touchEventInProgress) {
            // canvas.onmousedown only fires when the pointer is on the canvas,
            // so by definition the mouse is inside.
            this.mouseIsInside = true;
            this.clearMousePositions();
            this.positionOnMouseDown = this.convertPositionToCanvasLocale(e);
            var section = this.findSectionContainingPoint(this.positionOnMouseDown);
            if (section) {
                this.sectionOnMouseDown = section.name;
                this.propagateOnMouseDown(section, this.convertPositionToSectionLocale(section, this.positionOnMouseDown), e);
            }
            /*
                Pressing a button on something that cannot take the keyboard focus leaves the focus
                on the document body, and the handler that sends keys to the document listens
                inside the document container, so a key pressed before the button comes up goes
                nowhere. Escape during a drag is the case that shows it.

                The browser moves the focus as what it does after this handler, so the state to
                look at is the one right afterwards. Take the focus back where it has fallen out of
                the document, and leave it where it sits somewhere on purpose, in a dialog or a
                sidebar.
            */
            app.timerRegistry.setTimeout('focusafterpress', () => {
                if (document.activeElement === document.body)
                    app.map.refocus();
            }, 0);
        }
    }
    onMouseUp(e) {
        if (e.button === 1) {
            if (this.middleButtonDownOnCanvas) {
                this.middleButtonDownOnCanvas = false;
                // The browser pastes the primary selection when the middle
                // button is released. For a press that landed on a
                // hyperlink, consume the release, so the click only opens
                // the link. A press that grabbed the overview page is
                // consumed the same way; the pan state itself stays set
                // until the auxclick that follows this release.
                if (this.middleClickOnHyperlink || this.middlePanPosition !== null) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
            return;
        }
        // Early exit. If mouse down position is not inside the canvas area, we have nothing to check further.
        if (!this.positionOnMouseDown) {
            this.clearMousePositions();
            return;
        }
        if (e.button === 0 && !this.touchEventInProgress) {
            this.positionOnMouseUp = this.convertPositionToCanvasLocale(e);
            var section;
            if (!this.draggingSomething) {
                section = this.findSectionContainingPoint(this.positionOnMouseUp);
            }
            else {
                section = this.getSectionWithName(this.sectionOnMouseDown);
            }
            if (section) {
                this.propagateOnMouseUp(section, this.convertPositionToSectionLocale(section, this.positionOnMouseUp), e);
            }
        }
        if (!this.mouseIsInside) { // Normally, onclick event clears the positions. In this case, onClick won't be fired. So we clear the positions.
            this.clearMousePositions();
        }
    }
    onContextMenu(e) {
        var mousePosition = this.convertPositionToCanvasLocale(e);
        var section = this.findSectionContainingPoint(mousePosition);
        if (section) {
            this.propagateOnContextMenu(section, this.convertPositionToSectionLocale(section, mousePosition), e);
        }
        if (this.isLongPressActive()) {
            // LongPress triggers context menu.
            // We should stop propagating here because we are using different context menu handlers for touch and mouse events.
            // By stopping this event here, we can have real context menus (for mice) and other handlers (for longpress) at the same time (see Control.RowHeader.js).
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }
    extendAnimationDuration(extendMs) {
        if (this.getAnimatingSectionName()) { // Is animating.
            this.duration += extendMs;
        }
    }
    getAnimationDuration() {
        return this.duration;
    }
    getScrollLineHeight() {
        return this.scrollLineHeight;
    }
    onMouseWheel(e) {
        if (app.map && app.map.tooltip)
            app.map.tooltip.hide();
        var point = this.convertPositionToCanvasLocale(e);
        var delta;
        if (e.deltaMode === WheelEvent.DOM_DELTA_LINE)
            delta = [e.deltaX * this.scrollLineHeight, e.deltaY * this.scrollLineHeight];
        else
            delta = [e.deltaX, e.deltaY];
        var section = this.findSectionContainingPoint(point);
        if (section)
            this.propagateOnMouseWheel(section, this.convertPositionToSectionLocale(section, point), delta, e);
        app.idleHandler.notifyActive();
    }
    onMouseLeave(e) {
        // While dragging something, we don't clear the event information even if the mouse is outside of the canvas area.
        // We catch the mouse move and mouse up events even when the mouse pointer is outside the canvas area.
        // This feature is enabled to create a better dragging experience.
        if (!this.draggingSomething) {
            if (this.sectionUnderMouse !== null) {
                var section = this.getSectionWithName(this.sectionUnderMouse);
                if (section)
                    this.propagateOnMouseLeave(section, null, e);
                this.sectionUnderMouse = null;
            }
            this.clearMousePositions();
            this.mousePosition = null;
        }
        this.mouseIsInside = false;
    }
    onMouseEnter(e) {
        this.mouseIsInside = true;
        for (var i = 0; i < this.windowSectionList.length; i++) {
            var windowSection = this.windowSectionList[i];
            if (windowSection.interactable)
                windowSection.onMouseEnter(null, e);
        }
    }
    // When the browser window/tab loses focus during a drag, we never receive the mouseup event.
    // This leaves draggingSomething=true and sections (e.g. MouseControl) never send 'buttonup' to the core.
    // This may cause a stuck selection in some cases.
    onWindowBlur() {
        if (!this.draggingSomething)
            return;
        // Propagate a synthetic mouseUp to the section that received the original
        // mouseDown so it can clean up (e.g. MouseControl sends 'buttonup' to core).
        if (this.sectionOnMouseDown) {
            var section = this.getSectionWithName(this.sectionOnMouseDown);
            if (section) {
                var position = this.positionOnMouseUp || this.mousePosition || this.positionOnMouseDown;
                // Create a synthetic MouseEvent so section handlers can safely access
                // event properties (e.g. stopPropagation, modifiers).
                var syntheticEvent = new MouseEvent('mouseup', { button: 0, buttons: 0 });
                this.propagateOnMouseUp(section, this.convertPositionToSectionLocale(section, position), syntheticEvent);
            }
        }
        this.clearMousePositions();
        this.mousePosition = null;
        this.mouseIsInside = false;
    }
    onTouchStart(e) {
        if (e.touches.length === 1) {
            this.clearMousePositions();
            this.startLongPress(e);
            this.positionOnMouseDown = this.convertPositionToCanvasLocale(e);
            var section = this.findSectionContainingPoint(this.positionOnMouseDown);
            if (section) {
                this.sectionOnMouseDown = section.name;
                this.propagateOnMouseDown(section, this.convertPositionToSectionLocale(section, this.positionOnMouseDown), e);
            }
        }
        else if (!this.multiTouch) {
            this.stopLongPress();
            this.multiTouch = true;
            var section = this.getSectionWithName(this.sectionOnMouseDown);
            if (section)
                this.propagateOnMultiTouchStart(section, e);
        }
    }
    onTouchMove(e) {
        // Sometimes onTouchStart is fired for another element. In this case, we return.
        if (this.positionOnMouseDown === null)
            return;
        this.stopLongPress();
        if (!this.multiTouch) {
            this.mousePosition = this.convertPositionToCanvasLocale(e);
            this.dragDistance = [this.mousePosition[0] - this.positionOnMouseDown[0], this.mousePosition[1] - this.positionOnMouseDown[1]];
            if (this.dragDistance[0] ** 2 + this.dragDistance[1] ** 2 > 0.1)
                this.draggingSomething = true;
            var section = this.getSectionWithName(this.sectionOnMouseDown);
            if (section) {
                this.propagateOnMouseMove(section, this.convertPositionToSectionLocale(section, this.mousePosition), this.dragDistance, e);
            }
        }
        else if (e.touches.length === 2) {
            var section = this.getSectionWithName(this.sectionOnMouseDown);
            if (section) {
                var diffX = Math.abs(e.touches[0].clientX - e.touches[1].clientX);
                var diffY = Math.abs(e.touches[0].clientY - e.touches[1].clientY);
                // Let's keep "touchCenter" variable "static" for now. When we want to allow move & drag at the same time, we should make it dynamic again.
                if (!this.touchCenter) {
                    this.touchCenter = [(e.touches[0].clientX + e.touches[1].clientX) * 0.5, (e.touches[0].clientY + e.touches[1].clientY) * 0.5];
                    this.touchCenter = this.convertPointToCanvasLocale(this.touchCenter);
                }
                var distance = Math.sqrt(Math.pow(diffX, 2) + Math.pow(diffY, 2));
                this.propagateOnMultiTouchMove(section, this.convertPositionToSectionLocale(section, this.touchCenter), distance, e);
            }
        }
        app.idleHandler.notifyActive();
    }
    onTouchEnd(e) {
        this.stopLongPress();
        if (!this.multiTouch) {
            this.positionOnMouseUp = this.convertPositionToCanvasLocale(e);
            var section;
            if (!this.draggingSomething) {
                section = this.findSectionContainingPoint(this.positionOnMouseUp);
            }
            else {
                section = this.getSectionWithName(this.sectionOnMouseDown);
            }
            if (section) {
                this.propagateOnMouseUp(section, this.convertPositionToSectionLocale(section, this.positionOnMouseUp), e);
            }
        }
        else if (e.touches.length === 0) {
            this.multiTouch = false;
            var section = this.getSectionWithName(this.sectionOnMouseDown);
            if (section) {
                this.propagateOnMultiTouchEnd(section, e);
            }
        }
        this.touchEventInProgress = true;
    }
    onTouchCancel(e) {
        this.clearMousePositions();
        this.stopLongPress();
    }
    // A drag that carries one of these types is a slide preview being reordered in the slide
    // sorter, or a thumbnail brought in from the slide import pane; the document area takes no
    // drops from either.
    isSlideDrag(e) {
        if (!e.dataTransfer || !e.dataTransfer.types)
            return false;
        return (e.dataTransfer.types.includes('application/x-cool-slide') ||
            e.dataTransfer.types.includes('application/x-cool-slide-import'));
    }
    onDragOver(e) {
        if (this.isSlideDrag(e))
            return;
        // This is necessary to prevent window from taking the dropped object.
        e.preventDefault();
    }
    onDrop(e) {
        if (this.isSlideDrag(e))
            return;
        e.preventDefault();
        const point = this.convertPositionToCanvasLocale(e);
        const target = this.findSectionContainingPoint(point);
        if (target)
            this.propagateOnDrop(target, this.convertPositionToSectionLocale(target, point), e);
        this.clearMousePositions();
    }
    onResize(newWidth, newHeight) {
        var container = this.canvas.parentNode;
        var cRect = container.getBoundingClientRect();
        if (!newWidth)
            newWidth = cRect.right - cRect.left;
        if (!newHeight)
            newHeight = cRect.bottom - cRect.top;
        app.dpiScale = window.devicePixelRatio;
        app.roundedDpiScale = Math.round(window.devicePixelRatio);
        newWidth = Math.floor(newWidth * app.dpiScale);
        newHeight = Math.floor(newHeight * app.dpiScale);
        if (this.width === newWidth && this.height === newHeight && this.documentAnchor) {
            this.reNewAllSections(false);
            return;
        }
        if (!this.draggingSomething)
            this.clearMousePositions();
        this.width = newWidth;
        this.height = newHeight;
        this.needsResize = true;
        this.reNewAllSections(true);
    }
    findSectionContainingPoint(point, interactable = true) {
        for (var i = this.sections.length - 1; i > -1; i--) { // Search from top to bottom. Top section will be sent as target section.
            if (this.sections[i].isLocated && !this.sections[i].windowSection &&
                this.sections[i].showSection &&
                (!this.sections[i].documentObject || this.sections[i].isVisible) &&
                this.doesSectionIncludePoint(this.sections[i], point)
                && (interactable ? this.sections[i].interactable : true))
                return this.sections[i];
        }
        return null;
    }
    doesSectionIncludePoint(section, point) {
        // use isHit from section, that does check against bounds of local range (position, size)
        return section.isHit(point);
    }
    doSectionsIntersectOnYAxis(section1, section2) {
        var y11 = section1.myTopLeft[1];
        var y12 = section1.myTopLeft[1] + section1.size[1];
        var y21 = section2.myTopLeft[1];
        var y22 = section2.myTopLeft[1] + section2.size[1];
        if (((y11 >= y21 && y11 <= y22) || (y12 >= y21 && y12 <= y22)) || ((y21 >= y11 && y21 <= y12) || (y22 >= y11 && y22 <= y12)))
            return true;
        else
            return false;
    }
    doSectionsIntersectOnXAxis(section1, section2) {
        var x11 = section1.myTopLeft[0];
        var x12 = section1.myTopLeft[0] + section1.size[0];
        var x21 = section2.myTopLeft[0];
        var x22 = section2.myTopLeft[0] + section2.size[0];
        if (((x11 >= x21 && x11 < x22) || (x12 >= x21 && x12 <= x22)) || ((x21 >= x11 && x21 <= x12) || (x22 >= x11 && x22 <= x12)))
            return true;
        else
            return false;
    }
    // Find the left most point from a position with same zIndex.
    hitLeft(section) {
        var maxX = -Infinity;
        for (var i = 0; i < this.sections.length; i++) {
            if (this.sections[i].isLocated && this.sections[i].zIndex === section.zIndex && this.sections[i].name !== section.name) {
                var currentLeft = this.sections[i].myTopLeft[0] + this.sections[i].size[0];
                if (currentLeft > maxX && currentLeft < section.myTopLeft[0]) {
                    if (this.doSectionsIntersectOnYAxis(this.sections[i], section)) {
                        maxX = currentLeft;
                    }
                }
            }
        }
        if (maxX === -Infinity)
            return 0; // There is nothing on the left of this section.
        else
            return maxX + app.roundedDpiScale; // Don't overlap with the section on the left.
    }
    // Find the right most point from a position with same zIndex.
    hitRight(section) {
        var minX = Infinity;
        for (var i = 0; i < this.sections.length; i++) {
            if (this.sections[i].isLocated && this.sections[i].zIndex === section.zIndex && this.sections[i].name !== section.name) {
                var currentRight = this.sections[i].myTopLeft[0];
                if (currentRight < minX && currentRight > section.myTopLeft[0]) {
                    if (this.doSectionsIntersectOnYAxis(this.sections[i], section)) {
                        minX = currentRight;
                    }
                }
            }
        }
        if (minX === Infinity)
            return this.width; // There is nothing on the right of this section.
        else
            return minX - app.roundedDpiScale; // Don't overlap with the section on the right.
    }
    // Find the top most point from a position with same zIndex.
    hitTop(section) {
        var maxY = -Infinity;
        for (var i = 0; i < this.sections.length; i++) {
            if (this.sections[i].isLocated && this.sections[i].zIndex === section.zIndex && this.sections[i].name !== section.name) {
                var currentTop = this.sections[i].myTopLeft[1] + this.sections[i].size[1];
                if (currentTop > maxY && currentTop < section.myTopLeft[1]) {
                    if (this.doSectionsIntersectOnXAxis(this.sections[i], section)) {
                        maxY = currentTop;
                    }
                }
            }
        }
        if (maxY === -Infinity)
            return 0; // There is nothing on the left of this section.
        else
            return maxY + app.roundedDpiScale; // Don't overlap with the section on the top.
    }
    // Find the bottom most point from a position with same zIndex.
    hitBottom(section) {
        var minY = Infinity;
        for (var i = 0; i < this.sections.length; i++) {
            if (this.sections[i].isLocated && this.sections[i].zIndex === section.zIndex && this.sections[i].name !== section.name) {
                var currentBottom = this.sections[i].myTopLeft[1];
                if (currentBottom < minY && currentBottom > section.myTopLeft[1]) {
                    if (this.doSectionsIntersectOnXAxis(this.sections[i], section)) {
                        minY = currentBottom;
                    }
                }
            }
        }
        if (minY === Infinity)
            return this.height; // There is nothing on the left of this section.
        else
            return minY - app.roundedDpiScale; // Don't overlap with the section on the bottom.
    }
    createUpdateSingleDivElement(section) {
        var bcr = this.canvas.getBoundingClientRect();
        var element = document.getElementById('test-div-' + section.name);
        if ((!section.documentObject || section.isVisible) && section.isSectionShown() && section.myTopLeft) {
            if (!element) {
                element = document.createElement('div');
                element.id = 'test-div-' + section.name;
                document.body.appendChild(element);
            }
            element.style.position = 'fixed';
            element.style.zIndex = '-1';
            element.style.left = String(bcr.left + Math.round(section.myTopLeft[0] / app.dpiScale)) + 'px';
            element.style.top = String(bcr.top + Math.round(section.myTopLeft[1] / app.dpiScale)) + 'px';
            element.style.width = String(Math.round(section.size[0] / app.dpiScale)) + 'px';
            element.style.height = String(Math.round(section.size[1] / app.dpiScale)) + 'px';
            if (section.name === 'tiles') {
                // For tiles section add document coordinates of top and left too.
                element.innerText = JSON.stringify({
                    top: Math.round(app.activeDocument.activeLayout.viewedRectangle.pY1),
                    left: Math.round(app.activeDocument.activeLayout.viewedRectangle.pX1),
                    width: Math.round(section.size[0]),
                    height: Math.round(section.size[1])
                });
            }
        }
        else if (element)
            element.remove(); // Remove test-div if section is not visible.
    }
    createUpdateDivElements() {
        for (var i = 0; i < this.sections.length; i++) {
            this.createUpdateSingleDivElement(this.sections[i]);
        }
    }
    reNewAllSections(redraw = true) {
        this.orderSections();
        this.locateSections();
        for (var i = 0; i < this.sections.length; i++) {
            this.sections[i].onResize();
        }
        this.applyDrawingOrders();
        if (this.testing)
            this.createUpdateDivElements();
        if (redraw && this.drawingAllowed())
            this.requestReDraw();
        else if (!this.drawingEnabled)
            // Size backing store before WebKit's first composite, else canvas stays blurry until a later resize (Skyler f69d2fd / Andras 8f67b845).
            this.resizeCanvas();
    }
    roundPositionAndSize(section) {
        section.myTopLeft[0] = Math.round(section.myTopLeft[0]);
        section.myTopLeft[1] = Math.round(section.myTopLeft[1]);
        section.size[0] = Math.round(section.size[0]);
        section.size[1] = Math.round(section.size[1]);
    }
    calculateSectionInitialPosition(section, index) {
        if (typeof section.anchor[index] === 'string' || section.anchor[index].length === 1) {
            const anchor = typeof section.anchor[index] === 'string' ? section.anchor[index] : section.anchor[index][0];
            if (index === 0)
                return anchor === 'top' ? section.position[1] : (this.height - (section.position[1] + section.size[1]));
            else
                return anchor === 'left' ? section.position[0] : (this.width - (section.position[0] + section.size[0]));
        }
        else {
            // If we are here, it means section's edge(s) will be snapped to another section's edges.
            // Count should always be an odd number. Because last variable will be used as a fallback to canvas's edges (top, bottom, right or left).
            // See anchor explanation on top of this file.
            // Correct example: ["header", "bottom", "top"] => Look for section "header", if found, use its bottom, if not found, use canvas's top.
            if (section.anchor[index].length % 2 === 0) { // eslint-disable-line no-lonely-if
                console.error('Section: ' + section.name + '. Wrong anchor definition.');
                return 0;
            }
            else {
                var count = section.anchor[index].length;
                var targetSection = null;
                var targetEdge = null;
                for (var i = 0; i < count - 1; i++) {
                    targetSection = this.getSectionWithName(section.anchor[index][i]);
                    if (targetSection) {
                        targetEdge = section.anchor[index][i + 1];
                        break;
                    }
                }
                if (targetSection) {
                    // So, we have target section, we will use its position. Is it located?
                    if (!targetSection.isLocated) {
                        console.error('Section: ' + section.name + '. Target section for anchor should be located before this section.'
                            + ' It means that target section\'s (if zIndex is the same) processing order should be less or its zIndex should be less than this section.');
                        return 0;
                    }
                    else {
                        if (targetEdge === 'top') { // eslint-disable-line no-lonely-if
                            return targetSection.myTopLeft[1] - app.roundedDpiScale;
                        }
                        else if (targetEdge === 'bottom') {
                            return targetSection.myTopLeft[1] + targetSection.size[1] + app.roundedDpiScale;
                        }
                        else if (targetEdge === 'left') {
                            return targetSection.myTopLeft[0] - app.roundedDpiScale;
                        }
                        else if (targetEdge === 'right') {
                            return targetSection.myTopLeft[0] + targetSection.size[0] + app.roundedDpiScale;
                        }
                        else if (targetEdge === '-left') {
                            if (section.expand[0] === 'left' && section.origSizeHint) {
                                section.size[0] = section.origSizeHint[0];
                            }
                            return targetSection.myTopLeft[0] - section.size[0];
                        }
                    }
                }
                else {
                    // No target section is found. Use fallback.
                    const anchor = section.anchor[index][count - 1];
                    if (index === 0) {
                        return anchor === 'top' ? section.position[1] : (this.height - (section.position[1] + section.size[1]));
                    }
                    else {
                        return anchor === 'left' ? section.position[0] : (this.width - (section.position[0] + section.size[0]));
                    }
                }
            }
        }
    }
    expandSection(section) {
        if (section.expand.includes('left')) {
            var initialX = section.myTopLeft[0];
            section.myTopLeft[0] = this.hitLeft(section);
            section.size[0] = initialX - section.myTopLeft[0];
        }
        if (section.expand.includes('right')) {
            section.size[0] = this.hitRight(section) - section.myTopLeft[0];
        }
        if (section.expand.includes('top')) {
            var initialY = section.myTopLeft[1];
            section.myTopLeft[1] = this.hitTop(section);
            section.size[1] = initialY - section.myTopLeft[1];
        }
        if (section.expand.includes('bottom')) {
            section.size[1] = this.hitBottom(section) - section.myTopLeft[1];
        }
    }
    locateSections() {
        for (var i = 0; i < this.sections.length; i++) {
            const section = this.sections[i];
            // Reset some values.
            section.isLocated = false;
            section.myTopLeft = null;
            // Preserve the original size hint
            if (typeof section.origSizeHint === 'undefined') {
                section.origSizeHint = [...section.size];
            }
        }
        this.documentAnchor = null;
        this.windowSectionList = [];
        for (var i = 0; i < this.sections.length; i++) {
            const section = this.sections[i];
            if (section.documentObject === true) { // "Document anchor" section should be processed before "document object" sections.
                if (section.size && section.position) {
                    section.isLocated = true;
                    section.myTopLeft = [section.documentPosition.vX, section.documentPosition.vY];
                }
            }
            else if (section.boundToSection) { // Don't set boundToSection property for "window sections".
                var parentSection = this.getSectionWithName(section.boundToSection);
                if (parentSection) {
                    section.myTopLeft = [0, 0];
                    section.size = [0, 0];
                    section.size[0] = parentSection.size[0];
                    section.size[1] = parentSection.size[1];
                    section.myTopLeft[0] = parentSection.myTopLeft[0];
                    section.myTopLeft[1] = parentSection.myTopLeft[1];
                    this.roundPositionAndSize(section);
                    section.isLocated = true;
                }
            }
            else if (section.windowSection) {
                section.myTopLeft = [0, 0];
                section.size = [this.width, this.height];
                section.isLocated = true;
                this.windowSectionList.push(section);
            }
            else { // A regular UI element.
                section.myTopLeft = [this.calculateSectionInitialPosition(section, 1), this.calculateSectionInitialPosition(section, 0)];
                if (section.expand.length !== 0)
                    this.expandSection(section);
                this.roundPositionAndSize(section);
                section.isLocated = true;
            }
            if (section.name === this.documentAnchorSectionName) {
                this.documentAnchor = [section.myTopLeft[0], section.myTopLeft[1]];
                if (app.activeDocument?.activeLayout)
                    app.activeDocument.activeLayout.documentAnchorPosition = this.documentAnchor.slice();
            }
        }
    }
    orderSections() {
        // According to zIndex & processing order.
        function compareSections(a, b) {
            var zIndexDiff = a.zIndex - b.zIndex;
            if (zIndexDiff != 0)
                return zIndexDiff;
            return a.processingOrder - b.processingOrder;
        }
        this.sections.sort(compareSections);
    }
    applyDrawingOrders() {
        // According to zIndex, drawing order & processing order.
        // Section with the highest drawing order will be drawn on top (inside same zIndex).
        function compareSections(a, b) {
            var zIndexDiff = a.zIndex - b.zIndex;
            if (zIndexDiff != 0)
                return zIndexDiff;
            var drawingOrderDiff = a.drawingOrder - b.drawingOrder;
            if (drawingOrderDiff != 0)
                return drawingOrderDiff;
            return a.processingOrder - b.processingOrder;
        }
        this.sections.sort(compareSections);
    }
    drawSectionBorders() {
        this.context.lineWidth = 2 * app.dpiScale;
        this.context.strokeStyle = 'blue';
        for (var i = 0; i < this.sections.length; i++) {
            var section = this.sections[i];
            const multiplier = section.documentObject && app.map._docLayer.isCalcRTL() ? -1 : 1;
            if (section.isLocated && section.showSection && (!section.documentObject || section.isVisible)) {
                var xStart = section.myTopLeft[0];
                var xEnd = xStart + section.size[0] * multiplier;
                var yStart = section.myTopLeft[1];
                var yEnd = yStart + section.size[1];
                this.context.beginPath();
                this.context.moveTo(xStart, yStart);
                this.context.lineTo(xEnd, yStart);
                this.context.stroke();
                this.context.beginPath();
                this.context.moveTo(xEnd, yStart);
                this.context.lineTo(xEnd, yEnd);
                this.context.stroke();
                this.context.beginPath();
                this.context.moveTo(xEnd, yEnd);
                this.context.lineTo(xStart, yEnd);
                this.context.stroke();
                this.context.beginPath();
                this.context.moveTo(xStart, yEnd);
                this.context.lineTo(xStart, yStart);
                this.context.stroke();
            }
        }
    }
    setPenPosition(section) {
        this.context.setTransform(1, 0, 0, 1, 0, 0);
        this.context.translate(section.myTopLeft[0], section.myTopLeft[1]);
    }
    shouldDrawSection(section) {
        return section.isLocated && section.showSection && (!section.documentObject || section.isVisible);
    }
    drawSections(frameCount = null, elapsedTime = null) {
        // Un-comment to debug duplicate rendering problems:
        // const stack = new Error().stack;
        // console.log("Draw sections:\n", stack);
        if (app.map && app.map._debug)
            app.map._debug.setOverlayMessage('top-frames', 'Frames: ' + this.framesRendered++);
        this.context.setTransform(1, 0, 0, 1, 0, 0);
        this.clearCanvas();
        this.context.font = String(20 * app.dpiScale) + 'px Verdana';
        for (var i = 0; i < this.sections.length; i++) {
            const section = this.sections[i];
            if (this.shouldDrawSection(section)) {
                if (section.backgroundColor) {
                    this.context.globalAlpha = section.backgroundOpacity;
                    this.context.fillStyle = section.backgroundColor;
                    if (section.documentObject)
                        section.drawViewRectangle(section.boundingRectangle, true);
                    else
                        this.context.fillRect(section.myTopLeft[0], section.myTopLeft[1], section.size[0], section.size[1]);
                    this.context.globalAlpha = 1;
                }
                this.context.translate(section.myTopLeft[0], section.myTopLeft[1]);
                section.onDraw(frameCount, elapsedTime);
                if (section.borderColor) { // If section's border is set, draw its borders after section's "onDraw" function is called.
                    var offset = section.getLineOffset();
                    this.context.lineWidth = section.getLineWidth();
                    this.context.strokeStyle = section.borderColor;
                    this.context.strokeRect(offset, offset, section.size[0], section.size[1]);
                }
                this.context.translate(-section.myTopLeft[0], -section.myTopLeft[1]);
            }
        }
        //this.drawSectionBorders();
    }
    isMouseInside() {
        return this.mouseIsInside;
    }
    doesSectionExist(name) {
        if (name && typeof name === 'string') {
            return this.sectionsByName.has(name);
        }
        else {
            return false;
        }
    }
    checkNewSectionName(options) {
        if (options.name !== undefined && typeof options.name === 'string' && options.name.trim() !== '') {
            if (this.doesSectionExist(options.name)) {
                console.error('There is a section with the same name: ' + options.name + '. Use doesSectionExist for existancy checks.');
                return false;
            }
            else if (['top', 'left', 'bottom', 'right'].includes(options.name.trim())) {
                console.error('"top", "left", "bottom" and "right" words are reserved. Choose another name for the section.');
                return false;
            }
            else {
                return true;
            }
        }
        else {
            console.error('Sections should have a "name" property.');
            return false;
        }
    }
    checkSectionProperties(options) {
        if (options.anchor === undefined
            || options.position === undefined
            || options.size === undefined
            || options.expand === undefined
            || options.processingOrder === undefined
            || options.drawingOrder === undefined
            || options.zIndex === undefined
            || options.interactable === undefined) {
            console.error('Section has missing properties. See "checkSectionProperties" function.');
            return false;
        }
        else {
            if (options.showSection === undefined)
                options.showSection = true;
            if (options.windowSection === undefined)
                options.windowSection = false;
            return true;
        }
    }
    newSectionChecks(options) {
        if (!this.checkNewSectionName(options))
            return false;
        else if (!this.checkSectionProperties(options))
            return false;
        else
            return true;
    }
    addSectionFunctions(section) {
        // This is to be removed to a better place.
        section.isCalcRTL = function () {
            const docLayer = this.sectionProperties.docLayer;
            if (docLayer && docLayer.isCalcRTL())
                return true;
            return false;
        }.bind(section);
    }
    addSection(newSection) {
        if (this.newSectionChecks(newSection)) {
            this.pushSection(newSection);
            return true;
        }
        else {
            return false;
        }
    }
    pushSection(newSection) {
        // Every section can draw from Point(0, 0), their drawings will be translated to myTopLeft position.
        newSection.context = this.context;
        newSection.containerObject = this;
        newSection.sectionProperties.section = newSection;
        this.sections.push(newSection);
        this.sectionsByName.set(newSection.name, newSection);
        this.addSectionFunctions(newSection);
        newSection.onInitialize();
        if (this.drawingAllowed()) {
            this.updateBoundSectionLists();
            this.reNewAllSections();
        }
        else
            this.sectionsDirty = true;
    }
    removeSection(name) {
        var found = false;
        for (var i = 0; i < this.sections.length; i++) {
            if (this.sections[i].name === name) {
                var element = document.getElementById('test-div-' + this.sections[i].name);
                if (element) // Remove test div if exists.
                    document.body.removeChild(element);
                this.sections[i].onRemove();
                this.sectionsByName.delete(name);
                this.sections[i] = null;
                this.sections.splice(i, 1);
                found = true;
                break;
            }
        }
        if (found) {
            if (!this.drawingAllowed())
                this.sectionsDirty = true;
            else {
                this.updateBoundSectionLists();
                this.reNewAllSections();
            }
            return true;
        }
        else {
            return false;
        }
    }
    setAnimatingSectionName(sectionName) {
        this.animatingSectionName = sectionName;
    }
    getAnimatingSectionName() {
        return this.animatingSectionName;
    }
    animate(timeStamp) {
        app.enterRAF();
        if (this.lastFrameStamp > 0)
            this.elapsedTime += Math.max(0, timeStamp - this.lastFrameStamp);
        this.lastFrameStamp = timeStamp;
        if (this.duration && this.elapsedTime >= this.duration) { // This is not the only place that can set "continueAnimating" to "false".
            this.continueAnimating = false;
        }
        var section = this.getSectionWithName(this.getAnimatingSectionName());
        if (this.continueAnimating) {
            if (section)
                section.onAnimate(this.frameCount, this.elapsedTime);
            this.frameCount++;
            this.requestReDraw();
        }
        else {
            if (section) {
                section.isAnimating = false;
                section.onAnimationEnded(this.frameCount, this.elapsedTime);
            }
            this.setAnimatingSectionName(null);
            this.frameCount = this.elapsedTime = null;
        }
        app.exitRAF();
    }
    // Resets animation duration. Not to be called directly. Instead, use (inside section class) this.resetAnimation()
    resetAnimation(sectionName) {
        if (sectionName === this.getAnimatingSectionName()) {
            this.lastFrameStamp = 0;
            this.elapsedTime = 0;
            this.frameCount = 0;
        }
    }
    stopAnimating() {
        // Though this function is available for every section, generally, only the section that started animation should use this.
        this.continueAnimating = false;
    }
    // Don't call this directly. Instead, call (inside the section class) section.startAnimating(options).
    startAnimating(sectionName, options) {
        /*
            Most of the time, we need to draw entire canvas when animating.
            Because if there is another section under the animated one, that section needs to be renewed too.
            Also, sections may need to be redrawn because of the updated view (while animating).
            This animation feature re-draws all sections with requestAnimationFrame.
            Developer can set options to ensure the animation stops at certain point.
            If your section's "onDraw" function is given the variables "frameCount, elapsedTime", then you can assume that CanvasSectionContainer is in animation mode.
            You can also check getAnimatingSectionName function of container class (if it is null or not) to see if animating is on.

            Sections other than the one which started the animation, can't know when the animation will stop.

            The section which started the animation => "(inside section class) this.containerObject.getAnimatingSectionName()".

            For now, only one section can start animations at a time.

            options (possible values are separated by the '|' char):
                // Developer can set the duration for the animation, in milliseconds. There are also other ways to stop the animation.
                duration: 2000 | null // 2 seconds | null.
                // The animation can start after a requestAnimationFrame
                defer: boolean
        */
        if (!this.getAnimatingSectionName()) {
            this.setAnimatingSectionName(sectionName);
            this.getSectionWithName(sectionName).isAnimating = true;
            this.lastFrameStamp = 0;
            this.continueAnimating = true;
            this.duration = options.duration ? options.duration : null;
            this.elapsedTime = 0;
            this.frameCount = 0;
            if (options.defer)
                requestAnimationFrame(this.animate.bind(this));
            else
                this.animate(document.timeline.currentTime);
            return true;
        }
        else {
            return false;
        }
    }
}
