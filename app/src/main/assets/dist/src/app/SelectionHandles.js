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
    The points a connector can tie itself to: the ones someone added to an object, and the four an
    object falls back on, which lie in the middle of each side of the box around it.

    They are shown and no more: there is no name by which one of them could be spoken about, so the
    keyboard passes them by and the mouse cannot take hold of one.
*/
class GluePointHandles {
    /// One point to tie to, at that place, of the kind that says where it comes from.
    static handleAt(x, y, kind) {
        return {
            name: '',
            kind: kind,
            pointer: '0',
            point: new cool.Point(x, y).round(),
        };
    }
    /*
        The points someone added to that object, where the object carries them. They are named by
        the place they have in the object's own list, so the keyboard can walk them, and the
        mouse finds them where they lie.
    */
    static ownPointsOf(objectId) {
        const object = RenderGeometrySection.objectOf(objectId);
        const transform = RenderGeometrySection.transformOf(objectId);
        if (!transform)
            return [];
        return (object?.gluePoints ?? []).map((point, at) => {
            const onThePage = transform.apply(point.x, point.y);
            return {
                ...GluePointHandles.handleAt(onThePage.x, onThePage.y, 'GluePoint'),
                name: 'GluePoint.' + String(at),
            };
        });
    }
    /*
        The four points an object falls back on, in the middle of each of its sides: the upper,
        the right, the lower and the left one. Where they lie is the object's own business - a
        rectangle or a picture turns and shears them with itself, other objects take the sides of
        the upright box they stand in - so they are taken from the object as it gives them. Data
        that carries none falls back on the middles of the upright box.
    */
    static defaultPointsOf(objectId) {
        const transform = RenderGeometrySection.transformOf(objectId);
        if (!transform)
            return [];
        const fallback = 'DefaultGluePoint';
        // The object gives the four itself. The middles of its box stand in where it gave none.
        const sides = RenderGeometrySection.objectOf(objectId)?.sideGluePoints;
        if (sides?.length === 4)
            return sides.map((side) => {
                const at = transform.apply(side.x, side.y);
                return GluePointHandles.handleAt(at.x, at.y, fallback);
            });
        const box = cool.Range2D.fromPoints([
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
        ].map(([x, y]) => transform.apply(x, y)));
        return [
            GluePointHandles.handleAt(box.centerX, box.minY, fallback),
            GluePointHandles.handleAt(box.maxX, box.centerY, fallback),
            GluePointHandles.handleAt(box.centerX, box.maxY, fallback),
            GluePointHandles.handleAt(box.minX, box.centerY, fallback),
        ];
    }
}
/*
    The handles of a selection of objects, worked out from the geometry the client holds: the
    eight that frame the selection, and the ones that shape a single object, its corner radius
    and the points a custom shape is shaped by.
*/
class ObjectHandles {
    constructor(objectIds) {
        this.objectIds = objectIds;
    }
    handles() {
        if (!this.objectIds.length)
            return [];
        if (this.isATiedConnector() ||
            (this.objectIds.length === 1 &&
                ObjectHandles.hasHandlesOfItsOwnOnly(this.objectIds[0])))
            return [...this.shapingHandles(), ...this.ownGluePoints()];
        const framing = ObjectHandles.framingOf(this.objectIds);
        if (!framing)
            return [];
        return [...framing, ...this.shapingHandles(), ...this.ownGluePoints()];
    }
    /*
        The points someone added to the object for a connector to tie itself to. They belong to the
        object, so they are shown while it is selected, after the handles that shape it and before
        the points of its path.
    */
    ownGluePoints() {
        if (this.objectIds.length !== 1)
            return [];
        return GluePointHandles.ownPointsOf(this.objectIds[0]);
    }
    /*
        Where on the object's own square each of the eight that frame it sits: 0 and 0 is its
        upper left corner and 1 and 1 its lower right one. A handle in the middle of a side sits
        at a half on the axis it does not move on.
    */
    static { this.placesOfTheKinds = {
        '1': [0, 0],
        '2': [0.5, 0],
        '3': [1, 0],
        '4': [0, 0.5],
        '5': [1, 0.5],
        '6': [0, 1],
        '7': [0.5, 1],
        '8': [1, 1],
    }; }
    /// Where one of the eight of that kind sits on the object's own square. Nothing for a kind
    /// that is not one of the eight.
    static placeOfKind(kind) {
        const place = ObjectHandles.placesOfTheKinds[kind];
        return place ? new cool.Point(place[0], place[1]) : undefined;
    }
    /*
        The handles a change that turns the object over can put in the place of the given one:
        itself, the one it reflects onto across the square, the one down it, and the one across
        and down both. A handle in the middle of a side reflects onto itself on the axis it sits
        in the middle of, so only it and the one facing it come out.
    */
    static facing(kind) {
        const mine = ObjectHandles.placeOfKind(kind);
        if (!mine)
            return [kind];
        const wanted = [
            new cool.Point(mine.x, mine.y),
            new cool.Point(1 - mine.x, mine.y),
            new cool.Point(mine.x, 1 - mine.y),
            new cool.Point(1 - mine.x, 1 - mine.y),
        ];
        return Object.keys(ObjectHandles.placesOfTheKinds).filter((one) => {
            const place = ObjectHandles.placeOfKind(one);
            return wanted.some((other) => place && other.equals(place));
        });
    }
    /// The number the drawing layer gives a connector among the kinds of object.
    static { this.connectorKind = 24; }
    /*
        Where a handle that keeps a length of its own stands once the object has been given a
        change: as far along its rail as it was, on the rail as the change leaves it. The corner
        radius of a rectangle is such a handle - the radius is a length the object keeps, so the
        handle does not grow with the object - where a point a custom shape is shaped by is a
        share of the shape and travels with it, needing none of this.

        Nothing for a handle that travels, or for one whose rail is not a line.
    */
    static keptAlongItsRail(rails, point, was, becomes) {
        if (!rails?.keepsItsLength)
            return undefined;
        const least = rails.leastAcross;
        const most = rails.mostAcross;
        if (!least || !most)
            return undefined;
        // Where the rail starts on the page, and the way it runs from there.
        const ends = (mapping) => {
            const from = mapping.apply(least.x, least.y);
            return {
                from: from,
                along: mapping.apply(most.x, most.y).subtract(from),
            };
        };
        const before = ends(was);
        const after = ends(becomes);
        const length = after.along.length();
        if (!length)
            return undefined;
        const howFar = Math.min(point.distanceTo(before.from), length);
        return after.from
            .add(after.along.divideBy(length).multiplyBy(howFar))
            .round();
    }
    /*
        What may be done to the objects of a selection: it may be moved only where every one of
        them may be moved, and the same for the other two. The objects say it themselves, so a
        selection of several is not one answer for all of them any more.

        Which objects are asked is up to where one stands: on the page and in a group, a group is
        asked along with everything it holds, so a group holding one object whose place is held
        fast cannot be moved; inside a chart, a part of it answers on its own.
    */
    static allOfThem(objectIds) {
        return Interaction.context().theOnesThatHaveASay(objectIds);
    }
    static canBeMoved(objectIds) {
        return ObjectHandles.allOfThem(objectIds).every((objectId) => RenderGeometrySection.objectOf(objectId)?.cannotBeMoved !== true);
    }
    static canBeResized(objectIds) {
        return ObjectHandles.allOfThem(objectIds).every((objectId) => RenderGeometrySection.objectOf(objectId)?.cannotBeResized !== true);
    }
    /// Whether every one of those objects, and every object the groups among them hold, may be
    /// sheared.
    static canBeSheared(objectIds) {
        return ObjectHandles.allOfThem(objectIds).every((objectId) => RenderGeometrySection.objectOf(objectId)?.cannotBeSheared !== true);
    }
    static canBeTurned(objectIds) {
        return ObjectHandles.allOfThem(objectIds).every((objectId) => RenderGeometrySection.objectOf(objectId)?.cannotBeTurned !== true);
    }
    /// Whether the object stands at a right angle to the page, turned by a multiple of ninety
    /// degrees or not at all. A resize with two different factors shears no such object.
    static standsAtARightAngle(objectId) {
        const transform = RenderGeometrySection.transformOf(objectId);
        if (!transform)
            return true;
        const quarterTurns = transform.rotation() / (Math.PI / 2);
        return Math.abs(quarterTurns - Math.round(quarterTurns)) < 0.0001;
    }
    /*
        Whether a resize of these objects is laid through a square that is not an object's own: a
        selection of several stands on the box round them all, and a group on its own box, both
        upright on the page. A member turned off the right angles is sheared by two different
        factors through such a square. A single object that holds nothing is resized on its own
        square and shears never, however it is turned.
    */
    static resizesThroughABox(objectIds) {
        return (objectIds.length > 1 ||
            (objectIds.length === 1 &&
                RenderGeometrySection.holdsObjects(objectIds[0])));
    }
    /*
        Whether a resize of these objects keeps the ratio unless the user asks otherwise: the
        office holds a resize in ratio as soon as one object says it allows no free resize, which
        a shape says once it is turned at all. That matters only where the resize goes through a
        box and the object stands turned in it; a single object, or a member at a right angle, is
        not sheared by a free resize and does not ask for the ratio.
    */
    static keepsTheRatioByDefault(objectIds) {
        if (!ObjectHandles.resizesThroughABox(objectIds))
            return false;
        return ObjectHandles.allOfThem(objectIds).some((objectId) => RenderGeometrySection.objectOf(objectId)?.cannotBeResizedFreely ===
            true && !ObjectHandles.standsAtARightAngle(objectId));
    }
    /*
        Whether a resize of these objects keeps the ratio whatever the user asks: one of them
        cannot hold a shear at all and stands turned in the box the resize goes through, so two
        different factors would bring in a shear it has nowhere to put.
    */
    static keepsTheRatioAlways(objectIds) {
        if (!ObjectHandles.resizesThroughABox(objectIds))
            return false;
        return ObjectHandles.allOfThem(objectIds).some((objectId) => RenderGeometrySection.objectOf(objectId)?.cannotBeSheared === true &&
            !ObjectHandles.standsAtARightAngle(objectId));
    }
    /*
        Gives each of the eight the way it is drawn away from the place it stands on: one step
        along each of the two axes of the selection, worked out from where the eight stand now.
        The axes are the selection's own and not the page's, so a handle stays outside whatever
        angle the selection stands at, and a change that turns the selection over turns the axes
        over with it, so the handles keep facing outwards through a mirror.

        A handle that was not given a way to face is left as it is, which is every handle the
        engine sends.
    */
    static facedAwayFromTheirPlaces(handles) {
        const placeOf = (kind) => handles.find((one) => one.kind === kind)?.point;
        const upperLeft = placeOf('1');
        const upperRight = placeOf('3');
        const lowerLeft = placeOf('6');
        if (!upperLeft || !upperRight || !lowerLeft)
            return handles;
        // The way from one place to the other, one long.
        const step = (from, to) => {
            const along = to.subtract(from);
            return along.divideBy(along.length() || 1);
        };
        const across = step(upperLeft, upperRight);
        const down = step(upperLeft, lowerLeft);
        return handles.map((one) => {
            const place = ObjectHandles.placeOfKind(one.kind);
            if (!place || !one.awayFromItsPlace)
                return one;
            const sideways = Math.sign(place.x - 0.5);
            const downwards = Math.sign(place.y - 0.5);
            return {
                ...one,
                awayFromItsPlace: across
                    .multiplyBy(sideways)
                    .add(down.multiplyBy(downwards)),
                turnedBy: Math.atan2(across.y, across.x),
            };
        });
    }
    /// Whether the object of that id is a connector.
    static isAConnector(objectId) {
        return (RenderGeometrySection.objectOf(objectId)?.objectKind ===
            ObjectHandles.connectorKind);
    }
    /// Whether the object of that id is a connector that is tied to an object at either end.
    static isATiedConnector(objectId) {
        if (!ObjectHandles.isAConnector(objectId))
            return false;
        const object = RenderGeometrySection.objectOf(objectId);
        return object?.tiedAtStart === true || object?.tiedAtEnd === true;
    }
    /*
        The eight of one object that is shaped by its own handles alone, which are not shown: the
        handle that turns the object is laid out from them, above the middle of the upper side.
        Nothing for any other selection.
    */
    static unshownFramingOf(objectIds, square) {
        if (objectIds.length !== 1 ||
            !ObjectHandles.hasHandlesOfItsOwnOnly(objectIds[0]))
            return undefined;
        return new ObjectHandles(objectIds).framingHandles(square);
    }
    /// whether the object of that id is a line, a straight path of two points
    static isALine(objectId) {
        return RenderGeometrySection.objectOf(objectId)?.objectKind === 2;
    }
    /*
        where a line starts and the way it runs to its other end, through that square. the
        square of a line is the box round it, so each end sits on a corner of it, and the
        corners taken through the square as it is now follow a turn not yet answered
    */
    static wayOfTheLine(objectId, square) {
        if (!ObjectHandles.isALine(objectId))
            return null;
        const ends = (RenderGeometrySection.objectOf(objectId)?.handles ?? []).filter((handle) => handle.kind === 9);
        if (ends.length !== 2)
            return null;
        const [first, second] = ends.sort((one, other) => (one.point ?? 0) - (other.point ?? 0));
        const atX = first.x > second.x ? 1 : 0;
        const atY = first.y > second.y ? 1 : 0;
        const start = square.apply(atX, atY);
        return { start, way: square.apply(1 - atX, 1 - atY).subtract(start) };
    }
    /*
        the spot where both ends of a line or of the measured line of a measurement stand, where
        they stand on one, as a file may bring them. such an object has no way to turn or to hold
        an end to. nothing for any other object
    */
    static spotWithoutLength(objectId) {
        const object = RenderGeometrySection.objectOf(objectId);
        if (!object)
            return null;
        const isALine = ObjectHandles.isALine(objectId);
        const ends = (object.handles ?? []).filter((handle) => isALine
            ? handle.kind === 9
            : !!object.measurement &&
                handle.kind === 20 &&
                (handle.at === 2 || handle.at === 3));
        if (ends.length !== 2)
            return null;
        const [one, other] = ends;
        return one.x === other.x && one.y === other.y
            ? new cool.Point(one.x, one.y)
            : null;
    }
    /// Whether the object of that id is shaped by its own handles alone, without the eight.
    static hasHandlesOfItsOwnOnly(objectId) {
        return (RenderGeometrySection.objectOf(objectId)?.handlesOfItsOwnOnly === true);
    }
    /// Whether the object of that id is a part of a chart that can be neither moved nor resized,
    /// a series, an axis or a grid.
    static isAChartPartHeldInPlace(objectId) {
        const part = RenderGeometrySection.objectOf(objectId)?.chartPart;
        return part !== undefined && !part.draggable && !part.resizable;
    }
    /// Whether what is selected is one connector that is tied to an object.
    isATiedConnector() {
        return (this.objectIds.length === 1 &&
            ObjectHandles.isATiedConnector(this.objectIds[0]));
    }
    /*
        The eight handles that frame what is selected, from the upper left one to the lower right
        one, worked out from the objects the client holds. One object is framed by its own
        mapping, so the handles turn with it; several are framed by one upright box around them
        all, and the whole selection is scaled by it. Nothing where the client holds no geometry
        for what is selected.
    */
    static framingOf(objectIds, square) {
        /*
            A connector that is tied to an object runs from where it is tied, so scaling it or
            turning it leads nowhere: it is offered the points along its way alone, and neither
            the eight nor the handle that turns them, which is made from the eight. An object
            that is shaped by its own handles alone, a measurement, is offered those alone too.
            A part of a chart held in place shows the chart's own marks.
        */
        if (objectIds.length === 1 &&
            (ObjectHandles.isATiedConnector(objectIds[0]) ||
                ObjectHandles.hasHandlesOfItsOwnOnly(objectIds[0]) ||
                ObjectHandles.isAChartPartHeldInPlace(objectIds[0])))
            return undefined;
        return new ObjectHandles(objectIds).framingHandles(square);
    }
    /// The handles that shape the objects, which only one object on its own has.
    static shapingOf(objectIds) {
        return new ObjectHandles(objectIds).shapingHandles();
    }
    /*
        The eight, laid on the square handed in where one is - the selection's own square, which
        remembers how it has been turned and turned over - and otherwise on the object's mapping
        for one object, or on the upright box round them all for several.
    */
    framingHandles(square) {
        const mapping = square ?? this.framingMapping();
        if (!mapping)
            return undefined;
        // A framing handle sits on each corner of the unit square and halfway along each side,
        // taken onto the page by the mapping, from the upper left one to the lower right one.
        const corners = Object.values(ObjectHandles.placesOfTheKinds).map(([x, y]) => mapping.apply(x, y));
        // The pointer the engine asks for at each of the eight, in the same order.
        const pointers = [11, 7, 12, 9, 10, 13, 8, 14];
        /*
            An object without width or height would have handles on top of each other, so only the
            ones that stand apart are made: the corners go where there is both width and height,
            the handle in the middle of a side where the side has a length, and an object that is
            a point keeps the upper left one alone. The engine draws them by the same rule.
        */
        const [upperLeft, upperRight, lowerLeft] = [
            corners[0],
            corners[2],
            corners[5],
        ];
        const hasWidth = !upperLeft.equals(upperRight);
        const hasHeight = !upperLeft.equals(lowerLeft);
        const wanted = (kind) => {
            if (!hasWidth && !hasHeight)
                return kind === 1;
            // The corners, and the middle of a side across the direction that has a length.
            if (kind === 2 || kind === 7)
                return hasWidth;
            if (kind === 4 || kind === 5)
                return hasHeight;
            return hasWidth && hasHeight;
        };
        /*
            What draws the handles expects the whole set of eight and reads them by kind, so an
            object that would have fewer of them is left to the engine, which sends the handles
            that object really has.
        */
        if (![1, 2, 3, 4, 5, 6, 7, 8].every(wanted))
            return undefined;
        // The eight are what a scale takes hold of, so where the objects may not be made larger
        // or smaller they are shown and do nothing.
        const dead = !ObjectHandles.canBeResized(this.objectIds);
        return ObjectHandles.facedAwayFromTheirPlaces(corners.map((corner, index) => ({
            name: String(index + 1) + '.0.0',
            kind: String(index + 1),
            pointer: String(pointers[index]),
            point: corner.round(),
            deactivated: dead,
            awayFromItsPlace: new cool.Point(0, 0),
        })));
    }
    /*
        The mapping of the unit square onto what the framing handles stand around. One object is
        framed by its own mapping, so the handles turn with it; several are framed by one upright
        box around them all. Nothing where the client holds no geometry for what is selected.
    */
    framingMapping() {
        if (this.objectIds.length === 1)
            return RenderGeometrySection.transformOf(this.objectIds[0]);
        let box = null;
        for (const objectId of this.objectIds) {
            const one = RenderGeometrySection.boxOf(objectId);
            if (!one)
                return null;
            box = box ? box.union(one) : one;
        }
        return box ? cool.Matrix2D.fromRange(box) : null;
    }
    /*
        The handles that shape one object, which it carries itself: the corner radius of a
        rectangle and the points a custom shape is shaped by. A selection of several objects
        shapes none of them, it only frames them.
    */
    shapingHandles() {
        if (this.objectIds.length !== 1)
            return [];
        const object = RenderGeometrySection.objectOf(this.objectIds[0]);
        // without a length the help lines of a measurement stand on the ends of the measured
        // line, so their handles do nothing and a press reaches an end, to pull a length out
        const withoutLength = !!object?.measurement &&
            ObjectHandles.spotWithoutLength(this.objectIds[0]) !== null;
        // The number the object gives a handle ends the name where there is one, since the
        // handles of a measurement are alike in kind, polygon and point.
        return (object?.handles ?? []).map((handle) => ({
            name: String(handle.kind) +
                '.' +
                String(handle.polygon ?? 0) +
                '.' +
                String(handle.point ?? 0) +
                (handle.at !== undefined ? '.' + String(handle.at) : ''),
            kind: String(handle.kind),
            pointer: '28',
            point: new cool.Point(handle.x, handle.y),
            at: handle.at,
            rails: handle.rails,
            larger: handle.larger,
            deactivated: withoutLength && handle.at !== 2 && handle.at !== 3,
        }));
    }
}
