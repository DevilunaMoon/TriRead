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
class AnimationBaseNode extends BaseNode {
    constructor(aNodeInfo, aParentNode, aNodeContext) {
        super(aNodeInfo, aParentNode, aNodeContext);
        this.sClassName = 'AnimationBaseNode';
        this.bIsTargetTextElement = false;
        this.aAnimatedElement = null;
        this.aActivity = null;
    }
    parseNodeInfo() {
        super.parseNodeInfo();
        // targetElement property
        const aNodeInfo = this.aNodeInfo;
        this.aTargetHash = aNodeInfo.targetElement;
        if (!this.aTargetHash) {
            this.eCurrentState = NodeState.Invalid;
            window.app.console.log('AnimationBaseNode.parseElement: target element not found: ' +
                aNodeInfo.targetElement);
        }
        // subItem property for text animated element
        this.bIsTargetTextElement =
            aNodeInfo.subItem && aNodeInfo.subItem === 'OnlyText';
        // additive property
        if (aNodeInfo.additive && aNodeInfo.additive in AdditiveMode) {
            const sAdditive = aNodeInfo.additive;
            this.eAdditiveMode = AdditiveMode[sAdditive];
        }
        else {
            this.eAdditiveMode = AdditiveMode.Replace;
        }
        // set up min frame count value;
        this.nMinFrameCount = this.getDuration().isValue()
            ? this.getDuration().getValue() *
                SlideShowHandler.MINIMUM_FRAMES_PER_SECONDS
            : SlideShowHandler.MINIMUM_FRAMES_PER_SECONDS;
        if (this.nMinFrameCount < 1.0)
            this.nMinFrameCount = 1;
        else if (this.nMinFrameCount > SlideShowHandler.MINIMUM_FRAMES_PER_SECONDS)
            this.nMinFrameCount = SlideShowHandler.MINIMUM_FRAMES_PER_SECONDS;
        if (this.aTargetHash) {
            if (!this.aNodeContext.aAnimatedElementMap.has(this.aTargetHash)) {
                const slideHash = this.aNodeContext.metaSlide.info.hash;
                const slideWidth = this.aNodeContext._context.nSlideWidth;
                const slideHeight = this.aNodeContext._context.nSlideHeight;
                // The compositor knows which kind of element it can draw.
                const presenter = app.map.slideShowPresenter;
                const aAnimatedElement = presenter._slideCompositor.createAnimatedElement(this.aTargetHash, slideHash, aNodeInfo.title || aNodeInfo.objectName, slideWidth, slideHeight, this.bIsTargetTextElement);
                this.aNodeContext.aAnimatedElementMap.set(this.aTargetHash, aAnimatedElement);
            }
            this.aAnimatedElement = this.aNodeContext.aAnimatedElementMap.get(this.aTargetHash);
            // set additive mode
            this.aAnimatedElement.setAdditiveMode(this.eAdditiveMode);
        }
    }
    init_st() {
        if (this.aActivity)
            this.aActivity.activate(makeEvent(this.deactivate.bind(this)));
        else
            this.aActivity = this.createActivity();
        return true;
    }
    resolve_st() {
        return true;
    }
    activate_st() {
        if (this.aActivity) {
            this.saveStateOfAnimatedElement();
            this.aActivity.setTargets(this.getAnimatedElement());
            if (this.getContext().bIsSkipping) {
                this.aActivity.end();
            }
            else {
                this.getContext().aActivityQueue.addActivity(this.aActivity);
            }
        }
        else {
            super.scheduleDeactivationEvent();
        }
    }
    deactivate_st(eDestState) {
        if (eDestState === NodeState.Frozen) {
            if (this.aActivity)
                this.aActivity.end();
        }
        if (eDestState === NodeState.Ended) {
            if (this.aActivity)
                this.aActivity.dispose();
            if (this.getFillMode() === FillModes.Remove && this.getAnimatedElement())
                this.removeEffect();
        }
    }
    fillActivityParams() {
        // compute duration
        let nDuration = 0.001;
        if (this.getDuration().isValue()) {
            nDuration = this.getDuration().getValue();
        }
        else {
            window.app.console.log('AnimationBaseNode.fillActivityParams: duration is not a number');
        }
        // create and set up activity params
        const aActivityParamSet = new ActivityParamSet();
        aActivityParamSet.aEndEvent = makeEvent(this.deactivate.bind(this));
        aActivityParamSet.aTimerEventQueue = this._context.aTimerEventQueue;
        aActivityParamSet.aActivityQueue = this._context.aActivityQueue;
        aActivityParamSet.nMinDuration = nDuration;
        aActivityParamSet.nMinNumberOfFrames = this.getMinFrameCount();
        aActivityParamSet.bAutoReverse = this.isAutoReverseEnabled();
        aActivityParamSet.nRepeatCount = this.getRepeatCount();
        aActivityParamSet.nAccelerationFraction = this.getAccelerateValue();
        aActivityParamSet.nDecelerationFraction = this.getDecelerateValue();
        aActivityParamSet.nSlideWidth = this.aNodeContext._context.nSlideWidth;
        aActivityParamSet.nSlideHeight = this.aNodeContext._context.nSlideHeight;
        return aActivityParamSet;
    }
    hasPendingAnimation() {
        return true;
    }
    saveStateOfAnimatedElement() {
        this.getAnimatedElement().saveState(this.getId());
    }
    removeEffect() {
        this.getAnimatedElement().restoreState(this.getId());
    }
    getTargetHash() {
        return this.aTargetHash;
    }
    getAnimatedElement() {
        return this.aAnimatedElement;
    }
    getTargetAnimatedElement() {
        return this.aAnimatedElement;
    }
    dispose() {
        if (this.aActivity)
            this.aActivity.dispose();
        super.dispose();
    }
    getMinFrameCount() {
        return this.nMinFrameCount;
    }
    getAdditiveMode() {
        return this.eAdditiveMode;
    }
    info(bVerbose = false) {
        let sInfo = super.info(bVerbose);
        if (bVerbose) {
            // min frame count
            if (this.getMinFrameCount())
                sInfo += ';  min frame count: ' + this.getMinFrameCount();
            // additive mode
            sInfo += ';  additive: ' + AdditiveMode[this.getAdditiveMode()];
            // target element
            if (this.getTargetHash()) {
                const sElemId = this.getTargetHash();
                sInfo += ';  targetElement: ' + sElemId;
            }
        }
        return sInfo;
    }
}
class AnimationBaseNode2 extends AnimationBaseNode {
    constructor(aNodeInfo, aParentNode, aNodeContext) {
        super(aNodeInfo, aParentNode, aNodeContext);
        this.attributeName = '';
        this.aToValue = null;
    }
    parseNodeInfo() {
        super.parseNodeInfo();
        const aNodeInfo = this.aNodeInfo;
        this.attributeName = aNodeInfo.attributeName;
        if (!this.attributeName) {
            this.eCurrentState = NodeState.Invalid;
            window.app.console.log(`${this.sClassName}.parseElement: target attribute name not found`);
        }
        else {
            this.attributeName = this.attributeName.toLowerCase();
        }
        this.aToValue = aNodeInfo.to;
    }
    getAttributeName() {
        return this.attributeName;
    }
    getToValue() {
        return this.aToValue;
    }
    info(verbose) {
        let sInfo = super.info(verbose);
        if (verbose) {
            if (this.getAttributeName())
                sInfo +=
                    ';  \x1B[31mattributeName: ' + this.getAttributeName() + '\x1B[m';
            if (this.getToValue())
                sInfo += ';  to: ' + this.getToValue();
        }
        return sInfo;
    }
}
class AnimationBaseNode3 extends AnimationBaseNode2 {
    constructor(aNodeInfo, aParentNode, aNodeContext) {
        super(aNodeInfo, aParentNode, aNodeContext);
        this.eAccumulate = undefined;
        this.eCalcMode = undefined;
        this.aFromValue = null;
        this.aByValue = null;
        this.aKeyTimes = null;
        this.aValues = null;
        this.aFormula = null;
    }
    parseNodeInfo() {
        super.parseNodeInfo();
        const aNodeInfo = this.aNodeInfo;
        // accumulate propert
        this.eAccumulate = AccumulateMode.None;
        const sAccumulateAttr = aNodeInfo.accumulate;
        if (sAccumulateAttr === 'sum')
            this.eAccumulate = AccumulateMode.Sum;
        // calcMode property
        this.eCalcMode = CalcMode.Linear;
        if (aNodeInfo.calcMode && aNodeInfo.calcMode in CalcMode) {
            const sCalcMode = aNodeInfo.calcMode;
            this.eCalcMode = CalcMode[sCalcMode];
        }
        this.aFromValue = aNodeInfo.from;
        this.aByValue = aNodeInfo.by;
        // keyTimes property
        this.aKeyTimes = [];
        let sKeyTimesAttr = aNodeInfo.keyTimes;
        sKeyTimesAttr = removeWhiteSpaces(sKeyTimesAttr);
        if (sKeyTimesAttr) {
            const aKeyTimes = sKeyTimesAttr.split(';');
            for (let i = 0; i < aKeyTimes.length; ++i)
                this.aKeyTimes.push(parseFloat(aKeyTimes[i]));
        }
        // values property
        this.aValues = aNodeInfo.values ? aNodeInfo.values.split(';') : [];
        // formula property
        this.aFormula = aNodeInfo.formula;
    }
    getAccumulate() {
        return this.eAccumulate;
    }
    getCalcMode() {
        return this.eCalcMode;
    }
    getFromValue() {
        return this.aFromValue;
    }
    getByValue() {
        return this.aByValue;
    }
    getKeyTimes() {
        return this.aKeyTimes;
    }
    getValues() {
        return this.aValues;
    }
    getFormula() {
        return this.aFormula;
    }
    info(verbose) {
        let sInfo = super.info(verbose);
        if (verbose) {
            // accumulate mode
            if (this.getAccumulate())
                sInfo += ';  accumulate: ' + AccumulateMode[this.getAccumulate()];
            // calcMode
            sInfo += ';  calcMode: ' + CalcMode[this.getCalcMode()];
            // from
            if (this.getFromValue())
                sInfo += ';  from: ' + this.getFromValue();
            // by
            if (this.getByValue())
                sInfo += ';  by: ' + this.getByValue();
            // keyTimes
            if (this.getKeyTimes().length)
                sInfo += ';  keyTimes: ' + this.getKeyTimes().join(',');
            // values
            if (this.getValues().length)
                sInfo += ';  values: ' + this.getValues().join(',');
            // formula
            if (this.getFormula())
                sInfo += ';  formula: ' + this.getFormula();
        }
        return sInfo;
    }
}
