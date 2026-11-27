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
/*
    The classic way of editing, which follows the office. What its page context and its group
    context do is the same so far, apart from the group one stands in, so it is written once here
    and each context says only what differs.
*/
class ClassicContext {
    constructor(groupStoodIn) {
        this.groupStoodIn = groupStoodIn;
    }
    showsGroupBands() {
        return true;
    }
    /// A group is asked along with everything it holds, a diagram answers on its own.
    theOnesThatHaveASay(objectIds) {
        return RenderGeometrySection.theOnesThatHaveASay(objectIds);
    }
    /*
        A group is named to the engine as the objects it holds. It has no mapping of its own to be
        given - the drawing layer keeps only a rectangle for it, and hands a turn on to what is
        inside it - so naming the group would lose the turn. Naming the objects cannot: each of
        them has a mapping and takes it whole.
    */
    theOnesAChangeNames(objectIds) {
        return RenderGeometrySection.theOnesThatDraw(RenderGeometrySection.standingFor(objectIds));
    }
    /// An object goes where the move takes it.
    heldToItsWay(_objectIds, by) {
        return by;
    }
    /*
        Answers a press from the geometry the client holds, by naming the objects to the engine
        instead of sending the press for it to hit test. A press that meets no object asks for no
        selection at all, which is how the engine is told to drop the one it holds.

        Not taken here: a modifier other than Shift or Ctrl, or a press that meets nothing while
        nothing is selected or on a sheet. On a sheet the cells take that press, and moving the
        cell cursor drops the selection of objects.
    */
    press(hit, modifier) {
        const extending = modifier === app.UNOModifier.SHIFT || modifier === app.UNOModifier.CTRL;
        if (modifier !== 0 && !extending)
            return false;
        /*
            A press inside a group takes hold of the group. What was hit may be an object the
            group holds, and only entering the group reaches that.
        */
        const objectId = hit === undefined
            ? undefined
            : RenderGeometrySection.outermostOf(hit, this.groupStoodIn);
        if (objectId === undefined &&
            (!GraphicSelection.selectedObjectIDs.length ||
                app.map.getDocType() === 'spreadsheet'))
            return false;
        GraphicSelection.selectObjects(this.enteredBy(this.orTheGroup(this.selectionForPress(objectId, extending)), hit === undefined ? [] : [hit]));
        return true;
    }
    /*
        A diagram is never selected on its own, only among several objects: selecting it alone
        enters it. Of its objects, in the order a walk down it meets them, the one under the press
        is taken, else the first - the shape that spans the whole diagram - or going backwards the
        last.
    */
    enteredBy(selection, hits = [], backwards = false) {
        if (selection.length !== 1)
            return selection;
        if (!RenderGeometrySection.objectOf(selection[0])?.isDiagram)
            return selection;
        const objects = RenderGeometrySection.theOnesThatDraw(selection);
        if (!objects.length)
            return selection;
        const hit = hits.find((objectId) => objects.includes(objectId));
        if (hit !== undefined)
            return [hit];
        return [backwards ? objects[objects.length - 1] : objects[0]];
    }
    /*
        The selection to take for that one: as it is where it holds something, and where it holds
        nothing the group one stands in, since standing in a group with nothing selected is no
        place to be. Leaving a group selects it. On the page nothing is selected then.
    */
    orTheGroup(selection) {
        if (selection.length || this.groupStoodIn === undefined)
            return selection;
        return [this.groupStoodIn];
    }
    /*
        A double press on a group that is no diagram enters it: the member hit is selected, which
        puts one in the group's context. Anything else - an object with text, a chart, a diagram,
        empty space - is the engine's, which starts a text edit or activates the object.
    */
    doublePress(hit) {
        if (hit === undefined)
            return false;
        const objectId = RenderGeometrySection.outermostOf(hit, this.groupStoodIn);
        if (objectId === hit)
            return false;
        if (RenderGeometrySection.objectOf(objectId)?.isDiagram)
            return false;
        // a chart that is not active holds no objects to enter, even where its parts are still
        // here until the engine sends it as one again; the engine activates it
        if (!RenderGeometrySection.holdsObjects(objectId))
            return false;
        GraphicSelection.selectObjects([
            RenderGeometrySection.outermostOf(hit, objectId),
        ]);
        GraphicSelection.updateSelectionSection();
        return true;
    }
    /*
        Enter on one selected group that is no diagram enters it, selecting its first object.
        Anything else is the engine's, which starts the text edit of the object selected.
    */
    enterKey() {
        const selected = GraphicSelection.selectedObjectIDs;
        if (selected.length !== 1)
            return false;
        if (RenderGeometrySection.objectOf(selected[0])?.isDiagram)
            return false;
        const held = RenderGeometrySection.heldBy(selected[0]);
        if (!held.length)
            return false;
        GraphicSelection.selectAndShow([held[0]]);
        return true;
    }
    /*
        The states of the commands the client gives itself, from what is selected where one
        stands:
        - Enter Group on one selected group that is no diagram, as Enter and F3 enter it; Leave
          Group wherever one stands in a group; Ungroup where groups or diagrams are selected,
          each of which it takes apart by one level, and otherwise where one stands in a group,
          which it takes apart.
        - Group with two objects or more; aligning, arranging and the position and size with one
          or more; naming with exactly one; spreading out with three or more. As the office does,
          a part inside a 3D scene is neither aligned nor arranged.
        - Bringing to the front and forward where what is selected does not stand at the front
          of its level already, sending to the back and backward where it does not stand at the
          back.
        - By the kind of the objects and what they allow: flipping where none is held in place
          and each may be turned over; changing to curves for one object that may be and is no
          curve yet, or for several of which one may be; the area unless each object is a line
          or a table and one at least is a line, a picture having a fill behind what it shows;
          the line where no table is selected.
          With nothing selected the area and the line are offered, for the objects drawn next.
    */
    commandStates() {
        const selected = GraphicSelection.selectedObjectIDs;
        const count = selected.length;
        const single = count === 1 ? selected[0] : undefined;
        const aGroup = single !== undefined &&
            RenderGeometrySection.holdsObjects(single) &&
            !RenderGeometrySection.objectOf(single)?.isDiagram;
        // The kinds of the parts of a 3D scene, which sit between the scene's and the polygon's.
        const inAScene = selected.some((objectId) => {
            const kind = RenderGeometrySection.objectOf(objectId)?.objectKind ?? 0;
            return kind > 202 && kind <= 209;
        });
        const states = {
            '.uno:EnterGroup': aGroup,
            '.uno:LeaveGroup': this.groupStoodIn !== undefined,
            '.uno:FormatUngroup': this.groupStoodIn !== undefined ||
                selected.some((objectId) => RenderGeometrySection.holdsObjects(objectId)),
            '.uno:FormatGroup': count >= 2,
        };
        for (const command of Interaction.commandsForOneOrMore)
            states[command] =
                count >= 1 && (command === '.uno:TransformDialog' || !inAScene);
        // The places are counted only where every selected object is found at the level.
        if (count >= 1) {
            const level = this.objectsOfTheLevelOf(selected[0]);
            const places = selected
                .map((objectId) => level.indexOf(objectId))
                .filter((place) => place >= 0)
                .sort((a, b) => a - b);
            const atTheBack = places.every((place, at) => place === at);
            const atTheFront = places.every((place, at) => place === level.length - places.length + at);
            if (places.length === count) {
                if (atTheFront)
                    states['.uno:BringToFront'] = states['.uno:ObjectForwardOne'] = false;
                if (atTheBack)
                    states['.uno:SendToBack'] = states['.uno:ObjectBackOne'] = false;
            }
        }
        for (const command of Interaction.commandsForOne)
            states[command] = count === 1;
        for (const command of Interaction.commandsForThreeOrMore)
            states[command] = count >= 3;
        const objects = this.objectsTheCommandsGoTo()
            .map((objectId) => RenderGeometrySection.objectOf(objectId))
            .filter((object) => object !== undefined);
        const kinds = objects.map((object) => object.objectKind ?? 0);
        const flip = objects.length >= 1 &&
            objects.every((object) => !object.cannotBeMoved && !object.cannotBeFlipped);
        states['.uno:FlipHorizontal'] = flip;
        states['.uno:FlipVertical'] = flip;
        // The kinds 10 and 11 are the open and the closed curve.
        states['.uno:ChangeBezier'] =
            objects.length === 1
                ? !objects[0].cannotBeChangedToCurves &&
                    kinds[0] !== 10 &&
                    kinds[0] !== 11
                : objects.some((object) => !object.cannotBeChangedToCurves);
        // The kinds with no area: the line, the arc, the polyline, the open curve, the freehand
        // line and the connector. The table, kind 35, fills its cells with an area of their own.
        const withNoArea = [2, 6, 9, 10, 12, 24];
        states['.uno:FormatArea'] = !(kinds.some((kind) => withNoArea.includes(kind)) &&
            kinds.every((kind) => withNoArea.includes(kind) || kind === 35));
        states['.uno:FormatLine'] = !kinds.includes(35);
        return states;
    }
    /// The objects the commands go to, which are the ones selected.
    objectsTheCommandsGoTo() {
        return GraphicSelection.selectedObjectIDs;
    }
    /*
        Ungroup takes apart the groups and diagrams selected, each by one level, which the engine
        does with what it has marked. With none of them selected it takes apart the group one
        stands in.
    */
    ungroup() {
        const anySelected = GraphicSelection.selectedObjectIDs.some((objectId) => RenderGeometrySection.holdsObjects(objectId));
        if (anySelected || this.groupStoodIn === undefined)
            return false;
        GraphicSelection.takeApart(this.groupStoodIn);
        return true;
    }
    /// Ctrl+F3 leaves the group one stands in, selecting it. On the page there is none to leave.
    leaveKey() {
        if (this.groupStoodIn === undefined)
            return false;
        GraphicSelection.selectAndShow([this.groupStoodIn]);
        return true;
    }
    /*
        The objects one travels through where one stands: the ones the group holds, or those of
        the page. In the order the page draws them, from the back to the front, as the office
        travels.
    */
    objectsOfTheLevel() {
        return this.groupStoodIn === undefined
            ? RenderGeometrySection.heldByThePage()
            : RenderGeometrySection.heldBy(this.groupStoodIn);
    }
    /// The objects at the level of that one, in the order the page draws them, from the back to
    /// the front.
    objectsOfTheLevelOf(objectId) {
        const parent = RenderGeometrySection.parentOf(objectId);
        return parent
            ? RenderGeometrySection.heldBy(parent)
            : RenderGeometrySection.heldByThePage();
    }
    /// Selects that one object alone and brings it on screen, for a key going forwards or, with
    /// backwards set, backwards.
    selectOnly(objectId, backwards = false) {
        GraphicSelection.selectAndShow(this.enteredBy([objectId], [], backwards));
        return true;
    }
    /// Selects that one object alone where the mouse is, which is on screen already, the objects
    /// under the mouse being those.
    selectOnlyHere(objectId, hits) {
        GraphicSelection.selectObjects(this.enteredBy([objectId], hits));
        GraphicSelection.updateSelectionSection();
        return true;
    }
    /*
        Tab selects the next object of the level after the selection, Shift+Tab the one before it,
        going round from the last to the first. With nothing selected it starts at the first, or
        with Shift at the last.
    */
    tabKey(forwards) {
        const level = this.objectsOfTheLevel();
        if (!level.length)
            return false;
        const places = GraphicSelection.selectedObjectIDs
            .map((objectId) => level.indexOf(objectId))
            .filter((place) => place >= 0);
        if (!places.length)
            return this.selectOnly(level[forwards ? 0 : level.length - 1], !forwards);
        const from = forwards ? Math.max(...places) : Math.min(...places);
        const to = (from + (forwards ? 1 : -1) + level.length) % level.length;
        return this.selectOnly(level[to], !forwards);
    }
    /*
        Alt+press goes through the objects under the press, deep: every object on the way from the
        page down to each object the press meets, in the order a walk from the front to the back
        meets them, a group before what it holds. It selects the one after the selected one, or
        with Shift the one before it, going round at either end. So a group is selected first, the
        next press enters it, selecting the member under the press, and after its last member under
        the press one leaves it for the object behind. A diagram's objects under the press are
        stops of their own, its groups and the diagram itself are none, as a diagram is never
        selected alone. With nothing under the press selected, the frontmost is taken.
    */
    altPress(hits, backwards) {
        const order = [];
        for (const hit of hits) {
            // The way from the page down to the object met; inside a diagram only the object.
            const way = [];
            for (let objectId = hit, guard = 0; objectId && guard < 100; objectId = RenderGeometrySection.parentOf(objectId), ++guard) {
                if (RenderGeometrySection.objectOf(objectId)?.isDiagram) {
                    way.length = 0;
                    way.push(hit);
                    continue;
                }
                way.unshift(objectId);
            }
            for (const objectId of way)
                if (!order.includes(objectId))
                    order.push(objectId);
        }
        if (!order.length)
            return false;
        const selected = GraphicSelection.selectedObjectIDs;
        const isSelected = (objectId) => selected.includes(objectId);
        const at = backwards
            ? order.map(isSelected).lastIndexOf(true)
            : order.findIndex(isSelected);
        if (at < 0)
            return this.selectOnlyHere(order[0], hits);
        const next = (at + (backwards ? -1 : 1) + order.length) % order.length;
        return this.selectOnlyHere(order[next], hits);
    }
    /// Ctrl+Home selects the first object of the level, Ctrl+End the last.
    toAnEnd(first) {
        const level = this.objectsOfTheLevel();
        if (!level.length)
            return false;
        return this.selectOnly(level[first ? 0 : level.length - 1], !first);
    }
    /*
        Escape takes the selection away; in a group that selects the group, which leaves it, so
        Escape pressed again and again goes up group by group to the page and to nothing selected.
        With nothing selected it is left to the engine.
    */
    escape() {
        if (!GraphicSelection.selectedObjectIDs.length)
            return false;
        GraphicSelection.selectAndShow(this.orTheGroup([]));
        return true;
    }
    /*
        The selection a press asks for. A plain press asks for the object it meets alone, and none
        where it meets no object. A press with Shift or Ctrl asks for the object to join what is
        selected, or to leave it when it is in there already.

        The objects of one selection all sit at the same level, so an object from another group, or
        from the page while a group's members are selected, starts a selection of its own instead
        of joining one.
    */
    selectionForPress(objectId, extending) {
        const selected = GraphicSelection.selectedObjectIDs;
        if (objectId === undefined)
            return [];
        if (!extending)
            return [objectId];
        if (selected.includes(objectId))
            return selected.filter((selectedId) => selectedId !== objectId);
        const parent = RenderGeometrySection.parentOf(objectId);
        const sameLevel = selected.every((selectedId) => RenderGeometrySection.parentOf(selectedId) === parent);
        return sameLevel ? selected.concat(objectId) : [objectId];
    }
    /*
        A drag that begins on something nobody selected takes hold of the outermost object it
        belongs to, which is the group where it is in one, as long as that may be moved. A diagram
        is taken hold of through its first object, which stands for it, carries the whole of it,
        and is what the engine reports back. A drag with a modifier is the engine's.
    */
    takesHoldFor(hit, modifier) {
        if (modifier !== 0)
            return undefined;
        const objectId = RenderGeometrySection.outermostOf(hit, this.groupStoodIn);
        if (!ObjectHandles.canBeMoved([objectId]))
            return undefined;
        return this.enteredBy([objectId])[0];
    }
    /// An arrow key moves what is selected by the step EditSteps gives for the modifier held.
    arrowKey(towards, event) {
        GraphicSelection.selectionSection?.moveByKey(towards, event);
        return true;
    }
    /*
        Takes hold of the first object of the group that was selected, which is what stepping into
        a group leaves behind. Stepping in leaves nothing selected on its own, and with nothing
        selected there is no band to say which group one is standing in, and nothing to add to
        with a second press either.
    */
    groupEntered() {
        const selected = GraphicSelection.selectedObjectIDs;
        if (selected.length !== 1)
            return;
        const held = RenderGeometrySection.heldBy(selected[0]);
        if (!held.length)
            return;
        GraphicSelection.selectAndShow([held[0]]);
    }
    /*
        What is left of the selection where some of its objects were deleted: the ones that still
        stand. Where none does, one stays in the group they stood in and its first object is
        selected; a group holding nothing is deleted with its last member, so the first group up
        that still stands and holds something is taken, and the page with nothing selected where
        none does.
    */
    whatIsLeft(selected, groupsAbove) {
        const standing = (objectId) => RenderGeometrySection.objectOf(objectId) !== undefined;
        const left = selected.filter(standing);
        if (left.length)
            return left;
        for (const group of groupsAbove) {
            if (!standing(group))
                continue;
            const held = RenderGeometrySection.heldBy(group);
            if (held.length)
                return [held[0]];
        }
        return [];
    }
}
/// The page: what a selection of the page's objects does, and what one does with none.
class ClassicPageContext extends ClassicContext {
    constructor() {
        super(undefined);
    }
    /// With nothing selected an arrow key scrolls the view, as the office does.
    arrowKey(towards, event) {
        if (!GraphicSelection.selectedObjectIDs.length)
            return ClassicPageContext.scroll(towards, event);
        return super.arrowKey(towards, event);
    }
    /*
        Scrolls the view that draws from the objects, whose view is the client's own, by the step
        EditSteps gives for the modifier held.
    */
    static scroll(towards, event) {
        const layout = app.activeDocument?.activeLayout;
        if (layout?.type !== 'ViewLayoutVector')
            return false;
        const view = layout.viewedRectangle;
        const step = EditSteps.scrollStep(event, view.width, view.height);
        layout.scroll(towards.x * step.x * app.twipsToPixels, towards.y * step.y * app.twipsToPixels, true);
        return true;
    }
}
/// A group one stands in, with some of its members selected.
class ClassicGroupContext extends ClassicContext {
    constructor(group) {
        super(group);
    }
}
/*
    A diagram one stands in. Whatever groups a diagram holds for its own reasons stay hidden: its
    objects are one list, in the order a walk down it meets them, the first of them the shape that
    spans the whole diagram. One of them is selected at a time. Leaving the diagram goes to where
    it stands, the page or the group holding it, which stands in for the diagram itself, as a
    diagram is never selected alone.
*/
class ClassicDiagramContext extends ClassicGroupContext {
    constructor(diagram) {
        super(diagram);
        this.diagram = diagram;
    }
    /// The diagram's objects, one list without its groups.
    objectsOfTheLevel() {
        return RenderGeometrySection.theOnesThatDraw([this.diagram]);
    }
    /// The context of the place the diagram stands at.
    around() {
        return Interaction.contextAt(Interaction.placeOf([this.diagram]));
    }
    /// Leaves the diagram: the group holding it is selected, or nothing on the page.
    leave() {
        const holder = RenderGeometrySection.parentOf(this.diagram);
        GraphicSelection.selectAndShow(holder ? [holder] : []);
        return true;
    }
    /*
        A press on an object of the diagram selects it; Shift and Ctrl add nothing there, as one
        object is selected in a diagram at a time. Shift or Ctrl on an object outside the diagram
        selects the whole diagram, as an object, together with it, where the two stand at one
        level, or that object alone where they do not. A plain press anywhere else leaves the
        diagram and is answered as the place around it answers it: another object is selected,
        empty space selects nothing, or the group holding the diagram.
    */
    press(hit, modifier) {
        const extending = modifier === app.UNOModifier.SHIFT || modifier === app.UNOModifier.CTRL;
        if (extending) {
            if (hit === undefined || this.objectsOfTheLevel().includes(hit))
                return true;
            const holder = RenderGeometrySection.parentOf(this.diagram) || undefined;
            const objectId = RenderGeometrySection.outermostOf(hit, holder);
            if (objectId === this.diagram)
                return true;
            const sameLevel = RenderGeometrySection.parentOf(objectId) ===
                RenderGeometrySection.parentOf(this.diagram);
            GraphicSelection.selectObjects(sameLevel
                ? [this.diagram, objectId]
                : this.enteredBy([objectId], [hit]));
            return true;
        }
        if (modifier !== 0)
            return false;
        if (hit !== undefined && this.objectsOfTheLevel().includes(hit)) {
            GraphicSelection.selectObjects([hit]);
            return true;
        }
        return this.around().press(hit, modifier);
    }
    /// A double press is the engine's here, which starts the text edit of the object.
    doublePress(_hit) {
        return false;
    }
    /*
        Escape on an object of the diagram selects its first object, which stands for the whole
        diagram; Escape on that one leaves the diagram.
    */
    escape() {
        const first = this.objectsOfTheLevel()[0];
        if (first !== undefined && GraphicSelection.selectedObjectIDs[0] !== first)
            return this.selectOnly(first);
        return this.leave();
    }
    /// Whether the first object is selected, which stands for the whole diagram: then the
    /// diagram is what is selected, at the level around it.
    wholeSelected() {
        return (GraphicSelection.selectedObjectIDs[0] === this.objectsOfTheLevel()[0]);
    }
    /*
        Leave Group, and Ctrl+F3, on an object of the diagram go to its first object, the whole
        diagram, as Escape does. With the whole diagram selected it is an object at the level
        around it: inside a group they leave that group, selecting it; on the page there is
        nothing to leave.
    */
    leaveKey() {
        if (!this.wholeSelected())
            return this.escape();
        return RenderGeometrySection.parentOf(this.diagram) ? this.leave() : false;
    }
    /// Enter and F3 are the engine's here, Enter starting the text edit of the object.
    enterKey() {
        return false;
    }
    /*
        A diagram gives no hint of being a group but by Ungroup, which is offered wherever one
        stands in it and takes the whole diagram apart. Enter Group is never offered. Leave
        Group is offered inside the diagram, on its other objects, and with the whole diagram
        selected as for any object at the level around it: only where a group holds it. The
        whole diagram is moved and arranged as an object; its other objects take no geometry,
        so nothing that moves, arranges, groups, flips or changes them to curves is offered on
        them, while naming them and their area and line are.
    */
    commandStates() {
        const states = super.commandStates();
        const whole = this.wholeSelected();
        states['.uno:EnterGroup'] = false;
        states['.uno:LeaveGroup'] =
            !whole || !!RenderGeometrySection.parentOf(this.diagram);
        states['.uno:FormatUngroup'] = true;
        if (!whole) {
            states['.uno:FormatGroup'] = false;
            for (const command of Interaction.commandsForOneOrMore)
                states[command] = false;
            for (const command of Interaction.commandsForThreeOrMore)
                states[command] = false;
            states['.uno:FlipHorizontal'] = false;
            states['.uno:FlipVertical'] = false;
            states['.uno:ChangeBezier'] = false;
        }
        return states;
    }
    /// The whole diagram, where its first object stands for it, or the object of it selected.
    objectsTheCommandsGoTo() {
        return this.wholeSelected()
            ? [this.diagram]
            : GraphicSelection.selectedObjectIDs;
    }
    /// Ungroup takes the diagram apart, whichever of its objects is selected.
    ungroup() {
        GraphicSelection.takeApart(this.diagram);
        return true;
    }
    /*
        Tab goes to the next object of the diagram, Shift+Tab to the one before; past the last,
        or before the first, it leaves the diagram for the object after it, or before it, where the
        diagram stands - entering that one where it is a diagram too.
    */
    tabKey(forwards) {
        const objects = this.objectsOfTheLevel();
        const at = objects.indexOf(GraphicSelection.selectedObjectIDs[0]);
        const to = at + (forwards ? 1 : -1);
        if (at >= 0 && to >= 0 && to < objects.length)
            return this.selectOnly(objects[to], !forwards);
        const holder = RenderGeometrySection.parentOf(this.diagram);
        const outside = holder
            ? RenderGeometrySection.heldBy(holder)
            : RenderGeometrySection.heldByThePage();
        const place = outside.indexOf(this.diagram);
        if (place < 0)
            return false;
        const next = (place + (forwards ? 1 : -1) + outside.length) % outside.length;
        return this.selectOnly(outside[next], !forwards);
    }
}
/*
    An object active in place, a chart being edited. It is edited by itself, with an undo of its
    own while it is active, and the engine knows where its window lies, which is an upright
    rectangle also for a turned object. So everything goes to the engine and the object: presses
    in its window are the object's, one outside leaves it, and the keys, Escape among them, are
    the object's first. Nothing is selected or changed here and no command is offered here.
*/
class ClassicInPlaceContext {
    /*
        A press outside the object leaves it, and the engine selects nothing for that press. So
        what it met of the page is noted here for the report that follows: the object hit, as the
        page takes a press, the outermost group of a member for one, or nothing.
    */
    press(hit, modifier) {
        /*
            A press on another object outside the object's window leaves it here at once and is
            taken as the page takes it, so it selects that object and can start a drag of it. A
            press in the window, on what lies under it included, is the object's.
        */
        if (hit !== undefined && ClassicInPlaceContext.pressedOutside()) {
            GraphicSelection.leaveInPlace();
            return Interaction.context().press(hit, modifier);
        }
        if (ClassicInPlaceContext.pressedOutside()) {
            GraphicSelection.pressedOutside = null;
            return false;
        }
        /*
            A plain press inside the window on a part the chart selects on its own selects that
            part here, by the chart's rules for which part a press takes, and names it to the
            engine, which selects it in the chart. The object stays active; the chart reports the
            selection as its own. Any other press inside is the object's.
        */
        const place = Interaction.placeOf(GraphicSelection.selectedObjectIDs);
        if (modifier === 0 && hit !== undefined && place.kind === 'inPlace') {
            const part = RenderGeometrySection.outermostOf(hit, place.object);
            if (ClassicInPlaceContext.isAPart(part, place.object)) {
                GraphicSelection.selectObjects([part]);
                return true;
            }
        }
        return false;
    }
    /*
        A drag that begins on another object outside the object's window leaves it and carries
        that object, as the page does. One in the window takes hold of the part a press there
        takes, by the chart's rules, where that part may be moved, so the press, the outline under
        the pointer and the drag all mean the same part. Any other drag in the window is the
        object's.
    */
    takesHoldFor(hit, modifier) {
        if (ClassicInPlaceContext.pressedOutside()) {
            GraphicSelection.leaveInPlace();
            return Interaction.context().takesHoldFor(hit, modifier);
        }
        const place = Interaction.placeOf(GraphicSelection.selectedObjectIDs);
        if (modifier !== 0 || place.kind !== 'inPlace')
            return undefined;
        const part = RenderGeometrySection.outermostOf(hit, place.object);
        if (!ClassicInPlaceContext.isAPart(part, place.object))
            return undefined;
        return ObjectHandles.canBeMoved([part]) ? part : undefined;
    }
    /*
        Whether that object is a part of the active object that is selected on its own: a part
        the chart selects on its own, or a shape someone added to the chart, which lies directly
        on its page. The groups the chart only organises its parts with hold parts and are none.
    */
    static isAPart(objectId, object) {
        if (objectId === object)
            return false;
        if (RenderGeometrySection.objectOf(objectId)?.chartPart !== undefined)
            return true;
        return (RenderGeometrySection.parentOf(objectId) === object &&
            !ClassicInPlaceContext.holdsParts(objectId));
    }
    /// Whether that object holds a part the chart selects on its own, at any depth.
    static holdsParts(objectId) {
        return RenderGeometrySection.heldBy(objectId).some((held) => RenderGeometrySection.objectOf(held)?.chartPart !== undefined ||
            ClassicInPlaceContext.holdsParts(held));
    }
    /// Whether the last press landed outside the upright rectangle of the object's window.
    static pressedOutside() {
        const at = GraphicSelection.pressedAt;
        const area = GraphicSelection.inPlaceArea;
        if (!at || !area)
            return false;
        return (at.x < area[0] ||
            at.x > area[0] + area[2] ||
            at.y < area[1] ||
            at.y > area[1] + area[3]);
    }
    doublePress(_hit) {
        return false;
    }
    altPress(_hits, _backwards) {
        return false;
    }
    /*
        an arrow key moves a part that may be moved as one on the page is moved, by the same steps
        and here at once, a pie segment along its way; anything else selected inside leaves the
        key to the object
    */
    arrowKey(towards, event) {
        const selected = GraphicSelection.selectedObjectIDs;
        const place = Interaction.placeOf(selected);
        if (place.kind !== 'inPlace' ||
            !selected.length ||
            selected.includes(place.object) ||
            !ObjectHandles.canBeMoved(selected))
            return false;
        GraphicSelection.selectionSection?.moveByKey(towards, event);
        return true;
    }
    /*
        Escape steps out one level at a time, as the chart's own keys go up a level: from a
        selected part to the part a level up. From the top level, or with nothing selected inside,
        the object is left, and it stays selected.
    */
    escape() {
        const place = Interaction.placeOf(GraphicSelection.selectedObjectIDs);
        if (place.kind !== 'inPlace')
            return false;
        const outside = ClassicInPlaceContext.keysOf()?.outside;
        if (outside !== undefined) {
            GraphicSelection.selectAndShow([outside]);
            return true;
        }
        // at the top level, or with nothing selected inside, the object is left here, as a press
        // on nothing outside leaves it: selecting the object itself ends being active in the
        // engine and keeps it selected
        const object = place.object;
        GraphicSelection.leaveInPlace();
        GraphicSelection.selectAndShow([object]);
        return true;
    }
    /// Return and F3 go a level down, to the first part there, as the chart's own keys do, and
    /// where those end, as below the data labels, to the first part held. A part with nothing
    /// below it leaves the key to the object.
    enterKey() {
        return ClassicInPlaceContext.goTo(ClassicInPlaceContext.keysOf()?.inside ??
            ClassicInPlaceContext.firstPartHeld());
    }
    /// the first part the selected part holds, in the order the page draws them
    static firstPartHeld() {
        const selected = GraphicSelection.selectedObjectIDs;
        const data = RenderGeometrySection.currentPart();
        if (selected.length !== 1 || !data)
            return undefined;
        return data.order.find((objectId) => data.objects.get(objectId)?.chartPart !== undefined &&
            ClassicInPlaceContext.partAbove(objectId) === selected[0]);
    }
    /// Ctrl+F3 goes a level up.
    leaveKey() {
        return ClassicInPlaceContext.goTo(ClassicInPlaceContext.keysOf()?.outside);
    }
    /// Where the chart's keys go from the part selected inside the active object, nothing where
    /// no such part is selected.
    static keysOf() {
        const selected = GraphicSelection.selectedObjectIDs;
        if (selected.length !== 1)
            return undefined;
        return (RenderGeometrySection.objectOf(selected[0])?.chartKeys ??
            ClassicInPlaceContext.keysAmongItsSiblings(selected[0]));
    }
    /*
        the keys of a part the chart's own order does not know, a single data label or a data
        point taken by a press: we go round the parts held by the same part, and up to that one
    */
    static keysAmongItsSiblings(partId) {
        const holder = ClassicInPlaceContext.partAbove(partId);
        const data = RenderGeometrySection.currentPart();
        if (holder === undefined || !data)
            return undefined;
        const siblings = data.order.filter((objectId) => data.objects.get(objectId)?.chartPart !== undefined &&
            ClassicInPlaceContext.partAbove(objectId) === holder);
        const at = siblings.indexOf(partId);
        if (at < 0)
            return undefined;
        const count = siblings.length;
        return {
            next: siblings[(at + 1) % count],
            previous: siblings[(at + count - 1) % count],
            outside: holder,
        };
    }
    /// the nearest part of the chart above that one, over the groups the chart holds its parts in
    static partAbove(objectId) {
        let above = RenderGeometrySection.objectOf(objectId)?.parent;
        for (let guard = 0; above && guard < 100; ++guard) {
            const object = RenderGeometrySection.objectOf(above);
            if (!object)
                return undefined;
            if (object.chartPart !== undefined)
                return above;
            above = object.parent;
        }
        return undefined;
    }
    /// Selects that part here at once and names it to the engine; nothing for no part. A part the
    /// client holds no record of, one inside a 3D scene, takes the key and keeps the selection.
    static goTo(part) {
        if (part === undefined)
            return false;
        if (RenderGeometrySection.objectOf(part))
            GraphicSelection.selectAndShow([part]);
        return true;
    }
    /// The first part of the top level, where the chart starts, nothing where none is known.
    static firstPart() {
        const data = RenderGeometrySection.currentPart();
        return data?.order.find((objectId) => data.objects.get(objectId)?.chartKeys?.first);
    }
    commandStates() {
        const states = {};
        for (const command of Interaction.statesGivenHere)
            states[command] = false;
        return states;
    }
    ungroup() {
        return false;
    }
    // the surround of the active object marks the level; the groups a chart organises its
    // shapes with are not entered or taken apart one by one
    showsGroupBands() {
        return false;
    }
    // a part of a chart answers on its own: the chart moves and resizes it with all it holds by
    // its own rules. a shape added to the chart is asked as on the page
    theOnesThatHaveASay(objectIds) {
        return objectIds.flatMap((objectId) => RenderGeometrySection.objectOf(objectId)?.chartPart !== undefined
            ? [objectId]
            : RenderGeometrySection.theOnesThatHaveASay([objectId]));
    }
    /*
        a pie segment goes out of its pie along its own way only, as the chart drags it: the move
        is laid onto that way, and held between no offset and the whole one. anything else moved
        inside the chart, a shape added to it too, stays inside it, as the chart holds a part on
        its page
    */
    heldToItsWay(objectIds, by) {
        const along = objectIds.length === 1
            ? RenderGeometrySection.objectOf(objectIds[0])?.chartPart?.dragAlong
            : undefined;
        if (!along || along.length < 3)
            return ClassicInPlaceContext.heldInsideTheChart(objectIds, by);
        const [wayX, wayY, at] = along;
        const length = wayX * wayX + wayY * wayY;
        if (length <= 0)
            return by;
        const share = Math.min(Math.max((by.x * wayX + by.y * wayY) / length, -at), 1 - at);
        return new cool.Point(wayX * share, wayY * share);
    }
    /*
        how far objects inside the chart go of that move, so that their box stays inside the box
        of the chart. a move that brings an object lying outside back in is not held
    */
    static heldInsideTheChart(objectIds, by) {
        const place = Interaction.placeOf(GraphicSelection.selectedObjectIDs);
        if (place.kind !== 'inPlace' ||
            !objectIds.length ||
            objectIds.includes(place.object))
            return by;
        const chart = RenderGeometrySection.boxOf(place.object);
        let box;
        for (const objectId of objectIds) {
            const one = RenderGeometrySection.boxOf(objectId);
            if (!one)
                return by;
            box = box ? box.union(one) : one;
        }
        if (!chart || !box)
            return by;
        const held = (move, low, high) => Math.min(Math.max(move, Math.min(low, 0)), Math.max(high, 0));
        return new cool.Point(held(by.x, chart.minX - box.minX, chart.maxX - box.maxX), held(by.y, chart.minY - box.minY, chart.maxY - box.maxY));
    }
    // a part of a chart is named as itself, the chart changes it as one with all it holds, in one
    // step to undo. a shape added to the chart is named as on the page
    theOnesAChangeNames(objectIds) {
        return objectIds.flatMap((objectId) => RenderGeometrySection.objectOf(objectId)?.chartPart !== undefined
            ? [objectId]
            : RenderGeometrySection.theOnesThatDraw(RenderGeometrySection.standingFor([objectId])));
    }
    /*
        Tab goes through the parts of one level as the chart's own keys do, round and round, and
        with nothing selected inside it starts at the first part of the top level, going back at
        the last. It is done here at once, along the ways the chart told; the engine is told what
        is selected, as for a press.
    */
    tabKey(forwards) {
        const keys = ClassicInPlaceContext.keysOf();
        if (keys)
            return ClassicInPlaceContext.goTo(forwards ? keys.next : keys.previous);
        const first = ClassicInPlaceContext.firstPart();
        if (first === undefined)
            return false;
        return ClassicInPlaceContext.goTo(forwards
            ? first
            : RenderGeometrySection.objectOf(first)?.chartKeys?.previous);
    }
    toAnEnd(_first) {
        return false;
    }
    groupEntered() {
        // No group is entered from inside an object active in place.
    }
    enteredBy(selection) {
        return selection;
    }
    whatIsLeft(selected) {
        return selected;
    }
}
/*
    A formula active in place, edited in its own view the engine keeps: what is typed, a press
    inside it and the keys that move in it are the formula's, so they all go to the engine. A
    press outside leaves the formula as it leaves a chart, and so does Escape, which keeps the
    formula selected. It has no parts of its own to select or to go through.
*/
class ClassicFormulaContext extends ClassicInPlaceContext {
    press(hit, modifier) {
        if (!ClassicInPlaceContext.pressedOutside())
            return false;
        return super.press(hit, modifier);
    }
    takesHoldFor(hit, modifier) {
        if (!ClassicInPlaceContext.pressedOutside())
            return undefined;
        return super.takesHoldFor(hit, modifier);
    }
    escape() {
        const place = Interaction.placeOf(GraphicSelection.selectedObjectIDs);
        if (place.kind !== 'inPlace')
            return false;
        // selecting the formula itself ends its edit in the engine and keeps it selected
        const object = place.object;
        GraphicSelection.leaveInPlace();
        GraphicSelection.selectAndShow([object]);
        return true;
    }
    tabKey(_forwards) {
        return false;
    }
    enterKey() {
        return false;
    }
    leaveKey() {
        return false;
    }
}
class ClassicInteractionSet {
    contextFor(place) {
        switch (place.kind) {
            case 'inPlace':
                return GraphicSelection.inPlaceMath
                    ? new ClassicFormulaContext()
                    : new ClassicInPlaceContext();
            case 'group':
                return new ClassicGroupContext(place.group);
            case 'diagram':
                return new ClassicDiagramContext(place.diagram);
            default:
                return new ClassicPageContext();
        }
    }
}
