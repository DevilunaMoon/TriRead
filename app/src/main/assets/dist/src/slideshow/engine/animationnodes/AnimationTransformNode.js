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
class AnimationTransformNode extends AnimationBaseNode3 {
    constructor(aNodeInfo, aParentNode, aNodeContext) {
        super(aNodeInfo, aParentNode, aNodeContext);
        this.sClassName = 'AnimationTransformNode';
    }
    static isValidTransformation(sType) {
        return (sType === 'translate' ||
            sType === 'scale' ||
            sType === 'rotate' ||
            sType === 'skewX' ||
            sType === 'skewY');
    }
    parseNodeInfo() {
        super.parseNodeInfo();
        const aNodeInfo = this.aNodeInfo;
        if (!AnimationTransformNode.isValidTransformation(this.getTransformType())) {
            this.eCurrentState = NodeState.Invalid;
            window.app.console.log('AnimationTransformNode.parseElement: transformation type not found: ' +
                this.getTransformType());
        }
        else {
            this.attributeName = this.getTransformType();
        }
    }
    createActivity() {
        const aActivityParamSet = this.fillActivityParams();
        let aAnimation = null;
        if (this.getAttributeName() === 'scale' ||
            this.getAttributeName() === 'translate') {
            aAnimation = createPairPropertyAnimation(this.getAttributeName(), this.getAnimatedElement(), this.aNodeContext._context.nSlideWidth, this.aNodeContext._context.nSlideHeight);
        }
        else {
            aAnimation = createPropertyAnimation(this.getAttributeName(), this.getAnimatedElement(), this.aNodeContext._context.nSlideWidth, this.aNodeContext._context.nSlideHeight);
        }
        if (!aAnimation) {
            window.app.console.log('AnimationTransformNode.createActivity: failed to create animation.');
            return null;
        }
        const aInterpolator = null; // createActivity will compute it;
        return createActivity(aActivityParamSet, this, aAnimation, aInterpolator);
    }
    getTransformType() {
        return this.aNodeInfo.transformType.toLowerCase();
    }
}
