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
class TransitionFilterInfo {
    constructor(type, subtype, isDirectionForward = true, isModeIn = true, fadeColor) {
        this.transitionType = null;
        this.transitionSubtype = null;
        this.isDirectionForward = true;
        this.isModeIn = true;
        this.fadeColor = null;
        this.transitionType = type;
        this.transitionSubtype = subtype;
        this.isDirectionForward = isDirectionForward;
        this.isModeIn = isModeIn;
        this.fadeColor = fadeColor;
    }
    static fromSlideInfo(slideInfo) {
        const transitionFilterInfo = new TransitionFilterInfo();
        if (!slideInfo)
            return null;
        if (slideInfo.transitionType)
            transitionFilterInfo.transitionType =
                stringToTransitionTypeMap[slideInfo.transitionType];
        if (slideInfo.transitionSubtype)
            transitionFilterInfo.transitionSubtype =
                stringToTransitionSubTypeMap[slideInfo.transitionSubtype];
        if (typeof slideInfo.transitionDirection === 'boolean')
            transitionFilterInfo.isDirectionForward = slideInfo.transitionDirection;
        if (slideInfo.transitionFadeColor)
            transitionFilterInfo.fadeColor = slideInfo.transitionFadeColor;
        return transitionFilterInfo;
    }
}
class AnimationTransitionFilterNode extends AnimationBaseNode {
    constructor(aNodeInfo, aParentNode, aNodeContext) {
        super(aNodeInfo, aParentNode, aNodeContext);
        this.bIsReverseDirection = false;
        this.sClassName = 'AnimationTransitionFilterNode';
    }
    parseNodeInfo() {
        super.parseNodeInfo();
        let bIsValidTransition = true;
        const aNodeInfo = this.aNodeInfo;
        // type property
        this.eTransitionType = undefined;
        if (aNodeInfo.transitionType &&
            stringToTransitionTypeMap[aNodeInfo.transitionType] in TransitionType) {
            this.eTransitionType =
                stringToTransitionTypeMap[aNodeInfo.transitionType];
        }
        else {
            bIsValidTransition = false;
            window.app.console.log('AnimationTransitionFilterNode.parseElement: transition type not valid: ' +
                aNodeInfo.transitionType);
        }
        // subtype property
        this.eTransitionSubType = undefined;
        if (!aNodeInfo.transitionSubType)
            aNodeInfo.transitionSubType = 'Default';
        if (stringToTransitionSubTypeMap[aNodeInfo.transitionSubType] in
            TransitionSubType) {
            this.eTransitionSubType =
                stringToTransitionSubTypeMap[aNodeInfo.transitionSubType];
        }
        else {
            bIsValidTransition = false;
            window.app.console.log('AnimationTransitionFilterNode.parseElement: transition subtype not valid: ' +
                aNodeInfo.transitionSubType);
        }
        // if we do not support the requested transition type we fall back to crossfade transition;
        // note: if we do not provide an alternative transition and we set the state of the animation node to 'invalid'
        // the animation engine stops itself;
        if (!bIsValidTransition) {
            this.eTransitionType = TransitionType.FADE;
            this.eTransitionSubType = TransitionSubType.CROSSFADE;
            window.app.console.log('AnimationTransitionFilterNode.parseElement: in place of the invalid transition a crossfade transition is used');
        }
        this.bIsReverseDirection = aNodeInfo.transitionDirection === 'reverse';
        this.eTransitionMode = TransitionMode.in;
        if (aNodeInfo.transitionMode &&
            aNodeInfo.transitionMode in TransitionMode) {
            const sMode = aNodeInfo.transitionMode;
            this.eTransitionMode = TransitionMode[sMode];
        }
    }
    createActivity() {
        const aActivityParamSet = this.fillActivityParams();
        // in the 2d context case map any transition to cross-fade
        if (!this.aNodeContext._context.aSlideShowHandler.isGlSupported()) {
            const bModeIn = this.getTransitionMode() == TransitionMode.in;
            return createCrossFadeTransition(aActivityParamSet, this.getAnimatedElement(), this.aNodeContext._context.nSlideWidth, this.aNodeContext._context.nSlideHeight, bModeIn);
        }
        return createShapeTransition(aActivityParamSet, this.getAnimatedElement(), this.aNodeContext._context.nSlideWidth, this.aNodeContext._context.nSlideHeight, this);
    }
    getTransitionType() {
        return this.eTransitionType;
    }
    getTransitionSubtype() {
        return this.eTransitionSubType;
    }
    getTransitionMode() {
        return this.eTransitionMode;
    }
    getReverseDirection() {
        return this.bIsReverseDirection;
    }
    info(verbose = false) {
        let sInfo = super.info(verbose);
        if (verbose) {
            if (this.getTransitionType())
                sInfo += '; type: ' + TransitionType[this.getTransitionType()];
            if (this.getTransitionSubtype())
                sInfo += '; subtype: ' + TransitionSubType[this.getTransitionSubtype()];
            sInfo += '; is reverse direction: ' + this.getReverseDirection();
            sInfo += '; mode: ' + TransitionMode[this.getTransitionMode()];
        }
        return sInfo;
    }
}
