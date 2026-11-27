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
class Interaction {
    /// The commands that move or arrange what is selected, which need one object or more.
    static { this.commandsForOneOrMore = [
        '.uno:ObjectAlignLeft',
        '.uno:AlignCenter',
        '.uno:ObjectAlignRight',
        '.uno:AlignUp',
        '.uno:AlignMiddle',
        '.uno:AlignDown',
        '.uno:ObjectAlign',
        '.uno:BringToFront',
        '.uno:ObjectForwardOne',
        '.uno:ObjectBackOne',
        '.uno:SendToBack',
        '.uno:TransformDialog',
    ]; }
    /// The commands that name one object, which need exactly one.
    static { this.commandsForOne = [
        '.uno:NameGroup',
        '.uno:ObjectTitleDescription',
    ]; }
    /// The commands that spread objects out, which need three or more.
    static { this.commandsForThreeOrMore = [
        '.uno:DistributeSelection',
        '.uno:DistributeHorzLeft',
        '.uno:DistributeHorzCenter',
        '.uno:DistributeHorzDistance',
        '.uno:DistributeHorzRight',
        '.uno:DistributeVertTop',
        '.uno:DistributeVertCenter',
        '.uno:DistributeVertDistance',
        '.uno:DistributeVertBottom',
    ]; }
    /// The commands that depend on the kind of the objects selected and on what they allow.
    static { this.commandsByKind = [
        '.uno:FlipHorizontal',
        '.uno:FlipVertical',
        '.uno:ChangeBezier',
        '.uno:FormatArea',
        '.uno:FormatLine',
    ]; }
    /// Every command whose state a view that draws from the objects gives itself, from where the
    /// selection stands, rather than taking the engine's.
    static { this.statesGivenHere = [
        '.uno:EnterGroup',
        '.uno:LeaveGroup',
        '.uno:FormatUngroup',
        '.uno:FormatGroup',
        ...Interaction.commandsForOneOrMore,
        ...Interaction.commandsForOne,
        ...Interaction.commandsForThreeOrMore,
        ...Interaction.commandsByKind,
    ]; }
    /// The set in use. It is the classic one for now; which set to use is to become a setting.
    static { this.setInUse = null; }
    static set() {
        if (!Interaction.setInUse)
            Interaction.setInUse = new ClassicInteractionSet();
        return Interaction.setInUse;
    }
    /*
        Where the selection says one stands: the page where nothing is selected or the parent of
        what is selected is the page, a diagram where that parent or any parent above it is one,
        a group otherwise. The objects of a selection all have the same parent, so the first says
        it for all of them.
    */
    static placeOf(selected) {
        // An object active in place takes everything while it is, whatever it selects inside.
        if (RenderManager.isVectorRendering() &&
            GraphicSelection.inPlaceActive &&
            GraphicSelection.inPlaceArea &&
            GraphicSelection.inPlaceObject !== undefined)
            return { kind: 'inPlace', object: GraphicSelection.inPlaceObject };
        const first = selected[0];
        const parent = first === undefined ? undefined : RenderGeometrySection.parentOf(first);
        if (!parent)
            return { kind: 'page' };
        for (let above = parent, guard = 0; above && guard < 100; above = RenderGeometrySection.parentOf(above), ++guard) {
            if (RenderGeometrySection.objectOf(above)?.isDiagram)
                return { kind: 'diagram', group: parent, diagram: above };
        }
        return { kind: 'group', group: parent };
    }
    /// The context for the selection as it is now.
    static context() {
        return Interaction.contextAt(Interaction.placeOf(GraphicSelection.selectedObjectIDs));
    }
    /// The context for that place, which may be one the selection stood at before.
    static contextAt(place) {
        return Interaction.set().contextFor(place);
    }
    /// The groups above those objects, from their parent up to the one the page holds.
    static groupsAbove(selected) {
        const groups = [];
        const first = selected[0];
        let above = first === undefined ? undefined : RenderGeometrySection.parentOf(first);
        for (let guard = 0; above && guard < 100; ++guard) {
            groups.push(above);
            above = RenderGeometrySection.parentOf(above);
        }
        return groups;
    }
}
