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
class SetActivity extends AnimationActivity {
    constructor(aCommonParamSet, aAnimationNode, aAnimation) {
        super();
        this.aAnimation = aAnimation;
        this.aTargetElement = null;
        this.aEndEvent = aCommonParamSet.aEndEvent;
        this.aTimerEventQueue = aCommonParamSet.aTimerEventQueue;
        this.bIsActive = true;
        const aAnimatedElement = aAnimationNode.getAnimatedElement();
        const sAttributeName = aAnimationNode.getAttributeName();
        const sKey = sAttributeName;
        const aAttributeProp = aPropertyGetterSetterMap[sKey];
        const eValueType = aAttributeProp['type'];
        const aValueSet = [aAnimationNode.getToValue()];
        ANIMDBG.print('SetActivity: value type: ' +
            PropertyValueType[eValueType] +
            ', aTo = ' +
            aValueSet[0]);
        const aValueList = [];
        extractAttributeValues(eValueType, aValueList, aValueSet, aAnimatedElement.getBaseBBox(), aCommonParamSet.nSlideWidth, aCommonParamSet.nSlideHeight);
        ANIMDBG.print('SetActivity ctor: aTo = ' + aValueList[0]);
        this.aToAttr = aValueList[0];
    }
    activate(aEndEvent) {
        this.aEndEvent = aEndEvent;
        this.bIsActive = true;
    }
    dispose() {
        this.bIsActive = false;
        if (this.aEndEvent && this.aEndEvent.isCharged())
            this.aEndEvent.dispose();
    }
    calcTimeLag() {
        return 0.0;
    }
    perform() {
        if (!this.isActive())
            return false;
        // we're going inactive immediately:
        this.bIsActive = false;
        if (this.aAnimation && this.aTargetElement) {
            this.aAnimation.start(this.aTargetElement);
            this.aAnimation.perform(this.aToAttr);
            this.aAnimation.end();
        }
        if (this.aEndEvent)
            this.aTimerEventQueue.addEvent(this.aEndEvent);
    }
    isActive() {
        return this.bIsActive;
    }
    dequeued() {
        // empty body
    }
    end() {
        this.perform();
    }
    setTargets(aTargetElement) {
        assert(aTargetElement, 'SetActivity.setTargets: target element is not valid');
        this.aTargetElement = aTargetElement;
    }
}
