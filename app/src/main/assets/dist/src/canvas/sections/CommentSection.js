// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
// By default DOMPurify will strip all targets, so set everything
// as target=_blank with rel=noopener
DOMPurify.addHook('afterSanitizeAttributes', function (node) {
    if (node.tagName === 'A' && !node.classList.contains('context-menu-link')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener');
    }
});
var cool;
(function (cool) {
    /*
        data.layoutStatus: Enumartion sent from the core side.
        0: INVISIBLE, 1: VISIBLE, 2: INSERTED, 3: DELETED, 4: NONE, 5: HIDDEN
        Ex: "DELETED" means that the comment is deleted while the "track changes" is on.
    */
    let CommentLayoutStatus;
    (function (CommentLayoutStatus) {
        CommentLayoutStatus[CommentLayoutStatus["INVISIBLE"] = 0] = "INVISIBLE";
        CommentLayoutStatus[CommentLayoutStatus["VISIBLE"] = 1] = "VISIBLE";
        CommentLayoutStatus[CommentLayoutStatus["INSERTED"] = 2] = "INSERTED";
        CommentLayoutStatus[CommentLayoutStatus["DELETED"] = 3] = "DELETED";
        CommentLayoutStatus[CommentLayoutStatus["NONE"] = 4] = "NONE";
        CommentLayoutStatus[CommentLayoutStatus["HIDDEN"] = 5] = "HIDDEN";
    })(CommentLayoutStatus = cool.CommentLayoutStatus || (cool.CommentLayoutStatus = {}));
    class Comment extends CanvasSectionObject {
        // Cache the expensive to localize frequently created strings
        static { this.editCommentLabel = _('Edit comment'); }
        static { this.replyCommentLabel = _('Reply comment'); }
        static { this.openMenuLabel = _('Open menu'); }
        // Typing and pointing inside a comment card mean the user is still working. Pointer
        // movement stays out of this list, because a comment that moves under a resting pointer
        // produces it on its own.
        static { this.activityEvents = ['input', 'keydown', 'mousedown', 'touchstart']; }
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        static makeName(data) {
            return data.id === 'new' ? 'new comment' : 'comment ' + data.id;
        }
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        constructor(name, data, options, commentListSectionPointer) {
            super(name);
            this.processingOrder = app.CSections.Comment.processingOrder;
            this.drawingOrder = app.CSections.Comment.drawingOrder;
            this.zIndex = app.CSections.Comment.zIndex;
            this.valid = true;
            this.pendingInit = true;
            this.cachedCommentHeight = null;
            this.cachedIsEdit = false;
            this.hidden = null;
            this.containerPosX = 0;
            this.containerPosY = 0;
            // Final top after clamping (canvas-relative CSS px), so children can follow a clamped parent.
            this.renderedPosY = 0;
            // Height the card had when its position was last worked out, or null while no clamped
            // position has been worked out yet.
            this.positionedHeight = null;
            this.canvasContainerBounds = new DOMRect();
            // True while the text that selectText selected still has to be scrolled into view.
            this.searchSelectionPending = false;
            this.myTopLeft = [0, 0];
            this.documentObject = true;
            this.map = window.L.Map.THIS;
            if (!options)
                options = {};
            this.sectionProperties.commentListSection = commentListSectionPointer;
            this.sectionProperties.docLayer = this.map._docLayer;
            this.sectionProperties.selectedAreaPoint = null;
            this.sectionProperties.cellCursorPoint = null;
            this.sectionProperties.draggingStarted = false;
            this.sectionProperties.dragStartPosition = null;
            this.sectionProperties.minWidth = options.minWidth ? options.minWidth : 160;
            this.sectionProperties.maxHeight = options.maxHeight ? options.maxHeight : 50;
            this.sectionProperties.imgSize = options.imgSize ? options.imgSize : [32, 32];
            this.sectionProperties.margin = options.margin ? options.margin : [40, 40];
            this.sectionProperties.noMenu = options.noMenu ? options.noMenu : false;
            if (data.parent === undefined)
                data.parent = '0';
            this.setData(data);
            /*
                possibleParentCommentId:
                    * User deletes a parent comment.
                    * User deletes also its child comment.
                    * User reverts the last change (deletion of child comment).
                    * A comment "Add" action is sent from the core side.
                    * The child comment has also its parent id.
                    * But there is no such parent at the moment.
                    * So we will remember its possible parent comment in case user also reverts the deletion of parent comment.
                    * In that case, parent comment will come with its old id.
                    * Child comment can now find its parent.
                    * We will check child comment to see if its parent has also been revived.
            */
            this.sectionProperties.possibleParentCommentId = null;
            this.sectionProperties.wrapper = null;
            this.sectionProperties.container = null;
            this.sectionProperties.author = null;
            this.sectionProperties.resolvedTextElement = null;
            this.sectionProperties.removedTextElement = null;
            this.sectionProperties.authorAvatarImg = null;
            this.sectionProperties.authorAvatartdImg = null;
            this.sectionProperties.contentAuthor = null;
            this.sectionProperties.contentDate = null;
            this.sectionProperties.acceptButton = null;
            this.sectionProperties.rejectButton = null;
            this.sectionProperties.menu = null;
            this.sectionProperties.menuBarCell = null;
            this.sectionProperties.captionNode = null;
            this.sectionProperties.captionText = null;
            this.sectionProperties.contentNode = null;
            this.sectionProperties.nodeModify = null;
            this.sectionProperties.nodeModifyText = null;
            this.sectionProperties.saveButton = null;
            this.sectionProperties.cancelButton = null;
            this.sectionProperties.replyButton = null;
            this.sectionProperties.cancelReplyButton = null;
            this.sectionProperties.statusNode = null;
            this.sectionProperties.statusTimer = null;
            this.sectionProperties.contentText = null;
            this.sectionProperties.lastContentRaw = '';
            this.sectionProperties.nodeReply = null;
            this.sectionProperties.nodeReplyText = null;
            this.sectionProperties.contextMenu = false;
            this.sectionProperties.highlightedTextColor = '#777777'; // Writer.
            this.sectionProperties.usedTextColor = this.sectionProperties.data.color; // Writer.
            this.sectionProperties.showSelectedCoordinate = true; // Writer.
            if (app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing') {
                this.sectionProperties.part = this.sectionProperties.data.part;
                this.sectionProperties.partIndex = app.impress.getIndexFromPart(this.sectionProperties.part);
            }
            this.sectionProperties.isHighlighted = false;
            this.sectionProperties.commentContainerRemoved = false;
            this.sectionProperties.children = []; // This is used for Writer comments. There is parent / child relationship between comments in Writer files.
            this.sectionProperties.childLinesNode = null;
            this.sectionProperties.childLines = [];
            this.sectionProperties.childCommentOffset = 24;
            this.sectionProperties.commentMarkerSubSection = null; // For Impress and Draw documents.
            this.sectionProperties.commentAnchorAreaSubSection = null; // For comments with an explicit anchor area (PDF /Rect, drag-to-area).
            this.sectionProperties.calcCommentAreaWidth = 40; // Calc comment area doesn't cover the whole cell, in order to allow multi-cell selections.
            app.map.on('sheetgeometrychanged', this.setPositionAndSize.bind(this));
        }
        // Comments import can be costly if the document has a lot of them. If they are all imported/initialized
        // when online gets comments message from core, the initial doc render is delayed. To avoid that we do
        // lazy import of each comment when it needs to be shown (based on its coordinates).
        doPendingInitializationInView(force = false) {
            if (!this.pendingInit)
                return;
            if (!force) {
                if (!this.convertRectanglesToViewCoordinates())
                    return;
                // skip comments on other tabs than the current
                if (app.map._docLayer._docType === 'spreadsheet' && parseInt(this.sectionProperties.data.tab) !== app.map._docLayer._selectedPart)
                    return;
            }
            var button = window.L.DomUtil.create('div', 'annotation-btns-container', this.sectionProperties.nodeModify);
            window.L.DomEvent.on(this.sectionProperties.nodeModifyText, 'focus', this.onFocus, this);
            window.L.DomEvent.on(this.sectionProperties.nodeReplyText, 'focus', this.onFocusReply, this);
            window.L.DomEvent.on(this.sectionProperties.nodeModifyText, 'input', this.textAreaInput, this);
            window.L.DomEvent.on(this.sectionProperties.nodeReplyText, 'input', this.textAreaInput, this);
            window.L.DomEvent.on(this.sectionProperties.nodeModifyText, 'keydown', this.textAreaKeyDown, this);
            window.L.DomEvent.on(this.sectionProperties.nodeReplyText, 'keydown', this.textAreaKeyDown, this);
            window.L.DomEvent.on(this.sectionProperties.nodeModifyText, 'paste', app.LOUtil.onPastePlainText);
            window.L.DomEvent.on(this.sectionProperties.nodeReplyText, 'paste', app.LOUtil.onPastePlainText);
            this.sectionProperties.cancelButton = this.createButton(button, 'annotation-cancel-' + this.sectionProperties.data.id, 'annotation-button button', _('Cancel'), this.handleCancelCommentButton);
            this.sectionProperties.saveButton = this.createButton(button, 'annotation-save-' + this.sectionProperties.data.id, 'annotation-button button button-primary', _('Save'), this.handleSaveCommentButton);
            button = window.L.DomUtil.create('div', '', this.sectionProperties.nodeReply);
            this.sectionProperties.cancelReplyButton = this.createButton(button, 'annotation-cancel-reply-' + this.sectionProperties.data.id, 'annotation-button button', _('Cancel'), this.handleCancelCommentButton);
            this.sectionProperties.replyButton = this.createButton(button, 'annotation-reply-' + this.sectionProperties.data.id, 'annotation-button button button-primary', _('Reply'), this.handleReplyCommentButton);
            this.sectionProperties.statusNode = window.L.DomUtil.create('div', 'visuallyhidden', this.sectionProperties.container);
            this.sectionProperties.statusNode.setAttribute('role', 'status');
            window.L.DomEvent.disableScrollPropagation(this.sectionProperties.container);
            // Since this is a late called function, if the width is enough, we shouldn't collapse the comments.
            if (app.map._docLayer._docType !== 'text' || this.sectionProperties.commentListSection.isCollapsed === true)
                this.sectionProperties.container.style.visibility = 'hidden';
            this.sectionProperties.nodeModify.style.display = 'none';
            this.sectionProperties.nodeReply.style.display = 'none';
            var events = ['click', 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mouseout', 'keydown', 'keypress', 'keyup', 'touchstart', 'touchmove', 'touchend'];
            window.L.DomEvent.on(this.sectionProperties.container, 'click', this.onMouseClick, this);
            window.L.DomEvent.on(this.sectionProperties.container, 'keydown', this.onCommentKeyDown, this);
            // Events on a comment card stay inside the card. This is where the idle handler
            // hears about the ones that show the user is still working.
            for (const name of Comment.activityEvents) {
                window.L.DomEvent.on(this.sectionProperties.container, name, this.notifyActive, this);
            }
            for (var it = 0; it < events.length; it++) {
                window.L.DomEvent.on(this.sectionProperties.container, events[it], window.L.DomEvent.stopPropagation, this);
            }
            window.L.DomEvent.on(this.sectionProperties.container, 'touchstart', function (e) {
                if (e && e.touches.length > 1) {
                    window.L.DomEvent.preventDefault(e);
                }
            }, this);
            this.update();
            this.pendingInit = false;
        }
        onInitialize() {
            this.createContainerAndWrapper();
            this.createAuthorTable();
            if (this.sectionProperties.data.trackchange && !this.map.isReadOnlyMode() && !app.map['wopi'].HideChangeTrackingControls) {
                this.createTrackChangeButtons();
            }
            // Always create the menu if allowed; its visibility is kept in sync with
            // the current edit permission by updateEditability() so the Viewing/
            // Editing toggle can show or hide the Edit/Reply/Delete affordances
            // without re-rendering the comment.
            if (this.sectionProperties.noMenu !== true) {
                this.createMenu();
            }
            if (this.sectionProperties.data.trackchange) {
                this.sectionProperties.captionNode = window.L.DomUtil.create('div', 'cool-annotation-caption', this.sectionProperties.wrapper);
                this.sectionProperties.captionText = window.L.DomUtil.create('div', '', this.sectionProperties.captionNode);
                this.sectionProperties.captionText.id = 'annotation-caption-text-' + this.sectionProperties.data.id;
            }
            this.sectionProperties.contentNode = window.L.DomUtil.create('div', 'cool-annotation-content cool-dont-break', this.sectionProperties.wrapper);
            this.sectionProperties.contentNode.id = 'annotation-content-area-' + this.sectionProperties.data.id;
            this.sectionProperties.contentNode.setAttribute('tabindex', '0');
            const commentFooter = window.L.DomUtil.create('div', 'cool-annotation-footer', this.sectionProperties.wrapper);
            this.sectionProperties.contentDate = window.L.DomUtil.create('div', 'cool-annotation-date', commentFooter);
            const resolvedEl = window.L.DomUtil.create('div', 'cool-annotation-content-resolved', commentFooter);
            this.sectionProperties.resolvedTextElement = resolvedEl;
            this.updateResolvedField(this.sectionProperties.data.resolved);
            this.sectionProperties.nodeModify = window.L.DomUtil.create('div', 'cool-annotation-edit' + ' modify-annotation', this.sectionProperties.wrapper);
            this.sectionProperties.nodeModifyText = window.L.DomUtil.create('div', 'cool-annotation-textarea', this.sectionProperties.nodeModify);
            this.createReplyHint(this.sectionProperties.nodeModify);
            this.sectionProperties.nodeModifyText.setAttribute('contenteditable', 'true');
            this.sectionProperties.nodeModifyText.setAttribute('role', 'textbox');
            this.sectionProperties.nodeModifyText.setAttribute('aria-label', Comment.editCommentLabel);
            this.sectionProperties.nodeModifyText.id = 'annotation-modify-textarea-' + this.sectionProperties.data.id;
            this.sectionProperties.contentText = window.L.DomUtil.create('div', '', this.sectionProperties.contentNode);
            this.sectionProperties.nodeReply = window.L.DomUtil.create('div', 'cool-annotation-edit' + ' reply-annotation', this.sectionProperties.wrapper);
            this.sectionProperties.nodeReplyText = window.L.DomUtil.create('div', 'cool-annotation-textarea', this.sectionProperties.nodeReply);
            this.createReplyHint(this.sectionProperties.nodeReply);
            this.sectionProperties.nodeReplyText.setAttribute('contenteditable', 'true');
            this.sectionProperties.nodeReplyText.setAttribute('role', 'textbox');
            this.sectionProperties.nodeReplyText.setAttribute('aria-label', Comment.replyCommentLabel);
            this.sectionProperties.nodeReplyText.id = 'annotation-reply-textarea-' + this.sectionProperties.data.id;
            this.createChildLinesNode();
            this.sectionProperties.container.style.visibility = 'hidden';
            if (this.sectionProperties.commentMarkerSubSection === null && app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing')
                this.createMarkerSubSection();
            this.doPendingInitializationInView();
            if (!window.mode.isSmallScreenDevice())
                document.getElementById('document-container').appendChild(this.sectionProperties.container);
            this.updateEditability();
            this.sectionProperties.onUpdatePermissionBound = this.updateEditability.bind(this);
            app.events.on('updatepermission', this.sectionProperties.onUpdatePermissionBound);
        }
        // Syncs visible edit affordances with the current comment-editing
        // permission. The editable=true branch only re-shows the menubar
        // cell: nodeModify/nodeReply remain hidden until the user explicitly
        // triggers edit()/reply(), so we deliberately do NOT auto-reopen a
        // previously open edit/reply pane when permission is restored.
        makeEditable(editable) {
            const props = this.sectionProperties;
            if (props.menuBarCell?.style)
                props.menuBarCell.style.display = editable ? '' : 'none';
            if (editable)
                return;
            if (props.nodeModify?.style)
                props.nodeModify.style.display = 'none';
            if (props.nodeReply?.style)
                props.nodeReply.style.display = 'none';
            if (props.contentNode?.style)
                props.contentNode.style.display = '';
            props.container.classList.remove('modify-annotation-container');
            props.container.classList.remove('reply-annotation-container');
            this.cachedIsEdit = false;
        }
        // Invoked at init and on every updatepermission event, so toggling
        // between Viewing and Editing mode immediately hides or restores the
        // per-comment controls.
        updateEditability() {
            this.makeEditable(app.isCommentEditingAllowed());
        }
        createContainerAndWrapper() {
            var isRTL = document.documentElement.dir === 'rtl';
            this.sectionProperties.container = window.L.DomUtil.create('div', 'cool-annotation' + (isRTL ? ' rtl' : ''));
            this.sectionProperties.container.id = 'comment-container-' + this.sectionProperties.data.id;
            this.sectionProperties.container.setAttribute('role', 'article');
            this.sectionProperties.container.setAttribute('aria-roledescription', _('comment'));
            window.L.DomEvent.on(this.sectionProperties.container, 'focusout', this.onLostFocus, this);
            var mobileClass = window.mode.isSmallScreenDevice() ? ' wizard-comment-box' : '';
            if (this.sectionProperties.data.trackchange) {
                this.sectionProperties.wrapper = window.L.DomUtil.create('div', 'cool-annotation-redline-content-wrapper' + mobileClass, this.sectionProperties.container);
            }
            else {
                this.sectionProperties.wrapper = window.L.DomUtil.create('div', 'cool-annotation-content-wrapper' + mobileClass, this.sectionProperties.container);
            }
            this.sectionProperties.wrapper.style.marginLeft = this.sectionProperties.childCommentOffset * this.getChildLevel() + 'px';
            if (document.documentElement.dir === 'rtl')
                this.sectionProperties.wrapper.dir = 'rtl';
            // We make comment directly visible when its transitioned to its determined position
            if (cool.CommentSection.autoSavedComment)
                this.sectionProperties.container.style.visibility = 'hidden';
        }
        createAuthorTable() {
            this.sectionProperties.author = window.L.DomUtil.create('table', 'cool-annotation-table', this.sectionProperties.wrapper);
            this.sectionProperties.author.setAttribute('role', 'presentation'); // a layout table
            var tbody = window.L.DomUtil.create('tbody', '', this.sectionProperties.author);
            var tr = window.L.DomUtil.create('tr', 'cool-annotation-author-header', tbody);
            this.sectionProperties.authorRow = tr;
            tr.id = 'author table row ' + this.sectionProperties.data.id;
            var tdImg = window.L.DomUtil.create('td', 'cool-annotation-img', tr);
            var tdAuthor = window.L.DomUtil.create('td', 'cool-annotation-author', tr);
            var imgAuthor = window.L.DomUtil.create('img', 'avatar-img', tdImg);
            imgAuthor.setAttribute('alt', this.sectionProperties.data.author);
            var viewId = this.map.getViewId(this.sectionProperties.data.author);
            if (this.map['wopi'] && this.map['wopi'].CommentAvatarUrl)
                imgAuthor.setAttribute('src', this.map['wopi'].CommentAvatarUrl);
            else
                app.LOUtil.setUserImage(imgAuthor, this.map, viewId);
            imgAuthor.setAttribute('width', this.sectionProperties.imgSize[0]);
            imgAuthor.setAttribute('height', this.sectionProperties.imgSize[1]);
            if (app.map._docLayer._docType !== 'spreadsheet') {
                this.sectionProperties.collapsedInfoNode = window.L.DomUtil.create('div', 'cool-annotation-info-collapsed', tdImg);
                this.sectionProperties.collapsedInfoNode.style.display = 'none';
            }
            this.sectionProperties.authorAvatarImg = imgAuthor;
            this.sectionProperties.authorAvatartdImg = tdImg;
            this.sectionProperties.contentAuthor = window.L.DomUtil.create('div', 'cool-annotation-content-author', tdAuthor);
            this.sectionProperties.contentAuthor.id = 'annotation-content-author-' + this.sectionProperties.data.id;
        }
        createMenu() {
            var tdMenu = window.L.DomUtil.create('td', 'cool-annotation-menubar', this.sectionProperties.authorRow);
            this.sectionProperties.menuBarCell = tdMenu;
            // describe the buttons by the comment author and text, and the kind of change
            const id = this.sectionProperties.data.id;
            const describedBy = 'annotation-content-author-' + id
                + (this.sectionProperties.data.trackchange ? ' annotation-caption-text-' + id : '')
                + ' annotation-content-area-' + id; // not the text, copied into itself by autolinking
            if (this.isAuthor()) {
                const edit = window.L.DomUtil.create('div', 'cool-annotation-menu-edit', tdMenu);
                edit.id = 'comment-annotation-menu-edit-' + this.sectionProperties.data.id;
                // Honor an earlier Hide_Command for .uno:EditAnnotation; the class
                // is toggled symmetrically by UIManager.showCommand later.
                if (!app.map.uiManager.isCommandVisible('.uno:EditAnnotation'))
                    edit.classList.add('hidden-by-command');
                edit.tabIndex = 0;
                edit.onclick = this.onEditComment.bind(this);
                edit.onkeypress = this.editOnKeyPress.bind(this);
                edit.dataset.title = Comment.editCommentLabel;
                edit.setAttribute('aria-label', Comment.editCommentLabel);
                edit.setAttribute('role', 'button');
                edit.setAttribute('aria-describedby', describedBy);
            }
            this.sectionProperties.menu = window.L.DomUtil.create('div', this.sectionProperties.data.trackchange ? 'cool-annotation-menu-redline' : 'cool-annotation-menu', tdMenu);
            this.sectionProperties.menu.id = 'comment-annotation-menu-' + this.sectionProperties.data.id;
            this.sectionProperties.menu.tabIndex = 0;
            this.sectionProperties.menu.onclick = this.menuOnMouseClick.bind(this);
            this.sectionProperties.menu.onkeypress = this.menuOnKeyPress.bind(this);
            this.sectionProperties.menu.dataset.title = Comment.openMenuLabel;
            this.sectionProperties.menu.setAttribute('aria-label', Comment.openMenuLabel);
            this.sectionProperties.menu.setAttribute('role', 'button');
            this.sectionProperties.menu.setAttribute('aria-describedby', describedBy);
        }
        // Returns the final (post-clamp) top in canvas-relative CSS px, so a thread's
        // replies can follow a parent that was clamped to stay in view.
        setContainerPos(forceUpdate, canvasContainerBounds, left, top) {
            if (window.mode.isSmallScreenDevice()) {
                return this.renderedPosY;
            }
            // A call without explicit coordinates re-applies the position the layout
            // gave the container earlier. Until the first layout pass there is none,
            // so the container keeps its place and its first position comes straight
            // from the layout. A comment in edit state is the exception: its box is
            // visible right away, so it takes the clamped placement below even
            // before a layout pass has run.
            if (left === undefined &&
                top === undefined &&
                this.sectionProperties.container.style.left === '' &&
                !this.isEdit()) {
                return this.renderedPosY;
            }
            if (canvasContainerBounds === undefined) {
                canvasContainerBounds = this.canvasContainerBounds;
            }
            if (left === undefined) {
                left = this.containerPosX;
            }
            if (top === undefined) {
                top = this.containerPosY;
            }
            // A card in a page's box is positioned by the box, relative to the box. The box
            // stacks the cards the same way as the layout, so the card lands where it is asked.
            if (this.sectionProperties.container.parentElement?.classList.contains('cool-annotation-page-scroller')) {
                this.containerPosX = left;
                this.containerPosY = top;
                this.canvasContainerBounds = canvasContainerBounds;
                this.renderedPosY = top;
                return this.renderedPosY;
            }
            // A selected or edited card is held inside the view by the clamp below, so where it
            // ends up depends on how tall it is. Its text is capped after the layout places it,
            // which changes that height while the layout asks for the same place. So the height
            // is part of what makes a position out of date, along with the place and the bounds.
            const clamped = this.isSelected() || this.isEdit();
            const height = clamped ? this.getCommentHeight() : null;
            if (this.containerPosX === left
                && this.containerPosY === top
                && this.canvasContainerBounds.left === canvasContainerBounds.left
                && this.canvasContainerBounds.right === canvasContainerBounds.right
                && this.canvasContainerBounds.top === canvasContainerBounds.top
                && this.canvasContainerBounds.bottom === canvasContainerBounds.bottom
                && this.positionedHeight === height
                && !forceUpdate) {
                return this.renderedPosY;
            }
            this.positionedHeight = height;
            this.containerPosX = left;
            this.containerPosY = top;
            this.canvasContainerBounds = canvasContainerBounds;
            left += canvasContainerBounds.left;
            top += canvasContainerBounds.top;
            if (this.isSelected() || this.isEdit()) {
                // Gap kept between the comment and the toolbar/canvas edges.
                const margin = this.sectionProperties.commentListSection.sectionProperties.marginY / app.dpiScale;
                // In the per-page layout a selected or edited card stays beside its
                // page, so it is kept inside the view vertically only in full view.
                const clampY = !this.sectionProperties.commentListSection.usePerPageLayout()
                    || this.sectionProperties.commentListSection.isShownBig(this);
                if (left < canvasContainerBounds.left) {
                    left = canvasContainerBounds.left;
                }
                if (clampY && top < canvasContainerBounds.top + margin) {
                    top = canvasContainerBounds.top + margin;
                }
                const width = this.getCommentWidth() / app.dpiScale;
                if (left + width > canvasContainerBounds.right && !this.sectionProperties.commentListSection.keepsSelectedCommentBesideThePage()) {
                    left = canvasContainerBounds.right - width;
                }
                if (clampY && top + height > canvasContainerBounds.bottom - margin) {
                    top = canvasContainerBounds.bottom - height - margin;
                }
                // A comment taller than the view would be pushed up by the line above until
                // its top slips under the toolbar; keep the top below the toolbar.
                if (clampY && top < canvasContainerBounds.top + margin) {
                    top = canvasContainerBounds.top + margin;
                }
            }
            let maxHeight = '';
            if (this.sectionProperties.commentListSection.isShownBig(this)) {
                // Full view lifts the card and the overlay it casts over the sidebars.
                // That level lives in the stylesheet, so leave the inline value empty
                // here instead of pinning the card back down beside the document.
                this.sectionProperties.container.style.zIndex = '';
                // Content taller than the viewport would otherwise cut the content.
                const marginY = this.sectionProperties.commentListSection.sectionProperties.marginY / app.dpiScale;
                maxHeight = Math.round(canvasContainerBounds.bottom - top - marginY) + 'px';
            }
            else if (this.isEdit()) {
                this.sectionProperties.container.style.zIndex = 14;
            }
            else if (this.isSelected()) {
                this.sectionProperties.container.style.zIndex = 13;
            }
            else {
                this.sectionProperties.container.style.zIndex = ''; // Default for .cool-annotation is 12
            }
            this.sectionProperties.container.style.maxHeight = maxHeight;
            this.sectionProperties.container.style.left = Math.round(left) + 'px';
            this.sectionProperties.container.style.top = Math.round(top) + 'px';
            this.renderedPosY = top - canvasContainerBounds.top;
            return this.renderedPosY;
        }
        createReplyHint(commentType) {
            this.sectionProperties.replyHint = window.L.DomUtil.create('p', '', commentType);
            var small = document.createElement('small');
            small.classList.add('cool-font');
            small.innerText = _('Press Ctrl + Enter to post');
            this.sectionProperties.replyHint.appendChild(small);
        }
        createChildLinesNode() {
            this.sectionProperties.childLinesNode = window.L.DomUtil.create('div', 'cool-annotation-child-lines', this.sectionProperties.container);
            this.sectionProperties.childLinesNode.id = 'annotation-child-lines-' + this.sectionProperties.data.id;
            this.sectionProperties.childLinesNode.style.width = this.sectionProperties.childCommentOffset * (this.getChildLevel() + 1) + 'px';
        }
        updateReplyLabel() {
            const container = this.sectionProperties.container;
            const parentComment = this.isRootComment() ? null :
                this.sectionProperties.commentListSection.getComment(this.getParentCommentId());
            if (!parentComment) {
                container.removeAttribute('aria-label');
                return;
            }
            const label = _('Reply to {0}').replace('{0}', () => parentComment.sectionProperties.data.author);
            if (container.getAttribute('aria-label') !== label)
                container.setAttribute('aria-label', label);
        }
        getContainerPosX() {
            return this.containerPosX;
        }
        getContainerPosY() {
            return this.containerPosY;
        }
        updateChildLines() {
            this.updateReplyLabel();
            if (!this.isContainerVisible())
                return;
            this.sectionProperties.wrapper.style.marginLeft = this.sectionProperties.childCommentOffset * this.getChildLevel() + 'px';
            this.sectionProperties.childLinesNode.style.width = this.sectionProperties.childCommentOffset * (this.getChildLevel() + 1) + 'px';
            const childPositions = [];
            for (let i = 0; i < this.sectionProperties.children.length; i++) {
                if (this.sectionProperties.children[i].isContainerVisible())
                    childPositions.push({ id: this.sectionProperties.children[i].sectionProperties.data.id,
                        posY: this.sectionProperties.children[i].renderedPosY
                    });
            }
            childPositions.sort((a, b) => { return a.posY - b.posY; });
            // Use renderedPosY (post-clamp), not getContainerPosY (pre-clamp): a clamped
            // parent renders elsewhere than its requested top, so the line must follow where
            // things actually are, otherwise it stretches down to the stale position.
            let lastPosY = this.renderedPosY + this.getCommentHeight(false);
            let i = 0;
            for (; i < childPositions.length; i++) {
                if (this.sectionProperties.childLines[i] === undefined) {
                    this.sectionProperties.childLines[i] = window.L.DomUtil.create('div', 'cool-annotation-child-line', this.sectionProperties.childLinesNode);
                    this.sectionProperties.childLines[i].id = 'annotation-child-line-' + this.sectionProperties.data.id + '-' + i;
                    this.sectionProperties.childLines[i].style.width = (this.sectionProperties.childCommentOffset - 4) + 'px';
                }
                this.sectionProperties.childLines[i].style.marginLeft = (this.sectionProperties.childCommentOffset * this.getChildLevel() + 4) + 'px';
                this.sectionProperties.childLines[i].style.height = (childPositions[i].posY + 24 - lastPosY) + 'px';
                lastPosY = childPositions[i].posY + 24;
            }
            while (i < this.sectionProperties.childLines.length) {
                this.sectionProperties.childLinesNode.removeChild(this.sectionProperties.childLines[i]);
                this.sectionProperties.childLines.splice(i, 1);
            }
        }
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        setData(data) {
            this.sectionProperties.data = data;
            const rectangles = this.sectionProperties.data.rectangles;
            if (rectangles) {
                // Convert the rectangles into simple rectangles as soon as possible.
                for (let i = 0; i < rectangles.length; i++) {
                    rectangles[i] = new cool.SimpleRectangle(rectangles[i][0], rectangles[i][1], rectangles[i][2], rectangles[i][3]);
                }
            }
        }
        createTrackChangeButtons() {
            var tdAccept = window.L.DomUtil.create('td', 'cool-annotation-menubar', this.sectionProperties.authorRow);
            var acceptButton = this.sectionProperties.acceptButton = window.L.DomUtil.create('button', 'cool-redline-accept-button', tdAccept);
            var tdReject = window.L.DomUtil.create('td', 'cool-annotation-menubar', this.sectionProperties.authorRow);
            var rejectButton = this.sectionProperties.rejectButton = window.L.DomUtil.create('button', 'cool-redline-reject-button', tdReject);
            acceptButton.dataset.title = _('Accept change');
            acceptButton.setAttribute('aria-label', _('Accept change'));
            window.L.DomEvent.on(acceptButton, 'click', function () {
                this.map.fire('RedlineAccept', { id: this.sectionProperties.data.id });
            }, this);
            rejectButton.dataset.title = _('Reject change');
            rejectButton.setAttribute('aria-label', _('Reject change'));
            window.L.DomEvent.on(rejectButton, 'click', function () {
                this.map.fire('RedlineReject', { id: this.sectionProperties.data.id });
            }, this);
        }
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        createButton(container, id, cssClass, value, handler) {
            var button = window.L.DomUtil.create('input', cssClass, container);
            button.id = id;
            button.type = 'button';
            button.value = value;
            window.L.DomEvent.on(button, 'mousedown', window.L.DomEvent.preventDefault);
            window.L.DomEvent.on(button, 'click', handler, this);
            return button;
        }
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        parentOf(comment) {
            return this.sectionProperties.data.id === comment.sectionProperties.data.parent;
        }
        updateResolvedField(state) {
            this.sectionProperties.resolvedTextElement.innerText = state === 'true' ? _('Resolved') : '';
        }
        updateRemovedField() {
            var isDeleted = this.sectionProperties.data.layoutStatus === CommentLayoutStatus.DELETED;
            if (isDeleted && !this.sectionProperties.removedTextElement) {
                var commentFooter = this.sectionProperties.contentDate.parentNode;
                this.sectionProperties.removedTextElement = window.L.DomUtil.create('div', 'cool-annotation-content-removed', commentFooter);
            }
            if (this.sectionProperties.removedTextElement) {
                this.sectionProperties.removedTextElement.innerText = isDeleted ? _('Removed') : '';
            }
            if (isDeleted) {
                this.sectionProperties.resolvedTextElement.innerText = '';
            }
            else {
                this.updateResolvedField(this.sectionProperties.data.resolved);
            }
        }
        isNewPara() {
            const selection = window.getSelection();
            if (!selection.rangeCount)
                return;
            const range = selection.getRangeAt(0);
            const cursorPosition = range.startOffset;
            const node = range.startContainer;
            const beforeCursor = node.textContent.slice(0, cursorPosition);
            return /^\s*$/.test(beforeCursor.slice(0, -1));
        }
        textAreaInput(ev) {
            if (ev && app.map._docLayer._docType === 'text') {
                // special handling for mentions
                this.map?.mention.handleMentionInput(ev, this.isNewPara());
            }
        }
        handleKeyDownForPopup(ev, id) {
            var popup = this.map._textInput._handleKeyDownForPopup(ev, id);
            // Block Esc from propagating if it closes the comment mention Popup
            if (popup && id === 'mentionPopup' && ev.key === 'Escape') {
                ev.preventDefault();
                ev.stopPropagation();
            }
        }
        isCtrlEnter(ev) {
            return !!ev && ev.ctrlKey && ev.key === "Enter";
        }
        handleCommentCtrlEnter(ev) {
            this.map.mention?.closeMentionPopup(false);
            const targetId = ev.target.id;
            if (this.sectionProperties.nodeReplyText.id === targetId) {
                this.handleReplyCommentButton(ev);
            }
            else {
                this.handleSaveCommentButton(ev);
            }
        }
        // Working inside a comment card keeps the document awake, in the same way that working
        // in the document itself does.
        notifyActive() {
            app.idleHandler.notifyActive();
        }
        textAreaKeyDown(ev) {
            if (window.KeyboardShortcuts.processEvent(app.UI.language.fromURL, ev)) {
                return;
            }
            this.handleKeyDownForPopup(ev, 'mentionPopup');
        }
        onFocus() {
            this.resetControl(this.sectionProperties.saveButton, _('Save'), 'annotation-button-autosaved');
        }
        onFocusReply() {
            this.resetControl(this.sectionProperties.replyButton, _('Reply'), 'annotation-button-autosaved');
        }
        updateContent() {
            let contentModified = true;
            let contentRaw = '';
            if (this.sectionProperties.data.html)
                contentRaw = app.LOUtil.sanitize(this.sectionProperties.data.html);
            else
                contentRaw = this.sectionProperties.data.text ? this.sectionProperties.data.text : '';
            if (this.sectionProperties.lastContentRaw === contentRaw)
                contentModified = false;
            // happens when comment anchor is moved due to typing in the same paragraph
            if (!contentModified)
                return;
            this.sectionProperties.lastContentRaw = contentRaw;
            if (this.sectionProperties.data.html)
                // eslint-disable-next-line no-restricted-syntax -- sanitized markup
                this.sectionProperties.contentText.innerHTML = app.LOUtil.sanitize(this.sectionProperties.data.html);
            else
                this.sectionProperties.contentText.innerText = this.sectionProperties.data.text ? this.sectionProperties.data.text : '';
            // Get the escaped HTML out and find for possible, useful links
            var linkedText = Autolinker.link(this.sectionProperties.contentText.outerHTML);
            // eslint-disable-next-line no-restricted-syntax -- sanitized markup
            this.sectionProperties.contentText.innerHTML = app.LOUtil.sanitize(linkedText);
            // Original unlinked text
            this.sectionProperties.contentText.origText = this.sectionProperties.data.text ? this.sectionProperties.data.text : '';
            this.sectionProperties.contentText.origHTML = this.sectionProperties.data.html ? this.sectionProperties.data.html : '';
            this.sectionProperties.nodeModifyText.innerText = this.sectionProperties.data.text ? this.sectionProperties.data.text : '';
            if (this.sectionProperties.data.html) {
                // eslint-disable-next-line no-restricted-syntax -- sanitized markup
                this.sectionProperties.nodeModifyText.innerHTML = app.LOUtil.sanitize(this.sectionProperties.data.html);
            }
        }
        updateMetadata() {
            this.sectionProperties.contentAuthor.innerText = this.sectionProperties.data.author;
            this.updateReplyLabel();
            this.updateResolvedField(this.sectionProperties.data.resolved);
            this.updateRemovedField();
            if (this.map['wopi'] && this.map['wopi'].CommentAvatarUrl) {
                this.sectionProperties.authorAvatarImg.setAttribute('src', this.map['wopi'].CommentAvatarUrl);
            }
            else if (this.sectionProperties.data.avatar) {
                this.sectionProperties.authorAvatarImg.setAttribute('src', this.sectionProperties.data.avatar);
            }
            else {
                $(this.sectionProperties.authorAvatarImg).css('padding', '1.8px');
            }
            var user = this.map.getViewId(this.sectionProperties.data.author);
            if (user >= 0) {
                var color = app.LOUtil.rgbToHex(this.map.getViewColor(user));
                this.sectionProperties.authorAvatartdImg.style.borderColor = color;
            }
            // dateTimeUtc, when the server sends one, is the moment the comment was written, so the
            // time can be shown on the viewer's own clock. dateTime beside it is the author's wall
            // clock with no zone, which is all a comment from an older document carries.
            const d = this.sectionProperties.data.dateTimeUtc ?
                new Date(this.sectionProperties.data.dateTimeUtc) :
                new Date(this.sectionProperties.data.dateTime.replace(/,.*/, ''));
            var dateOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' };
            this.sectionProperties.contentDate.innerText = isNaN(d.getTime()) ? this.sectionProperties.data.dateTime : d.toLocaleDateString(String.locale, dateOptions);
            if (this.sectionProperties.data.trackchange) {
                this.sectionProperties.captionText.innerText = this.sectionProperties.data.description;
            }
        }
        updateLayout() {
            var style = this.sectionProperties.wrapper.style;
            style.width = '';
            style.whiteSpace = 'nowrap';
            style.whiteSpace = '';
        }
        setPositionAndSize() {
            var rectangles = this.sectionProperties.data.rectanglesOriginal;
            if (rectangles && app.map._docLayer._docType === 'text') {
                var xMin = Infinity, yMin = Infinity, xMax = 0, yMax = 0;
                for (var i = 0; i < rectangles.length; i++) {
                    if (rectangles[i][0] < xMin)
                        xMin = rectangles[i][0];
                    if (rectangles[i][1] < yMin)
                        yMin = rectangles[i][1];
                    if (rectangles[i][0] + rectangles[i][2] > xMax)
                        xMax = rectangles[i][0] + rectangles[i][2];
                    if (rectangles[i][1] + rectangles[i][3] > yMax)
                        yMax = rectangles[i][1] + rectangles[i][3];
                }
                // Rectangles are in twips. Convert them to core pixels.
                xMin = Math.round(xMin * app.twipsToPixels);
                yMin = Math.round(yMin * app.twipsToPixels);
                xMax = Math.round(xMax * app.twipsToPixels);
                yMax = Math.round(yMax * app.twipsToPixels);
                this.setPosition(xMin, yMin); // This function is added by section container.
                this.size = [xMax - xMin, yMax - yMin];
                if (this.size[0] < 5)
                    this.size[0] = 5;
            }
            else if (this.sectionProperties.data.cellRange && app.map._docLayer._docType === 'spreadsheet') {
                this.size = this.calcOptimumSizeForCalc();
                var cellPos = app.map._docLayer._cellRangeToTwipRect(this.sectionProperties.data.cellRange).toRectangle();
                let startX = cellPos[0];
                if (this.isCalcRTL()) { // Mirroring is done in setPosition
                    const sizeX = cellPos[2];
                    startX += sizeX; // but adjust for width of the cell.
                }
                // A comment on another sheet sits at the same cell position as one on this sheet. Only
                // a comment on the selected sheet is shown, so it is the one that receives the mouse.
                this.setShowSection(parseInt(this.sectionProperties.data.tab) === app.map._docLayer._selectedPart);
                var position = [Math.round((cellPos[0] + cellPos[2]) * app.twipsToPixels - this.size[0]), Math.round(cellPos[1] * app.twipsToPixels)];
                this.setPosition(position[0], position[1]);
            }
            else if (app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing') {
                this.size = [Math.round(this.sectionProperties.imgSize[0] * app.dpiScale), Math.round(this.sectionProperties.imgSize[1] * app.dpiScale)];
                this.setPosition(Math.round(this.sectionProperties.data.rectangle[0] * app.twipsToPixels), Math.round(this.sectionProperties.data.rectangle[1] * app.twipsToPixels));
            }
        }
        removeHighlight() {
            if (app.map._docLayer._docType === 'text') {
                this.sectionProperties.usedTextColor = this.sectionProperties.data.color;
            }
            else if (app.map._docLayer._docType === 'spreadsheet') {
                this.backgroundColor = null;
                this.backgroundOpacity = 1;
            }
            this.containerObject.requestReDraw();
            this.sectionProperties.isHighlighted = false;
        }
        // Paints this comment in the highlight colours.
        highlight() {
            if (app.map._docLayer._docType === 'text') {
                this.sectionProperties.usedTextColor = this.sectionProperties.highlightedTextColor;
            }
            else if (app.map._docLayer._docType === 'spreadsheet') {
                this.backgroundColor = '#777777'; //background: rgba(119, 119, 119, 0.25);
                this.backgroundOpacity = 0.25;
            }
            this.containerObject.requestReDraw();
            this.sectionProperties.isHighlighted = true;
        }
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        static doesRectIntersectView(pos, size, viewContext) {
            var paneBoundsList = viewContext.paneBoundsList;
            var endPos = [pos[0] + size[0], pos[1] + size[1]];
            for (var i = 0; i < paneBoundsList.length; ++i) {
                var paneBounds = paneBoundsList[i];
                var rectInvisible = (endPos[0] < paneBounds.min.x || endPos[1] < paneBounds.min.y ||
                    pos[0] > paneBounds.max.x || pos[1] > paneBounds.max.y);
                if (!rectInvisible)
                    return true;
            }
            return false;
        }
        // This is for svg elements that will be bound to document-container.
        // This also returns whether any rectangle has an intersection with the visible area/panes.
        // This function calculates the core pixel coordinates then converts them into view coordinates.
        convertRectanglesToViewCoordinates() {
            var rectangles = this.sectionProperties.data.rectangles;
            var viewContext = this.map.getTileSectionMgr()._paintContext();
            var intersectsVisibleArea = false;
            if (rectangles) {
                for (let i = 0; i < rectangles.length; i++) {
                    if (app.activeDocument.activeLayout.viewedRectangle.intersectsRectangle(rectangles[i].toArray())) {
                        intersectsVisibleArea = true;
                        break;
                    }
                }
            }
            else if (this.sectionProperties.data.trackchange && this.sectionProperties.data.anchorPos) {
                // For redline comments there are no 'rectangles' or 'rectangleOriginal' properties in sectionProperties.data
                // So use the comment rectangle stored in anchorPos (in display? twips).
                intersectsVisibleArea = Comment.doesRectIntersectView(this.getPosition(), this.getSize(), viewContext);
            }
            return intersectsVisibleArea;
        }
        getPosition() {
            // For redline comments there are no 'rectangles' or 'rectangleOriginal' properties in sectionProperties.data
            // So use the comment rectangle stored in anchorPos (in display? twips).
            if (this.sectionProperties.data.trackchange && this.sectionProperties.data.anchorPos) {
                var anchorPos = this.sectionProperties.data.anchorPos;
                return [
                    Math.round(anchorPos[0] * app.twipsToPixels),
                    Math.round(anchorPos[1] * app.twipsToPixels)
                ];
            }
            else {
                return this.position;
            }
        }
        getSize() {
            // For redline comments there are no 'rectangles' or 'rectangleOriginal' properties in sectionProperties.data
            // So use the comment rectangle stored in anchorPos (in display? twips).
            if (this.sectionProperties.data.trackchange && this.sectionProperties.data.anchorPos) {
                var anchorPos = this.sectionProperties.data.anchorPos;
                return [
                    Math.round(anchorPos[2] * app.twipsToPixels),
                    Math.round(anchorPos[3] * app.twipsToPixels)
                ];
            }
            else {
                return this.size;
            }
        }
        updatePosition() {
            this.setPositionAndSize();
            if (app.map._docLayer._docType === 'spreadsheet')
                this.positionCalcComment();
            else if (app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing") {
                if (this.sectionProperties.commentMarkerSubSection !== null) {
                    this.sectionProperties.commentMarkerSubSection.sectionProperties.data = this.sectionProperties.data;
                    this.sectionProperties.commentMarkerSubSection.setPosition(this.sectionProperties.data.anchorPos[0] * app.twipsToPixels, this.sectionProperties.data.anchorPos[1] * app.twipsToPixels);
                }
                if (this.sectionProperties.commentAnchorAreaSubSection !== null) {
                    const data = this.sectionProperties.data;
                    this.sectionProperties.commentAnchorAreaSubSection.sectionProperties.data = data;
                    this.sectionProperties.commentAnchorAreaSubSection.setPosition(data.anchorPos[0] * app.twipsToPixels, data.anchorPos[1] * app.twipsToPixels);
                    // rectangle = [x, y, width, height] in twips (ImpressTileLayer.newAnnotation
                    // builds it from the data; the JSON form coming back from core uses the
                    // same shape via tools::Rectangle::toString()).
                    this.sectionProperties.commentAnchorAreaSubSection.resize(data.rectangle[2] * app.twipsToPixels / app.dpiScale, data.rectangle[3] * app.twipsToPixels / app.dpiScale);
                }
            }
        }
        createMarkerSubSection() {
            if (this.sectionProperties.data.rectangle === null)
                return;
            const showMarker = app.impress.partList[app.map._docLayer._selectedPart].part === this.sectionProperties.data.part ||
                app.file.fileBasedView;
            this.setShowSection(showMarker);
            // Anchor-area outline: only when the comment carries an explicit
            // area (set by core via the hasArea JSON field for PDF /Rect or
            // the Width/Height args of .uno:InsertAnnotation). Added before
            // the marker sub-section so findSectionContainingPoint, which
            // iterates last-to-first, lets the smaller marker icon take a
            // click at the rectangle's top-left while the area catches
            // clicks elsewhere inside the rectangle.
            if (this.sectionProperties.data.hasArea) {
                const widthCssPx = this.sectionProperties.data.rectangle[2]
                    * app.twipsToPixels / app.dpiScale;
                const heightCssPx = this.sectionProperties.data.rectangle[3]
                    * app.twipsToPixels / app.dpiScale;
                this.sectionProperties.commentAnchorAreaSubSection = new CommentAnchorAreaSubSection(this.name + this.sectionProperties.data.id + '-area' + String(Math.random()), widthCssPx, heightCssPx, new cool.SimplePoint(this.sectionProperties.data.anchorPos[0], this.sectionProperties.data.anchorPos[1]), showMarker, this, this.sectionProperties.data);
                app.sectionContainer.addSection(this.sectionProperties.commentAnchorAreaSubSection);
            }
            this.sectionProperties.commentMarkerSubSection = new CommentMarkerSubSection(this.name + this.sectionProperties.data.id + String(Math.random()), // Section name - only as a placeholder.
            28, 28, // Width and height.
            new cool.SimplePoint(this.sectionProperties.data.anchorPos[0], this.sectionProperties.data.anchorPos[1]), // Document position.
            'annotation-marker', // Extra class.
            showMarker, // Show section.
            this, // Parent section.
            this.sectionProperties.data);
            app.sectionContainer.addSection(this.sectionProperties.commentMarkerSubSection);
        }
        isContainerVisible() {
            return this.sectionProperties.container.style &&
                this.sectionProperties.container.style.display !== 'none' &&
                (this.sectionProperties.container.style.visibility === 'visible' ||
                    this.sectionProperties.container.style.visibility === '');
        }
        update() {
            this.updateContent();
            this.updateMetadata();
            this.updateLayout();
            this.updatePosition();
        }
        showMarker() {
            if (this.sectionProperties.commentMarkerSubSection != null) {
                this.sectionProperties.commentMarkerSubSection.showSection = true;
                this.sectionProperties.commentMarkerSubSection.onSectionShowStatusChange();
                this.setShowSection(true);
            }
            if (this.sectionProperties.commentAnchorAreaSubSection != null) {
                this.sectionProperties.commentAnchorAreaSubSection.showSection = true;
                this.sectionProperties.commentAnchorAreaSubSection.onSectionShowStatusChange();
            }
        }
        hideMarker() {
            if (this.sectionProperties.commentMarkerSubSection != null) {
                this.sectionProperties.commentMarkerSubSection.showSection = false;
                this.sectionProperties.commentMarkerSubSection.onSectionShowStatusChange();
                this.setShowSection(false);
            }
            if (this.sectionProperties.commentAnchorAreaSubSection != null) {
                this.sectionProperties.commentAnchorAreaSubSection.showSection = false;
                this.sectionProperties.commentAnchorAreaSubSection.onSectionShowStatusChange();
            }
        }
        showWriter() {
            if (!this.isCollapsed || this.isSelected()) {
                this.sectionProperties.container.style.visibility = '';
                this.sectionProperties.container.style.display = '';
            }
            if (this.sectionProperties.data.resolved !== 'true' || this.sectionProperties.commentListSection.sectionProperties.showResolved) {
                window.L.DomUtil.addClass(this.sectionProperties.container, 'cool-annotation-collapsed-show');
                this.sectionProperties.showSelectedCoordinate = true;
            }
            this.sectionProperties.contentNode.style.display = '';
            this.sectionProperties.nodeModify.style.display = 'none';
            this.sectionProperties.nodeReply.style.display = 'none';
            this.sectionProperties.collapsedInfoNode.style.visibility = '';
            this.cachedIsEdit = false;
            this.setContainerPos(true);
        }
        showCalc() {
            this.sectionProperties.container.style.display = '';
            this.sectionProperties.contentNode.style.display = '';
            this.sectionProperties.nodeModify.style.display = 'none';
            this.sectionProperties.nodeReply.style.display = 'none';
            this.cachedIsEdit = false;
            this.positionCalcComment();
            if (!window.mode.isSmallScreenDevice()) {
                this.sectionProperties.commentListSection.select(this);
            }
            this.sectionProperties.container.style.visibility = '';
        }
        getCommentWidth() {
            // note: getComputedStyle can be an exceptional bottle-neck with many comments
            return parseFloat(getComputedStyle(this.sectionProperties.container).width) * app.dpiScale;
        }
        positionCalcComment() {
            if (!window.mode.isSmallScreenDevice()) {
                const cellSize = this.calcOptimumSizeForCalc()[0];
                const startX = this.isCalcRTL()
                    ? this.myTopLeft[0] - cellSize - this.getCommentWidth() + 3
                    : this.myTopLeft[0] + cellSize - 3;
                var pos = [Math.round(startX / app.dpiScale), Math.round(this.myTopLeft[1] / app.dpiScale)];
                this.sectionProperties.container.style.transform = 'translate3d(' + pos[0] + 'px, ' + pos[1] + 'px, 0px)';
            }
        }
        // True when the comment was put on display, false when it belongs to another
        // slide or page and was left alone.
        showImpressDraw() {
            if (!this.isInsideActivePart())
                return false;
            this.sectionProperties.container.style.display = '';
            this.sectionProperties.nodeModify.style.display = 'none';
            this.sectionProperties.nodeReply.style.display = 'none';
            this.sectionProperties.contentNode.style.display = '';
            this.cachedIsEdit = false;
            this.setContainerPos(true);
            if (this.isSelected() || !this.isCollapsed) {
                this.sectionProperties.container.style.visibility = '';
            }
            else {
                this.sectionProperties.container.style.visibility = 'hidden';
            }
            window.L.DomUtil.addClass(this.sectionProperties.container, 'cool-annotation-collapsed-show');
            return true;
        }
        setLayoutClass() {
            this.sectionProperties.container.classList.remove('tracked-deleted-comment-show');
            this.sectionProperties.container.classList.remove('tracked-deleted-comment-hide');
            var showTrackedChanges = this.map['stateChangeHandler'].getItemValue('.uno:ShowTrackedChanges') === 'true';
            var layoutClass = showTrackedChanges ? 'tracked-deleted-comment-show' : 'tracked-deleted-comment-hide';
            if (this.sectionProperties.data.layoutStatus === CommentLayoutStatus.DELETED) {
                this.sectionProperties.container.classList.add(layoutClass);
            }
            this.updateRemovedField();
        }
        show() {
            this.doPendingInitializationInView(true /* force */);
            if (this.hidden === false && !this.isEdit())
                return;
            // A marker belongs on the page its comment is anchored to. The
            // file-based view has every page on display at once, so every marker is
            // on screen there; otherwise the current slide carries the markers.
            if (this.isInsideActivePart() || app.file.fileBasedView)
                this.showMarker();
            // On mobile, container shouldn't be 'document-container', but it is 'document-container' on initialization. So we hide the comment until comment wizard is opened.
            if (window.mode.isSmallScreenDevice() && this.sectionProperties.container.parentElement === document.getElementById('document-container'))
                this.sectionProperties.container.style.visibility = 'hidden';
            if (cool.CommentSection.commentWasAutoAdded)
                return;
            // We don't cache the hidden state for spreadsheets. Only one comment can be
            // visible and they're hidden when scrolling, so it's easier this way.
            if (app.map._docLayer._docType === 'text') {
                this.showWriter();
                this.hidden = false;
            }
            else if (app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing') {
                // The flag holds whether the box ended up on display. A comment
                // anchored to another slide or page keeps its box closed, so it
                // stays hidden.
                this.hidden = !this.showImpressDraw();
            }
            else if (app.map._docLayer._docType === 'spreadsheet')
                this.showCalc();
            this.setLayoutClass();
        }
        hideWriter() {
            this.sectionProperties.container.style.visibility = 'hidden';
            this.sectionProperties.nodeModify.style.display = 'none';
            this.sectionProperties.nodeReply.style.display = 'none';
            this.sectionProperties.showSelectedCoordinate = false;
            window.L.DomUtil.removeClass(this.sectionProperties.container, 'cool-annotation-collapsed-show');
            this.cachedIsEdit = false;
            this.setContainerPos(true);
            this.hidden = true;
        }
        hideCalc() {
            if (!window.mode.isSmallScreenDevice())
                this.sectionProperties.container.style.visibility = 'hidden';
            this.sectionProperties.nodeModify.style.display = 'none';
            this.sectionProperties.nodeReply.style.display = 'none';
            this.cachedIsEdit = false;
            if (this.sectionProperties.commentListSection.sectionProperties.selectedComment === this)
                this.sectionProperties.commentListSection.sectionProperties.selectedComment = null;
        }
        hideImpressDraw() {
            // While comments as a whole are hidden, a comment on the current slide or page is hidden
            // along with its marker, the same as a comment on any other slide or page.
            if (!this.isInsideActivePart()
                || this.sectionProperties.commentListSection.sectionProperties.show === false) {
                this.sectionProperties.container.style.display = 'none';
                this.hideMarker();
            }
            else {
                this.sectionProperties.container.style.display = '';
                if (this.isCollapsed)
                    this.sectionProperties.container.style.visibility = 'hidden';
                this.sectionProperties.nodeModify.style.display = 'none';
                this.sectionProperties.nodeReply.style.display = 'none';
                this.cachedIsEdit = false;
                this.setContainerPos(true);
            }
            window.L.DomUtil.removeClass(this.sectionProperties.container, 'cool-annotation-collapsed-show');
            this.hidden = true;
        }
        isAuthor() {
            return this.map.getViewName(app.map._docLayer._viewId) === this.sectionProperties.data.author;
        }
        canRemove() {
            return this.isAuthor() || !this.map.isReadOnlyMode();
        }
        canModerate() {
            return this.isAuthor() || app.isCommentEditingAllowed();
        }
        // check if this is "our" autosaved comment
        // core is not aware it's autosaved one so use this simplified detection based on content
        isAutoSaved() {
            var autoSavedComment = cool.CommentSection.autoSavedComment;
            if (!autoSavedComment)
                return false;
            return this.isAuthor();
        }
        hide() {
            if (this.hidden === true || this.isEdit()) {
                return;
            }
            if (this.sectionProperties.data.id === 'new') {
                this.sectionProperties.commentListSection.removeItem(this.sectionProperties.data.id);
                return;
            }
            if (app.map._docLayer._docType === 'text')
                this.hideWriter();
            else if (app.map._docLayer._docType === 'spreadsheet')
                this.hideCalc();
            else if (app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing')
                this.hideImpressDraw();
        }
        isInsideActivePart() {
            // Impress and Draw only.
            return this.sectionProperties.partIndex === app.map._docLayer._selectedPart;
        }
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        menuOnMouseClick(e) {
            this.openContextMenu();
            window.L.DomEvent.stopPropagation(e);
        }
        onEditComment(e) {
            this.sectionProperties.commentListSection.modify(this);
            window.L.DomEvent.stopPropagation(e);
        }
        editOnKeyPress(e) {
            if (e.code === 'Space' || e.code === 'Enter') {
                this.onEditComment(e);
                window.L.DomEvent.stopPropagation(e);
            }
        }
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        menuOnKeyPress(e) {
            if (e.code === 'Space' || e.code === 'Enter')
                this.openContextMenu();
            window.L.DomEvent.stopPropagation(e);
        }
        openContextMenu() {
            const listSection = this.sectionProperties.commentListSection;
            const data = this.sectionProperties.data;
            const docLayer = app.map._docLayer;
            const entries = [];
            let pos = 0;
            // Honor Hide_Command for entries that map to a UNO command, so a host
            // can suppress comment-dialog actions the same way it suppresses
            // menubar / toolbar items.
            const isShown = (uno) => app.map.uiManager.isCommandVisible(uno);
            if (data.trackchange) {
                entries.push({ text: _('Comment'), type: 'action', id: 'modify', pos: String(pos++) });
            }
            else {
                const isAuthor = this.isAuthor();
                const canRemove = this.canRemove();
                const canModerate = this.canModerate();
                const removeUno = docLayer._docType === 'text' ? '.uno:DeleteComment'
                    : (docLayer._docType === 'spreadsheet' ? '.uno:DeleteNote'
                        : '.uno:DeleteAnnotation');
                if (isAuthor && isShown('.uno:EditAnnotation'))
                    entries.push({ text: _('Modify'), type: 'action', id: 'modify', pos: String(pos++) });
                if (docLayer._docType === 'text' && isShown('.uno:ReplyComment'))
                    entries.push({ text: _('Reply'), type: 'action', id: 'reply', pos: String(pos++) });
                if (canRemove && isShown(removeUno))
                    entries.push({ text: _('Remove'), type: 'action', id: 'remove', pos: String(pos++) });
                if (docLayer._docType === 'text' && this.isRootComment() && canRemove
                    && isShown('.uno:DeleteCommentThread'))
                    entries.push({ text: _('Remove Thread'), type: 'action', id: 'removeThread', pos: String(pos++) });
                const isNonWriterComponent = ['spreadsheet', 'drawing', 'presentation'].includes(docLayer._docType);
                if (canModerate
                    && (docLayer._docType === 'text' || (isNonWriterComponent && data.threaded))
                    && isShown('.uno:ResolveComment'))
                    entries.push({
                        text: data.resolved === 'false' ? _('Resolve') : _('Unresolve'),
                        type: 'action', id: 'resolve', pos: String(pos++),
                    });
                if (docLayer._docType === 'text' && this.isRootComment() && canModerate
                    && isShown('.uno:ResolveCommentThread'))
                    entries.push({
                        text: listSection.isThreadResolved(this) ? _('Unresolve Thread') : _('Resolve Thread'),
                        type: 'action', id: 'resolveThread', pos: String(pos++),
                    });
                if (docLayer._docType === 'text' && !this.isRootComment() && isAuthor
                    && isShown('.uno:PromoteComment'))
                    entries.push({ text: _('Promote to top comment'), type: 'action', id: 'promote', pos: String(pos++) });
                if (docLayer._docType === 'text' && !window.mode.isSmallScreenDevice()) {
                    const isShownBig = listSection.isShownBig(this);
                    entries.push({
                        text: isShownBig ? _('Show on the side') : _('Open in full view'),
                        type: 'action', id: 'showBigger', pos: String(pos++),
                    });
                }
                if ((docLayer._docType === 'text' || docLayer._docType === 'spreadsheet')
                    && !window.mode.isSmallScreenDevice())
                    entries.push({ text: _('Show in navigator'), type: 'action', id: 'showInNavigator', pos: String(pos++) });
            }
            if (entries.length === 0)
                return;
            const menuEl = this.sectionProperties.menu;
            menuEl._onDropDown = function (open) {
                this.sectionProperties.contextMenu = open;
            }.bind(this);
            if (window.mode.isSmallScreenDevice()) {
                const menu = [];
                entries.forEach((entry) => {
                    menu.push({
                        name: entry.text,
                        command: entry.text,
                        callback: () => {
                            this.handleMenuAction(entry.id);
                            if (entry.id !== 'reply' && entry.id !== 'modify')
                                app.map.fire('mobilewizardback');
                        },
                    });
                });
                const menuData = window.L.Control.JSDialogBuilder.getMenuStructureForMobileWizard(menu, true, '');
                app.map.fire('mobilewizard', { data: menuData });
                return;
            }
            const dropdownId = 'comment-menu-' + data.id;
            const callback = function (_objectType, eventType, _object, _data, entry) {
                if (eventType !== 'selected')
                    return false;
                // reply and modify set focus on the comment textbox
                // tell the dropdown not to restore focus in those cases
                const focusHandled = entry?.id === 'reply' || entry?.id === 'modify';
                JSDialog.CloseDropdown(dropdownId, focusHandled);
                this.handleMenuAction(entry?.id);
                return true;
            }.bind(this);
            JSDialog.OpenDropdown(dropdownId, menuEl, entries, callback, '', false, false, true);
        }
        handleMenuAction(id) {
            const listSection = this.sectionProperties.commentListSection;
            switch (id) {
                case 'modify':
                    listSection.modify(this);
                    break;
                case 'reply':
                    listSection.reply(this);
                    break;
                case 'remove':
                    listSection.remove(this.sectionProperties.data.id);
                    break;
                case 'removeThread':
                    listSection.removeThread(this.sectionProperties.data.id);
                    break;
                case 'resolve':
                    listSection.resolve(this);
                    break;
                case 'resolveThread':
                    listSection.resolveThread(this);
                    break;
                case 'promote':
                    listSection.promote(this);
                    break;
                case 'showBigger':
                    listSection.toggleShowBigger(this);
                    break;
                case 'showInNavigator':
                    listSection.showInNavigator(this);
                    break;
            }
        }
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        onMouseClick(e) {
            if ((window.mode.isSmallScreenDevice() || window.mode.isTablet())
                && this.map.getDocType() == 'spreadsheet'
                && !this.map.uiManager.mobileWizard.isOpen()) {
                this.hide();
            }
            window.L.DomEvent.stopPropagation(e);
            this.sectionProperties.commentListSection.click(this);
        }
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        onCommentKeyDown(e) {
            if (!window.mode.isDesktop()) {
                return;
            }
            if (e.key !== 'Escape')
                this.clearStatus(); // the Escape hint is stale after any other key
            if (this.isCtrlEnter(e)) {
                e.preventDefault();
                e.stopPropagation();
                this.handleCommentCtrlEnter(e);
                return;
            }
            if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && e.key === 'F12') {
                // back to the caret, which Alt+F12 and the Navigator leave at the anchor
                e.preventDefault();
                e.stopPropagation();
                app.map.focus();
                return;
            }
            if (e.key === 'Tab' && this.isEdit()) {
                this.cycleEditFocus(e);
                return;
            }
            if (e.key === 'F6' && !this.sectionProperties.nodeModifyText.contains(e.target)
                && !this.sectionProperties.nodeReplyText.contains(e.target)) {
                window.KeyboardShortcuts.processEvent(app.UI.language.fromURL, e);
                return;
            }
            if (!this.isEdit() && this.moveFocusByKey(e))
                return;
            if (e.key === 'Escape') {
                // When a comment is being edited and focus is in the textbox,
                // Esc should not close it but mark it with attention, unless
                // closing it discards nothing.
                const editingComment = this.isEdit() ? this : Comment.isAnyEdit();
                if (editingComment) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!editingComment.hasUnsavedText()) {
                        editingComment.handleCancelCommentButton(e);
                        return;
                    }
                    this.sectionProperties.commentListSection
                        .addCommentAttention(editingComment);
                    editingComment.announceUnsavedText();
                }
                return;
            }
            if (e.keyCode === 33 || e.keyCode === 34) {
                this.handleCommentPageNav(e);
                return;
            }
        }
        getTabStops() {
            const candidates = this.sectionProperties.container.querySelectorAll('button, a[href], [tabindex="0"]');
            return Array.from(candidates).filter((element) => element.getClientRects().length > 0 && !element.closest('.cool-annotation-edit'));
        }
        focusTabStop(stop) {
            const stops = this.getTabStops();
            let element = stop === 'first' ? stops[0] : stops[stops.length - 1];
            if (stop === 'body' && stops.includes(this.sectionProperties.contentNode))
                element = this.sectionProperties.contentNode;
            if (!element)
                return;
            element.focus({ preventScroll: true });
            this.scrollDocumentToShow(element.getBoundingClientRect());
        }
        moveFocusByKey(e) {
            if (e.ctrlKey || e.altKey || e.metaKey)
                return false;
            const isTab = e.key === 'Tab';
            const isArrow = (e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.shiftKey;
            if (!isTab && !isArrow)
                return false;
            const commentList = this.sectionProperties.commentListSection;
            if (!commentList.getNavigableComments().includes(this))
                return false;
            const stops = this.getTabStops();
            const current = stops.indexOf(e.target);
            if (current === -1)
                return false;
            const forward = isTab ? !e.shiftKey : e.key === 'ArrowDown';
            const content = this.sectionProperties.contentNode;
            if (isArrow && e.target === content) {
                const canScroll = forward
                    ? content.scrollTop + content.clientHeight < content.scrollHeight - 1
                    : content.scrollTop > 0;
                if (canScroll)
                    return false;
            }
            e.preventDefault();
            e.stopPropagation();
            const nextStop = isTab ? stops[current + (forward ? 1 : -1)] : null;
            if (nextStop) {
                nextStop.focus({ preventScroll: true });
                this.scrollDocumentToShow(nextStop.getBoundingClientRect());
                return true;
            }
            const next = commentList.getAdjacentComment(this, forward ? 1 : -1);
            if (next)
                commentList.focusComment(next, isArrow ? 'body' : (forward ? 'first' : 'last'));
            else if (isTab)
                app.map.focus();
            return true;
        }
        scrollDocumentToShowRight() {
            const rect = this.sectionProperties.wrapper.getBoundingClientRect();
            const documentRect = document.getElementById('document-container').getBoundingClientRect();
            const margin = this.sectionProperties.commentListSection.sectionProperties.columnEndMargin;
            const offset = rect.right + margin - documentRect.right;
            if (offset > 0)
                app.activeDocument.activeLayout.scroll(Math.ceil(offset * app.dpiScale), 0);
        }
        scrollDocumentToShow(rect) {
            const documentRect = document.getElementById('document-container').getBoundingClientRect();
            const margin = this.sectionProperties.commentListSection.sectionProperties.marginY / app.dpiScale;
            let offset = 0;
            if (rect.top < documentRect.top + margin)
                offset = rect.top - documentRect.top - margin;
            else if (rect.bottom > documentRect.bottom - margin)
                offset = Math.min(rect.bottom - documentRect.bottom + margin, rect.top - documentRect.top - margin);
            if (offset !== 0)
                app.activeDocument.activeLayout.scroll(0, Math.round(offset * app.dpiScale));
        }
        // Tab/Shift+Tab within the modify or reply pane cycles between the text
        // area and its own buttons, rather than leaving the popup - the "..."
        // menu button in the comment's author row stays out of this order since
        // it belongs to the view pane, not the pane currently being edited.
        cycleEditFocus(e) {
            const props = this.sectionProperties;
            const inReply = props.nodeReply.style.display !== 'none';
            const order = inReply
                ? [props.nodeReplyText, props.cancelReplyButton, props.replyButton]
                : [props.nodeModifyText, props.cancelButton, props.saveButton];
            const current = order.indexOf(document.activeElement);
            if (current === -1)
                return;
            e.preventDefault();
            e.stopPropagation();
            const next = (current + (e.shiftKey ? -1 : 1) + order.length) % order.length;
            order[next].focus();
        }
        /**
         * Workaround for Chrome desktop bug where PageUp/PageDown in a textarea
         * scrolls the page instead of moving the caret.
         * https://issues.chromium.org/issues/41417806
         */
        handleCommentPageNav(e) {
            window.L.DomEvent.preventDefault(e);
            const target = e.target;
            const pos = e.keyCode === 33 ? 0 : target.textLength;
            const currentPos = target.selectionStart;
            if (e.shiftKey) {
                const [start, end] = currentPos <= pos
                    ? [currentPos, pos]
                    : [pos, currentPos];
                target.setSelectionRange(start, end, currentPos > pos ? 'backward' : 'forward');
            }
            else {
                target.setSelectionRange(pos, pos);
            }
        }
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        handleReplyCommentButton(e) {
            cool.CommentSection.autoSavedComment = null;
            cool.CommentSection.commentWasAutoAdded = false;
            this.textAreaInput(null);
            this.onReplyClick(e);
        }
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        onReplyClick(e) {
            window.L.DomEvent.stopPropagation(e);
            if (window.mode.isSmallScreenDevice()) {
                this.sectionProperties.data.reply = this.sectionProperties.data.text;
                this.sectionProperties.commentListSection.saveReply(this);
            }
            else {
                this.removeLastBRTag(this.sectionProperties.nodeReplyText);
                this.sectionProperties.data.reply = this.sectionProperties.nodeReplyText.innerText;
                this.sectionProperties.data.html = this.sectionProperties.nodeReplyText.innerHTML;
                // Assigning an empty string to .innerHTML property in some browsers will convert it to 'null'
                // While in browsers like Chrome and Firefox, a null value is automatically converted to ''
                // Better to assign '' here instead of null to keep the behavior same for all
                this.sectionProperties.nodeReplyText.innerText = '';
                this.show();
                this.sectionProperties.commentListSection.saveReply(this);
            }
        }
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        handleCancelCommentButton(e) {
            if (cool.CommentSection.commentWasAutoAdded) {
                app.sectionContainer.getSectionWithName(app.CSections.CommentList.name).remove(this.sectionProperties.data.id);
            }
            if (cool.CommentSection.autoSavedComment) {
                this.sectionProperties.contentText.origText = this.sectionProperties.contentText.uneditedText;
                this.sectionProperties.contentText.uneditedText = null;
                this.sectionProperties.contentText.origHTML = this.sectionProperties.contentText.uneditedHTML;
                this.sectionProperties.contentText.uneditedHTML = null;
            }
            // These lines are repeated in onCancelClick,
            // it makes things simple by not adding so many condition for different apps and different situation
            // It is mandatory to change these values before handleSaveCommentButton is called
            // calling handleSaveCommentButton in onCancelClick causes problem because that is also called from many other events/function (i.e: onPartChange)
            if (this.sectionProperties.contentText.origHTML) {
                // eslint-disable-next-line no-restricted-syntax -- sanitized markup
                this.sectionProperties.nodeModifyText.innerHTML = app.LOUtil.sanitize(this.sectionProperties.contentText.origHTML);
            }
            else {
                this.sectionProperties.nodeModifyText.innerText = this.sectionProperties.contentText.origText;
            }
            this.sectionProperties.nodeReplyText.innerText = '';
            if (cool.CommentSection.autoSavedComment)
                this.handleSaveCommentButton(e);
            this.onCancelClick(e);
            if (app.map._docLayer._docType === 'spreadsheet')
                this.hideCalc();
            cool.CommentSection.commentWasAutoAdded = false;
            cool.CommentSection.autoSavedComment = null;
        }
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        onCancelClick(e) {
            if (e)
                window.L.DomEvent.stopPropagation(e);
            if (this.sectionProperties.contentText.origHTML) {
                // eslint-disable-next-line no-restricted-syntax -- sanitized markup
                this.sectionProperties.nodeModifyText.innerHTML = app.LOUtil.sanitize(this.sectionProperties.contentText.origHTML);
            }
            else {
                this.sectionProperties.nodeModifyText.innerText = this.sectionProperties.contentText.origText;
            }
            this.sectionProperties.nodeReplyText.innerText = '';
            if (app.map._docLayer._docType !== 'spreadsheet')
                this.show();
            this.sectionProperties.commentListSection.cancel(this);
        }
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        handleSaveCommentButton(e) {
            cool.CommentSection.autoSavedComment = null;
            cool.CommentSection.commentWasAutoAdded = false;
            this.sectionProperties.contentText.uneditedText = null;
            this.sectionProperties.contentText.uneditedHTML = null;
            this.textAreaInput(null);
            this.onSaveComment(e);
        }
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        onSaveComment(e) {
            this.sectionProperties.commentContainerRemoved = true;
            window.L.DomEvent.stopPropagation(e);
            this.removeLastBRTag(this.sectionProperties.nodeModifyText);
            this.sectionProperties.data.text = this.sectionProperties.nodeModifyText.innerText;
            this.sectionProperties.data.html = this.sectionProperties.nodeModifyText.innerHTML;
            this.updateContent();
            this.updateMetadata();
            if (!cool.CommentSection.autoSavedComment)
                this.show();
            this.sectionProperties.commentListSection.save(this);
        }
        // for some reason firefox adds <br> at of the end of text in contenteditable div
        // there have been similar reports: https://bugzilla.mozilla.org/show_bug.cgi?id=1615852
        removeLastBRTag(element) {
            if (!window.L.Browser.gecko)
                return;
            const brElements = element.querySelectorAll('br');
            if (brElements.length > 0)
                brElements[brElements.length - 1].remove();
        }
        hasUnsavedText() {
            // Cancel deletes an autosaved new comment and reverts an autosaved edit
            if (cool.CommentSection.autoSavedComment || cool.CommentSection.commentWasAutoAdded)
                return true;
            const props = this.sectionProperties;
            if (props.nodeReply.style.display !== 'none')
                return props.nodeReplyText.innerText.trim() !== '';
            return this.isModifiedTextChanged();
        }
        isModifiedTextChanged() {
            const props = this.sectionProperties;
            // a new comment has no original text; one without HTML, as in Impress, has text only
            const origHTML = props.contentText.origHTML || '';
            if (origHTML) {
                const node = props.nodeModifyText.cloneNode(true);
                this.removeLastBRTag(node);
                return origHTML !== node.innerHTML;
            }
            // innerText has line breaks and single spaces only where the element is laid out
            const text = (s) => s.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
            return text(props.contentText.origText || '') !== text(props.nodeModifyText.innerText);
        }
        announceUnsavedText() {
            const props = this.sectionProperties;
            const cancel = props.nodeReply.style.display !== 'none' ? props.cancelReplyButton : props.cancelButton;
            const status = props.statusNode;
            // a live region is announced on a change, so empty it for a repeated Escape
            this.clearStatus();
            props.statusTimer = setTimeout(() => {
                status.textContent = _('Press Ctrl + Enter to post, or %1 to discard').replace('%1', cancel.value);
            }, 100);
        }
        clearStatus() {
            clearTimeout(this.sectionProperties.statusTimer);
            this.sectionProperties.statusNode.textContent = '';
        }
        isNodeEmpty() {
            this.removeLastBRTag(this.sectionProperties.nodeModifyText);
            if (this.sectionProperties.nodeModifyText.innerText == "" &&
                this.sectionProperties.nodeModifyText.innerHTML == "")
                return true;
            return false;
        }
        updateControl(button, label, className) {
            if (button) {
                button.value = label;
                button.classList.add(className);
            }
        }
        updateSaveControls() {
            this.updateControl(this.sectionProperties.saveButton, _('Saved'), 'annotation-button-autosaved');
            this.updateControl(this.sectionProperties.cancelButton, _('Delete'), 'annotation-button-delete');
        }
        updateReplyControls() {
            this.updateControl(this.sectionProperties.replyButton, _('Saved'), 'annotation-button-autosaved');
            this.updateControl(this.sectionProperties.cancelReplyButton, _('Delete'), 'annotation-button-delete');
        }
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        onLostFocus(e) {
            if (!this.isEdit() || this.sectionProperties.container.contains(e.relatedTarget))
                return;
            // The card loses the focus while the layout moves it into or out of a
            // page's box. The user has not left it.
            if (this.sectionProperties.commentListSection.movingCards)
                return;
            if (this.sectionProperties.nodeReply.contains(e.target)) {
                this.onLostFocusReply(e);
                return;
            }
            if (app.map._docLayer._docType === 'text' && this.map.mention?.isTypingMention()) {
                return;
            }
            if (!this.sectionProperties.commentContainerRemoved) {
                $(this.sectionProperties.container).removeClass('annotation-active reply-annotation-container modify-annotation-container');
                // compared before the last <br> goes, as the comparison drops it itself
                const isChanged = this.isModifiedTextChanged();
                this.removeLastBRTag(this.sectionProperties.nodeModifyText);
                if (isChanged) {
                    if (!document.hasFocus())
                        app.definitions.CommentSection.needFocus = this;
                    if (!this.sectionProperties.contentText.uneditedHTML)
                        this.sectionProperties.contentText.uneditedHTML = this.sectionProperties.contentText.origHTML;
                    if (!this.sectionProperties.contentText.uneditedText)
                        this.sectionProperties.contentText.uneditedText = this.sectionProperties.contentText.origText;
                    cool.CommentSection.autoSavedComment = this;
                    this.onSaveComment(e);
                }
                else if (this.containerObject.testing) {
                    var insertButton = document.getElementById('menu-insertcomment');
                    if (insertButton) {
                        if (window.getComputedStyle(insertButton).display === 'none') {
                            this.onCancelClick(e);
                        }
                    }
                }
                else if (app.map._docLayer._docType === 'text' && this.isNodeEmpty())
                    this.onCancelClick(e);
            }
        }
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        onLostFocusReply(e) {
            if (app.map._docLayer._docType === 'text' && this.map.mention?.isTypingMention()) {
                return;
            }
            if (this.sectionProperties.nodeReplyText.innerText !== '') {
                if (!document.hasFocus())
                    app.definitions.CommentSection.needFocus = this;
                if (!this.sectionProperties.contentText.uneditedHTML)
                    this.sectionProperties.contentText.uneditedHTML = this.sectionProperties.contentText.origHTML;
                if (!this.sectionProperties.contentText.uneditedText)
                    this.sectionProperties.contentText.uneditedText = this.sectionProperties.contentText.origText;
                cool.CommentSection.autoSavedComment = this;
                this.onReplyClick(e);
            }
            else {
                this.sectionProperties.nodeReply.style.display = 'none';
                if (!this.sectionProperties.nodeModify || this.sectionProperties.nodeModify.style.display === 'none') {
                    this.cachedIsEdit = false;
                    if (app.map._docLayer._docType !== 'spreadsheet') {
                        this.setContainerPos(true);
                    }
                }
            }
        }
        resetControl(button, label, className) {
            if (button) {
                button.value = label;
                button.classList.remove(className);
            }
        }
        resetSaveControls() {
            this.resetControl(this.sectionProperties.saveButton, _('Save'), 'annotation-button-autosaved');
            this.resetControl(this.sectionProperties.cancelButton, _('Cancel'), 'annotation-button-delete');
        }
        resetReplyControls() {
            this.resetControl(this.sectionProperties.replyButton, _('Reply'), 'annotation-button-autosaved');
            this.resetControl(this.sectionProperties.cancelReplyButton, _('Cancel'), 'annotation-button-delete');
        }
        focus() {
            this.sectionProperties.container.classList.add('annotation-active');
            this.sectionProperties.nodeModifyText.focus({ focusVisible: true });
            this.sectionProperties.nodeReplyText.focus({ focusVisible: true });
            // set cursor at the last position on refocus after autosave
            if (this.isModifying() && this.sectionProperties.nodeModifyText.childNodes.length > 0) {
                var range = document.createRange();
                var sel = document.getSelection();
                range.setStartAfter(this.sectionProperties.nodeModifyText.lastChild);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
            this.resetSaveControls();
            this.resetReplyControls();
        }
        focusLost() {
            this.updateSaveControls();
            this.updateReplyControls();
        }
        reply() {
            this.sectionProperties.container.classList.add('reply-annotation-container');
            this.sectionProperties.container.style.visibility = '';
            this.sectionProperties.contentNode.style.display = '';
            this.sectionProperties.nodeModify.style.display = 'none';
            this.sectionProperties.nodeReply.style.display = '';
            this.cachedIsEdit = true;
            if (app.map._docLayer._docType !== 'spreadsheet') {
                this.setContainerPos(true);
            }
            return this;
        }
        edit() {
            this.doPendingInitializationInView(true /* force */);
            this.sectionProperties.container.classList.add('modify-annotation-container');
            this.sectionProperties.nodeModify.style.display = '';
            this.sectionProperties.nodeReply.style.display = 'none';
            this.sectionProperties.container.style.visibility = '';
            this.sectionProperties.contentNode.style.display = 'none';
            this.cachedIsEdit = true;
            if (app.map._docLayer._docType !== 'spreadsheet') {
                this.setContainerPos(true);
            }
            return this;
        }
        isEdit() {
            return this.cachedIsEdit;
        }
        isModifying() {
            return !this.pendingInit && this.sectionProperties.nodeModify && this.sectionProperties.nodeModify.style.display !== 'none';
        }
        static isAnyEdit() {
            var section = app.sectionContainer && app.sectionContainer instanceof CanvasSectionContainer ?
                app.sectionContainer.getSectionWithName(app.CSections.CommentList.name) : null;
            if (!section) {
                return null;
            }
            var commentList = section.sectionProperties.commentList;
            for (var i in commentList) {
                var modifyNode = commentList[i].sectionProperties.nodeModify;
                var replyNode = commentList[i].sectionProperties.nodeReply;
                if (!commentList[i].pendingInit &&
                    ((modifyNode && modifyNode.style.display !== 'none') ||
                        (replyNode && replyNode.style.display !== 'none')))
                    return commentList[i];
            }
            return null;
        }
        static isAnyFocus() {
            const comment_ = Comment.isAnyEdit();
            // We have a comment in edit mode. Is it focused?
            if (comment_ && (document.activeElement === comment_.sectionProperties.nodeModifyText || document.activeElement === comment_.sectionProperties.nodeReplyText))
                return true;
            return false;
        }
        isDisplayed() {
            return (this.sectionProperties.container.style && this.sectionProperties.container.style.visibility === '');
        }
        onResize() {
            this.updatePosition();
        }
        isSelected() {
            return this.sectionProperties.commentListSection.sectionProperties.selectedComment === this;
        }
        /*
            point is the core pixel coordinate of the cursor.
            Not adjusted according to the view.
            For adjusting, we need to take document top left and documentAnchor top left into account.
            No need to do that for now.
        */
        checkIfCursorIsOnThisCommentWriter(newPosition) {
            if (this.sectionProperties.commentListSection.sectionProperties.show == false)
                return;
            if (this.sectionProperties.commentListSection.cursorMovedByRemove)
                return;
            const rectangles = this.sectionProperties.data.rectangles;
            for (var i = 0; i < rectangles.length; i++) {
                if (rectangles[i].containsPoint([newPosition.x1, newPosition.y1])) {
                    if (!this.isSelected())
                        this.sectionProperties.commentListSection.selectById(this.sectionProperties.data.id);
                    this.stopPropagating();
                    return;
                }
            }
            // If we are here, this comment is not selected.
            if (this.isSelected()) {
                if (this.isCollapsed)
                    this.setCollapsed();
                this.sectionProperties.commentListSection.unselect();
            }
        }
        /// This event is Writer-only. Fired by CanvasSectionContainer.
        onCursorPositionChanged(newPosition) {
            if (this.sectionProperties.data.rectangles) {
                this.checkIfCursorIsOnThisCommentWriter(newPosition);
            }
        }
        /// This event is Calc-only. Fired by CanvasSectionContainer.
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        onCellAddressChanged() {
            if (this.sectionProperties.data.rectangles) {
                if (this.sectionProperties.data.rectangles[0].containsPoint(app.calc.cellCursorRectangle.center))
                    this.sectionProperties.commentListSection.sectionProperties.calcCurrentComment = this;
                else if (this.isSelected()) {
                    if (!this.sectionProperties.commentListSection.sectionProperties.doNotHideCommentTimer) {
                        this.hide();
                        this.sectionProperties.commentListSection.sectionProperties.calcCurrentComment = null;
                    }
                }
                else if (this.sectionProperties.commentListSection.sectionProperties.calcCurrentComment == this)
                    this.sectionProperties.commentListSection.sectionProperties.calcCurrentComment = null;
            }
        }
        sendClickToCore(point, count) {
            /*
                On Calc, comments are shown when user focuses to the cell or moves the mouse pointer over the cell.
                Comment class (this class) covers the cell area. So the document is blocked now.
                We need to pass the click and double click events to the document.
            */
            app.map._docLayer._postMouseEvent('buttondown', point.x, point.y, count, 1, 0);
            app.map._docLayer._postMouseEvent('buttonup', point.x, point.y, count, 1, 0);
            app.map.focus();
        }
        onClick(point, e) {
            const docType = app.map._docLayer._docType;
            if (['presentation', 'drawing'].includes(docType)) {
                this.sectionProperties.commentListSection.selectById(this.sectionProperties.data.id);
                // This click selected the comment. Stop it from reaching the document
                // view, where the canvas-targeted listener would treat it as a click
                // outside the comment and close it again. The marker sub section stops
                // its own click for the same reason.
                e.stopPropagation();
                this.stopPropagating();
            }
            else if (docType === 'text') {
                app.activeDocument.mouseControl.onClick(this.toMouseControlLocal(point), e);
            }
            else if (docType === 'spreadsheet') {
                point.pX += this.position[0];
                point.pY += this.position[1];
                this.sendClickToCore(point, 1);
            }
        }
        onDoubleClick(point, e) {
            if ('spreadsheet' === app.map._docLayer._docType) {
                point.pX += this.position[0];
                point.pY += this.position[1];
                this.sendClickToCore(point, 2);
            }
        }
        onDraw() {
            if (this.sectionProperties.showSelectedCoordinate) {
                if (app.map._docLayer._docType === 'text') {
                    const rectangles = this.sectionProperties.data.rectangles;
                    if (rectangles) {
                        this.context.translate(-this.myTopLeft[0], -this.myTopLeft[1]);
                        this.context.fillStyle = this.sectionProperties.usedTextColor;
                        this.context.globalAlpha = 0.25;
                        for (let i = 0; i < rectangles.length; i++) {
                            const height = Math.max(rectangles[i].v4Y - rectangles[i].v1Y, 3);
                            const width = Math.max(rectangles[i].v4X - rectangles[i].v1X, 3);
                            this.context.fillRect(rectangles[i].v1X, rectangles[i].v1Y, width, height);
                        }
                        this.context.globalAlpha = 1;
                        this.context.translate(this.myTopLeft[0], this.myTopLeft[1]);
                    }
                }
                else if (app.map._docLayer._docType === 'spreadsheet' &&
                    parseInt(this.sectionProperties.data.tab) === app.map._docLayer._selectedPart &&
                    // Don't draw with stale section myTopLeft after a tab-switch.
                    // Wait for a 'commandstatechanged'.
                    this.sectionProperties.commentListSection.sectionProperties.calcCommandStateChanged === true) {
                    var cellSize = this.calcOptimumSizeForCalc();
                    if (cellSize[0] !== 0 && cellSize[1] !== 0) { // don't draw notes in hidden cells
                        // dim scales the marker with the zoom level.
                        var margin = 1;
                        var baseSize = 2;
                        var zoom = this.map.getZoom();
                        var dim = baseSize + zoom;
                        const isRTL = this.isCalcRTL();
                        // Anchor at the cell's outer-top corner and grow inward;
                        // in RTL the section is mirrored (see note above).
                        const sign = isRTL ? -1 : 1;
                        const ax = isRTL ? -cellSize[0] + margin : cellSize[0] - margin;
                        const px = (o) => ax - sign * o;
                        this.context.fillStyle = getComputedStyle(document.body).getPropertyValue('--color-calc-comment');
                        var region = new Path2D();
                        if (this.sectionProperties.data.threaded) {
                            // Threaded comment: a speech-bubble icon with a tail
                            // hanging from the inner-bottom corner.
                            var bodyW = dim * 0.72;
                            var bodyH = dim * 0.52;
                            var tailH = dim * 0.26;
                            var tailW = dim * 0.36;
                            region.moveTo(px(0), 0);
                            region.lineTo(px(bodyW), 0);
                            region.lineTo(px(bodyW), bodyH + tailH);
                            region.lineTo(px(bodyW - tailW), bodyH);
                            region.lineTo(px(0), bodyH);
                        }
                        else {
                            // Plain note: the classic corner triangle.
                            region.moveTo(px(0), 0);
                            region.lineTo(px(dim), 0);
                            region.lineTo(px(0), dim);
                        }
                        region.closePath();
                        this.context.fill(region);
                    }
                }
            }
        }
        // Comment-local + this.myTopLeft is the canvas-pixel coordinate; MouseControl
        // is bound to the tiles section and expects its argument in that section's
        // local frame, which is offset from canvas by the document anchor (e.g. the
        // ruler height in Writer). Without removing the anchor, forwarded events
        // drift by that amount.
        toMouseControlLocal(point) {
            const docAnchor = app.sectionContainer.getDocumentAnchor();
            const result = point.clone();
            result.pX += this.myTopLeft[0] - docAnchor[0];
            result.pY += this.myTopLeft[1] - docAnchor[1];
            return result;
        }
        // In Writer, a comment-highlighted region overlays the document. By default
        // this section would swallow mouse events, so neither a text selection drag
        // nor a plain hover started on top of a commented passage ever reaches core.
        // That means e.g. the tracked-change tooltip is never requested when the
        // change is also covered by a comment. Forward the drag lifecycle
        // (down/move/up) and hover moves to MouseControl while leaving click handling
        // to the existing onClick path.
        forwardWriterMouseEventToCore(handler, point, dragDistance, e) {
            const mousePoint = this.toMouseControlLocal(point);
            const mouseControl = app.activeDocument.mouseControl;
            if (handler === 'onMouseMove')
                mouseControl.onMouseMove(mousePoint, dragDistance, e);
            else if (handler === 'onMouseDown')
                mouseControl.onMouseDown(mousePoint, e);
            else
                mouseControl.onMouseUp(mousePoint, e);
        }
        onMouseDown(point, e) {
            if (app.map._docLayer._docType === 'text')
                this.forwardWriterMouseEventToCore('onMouseDown', point, [0, 0], e);
        }
        onMouseMove(point, dragDistance, e) {
            // Forward both drags (text selection) and plain hovers (so core can
            // request tooltips, e.g. for tracked changes under the comment).
            if (app.map._docLayer._docType === 'text')
                this.forwardWriterMouseEventToCore('onMouseMove', point, dragDistance, e);
        }
        onMouseUp(point, e) {
            // A drag finishing on top of a commented region: let MouseControl
            // send the matching buttonup so core completes the selection.
            if (this.containerObject.isDraggingSomething() && app.map._docLayer._docType === 'text') {
                this.forwardWriterMouseEventToCore('onMouseUp', point, [0, 0], e);
                return;
            }
            // Hammer.js doesn't fire onClick event after touchEnd event.
            // CanvasSectionContainer fires the onClick event. But since Hammer.js is used for map, it disables the onClick for SectionContainer.
            // We will use this event as click event on touch devices, until we remove Hammer.js (then this code will be removed from here).
            // Control.ColumnHeader.js file is not affected by this situation, because map element (so Hammer.js) doesn't cover headers.
            if (!this.containerObject.isDraggingSomething() && window.mode.isSmallScreenDevice() || window.mode.isTablet()) {
                if (app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing')
                    app.map._docLayer._openCommentWizard(this);
                this.onMouseEnter();
                this.onClick(point, e);
            }
        }
        calcContinueWithMouseEvent() {
            if (app.map._docLayer._docType === 'spreadsheet') {
                var conditions = !this.isEdit();
                if (conditions) {
                    var sc = this.sectionProperties.commentListSection.sectionProperties.selectedComment;
                    if (sc)
                        conditions = sc.sectionProperties.data.id !== 'new';
                }
                return conditions;
            }
            else {
                return false;
            }
        }
        calcCellSize() {
            var cellPos = app.map._docLayer._cellRangeToTwipRect(this.sectionProperties.data.cellRange).toRectangle();
            return [Math.round((cellPos[2]) * app.twipsToPixels), Math.round((cellPos[3]) * app.twipsToPixels)];
        }
        calcOptimumSizeForCalc() {
            const size = this.calcCellSize();
            if (size[0] > this.sectionProperties.calcCommentAreaWidth)
                size[0] = this.sectionProperties.calcCommentAreaWidth;
            return size;
        }
        onMouseEnter() {
            if (this.calcContinueWithMouseEvent()) {
                // When mouse is above this section, comment's HTML element will be shown.
                // If mouse pointer goes to HTML element, onMouseLeave event shouldn't be fired.
                // But mouse pointer will have left the borders of this section and onMouseLeave event will be fired.
                // Let's do it properly, when mouse is above this section, we will make this section's size bigger and onMouseLeave event will not be fired.
                if (parseInt(this.sectionProperties.data.tab) === app.map._docLayer._selectedPart) {
                    var sc = this.sectionProperties.commentListSection.sectionProperties.selectedComment;
                    if (sc) {
                        if (!sc.isEdit())
                            sc.hide();
                        else
                            return; // Another comment is being edited. Return.
                    }
                    var containerWidth = this.sectionProperties.container.getBoundingClientRect().width;
                    var cellPos = app.map._docLayer._cellRangeToTwipRect(this.sectionProperties.data.cellRange).toRectangle();
                    this.size = [Math.round((cellPos[2]) * app.twipsToPixels + containerWidth), Math.round((cellPos[3]) * app.twipsToPixels)];
                    this.sectionProperties.commentListSection.selectById(this.sectionProperties.data.id);
                    this.show();
                }
            }
        }
        onMouseLeave(point) {
            if (this.calcContinueWithMouseEvent()) {
                if (parseInt(this.sectionProperties.data.tab) === app.map._docLayer._selectedPart) {
                    // Revert the changes we did on "onMouseEnter" event.
                    this.size = this.calcOptimumSizeForCalc();
                    if (point) {
                        this.hide();
                    }
                }
            }
        }
        onNewDocumentTopLeft() {
            this.doPendingInitializationInView();
            this.updatePosition();
        }
        onCommentDataUpdate() {
            this.doPendingInitializationInView();
            this.updatePosition();
        }
        onRemove() {
            this.sectionProperties.commentContainerRemoved = true;
            if (this.sectionProperties.onUpdatePermissionBound) {
                app.events.off('updatepermission', this.sectionProperties.onUpdatePermissionBound);
                this.sectionProperties.onUpdatePermissionBound = null;
            }
            if (this.sectionProperties.commentListSection.sectionProperties.selectedComment === this)
                this.sectionProperties.commentListSection.sectionProperties.selectedComment = null;
            this.sectionProperties.commentListSection.forgetCommentSearchHit(this);
            this.sectionProperties.commentListSection.hideArrow();
            var container = this.sectionProperties.container;
            if (this.sectionProperties.commentMarkerSubSection !== null)
                app.sectionContainer.removeSection(this.sectionProperties.commentMarkerSubSection.name);
            if (this.sectionProperties.commentAnchorAreaSubSection !== null)
                app.sectionContainer.removeSection(this.sectionProperties.commentAnchorAreaSubSection.name);
            if (container && container.parentElement) {
                var c = 0;
                while (c < 10) {
                    try {
                        container.parentElement.removeChild(container);
                        break;
                    }
                    catch (e) {
                        c++;
                    }
                }
            }
        }
        isRootComment() {
            return this.sectionProperties.data.parent === '0';
        }
        setAsRootComment() {
            this.sectionProperties.data.parent = '0';
            if (app.map._docLayer._docType === 'text')
                this.sectionProperties.data.parentId = '0';
        }
        getChildrenLength() {
            return this.sectionProperties.children.length;
        }
        getChildByIndex(index) {
            if (this.sectionProperties.children.length > index)
                return this.sectionProperties.children[index];
            else
                return null;
        }
        removeChildByIndex(index) {
            if (this.sectionProperties.children.length > index)
                this.sectionProperties.children.splice(index, 1);
        }
        getParentCommentId() {
            if (this.sectionProperties.data.parent && this.sectionProperties.data.parent !== '0')
                return this.sectionProperties.data.parent;
            else
                return null;
        }
        getIndexOfChild(comment) {
            return this.sectionProperties.children.indexOf(comment);
        }
        getChildLevel() {
            if (this.isRootComment())
                return 0;
            const parentComment = this.sectionProperties.commentListSection.getComment(this.getParentCommentId());
            if (parentComment)
                return parentComment.getChildLevel() + 1;
            return 1; // Comment list not fully initialized but we know we are not root
        }
        getCommentHeight(invalidateCache = true) {
            if (invalidateCache)
                this.cachedCommentHeight = null;
            if (this.cachedCommentHeight === null)
                this.cachedCommentHeight = this.sectionProperties.container.getBoundingClientRect().height;
            return this.cachedCommentHeight;
        }
        setCollapsed() {
            this.isCollapsed = true;
            // A collapsed comment shows only its avatar bubble, and only on the slide
            // it belongs to; on any other slide it is fully hidden. In the file-based
            // view every page is on display at once, so every comment keeps its
            // bubble. A comment in edit state falls through instead, taking the same
            // route as on the displayed slide, where the code below closes its box.
            if ((app.map._docLayer._docType === 'presentation' ||
                app.map._docLayer._docType === 'drawing') &&
                !app.file.fileBasedView &&
                !this.isInsideActivePart() &&
                !this.isEdit()) {
                this.hide();
                return;
            }
            if (this.sectionProperties.commentListSection.sectionProperties.show != false && !this.isEdit()) {
                this.show();
                this.sectionProperties.commentListSection.removeCommentAttention(this);
            }
            if (this.isRootComment() || app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing') {
                this.sectionProperties.container.style.display = '';
                this.sectionProperties.container.style.visibility = 'hidden';
            }
            this.updateThreadInfoIndicator();
            if (this.sectionProperties.data.resolved === 'false'
                || this.sectionProperties.commentListSection.sectionProperties.showResolved
                || app.map._docLayer._docType === 'presentation'
                || app.map._docLayer._docType === 'drawing')
                window.L.DomUtil.addClass(this.sectionProperties.container, 'cool-annotation-collapsed-show');
        }
        updateThreadInfoIndicator(replycount = -1) {
            if (app.map._docLayer._docType === 'spreadsheet')
                return;
            var innerText;
            if (this.isEdit())
                innerText = '!';
            else if (replycount === '!' || typeof replycount === "number" && replycount > 0)
                innerText = replycount;
            else
                innerText = '';
            if (this.sectionProperties.collapsedInfoNode.innerText != innerText)
                this.sectionProperties.collapsedInfoNode.innerText = innerText;
            const containerVisible = this.isContainerVisible();
            if (innerText === '' || containerVisible)
                this.sectionProperties.collapsedInfoNode.style.display = 'none';
            else if (!containerVisible && innerText !== '')
                this.sectionProperties.collapsedInfoNode.style.display = '';
        }
        setExpanded() {
            if (!this.isCollapsed)
                return;
            this.isCollapsed = false;
            // While comments as a whole are hidden, the box stays hidden and only the collapsed state
            // is cleared.
            if (this.sectionProperties.commentListSection.sectionProperties.show !== false
                && (app.map.getDocType() !== 'text' // Comments are resolved only in writer, always show in other apps
                    || this.sectionProperties.data.resolved === 'false'
                    || this.sectionProperties.commentListSection.sectionProperties.showResolved)) {
                this.sectionProperties.container.style.display = '';
                // For presentations, only expand if the comment is on the active slide.
                if ((app.map.getDocType() !== 'presentation' && app.map.getDocType() !== 'drawing') || this.isInsideActivePart()) {
                    this.sectionProperties.container.style.visibility = '';
                }
            }
            if (app.map._docLayer._docType === 'text')
                this.sectionProperties.collapsedInfoNode.style.display = 'none';
            window.L.DomUtil.removeClass(this.sectionProperties.container, 'cool-annotation-collapsed-show');
        }
        // Returns the text node and the offset in it for an offset into all the text of an element.
        static getTextPosition(element, offset) {
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
            let remaining = offset;
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                const length = node.length;
                if (remaining <= length)
                    return { node: node, offset: remaining };
                remaining -= length;
            }
            return null;
        }
        // Selects text of this comment. searchText is the selected text, and searchOccurrence is the
        // number of times it starts earlier in the paragraph. When they are given, they place the
        // selection, because the paragraph here writes each link out and shortens the links that
        // Autolinker finds, while the indexes count the text as the document engine has it.
        selectText(startParagraph, startIndex, endParagraph, endIndex, searchText, searchOccurrence) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            const paragraphElements = Array.from(this.sectionProperties.contentText.firstChild.children);
            if (paragraphElements.length === 0) {
                return;
            }
            if (startParagraph > paragraphElements.length - 1 || endParagraph > paragraphElements.length - 1) {
                return;
            }
            const startElement = paragraphElements[startParagraph];
            const endElement = paragraphElements[endParagraph];
            if (searchText && startParagraph === endParagraph) {
                const paragraphText = startElement.textContent;
                let found = paragraphText.indexOf(searchText);
                for (let i = 0; found >= 0 && i < searchOccurrence; i++)
                    found = paragraphText.indexOf(searchText, found + 1);
                if (found >= 0) {
                    startIndex = found;
                    endIndex = found + searchText.length;
                }
            }
            const start = Comment.getTextPosition(startElement, startIndex);
            const end = Comment.getTextPosition(endElement, endIndex);
            if (!start || !end)
                return;
            // Create and apply the selection range
            const range = document.createRange();
            range.setStart(start.node, start.offset);
            range.setEnd(end.node, end.offset);
            selection.addRange(range);
            // Ensure the selection is visible
            this.sectionProperties.contentText.focus();
            this.searchSelectionPending = true;
            this.revealSearchSelection();
        }
        // Scrolls the text of this comment to the text that selectText selected, and scrolls the
        // document when that text is outside the document area, as a reply below the view can be. The
        // text of a long comment scrolls inside its card, and the card moves with the document. While
        // the comment is hidden, the selection waits for the layout that shows it.
        revealSearchSelection() {
            if (!this.searchSelectionPending)
                return;
            const selection = window.getSelection();
            const contentNode = this.sectionProperties.contentNode;
            if (!selection.rangeCount || !contentNode.contains(selection.anchorNode)) {
                this.searchSelectionPending = false;
                return;
            }
            const contentRect = contentNode.getBoundingClientRect();
            if (contentRect.height === 0)
                return;
            const selectionRect = selection.getRangeAt(0).getBoundingClientRect();
            if (selectionRect.top < contentRect.top || selectionRect.bottom > contentRect.bottom)
                contentNode.scrollTop += selectionRect.top - contentRect.top
                    - (contentRect.height - selectionRect.height) / 2;
            this.searchSelectionPending = false;
            this.scrollDocumentToShow(selection.getRangeAt(0).getBoundingClientRect());
        }
        // Drops the text that selectText selected, when it is still selected.
        clearSearchSelection() {
            this.searchSelectionPending = false;
            const selection = window.getSelection();
            if (selection && selection.rangeCount
                && this.sectionProperties.contentText.contains(selection.anchorNode))
                selection.removeAllRanges();
        }
        autoCompleteMention(username, profileLink, replacement) {
            const selection = window.getSelection();
            if (!selection)
                return;
            const editorElement = this.getActiveEditorElement();
            let range = null;
            if (selection.rangeCount) {
                const candidateRange = selection.getRangeAt(0);
                if (!editorElement ||
                    editorElement.contains(candidateRange.startContainer))
                    range = candidateRange;
            }
            const container = range ? range.startContainer : null;
            let textNode = null;
            let cursorPosition = range ? range.endOffset : 0;
            if (container && container.nodeType === Node.TEXT_NODE) {
                textNode = container;
            }
            else if (!range) {
                if (!editorElement)
                    return;
                const walker = document.createTreeWalker(editorElement, NodeFilter.SHOW_TEXT, null);
                textNode = walker.nextNode();
                if (!textNode) {
                    textNode = document.createTextNode('');
                    editorElement.appendChild(textNode);
                }
                cursorPosition = textNode.textContent?.length ?? 0;
            }
            const containerText = textNode?.textContent || container?.textContent || editorElement?.textContent || '';
            const mentionStart = containerText.lastIndexOf(replacement, cursorPosition);
            if (mentionStart !== -1) {
                const mentionEnd = mentionStart + replacement.length;
                const beforeMention = containerText.substring(0, mentionStart);
                const afterMention = containerText.substring(mentionEnd);
                const hyperlink = document.createElement('a');
                hyperlink.href = profileLink;
                hyperlink.textContent = `@${username}`;
                if (!textNode || !textNode.parentNode) {
                    return;
                }
                textNode.textContent = beforeMention;
                textNode.parentNode?.insertBefore(hyperlink, textNode.nextSibling);
                const afterTextNode = document.createTextNode(afterMention);
                const extraSpaceNode = document.createTextNode('\u00A0');
                hyperlink.parentNode?.insertBefore(extraSpaceNode, hyperlink.nextSibling);
                hyperlink.parentNode?.insertBefore(afterTextNode, extraSpaceNode.nextSibling);
                const newRange = document.createRange();
                newRange.setStartAfter(extraSpaceNode);
                newRange.setEndAfter(extraSpaceNode);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        }
        getActiveEditorElement() {
            if (window.mode.isSmallScreenDevice()) {
                const commentSection = app.sectionContainer.getSectionWithName(app.CSections.CommentList.name);
                const isMobileCommentActive = commentSection?.isMobileCommentActive();
                if (!isMobileCommentActive)
                    return null;
                const mobileCommentModalId = commentSection?.getMobileCommentModalId();
                return document.getElementById(mobileCommentModalId);
            }
            if (this.sectionProperties.nodeModify &&
                this.sectionProperties.nodeModify.style.display !== 'none')
                return this.sectionProperties.nodeModifyText;
            if (this.sectionProperties.nodeReply &&
                this.sectionProperties.nodeReply.style.display !== 'none')
                return this.sectionProperties.nodeReplyText;
            return (this.sectionProperties.nodeModifyText ||
                this.sectionProperties.nodeReplyText ||
                null);
        }
        onContextMenu(point, e) {
            Util.ensureValue(app.activeDocument);
            Util.ensureValue(app.activeDocument.mouseControl);
            const viewed = app.activeDocument.activeLayout.viewedRectangle;
            const anchor = this.containerObject.getDocumentAnchor();
            point.pX = this.myTopLeft[0] + point.pX + viewed.pX1 - anchor[0];
            point.pY = this.myTopLeft[1] + point.pY + viewed.pY1 - anchor[1];
            app.activeDocument.mouseControl.setMousePosition(point);
            app.activeDocument.mouseControl.onContextMenu(point, e);
        }
    }
    cool.Comment = Comment;
})(cool || (cool = {}));
app.definitions.Comment = cool.Comment;
