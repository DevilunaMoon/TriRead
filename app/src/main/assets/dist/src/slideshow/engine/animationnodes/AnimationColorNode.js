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
var ColorSpace;
(function (ColorSpace) {
    ColorSpace[ColorSpace["rgb"] = 0] = "rgb";
    ColorSpace[ColorSpace["hsl"] = 1] = "hsl";
})(ColorSpace || (ColorSpace = {}));
var ClockDirection;
(function (ClockDirection) {
    ClockDirection[ClockDirection["clockwise"] = 0] = "clockwise";
    ClockDirection[ClockDirection["counterClockwise"] = 1] = "counterClockwise";
})(ClockDirection || (ClockDirection = {}));
class AnimationColorNode extends AnimationBaseNode3 {
    constructor(aNodeInfo, aParentNode, aNodeContext) {
        super(aNodeInfo, aParentNode, aNodeContext);
        this.sClassName = 'AnimationColorNode';
    }
    parseNodeInfo() {
        super.parseNodeInfo();
        const aNodeInfo = this.aNodeInfo;
        this.eColorInterpolation = ColorSpace.rgb;
        if (aNodeInfo.colorInterpolation &&
            aNodeInfo.colorInterpolation in ColorSpace) {
            const sColorInterpolation = aNodeInfo.colorInterpolation;
            this.eColorInterpolation = ColorSpace[sColorInterpolation];
        }
        this.eColorInterpolationDirection = ClockDirection.clockwise;
        if (aNodeInfo.colorInterpolationDirection &&
            aNodeInfo.colorInterpolationDirection in ClockDirection) {
            const sColorInterpolationDir = aNodeInfo.colorInterpolationDirection;
            this.eColorInterpolationDirection =
                ClockDirection[sColorInterpolationDir];
        }
    }
    createActivity() {
        const aActivityParamSet = this.fillActivityParams();
        // initialize object dim color
        if (this.getAnimatedElement() &&
            this.getToValue() &&
            this.getAttributeName() === 'dimcolor') {
            this.getAnimatedElement().setDefaultDimColor(colorParser(this.getToValue()));
        }
        const aAnimation = createPropertyAnimation(this.getAttributeName(), this.getAnimatedElement(), this.aNodeContext._context.nSlideWidth, this.aNodeContext._context.nSlideHeight);
        let aColorAnimation;
        let aInterpolator;
        if (this.getColorInterpolation() === ColorSpace.hsl) {
            ANIMDBG.print('AnimationColorNode.createActivity: color space hsl');
            aColorAnimation = new HSLAnimationWrapper(aAnimation);
            aInterpolator = PropertyInterpolator.getInterpolator(PropertyValueType.Color, ColorSpace.hsl, this.getColorInterpolationDirection());
        }
        else {
            ANIMDBG.print('AnimationColorNode.createActivity: color space rgb');
            aColorAnimation = aAnimation;
            aInterpolator = PropertyInterpolator.getInterpolator(PropertyValueType.Color, ColorSpace.rgb);
        }
        return createActivity(aActivityParamSet, this, aColorAnimation, aInterpolator);
    }
    getColorInterpolation() {
        return this.eColorInterpolation;
    }
    getColorInterpolationDirection() {
        return this.eColorInterpolationDirection;
    }
    info(bVerbose = false) {
        let sInfo = super.info.call(this, bVerbose);
        if (bVerbose) {
            // color interpolation
            sInfo +=
                ';  color-interpolation: ' + ColorSpace[this.getColorInterpolation()];
            // color interpolation direction
            sInfo +=
                ';  color-interpolation-direction: ' +
                    ClockDirection[this.getColorInterpolationDirection()];
        }
        return sInfo;
    }
}
