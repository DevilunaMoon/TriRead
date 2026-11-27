/* -*- js-indent-level: 8; fill-column: 100 -*- */
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
 * The JSON for vector rendering of a sheet, which is cut into blocks of cells. Each position of a
 * block primitive is a cell and the twips into it, so a block stays right when the size of a
 * column or a row changes. A block arrives in parts: the borders of the whole block, and the other
 * layers of each row. Drawing objects are in twips from the top-left corner of their anchor cell.
 */
var cool;
(function (cool) {
    /// Expands compact text portions in place. Unknown styles stay as they are.
    function calcApplyTextStyles(primitives, styles) {
        for (const primitive of primitives ?? []) {
            const portion = primitive;
            const style = portion.style !== undefined ? styles.get(portion.style) : undefined;
            if (style) {
                Object.assign(portion, style);
                delete portion.style;
                if (!portion.matrix &&
                    portion.x !== undefined &&
                    portion.y !== undefined) {
                    const size = portion.fontSize ?? 0;
                    // The origin stays a position, which the placer reads.
                    portion.matrix = [
                        size,
                        0,
                        0,
                        size,
                        portion.x,
                        portion.y,
                    ];
                    delete portion.x;
                    delete portion.y;
                }
            }
            calcApplyTextStyles(primitive.children, styles);
            // A strikeout drawn with a character is a text of its own among the lines.
            const decorated = primitive;
            calcApplyTextStyles(decorated.decorations, styles);
            calcApplyTextStyles(decorated.decorationsInTextColor, styles);
        }
    }
    cool.calcApplyTextStyles = calcApplyTextStyles;
    function joinRanges(first, second) {
        if (!first)
            return second;
        if (!second)
            return first;
        const x = Math.min(first.x, second.x);
        const y = Math.min(first.y, second.y);
        return {
            x,
            y,
            width: Math.max(first.x + first.width, second.x + second.width) - x,
            height: Math.max(first.y + first.height, second.y + second.height) - y,
        };
    }
    function isBefore(first, second) {
        return (first[0] < second[0] || (first[0] === second[0] && first[1] < second[1]));
    }
    /// The smallest rectangle that holds both.
    function joinCellRanges(first, second) {
        if (!first)
            return second;
        if (!second)
            return first;
        const earlier = (a, b) => isBefore(b, a) ? b : a;
        const later = (a, b) => isBefore(a, b) ? b : a;
        return {
            x: earlier(first.x, second.x),
            y: earlier(first.y, second.y),
            right: later(first.right, second.right),
            bottom: later(first.bottom, second.bottom),
        };
    }
    /// The held block with the update applied. Undefined if its base is not held.
    function calcUpdatedBlock(held, update, current) {
        if (update.from > 0 && (!held || held.current < update.from))
            return undefined;
        const base = update.from > 0 ? held : undefined;
        const rows = new Map(base ? base.rows : []);
        for (const row of update.rows ?? []) {
            if (row.content.layers)
                rows.set(row.row, row);
            else
                rows.delete(row.row);
        }
        let borders = base ? base.borders : undefined;
        if (update.borders)
            borders = update.borders.content.layers ? update.borders : undefined;
        const parts = [];
        if (borders)
            parts.push(borders);
        for (const row of Array.from(rows.keys()).sort((a, b) => a - b))
            parts.push(rows.get(row));
        const layers = {};
        let ink = undefined;
        for (const part of parts) {
            ink = joinCellRanges(ink, part.content.ink);
            const partLayers = part.content.layers ?? {};
            for (const name of Object.keys(partLayers)) {
                const primitives = partLayers[name];
                if (!primitives)
                    continue;
                layers[name] = (layers[name] ?? []).concat(primitives);
            }
        }
        return {
            kind: 'cells',
            blockRow: update.blockRow,
            blockColumn: update.blockColumn,
            startRow: update.startRow,
            startColumn: update.startColumn,
            endRow: update.endRow,
            endColumn: update.endColumn,
            version: update.version,
            current: Math.max(current, update.version),
            borders,
            rows,
            content: { bounds: update.bounds, ink, layers },
            // The objects follow in the answer. A whole block names all of its own.
            objects: new Set(base ? base.objects : []),
        };
    }
    cool.calcUpdatedBlock = calcUpdatedBlock;
    /// The block without the stored text of the given cells, which views edit: the edit is drawn
    /// over such a cell instead, and its stored text would show where the edit does not reach.
    /// The parts of other rows stay shared.
    function calcBlockWithoutCellText(block, cells) {
        const rows = new Map(block.rows);
        for (const cell of cells) {
            const part = rows.get(cell.row);
            const text = part?.content.layers?.text;
            if (!part || !text)
                continue;
            const kept = text.filter((primitive) => {
                const fields = primitive;
                return !(fields.type === 'calcCellText' &&
                    fields.column === cell.column &&
                    fields.row === cell.row);
            });
            if (kept.length === text.length)
                continue;
            rows.set(cell.row, {
                version: part.version,
                content: {
                    ...part.content,
                    layers: { ...part.content.layers, text: kept },
                },
            });
        }
        return { ...block, rows };
    }
    cool.calcBlockWithoutCellText = calcBlockWithoutCellText;
    /// The text strips of a block in row order. Rows without ink are skipped.
    function calcTextStrips(block, stripRows) {
        const strips = new Map();
        for (const [row, part] of block.rows) {
            const layers = part.content.layers;
            const ink = part.content.ink;
            if (!layers || !ink)
                continue;
            if (!layers.text?.length &&
                !layers.extras?.length &&
                !layers.marks?.length)
                continue;
            const index = Math.floor((row - block.startRow) / stripRows);
            const held = strips.get(index);
            if (held) {
                held.parts.push(part);
                held.ink = joinRanges(held.ink, ink);
            }
            else
                strips.set(index, { strip: index, parts: [part], ink });
        }
        return Array.from(strips.values()).sort((a, b) => a.strip - b.strip);
    }
    cool.calcTextStrips = calcTextStrips;
    /// The key a block is filed under: its block row and block column.
    function calcBlockKey(blockRow, blockColumn) {
        return String(blockRow) + ':' + String(blockColumn);
    }
    cool.calcBlockKey = calcBlockKey;
})(cool || (cool = {}));
