// @ts-strict-ignore
/* -*- tab-width: 4 -*- */
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
 * The animated element of the vector path. It holds no content: the
 * primitives stay in the slide's tree, and the element carries the state
 * over the rectangle of its target, a shape or one paragraph of its text.
 */
class AnimatedElementVector extends AnimatedElement {
    constructor(compositor, sId, slideHash, title, slideWidth, slideHeight, bIsTextElement) {
        super(sId, slideHash, title, slideWidth, slideHeight);
        this.compositor = compositor;
        this.bIsTextElement = bIsTextElement;
    }
    isTextElement() {
        return this.bIsTextElement;
    }
    // The base rectangle and colors come from the slide's primitive tree,
    // read at every slide start. Without the tree the element stays invalid
    // until it arrives.
    updateContentInfo() {
        const aBounds = this.compositor.getLayerBounds(this.slideHash, this.sId);
        if (!aBounds) {
            this.bIsValid = false;
            this.aBaseFillColor = AnimatedElement.DefaultColor;
            this.aBaseLineColor = AnimatedElement.DefaultColor;
            this.aBaseFontColor = AnimatedElement.DefaultColor;
            super.updateContentInfo();
            return;
        }
        this.setBaseBBox(aBounds);
        const aColors = this.compositor.getTargetColors(this.slideHash, this.sId);
        this.aBaseFillColor = AnimatedElementVector.parseColor(aColors?.fillColor);
        this.aBaseLineColor = AnimatedElementVector.parseColor(aColors?.lineColor);
        this.aBaseFontColor = AnimatedElementVector.parseColor(aColors?.fontColor);
        this.DBG('.updateContentInfo: ' +
            `\n  aBaseBBox: ${BBoxToString(this.aBaseBBox)}` +
            `\n  base center: x: ${this.nBaseCenterX} y: ${this.nBaseCenterY}`);
        this.bIsValid = true;
    }
    static parseColor(sColor) {
        if (!sColor)
            return AnimatedElement.DefaultColor;
        const aColor = colorParser(sColor);
        return aColor instanceof RGBColor ? aColor : AnimatedElement.DefaultColor;
    }
}
