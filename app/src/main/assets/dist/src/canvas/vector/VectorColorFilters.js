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
    /// SVG filters for the canvas filter property, one per distinct list of
    /// color modifiers, kept in an SVG element of the document.
    class VectorColorFilters {
        constructor() {
            this._svg = null;
            // Filter value by the JSON of its steps. Null for no steps.
            this._filters = new Map();
            this._count = 0;
        }
        static { this._SVG_NAMESPACE = 'http://www.w3.org/2000/svg'; }
        /// Whether the context has filters. Safari has them only behind a flag.
        static canFilter(context) {
            return typeof context.filter === 'string';
        }
        /// Filter for the modifiers, first to last. Null when no color changes.
        filterFor(modifiers) {
            // Modifiers with the same steps share a filter.
            const steps = [];
            for (const modifier of modifiers)
                steps.push(...cool.VectorColorModifiers.steps(modifier));
            const key = JSON.stringify(steps);
            const known = this._filters.get(key);
            if (known !== undefined)
                return known;
            let filter = null;
            if (steps.length) {
                this._count++;
                const id = 'cool-vector-color-' + this._count;
                this._container().appendChild(VectorColorFilters._build(id, steps));
                filter = 'url(#' + id + ')';
            }
            this._filters.set(key, filter);
            return filter;
        }
        /// Take the filters out of the document. The next list builds anew.
        release() {
            if (this._svg)
                this._svg.remove();
            this._svg = null;
            this._filters.clear();
        }
        _container() {
            if (!this._svg) {
                const svg = document.createElementNS(VectorColorFilters._SVG_NAMESPACE, 'svg');
                // A displayed zero-size element keeps its filters active.
                svg.setAttribute('width', '0');
                svg.setAttribute('height', '0');
                svg.setAttribute('aria-hidden', 'true');
                svg.style.position = 'absolute';
                document.body.appendChild(svg);
                this._svg = svg;
            }
            return this._svg;
        }
        static _element(name) {
            return document.createElementNS(VectorColorFilters._SVG_NAMESPACE, name);
        }
        // One filter primitive per step, each fed by the one before.
        static _build(id, steps) {
            const filter = VectorColorFilters._element('filter');
            filter.setAttribute('id', id);
            // The engine modifies sRGB values. Filters default to linear light.
            filter.setAttribute('color-interpolation-filters', 'sRGB');
            for (const step of steps) {
                if (step.kind === 'matrix') {
                    // Alpha passes through. The matrix clamps every result.
                    const values = [];
                    for (let row = 0; row < 3; row++) {
                        const start = row * 4;
                        values.push(step.rows[start], step.rows[start + 1], step.rows[start + 2], 0, step.rows[start + 3]);
                    }
                    values.push(0, 0, 0, 1, 0);
                    const matrix = VectorColorFilters._element('feColorMatrix');
                    matrix.setAttribute('type', 'matrix');
                    matrix.setAttribute('values', values.join(' '));
                    filter.appendChild(matrix);
                    continue;
                }
                // The transfer has no function for alpha, so the alpha stays.
                const transfer = VectorColorFilters._element('feComponentTransfer');
                ['feFuncR', 'feFuncG', 'feFuncB'].forEach((name, channel) => {
                    const channelFunction = VectorColorFilters._element(name);
                    if (step.kind === 'linear') {
                        channelFunction.setAttribute('type', 'linear');
                        channelFunction.setAttribute('slope', String(step.slopes[channel]));
                        channelFunction.setAttribute('intercept', String(step.intercepts[channel]));
                    }
                    else if (step.kind === 'power') {
                        channelFunction.setAttribute('type', 'gamma');
                        channelFunction.setAttribute('amplitude', '1');
                        channelFunction.setAttribute('exponent', String(step.exponent));
                        channelFunction.setAttribute('offset', '0');
                    }
                    transfer.appendChild(channelFunction);
                });
                filter.appendChild(transfer);
            }
            return filter;
        }
    }
    cool.VectorColorFilters = VectorColorFilters;
})(cool || (cool = {}));
