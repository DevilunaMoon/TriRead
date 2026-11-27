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
    How the handles of a selection look: how large each kind is, what shape it has and what color
    it takes. One place, so that changing any of it is changing one number rather than hunting
    through the groups that draw them.

    There is one size for all of them, and each kind takes a share of it. A share of one is that
    size; a point of a path is two thirds of it. Changing the size alone keeps every kind in the
    same relation to the others.
*/
class HandleLook {
    /// How wide a handle of a share of one is, before the screen's own scale is taken in.
    static { this.size = 12; }
    /// that size, or the one set for the view that draws from the objects
    static sizeNow() {
        return VectorSettings.handleSize(HandleLook.size);
    }
    /// What share of that size each kind takes.
    static { this.shareOfTheSize = {
        framing: 1,
        turning: 1,
        shaping: 1,
        tiePoint: 5 / 6,
        pathPoint: 2 / 3,
        weight: 1 / 2,
        crop: 1,
    }; }
    /** Whether each kind is drawn as a square or as a circle.

     * A point to tie a connector to is a circle here and draws more of its own besides: the
     * noses that say which ways out it offers, and the marks that say which side of the object
     * its place is measured from. Those depend on what the point holds, so the group that knows
     * it draws them and takes only the size and the colors from here.
     */
    static { this.shapeOfTheKind = {
        framing: 'square',
        turning: 'circle',
        shaping: 'circle',
        tiePoint: 'circle',
        pathPoint: 'square',
        weight: 'circle',
        /*
            A crop mark is neither: an L at a corner of the picture and a bar along a side, each
            a handle long and half a handle thick, laid in the picture's own axes by the group
            that draws them. The size and the color come from here.
        */
        crop: 'square',
    }; }
    /// What each kind is filled with.
    static { this.colorOfTheKind = {
        framing: '#FFFFFF',
        turning: '#FFFFFF',
        shaping: '#FFFF00',
        /*
            A point to tie a connector to is drawn in a dimmed red: it is offered while something
            else is being done and should not shout over the handles beside it.
        */
        tiePoint: '#B03A3A',
        pathPoint: '#1C99E0',
        weight: '#1C99E0',
        // A crop mark is drawn in the handle color darkened by cropMarkShade. This is what it
        // falls back on where that cannot be worked out.
        crop: '#FFFFFF',
    }; }
    /*
        The band drawn round a selection that holds other objects stands off from what it goes
        round, and has a width of its own. Both are shares of the same size the handles take, so
        making the handles larger moves the band out and widens it in step. Every kind of band is
        the same size, and only the color tells one from another.
    */
    static { this.shareOfTheSizeBeforeASurround = 2 / 5; }
    static { this.shareOfTheSizeOfASurround = 2 / 5; }
    /*
        One color for each kind of band. The lines that bound it and the gradient it is filled
        with are all worked out from that one color, lighter on one side and darker on the
        other, so a band is changed by changing a single value.
    */
    static { this.colorOfTheSurround = {
        group: '#CFE0F4',
        diagram: '#F0F0F0',
    }; }
    /// How far the lighter and the darker of that color stand from it, as a share of the whole
    /// range a color has.
    static { this.surroundBlend = 0.1; }
    /// Whether a group that is not a diagram is drawn with a band round it.
    static { this.bandRoundAGroup = true; }
    /*
        That color moved towards white by that share of the whole range, or towards black where
        the share is negative.
    */
    static blended(color, by) {
        const part = (at) => parseInt(color.substr(at, 2), 16);
        const moved = (value) => Math.round(Math.min(255, Math.max(0, value + by * 255)))
            .toString(16)
            .padStart(2, '0');
        return '#' + moved(part(1)) + moved(part(3)) + moved(part(5));
    }
    /*
        How far the eight that frame a selection are drawn outside the places they stand on, as a
        share of half a handle. At one, a corner handle has moved by half of itself along each
        axis, so the corner of it that faces the selection lands on the place it stands on and
        the handle lies wholly outside the frame; at nought it is drawn centered on that place, as
        it always was; at minus one it lies wholly inside. Anything beyond either end would leave
        the frame behind altogether, so the share is held between the two.

        It is what keeps the eight off the points of a path, which lie on the corners of the
        frame and halfway along its sides. Only the drawing and the hit test know of it: a drag
        still puts the edge the handle names where the mouse is.
    */
    static { this.shareTheEightMoveOut = 0.5; }
    /// Whether the eight are drawn turned with the selection, so that a square handle stands at
    /// the object's own angle rather than upright. Only the turn: a sheared object still gets
    /// square handles.
    static { this.turnTheEightWithTheObject = true; }
    /// How much darker than the handle color a crop mark is drawn, as a share of the whole
    /// range a color has, so that the marks and the eight can be told apart at a glance.
    static { this.cropMarkShade = 0.12; }
    /// The line every handle is drawn round with.
    static { this.outlineColour = 'black'; }
    /// A point to tie to that keeps a distance of its own, and one of the four an object falls
    /// back on, which takes the same red darker again so the given ones stand out from it.
    static { this.tiePointKeepingItsDistance = '#CC6666'; }
    static { this.tiePointFallenBackOn = '#6A2323'; }
    /// A handle that is shown and does nothing.
    static { this.deactivatedColour = '#E0E0E0'; }
    static { this.deactivatedOutlineColour = '#909090'; }
    /// The line a drag of a point leaves behind, and the one a path is drawn along while it is
    /// edited.
    static { this.outlineOfADrag = '#1C99E0'; }
    /// The line that ties a weight of a curve to its point, drawn in two colors one over the
    /// other with a dash, so it shows on a light background and on a dark one alike.
    static { this.helperLineColour = '#1C99E0'; }
    static { this.helperLineDarkColour = '#0B3F63'; }
    static { this.helperLineAlpha = 0.7; }
    /// The length of a dash of that line, in CSS pixels.
    static { this.helperLineDash = 4; }
    /// How wide a handle of that kind is drawn, in core pixels.
    static widthOf(kind) {
        return (HandleLook.sizeNow() * HandleLook.shareOfTheSize[kind] * app.dpiScale);
    }
    /// How much a larger handle reaches beyond a handle of its kind on each side, as a share of
    /// that handle's width. A half of the width in all makes it half as wide again.
    static { this.shareALargerHandleGrows = 1 / 4; }
    /// How much a larger handle of that kind reaches beyond the usual one on each side, in core
    /// pixels.
    static largerBy(kind) {
        return HandleLook.widthOf(kind) * HandleLook.shareALargerHandleGrows;
    }
    /// How far the eight are drawn outside the places they stand on, in core pixels.
    static distanceTheEightMoveOut() {
        const share = Math.max(-1, Math.min(1, HandleLook.shareTheEightMoveOut));
        return share * HandleLook.widthOf('framing') * 0.5;
    }
    /*
        Where a handle is drawn, in twips, which is where it stands unless it is one of the eight
        and those are drawn outside the frame.
    */
    static drawnAt(handle) {
        const away = handle.awayFromItsPlace;
        const distance = away
            ? (handle.awayBy ?? HandleLook.distanceTheEightMoveOut()) *
                app.pixelsToTwips
            : 0;
        return new cool.SimplePoint(handle.point.x + (away ? away.x * distance : 0), handle.point.y + (away ? away.y * distance : 0));
    }
    /// How far a band stands off from what it goes round, in core pixels.
    static distanceBeforeASurround() {
        return (HandleLook.sizeNow() *
            HandleLook.shareOfTheSizeBeforeASurround *
            app.dpiScale);
    }
    /// How wide a band is drawn, in core pixels.
    static widthOfASurround() {
        return (HandleLook.sizeNow() * HandleLook.shareOfTheSizeOfASurround * app.dpiScale);
    }
    /// How far the outer edge of a band lies from what it goes round, in core pixels.
    static reachOfASurround() {
        return HandleLook.distanceBeforeASurround() + HandleLook.widthOfASurround();
    }
    /*
        Lays the outline of a handle of that kind into the path being built, grown by however much
        the handle is being shown larger, and answers the color it is filled with.
    */
    /*
        Lays the handle above the selection in the mode that shears into the path being built: a
        rectangle slanted by thirty degrees, a little wider than high, a little wider than the
        circle of the turning mode and less high, turned by that angle with the selection. It is
        filled and edged as that circle is.
    */
    static layShearing(context, at, grown, turnedBy = 0) {
        const size = HandleLook.widthOf('turning') + 2 * grown;
        const wide = size * 0.9;
        const high = size * 0.75;
        const slant = high * Math.tan(Math.PI / 6);
        const corners = cool.Matrix2D.IDENTITY.rotateAround(0, 0, turnedBy).translate(at.vX, at.vY);
        [
            corners.apply(-wide / 2 + slant / 2, -high / 2),
            corners.apply(wide / 2 + slant / 2, -high / 2),
            corners.apply(wide / 2 - slant / 2, high / 2),
            corners.apply(-wide / 2 - slant / 2, high / 2),
        ].forEach((corner, index) => index
            ? context.lineTo(corner.x, corner.y)
            : context.moveTo(corner.x, corner.y));
        context.closePath();
        return HandleLook.colorOfTheKind.turning;
    }
    static lay(context, kind, at, grown, turnedBy) {
        const across = HandleLook.widthOf(kind) + 2 * grown;
        if (HandleLook.shapeOfTheKind[kind] !== 'square')
            context.arc(at.vX, at.vY, across * 0.5, 0, Math.PI * 2);
        else if (turnedBy && HandleLook.turnTheEightWithTheObject) {
            // The corners of the square are laid into the path under the turn and stay where
            // they were laid once the transform is put back.
            context.save();
            context.translate(at.vX, at.vY);
            context.rotate(turnedBy);
            context.rect(-across * 0.5, -across * 0.5, across, across);
            context.restore();
        }
        else
            context.rect(at.vX - across * 0.5, at.vY - across * 0.5, across, across);
        return HandleLook.colorOfTheKind[kind];
    }
}
