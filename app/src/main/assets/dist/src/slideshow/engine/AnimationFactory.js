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
class AnimationBase {
}
class GenericAnimation extends AnimationBase {
    constructor(aGetValueFunc, aSetValueFunc, aGetModifier, aSetModifier) {
        super();
        assert(aGetValueFunc && aSetValueFunc, 'GenericAnimation constructor: get value functor and/or set value functor are not valid');
        this.aGetValueFunc = aGetValueFunc;
        this.aSetValueFunc = aSetValueFunc;
        this.aGetModifier = aGetModifier;
        this.aSetModifier = aSetModifier;
        this.aAnimatableElement = null;
        this.bAnimationStarted = false;
    }
    start(aAnimatableElement) {
        assert(aAnimatableElement, 'GenericAnimation.start: animatable element is not valid');
        this.aAnimatableElement = aAnimatableElement;
        this.aAnimatableElement.notifyAnimationStart();
        if (!this.bAnimationStarted)
            this.bAnimationStarted = true;
    }
    end() {
        if (this.bAnimationStarted) {
            this.bAnimationStarted = false;
            this.aAnimatableElement.notifyAnimationEnd();
        }
    }
    perform(aValue) {
        if (this.aSetModifier)
            aValue = this.aSetModifier(aValue);
        this.aSetValueFunc(aValue);
    }
    getUnderlyingValue() {
        let aValue = this.aGetValueFunc();
        if (this.aGetModifier)
            aValue = this.aGetModifier(aValue);
        return aValue;
    }
}
class TupleAnimation extends GenericAnimation {
    constructor(aGetValueFunc, aSetValueFunc, aDefaultValue, aReferenceSize) {
        super(aGetValueFunc, aSetValueFunc);
        assert(aDefaultValue && aReferenceSize, 'TupleAnimation constructor: default value functor and/or reference size are not valid');
        this.aDefaultValue = aDefaultValue;
        this.aReferenceSize = aReferenceSize;
    }
    perform(aNormValue) {
        assert(aNormValue.length === this.aReferenceSize.length, 'TupleAnimation.perform: aNormValue array param has wrong length');
        const aValue = [];
        for (let i = 0; i < aNormValue.length; ++i) {
            aValue.push(aNormValue[i] * this.aReferenceSize[i]);
        }
        this.aSetValueFunc(aValue);
    }
    getUnderlyingValue() {
        const aValue = this.aGetValueFunc();
        assert(aValue.length === this.aReferenceSize.length, 'TupleAnimation.perform: array param has wrong length');
        const aNormValue = [];
        for (let i = 0; i < aValue.length; ++i) {
            aNormValue.push(aValue[i] / this.aReferenceSize[i]);
        }
        return aNormValue;
    }
}
class HSLAnimationWrapper {
    constructor(aColorAnimation) {
        this.aAnimation = aColorAnimation;
    }
    start(aAnimatableElement) {
        this.aAnimation.start(aAnimatableElement);
    }
    end() {
        this.aAnimation.end();
    }
    perform(aHSLValue) {
        this.aAnimation.perform(aHSLValue.convertToRGB());
    }
    getUnderlyingValue() {
        return this.aAnimation.getUnderlyingValue().convertToHSL();
    }
}
function createPropertyAnimation(sAttrName, aAnimatedElement, nWidth, nHeight) {
    const sPropNameAsKey = sAttrName;
    if (!aPropertyGetterSetterMap[sPropNameAsKey]) {
        window.app.console.log('createPropertyAnimation: attribute is unknown: ' + sAttrName);
        return null;
    }
    const aFunctorSet = aPropertyGetterSetterMap[sPropNameAsKey];
    const sGetValueMethod = aFunctorSet.get;
    const sSetValueMethod = aFunctorSet.set;
    if (!sGetValueMethod || !sSetValueMethod) {
        window.app.console.log('createPropertyAnimation: attribute is not handled');
        return null;
    }
    const aGetModifier = aFunctorSet.getmod
        ? aFunctorSet.getmod(nWidth, nHeight)
        : null;
    const aSetModifier = aFunctorSet.setmod
        ? aFunctorSet.setmod(nWidth, nHeight)
        : null;
    const aGetValueMethod = aAnimatedElement[sGetValueMethod];
    const aSetValueMethod = aAnimatedElement[sSetValueMethod];
    return new GenericAnimation(aGetValueMethod.bind(aAnimatedElement), aSetValueMethod.bind(aAnimatedElement), aGetModifier, aSetModifier);
}
function createPairPropertyAnimation(sTransformType, aAnimatedElement, nWidth, nHeight) {
    const sTransformTypeAsKey = sTransformType;
    const aFunctorSet = aPropertyGetterSetterMap[sTransformTypeAsKey];
    const sGetValueMethod = aFunctorSet.get;
    const sSetValueMethod = aFunctorSet.set;
    const aDefaultValue = [];
    const aSizeReference = [];
    if (sTransformType === 'scale') {
        aDefaultValue[0] = aSizeReference[0] = aAnimatedElement.getBaseBBox().width;
        aDefaultValue[1] = aSizeReference[1] =
            aAnimatedElement.getBaseBBox().height;
    }
    else if (sTransformType === 'translate') {
        aDefaultValue[0] = aAnimatedElement.getBaseCenterX();
        aDefaultValue[1] = aAnimatedElement.getBaseCenterY();
        aSizeReference[0] = nWidth;
        aSizeReference[1] = nHeight;
    }
    else {
        window.app.console.log('createPairPropertyAnimation: transform type is not handled');
        return null;
    }
    const aGetValueMethod = aAnimatedElement[sGetValueMethod];
    const aSetValueMethod = aAnimatedElement[sSetValueMethod];
    return new TupleAnimation(aGetValueMethod.bind(aAnimatedElement), aSetValueMethod.bind(aAnimatedElement), aDefaultValue, aSizeReference);
}
class TransitionFilterAnimation extends AnimationBase {
    constructor(nNodeId, transitionFilterInfo, aAnimatableElement) {
        assert(aAnimatableElement, 'TransitionFilterAnimation: animatable element is not valid');
        ANIMDBG.print('TransitionFilterAnimation: Animated Element Id: ' +
            aAnimatableElement.getId());
        super();
        this.nNodeId = nNodeId;
        this.aTransitionFilterInfo = transitionFilterInfo;
        this.aAnimatableElement = aAnimatableElement;
        this.bAnimationStarted = false;
        this.aTransition = null;
    }
    getNodeId() {
        return this.nNodeId;
    }
    getTransitionFilterInfo() {
        return this.aTransitionFilterInfo;
    }
    start(aAnimatableElement) {
        assert(this.aAnimatableElement.getId() === aAnimatableElement.getId(), 'TransitionFilterAnimation: animatable element mismatch');
        if (!this.aTransition) {
            const transitionParameters = this.createTransitionParameters(this.aAnimatableElement, this.aTransitionFilterInfo);
            // Without a rendering context there is no WebGL transition object.
            // The frames are still recorded on the element.
            if (transitionParameters.context)
                this.aTransition = this.createShapeTransition(transitionParameters);
        }
        this.aAnimatableElement.notifyAnimationStart();
        if (!this.bAnimationStarted)
            this.bAnimationStarted = true;
    }
    end() {
        if (this.bAnimationStarted) {
            this.bAnimationStarted = false;
            this.aAnimatableElement.notifyAnimationEnd();
        }
    }
    perform(nT) {
        this.aAnimatableElement.setTransitionFilterFrame(this, nT);
    }
    renderFrame(nT, properties) {
        if (this.aTransition) {
            this.aTransition.renderFrame(nT, properties);
        }
    }
    notifySlideEnd() {
        // clean up resources
        if (this.aTransition) {
            this.aTransition.end();
            this.aTransition = null;
        }
    }
    getUnderlyingValue() {
        return 0.0;
    }
    createTransitionParameters(aAnimatedElement, transitionFilterInfo) {
        const transitionParameters = new TransitionParameters();
        aAnimatedElement.setTransitionParameters(transitionParameters);
        transitionParameters.transitionFilterInfo = transitionFilterInfo;
        return transitionParameters;
    }
    createShapeTransition(transitionParameters) {
        return createTransition(transitionParameters, /*isSlideTransition*/ false);
    }
}
class PathAnimation extends AnimationBase {
    constructor(path, eAdditive, slideWidth, slideHeight) {
        super();
        this.path = path;
        this.eAdditive = eAdditive;
        this.slideWidth = slideWidth;
        this.slideHeight = slideHeight;
        this.svgPath = this.createSvgPath(path);
        this.pathLength = this.svgPath.getTotalLength();
    }
    start(aAnimatableElement) {
        assert(aAnimatableElement, 'GenericAnimation.start: animatable element is not valid');
        this.aAnimatableElement = aAnimatableElement;
        this.centerX = this.aAnimatableElement.getBaseCenterX();
        this.centerY = this.aAnimatableElement.getBaseCenterY();
        this.aAnimatableElement.notifyAnimationStart();
        if (!this.bAnimationStarted)
            this.bAnimationStarted = true;
    }
    end() {
        if (this.bAnimationStarted) {
            this.bAnimationStarted = false;
            this.aAnimatableElement.notifyAnimationEnd();
        }
    }
    perform(nT) {
        let aOutPos = this.parametricPath(nT);
        aOutPos = [aOutPos[0] * this.slideWidth, aOutPos[1] * this.slideHeight];
        aOutPos = [aOutPos[0] + this.centerX, aOutPos[1] + this.centerY];
        this.aAnimatableElement.setPos(aOutPos);
    }
    getUnderlyingValue() {
        return 0.0;
    }
    createSvgPath(path) {
        const svgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        svgPath.setAttribute('d', path);
        return svgPath;
    }
    parametricPath(nT) {
        const distance = this.pathLength * nT;
        const point = this.svgPath.getPointAtLength(distance);
        return [point.x, point.y];
    }
}
function createShapeTransition(aActivityParamSet, aAnimatedElement, nSlideWidth, nSlideHeight, aAnimatedTransitionFilterNode) {
    if (!aAnimatedTransitionFilterNode) {
        window.app.console.log('createShapeTransition: the animated transition filter node is not valid.');
        return null;
    }
    const eTransitionType = aAnimatedTransitionFilterNode.getTransitionType();
    const eTransitionSubType = aAnimatedTransitionFilterNode.getTransitionSubtype();
    const bDirectionForward = !aAnimatedTransitionFilterNode.getReverseDirection();
    const bModeIn = aAnimatedTransitionFilterNode.getTransitionMode() == TransitionMode.in;
    const transitionFilterInfo = new TransitionFilterInfo(eTransitionType, eTransitionSubType, bDirectionForward, bModeIn);
    let aTransitionInfo = null;
    if (aTransitionInfoTable[eTransitionType])
        aTransitionInfo = aTransitionInfoTable[eTransitionType][eTransitionSubType];
    const eTransitionClass = aTransitionInfo
        ? aTransitionInfo['class']
        : TransitionClass.Invalid;
    switch (eTransitionClass) {
        default:
        case TransitionClass.Invalid:
            window.app.console.log('createShapeTransition: transition class: TRANSITION_INVALID');
            return null;
        case TransitionClass.ClipPoligon: {
            const aClippingAnimation = new TransitionFilterAnimation(aAnimatedTransitionFilterNode.getId(), transitionFilterInfo, aAnimatedElement);
            return new SimpleActivity(aActivityParamSet, aClippingAnimation, DirectionType.Forward);
        }
        case TransitionClass.Special:
            switch (eTransitionType) {
                // map SLIDEWIPE to BARWIPE, for now
                case TransitionType.SLIDEWIPE: {
                    let subtype = TransitionSubType.DEFAULT;
                    let isForwardDirection = true;
                    switch (eTransitionSubType) {
                        case TransitionSubType.FROMLEFT:
                            subtype = TransitionSubType.LEFTTORIGHT;
                            isForwardDirection = true;
                            break;
                        case TransitionSubType.FROMRIGHT:
                            subtype = TransitionSubType.LEFTTORIGHT;
                            isForwardDirection = false;
                            break;
                        case TransitionSubType.FROMTOP:
                            subtype = TransitionSubType.TOPTOBOTTOM;
                            isForwardDirection = true;
                            break;
                        case TransitionSubType.FROMBOTTOM:
                            subtype = TransitionSubType.TOPTOBOTTOM;
                            isForwardDirection = false;
                            break;
                        default:
                            window.app.console.log('createShapeTransition: unexpected subtype for SLIDEWIPE');
                            break;
                    }
                    transitionFilterInfo.transitionType = TransitionType.BARWIPE;
                    transitionFilterInfo.transitionSubtype = subtype;
                    transitionFilterInfo.isDirectionForward = isForwardDirection;
                    const aClippingAnimation = new TransitionFilterAnimation(aAnimatedTransitionFilterNode.getId(), transitionFilterInfo, aAnimatedElement);
                    return new SimpleActivity(aActivityParamSet, aClippingAnimation, DirectionType.Forward);
                }
                // we map everything else to crossfade
                default: {
                    return createCrossFadeTransition(aActivityParamSet, aAnimatedElement, nSlideWidth, nSlideHeight, bModeIn);
                }
            }
    }
}
function createCrossFadeTransition(aActivityParamSet, aAnimatedElement, nSlideWidth, nSlideHeight, bModeIn) {
    const aAnimation = createPropertyAnimation('opacity', aAnimatedElement, nSlideWidth, nSlideHeight);
    const eDirection = bModeIn ? DirectionType.Forward : DirectionType.Backward;
    return new SimpleActivity(aActivityParamSet, aAnimation, eDirection);
}
