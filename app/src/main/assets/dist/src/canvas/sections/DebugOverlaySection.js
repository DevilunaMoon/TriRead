// @ts-strict-ignore
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
class DebugOverlaySection extends CanvasSectionObject {
    constructor(debug) {
        super(app.CSections.Debug.DebugOverlay.name);
        this.interactable = false;
        this.anchor = ['top', 'left'];
        this.processingOrder = app.CSections.Debug.DebugOverlay.processingOrder;
        this.drawingOrder = app.CSections.Debug.DebugOverlay.drawingOrder;
        this.zIndex = app.CSections.Debug.DebugOverlay.zIndex;
        this.boundToSection = 'tiles';
        this._debug = debug;
    }
    onDraw(frameCount, elapsedTime, subsetBounds) {
        RenderManager.updateOverlayMessages();
        const msgs = this._debug.getOverlayMessages();
        if (!msgs)
            return;
        const topValues = Object.entries(msgs)
            .filter(([key]) => key.startsWith('top-'))
            .map(([, value]) => value.toString());
        const bottomValues = Object.entries(msgs)
            .filter(([key]) => !key.startsWith('top-'))
            .map(([, value]) => value.toString());
        const drawValues = function (ctx, top, lines) {
            const textLines = lines.join('\n').split('\n');
            if (textLines.length < 1)
                return;
            const lineHeight = 22;
            ctx.font = '18px Arial';
            var ybase;
            if (top)
                ybase = lineHeight * 2;
            else
                ybase = ctx.canvas.height - lineHeight * textLines.length;
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(255.0, 255.0, 255.0, 0.7)';
            textLines.forEach((txt, i) => {
                const xpad = lineHeight;
                const y = ybase + i * lineHeight;
                const metrics = ctx.measureText(txt);
                ctx.fillRect(0, y - lineHeight, metrics.width + xpad, lineHeight * 1.5);
            });
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            textLines.forEach((txt, i) => {
                const xpad = lineHeight;
                const y = ybase + i * lineHeight;
                ctx.fillText(txt, xpad, y);
            });
        };
        drawValues(this.context, true, topValues);
        drawValues(this.context, false, bottomValues);
    }
}
app.definitions.debugOverlaySection = DebugOverlaySection;
