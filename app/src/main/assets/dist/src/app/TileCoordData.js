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
class TileCoordData {
    constructor(left, top, zoom = null, part = null, mode = null) {
        this.x = left;
        this.y = top;
        this.z = zoom !== null ? zoom : app.map.getZoom();
        this.part = part !== null ? part : app.map._docLayer.getSelectedPart();
        this.mode = mode !== null ? mode : 0;
        this.scale = Math.pow(1.2, this.z - 10);
    }
    getPos() {
        return new cool.Point(this.x, this.y);
    }
    // Returns SimplePoint. To replace getPos in the short term.
    getPosSimplePoint() {
        // A SimplePoint carries the part index, while the tile names its part
        // by part identifier.
        return cool.SimplePoint.fromCorePixels([this.x, this.y], app.map._docLayer.getIndexFromPart(this.part), this.mode);
    }
    key() {
        return (this.x +
            ':' +
            this.y +
            ':' +
            this.z +
            ':' +
            this.part +
            ':' +
            (this.mode !== undefined ? this.mode : 0));
    }
    toString() {
        return ('{ left : ' +
            this.x +
            ', top : ' +
            this.y +
            ', z : ' +
            this.z +
            ', part : ' +
            this.part +
            ', mode : ' +
            this.mode +
            ' }');
    }
    static parseKey(key) {
        window.app.console.assert(typeof key === 'string', 'key should be a string');
        const k = key.split(':');
        const mode = k.length >= 5 ? +k[4] : 0;
        window.app.console.assert(k.length >= 5, 'invalid key format');
        // The key was built from a part identifier, so the parsed field is one.
        return new TileCoordData(+k[0], +k[1], +k[2], k[3], mode);
    }
    static keyToTileCoords(key) {
        return TileCoordData.parseKey(key);
    }
}
