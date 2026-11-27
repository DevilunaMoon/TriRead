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
 * JSControl is a base class for implementing jsdialog based controls. Handles positioning.
 */
class JSControl extends BaseClass {
    mergeOptions(options) {
        for (const [name, value] of Object.entries(options)) {
            this.options[name] = value;
        }
    }
    constructor(options) {
        super();
        this.options = {
            position: 'topright',
        };
        this._map = null;
        this._container = null;
        if (options) {
            this.mergeOptions(options);
        }
    }
    getPosition() {
        return this.options.position;
    }
    setPosition(position) {
        const map = this._map;
        if (map) {
            map.removeControl(this);
        }
        this.options.position = position;
        if (map) {
            map.addControl(this);
        }
        return this;
    }
    getContainer() {
        return this._container;
    }
    onAdd(map) {
        return null;
    }
    addTo(map) {
        this.remove();
        this._map = map;
        const container = (this._container = this.onAdd(map));
        const pos = this.getPosition();
        const corner = map._controlCorners[pos];
        window.L.DomUtil.addClass(container, 'leaflet-control');
        if (pos.indexOf('bottom') !== -1) {
            corner.insertBefore(container, corner.firstChild);
        }
        else {
            corner.appendChild(container);
        }
        if (this.onAdded) {
            this.onAdded(this._map);
        }
        return this;
    }
    remove() {
        if (!this._map) {
            return this;
        }
        window.L.DomUtil.remove(this._container);
        if (this.onRemove) {
            this.onRemove(this._map);
        }
        this._map = null;
        return this;
    }
    isVisible() {
        if (!this._map) {
            return false;
        }
        const corner = this._map._controlCorners[this.options.position];
        return corner.hasChildNodes();
    }
}
