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
var cool;
(function (cool) {
    /// Walk a JSON primitive tree and collect the checksum of every
    /// image-bearing primitive and the font id of every text portion, including
    /// those in the mask of a transparence.
    class VectorResourceWalker {
        constructor(checksums, fontIds) {
            this._checksums = checksums;
            this._fontIds = fontIds;
        }
        walkObjects(objects) {
            for (const obj of objects) {
                if (obj.primitives)
                    this.walkPrimitives(obj.primitives);
                if (obj.aids)
                    this.walkPrimitives(obj.aids);
            }
        }
        walkPrimitives(primitives) {
            for (const p of primitives)
                this._walkPrimitive(p);
        }
        _walkPrimitive(primitive) {
            if (cool.GraphicResource.is(primitive))
                this._checksums.add(primitive.checksum);
            // An image fill names its image a level down.
            const fillGraphic = primitive.fillGraphic;
            if (fillGraphic && typeof fillGraphic.checksum === 'number')
                this._checksums.add(fillGraphic.checksum);
            const fontId = primitive.fontId;
            if (typeof fontId === 'string')
                this._fontIds.add(fontId);
            // A mask is a subtree, a uniform transparency a number.
            const transparence = primitive.transparence;
            if (Array.isArray(transparence))
                this.walkPrimitives(transparence);
            if (primitive.children)
                this.walkPrimitives(primitive.children);
            // A strikeout with a character is text, among the decorations.
            const decorated = primitive;
            if (decorated.decorations)
                this.walkPrimitives(decorated.decorations);
            if (decorated.decorationsInTextColor)
                this.walkPrimitives(decorated.decorationsInTextColor);
        }
    }
    cool.VectorResourceWalker = VectorResourceWalker;
})(cool || (cool = {}));
