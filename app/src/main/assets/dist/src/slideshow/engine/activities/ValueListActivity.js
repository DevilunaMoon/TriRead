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
function ValueListActivityTemplate(BaseType) {
    class ValueListActivity extends BaseType {
        constructor(...args) {
            assert(args.length === 6, 'ValueListActivity, constructor args length is wrong');
            const aValueList = args[0];
            const aActivityParamSet = args[1];
            const aAnimation = args[2];
            const aInterpolator = args[3];
            const aOperatorSet = args[4];
            const bAccumulate = args[5];
            assert(aAnimation, 'ValueListActivity constructor: invalid animation object');
            assert(aValueList.length != 0, 'ValueListActivity: value list is empty');
            super(aValueList, aActivityParamSet, aAnimation, aInterpolator, aOperatorSet, bAccumulate);
            this.aValueList = aValueList;
            this.aAnimation = aAnimation;
            this.aInterpolator = aInterpolator;
            this.add = aOperatorSet.add;
            this.scale = aOperatorSet.scale;
            this.bCumulative = bAccumulate;
            this.aLastValue = this.aValueList[this.aValueList.length - 1];
            this.aFormula = aActivityParamSet.aFormula;
        }
        activate(aEndEvent) {
            super.activate(aEndEvent);
            for (let i = 0; i < this.aValueList.length; ++i) {
                ANIMDBG.print('ValueListActivity.activate: value[' +
                    i +
                    '] = ' +
                    this.aValueList[i]);
            }
        }
        initAnimatedElement() {
            if (this.aAnimation) {
                let aValue = this.aValueList[0];
                aValue = this.aFormula ? this.aFormula(aValue) : aValue;
                this.aAnimation.perform(aValue);
            }
        }
        startAnimation() {
            if (this.isDisposed() || !this.aAnimation) {
                window.app.console.log('ValueListActivity.startAnimation: activity disposed or not valid animation');
                return;
            }
            super.startAnimation();
            this.aAnimation.start(this.getTargetElement());
        }
        endAnimation() {
            if (this.aAnimation)
                this.aAnimation.end();
        }
        // perform hook override for ContinuousKeyTimeActivityBase base
        performContinuousHook(nIndex, nFractionalIndex, nRepeatCount) {
            if (this.isDisposed() || !this.aAnimation) {
                window.app.console.log('ValueListActivity.performContinuousHook: activity disposed or not valid animation');
                return;
            }
            assert(nIndex + 1 < this.aValueList.length, 'ValueListActivity.performContinuousHook: assertion (nIndex + 1 < this.aValueList.length) failed');
            // interpolate between nIndex and nIndex+1 values
            let aValue = this.aInterpolator(this.aValueList[nIndex], this.aValueList[nIndex + 1], nFractionalIndex);
            if (this.bCumulative) {
                //aValue = aValue + nRepeatCount * this.aLastValue;
                aValue = this.add(aValue, this.scale(nRepeatCount, this.aLastValue));
            }
            aValue = this.aFormula ? this.aFormula(aValue) : aValue;
            this.aAnimation.perform(aValue);
        }
        // perform hook override for DiscreteActivityBase base
        performDiscreteHook(nFrame, nRepeatCount) {
            if (this.isDisposed() || !this.aAnimation) {
                window.app.console.log('ValueListActivity.performDiscreteHook: activity disposed or not valid animation');
                return;
            }
            assert(nFrame < this.aValueList.length, 'ValueListActivity.performDiscreteHook: assertion ( nFrame < this.aValueList.length) failed');
            // this is discrete, thus no lerp here.
            let aValue = this.aValueList[nFrame];
            if (this.bCumulative) {
                aValue = this.add(aValue, this.scale(nRepeatCount, this.aLastValue));
                // for numbers:   aValue = aValue + nRepeatCount * this.aLastValue;
                // for enums, bools or strings:   aValue = aValue;
            }
            aValue = this.aFormula ? this.aFormula(aValue) : aValue;
            this.aAnimation.perform(aValue);
        }
        performEnd() {
            if (this.aAnimation) {
                const aValue = this.aFormula
                    ? this.aFormula(this.aLastValue)
                    : this.aLastValue;
                this.aAnimation.perform(aValue);
            }
        }
        dispose() {
            super.dispose();
        }
    }
    return ValueListActivity;
}
class ContinuousKeyTimeActivityBaseValueListCtor extends ContinuousKeyTimeActivityBase {
    constructor(aValueList, aActivityParamSet, aAnimation, aInterpolator, aOperatorSet, bAccumulate) {
        super(aActivityParamSet);
    }
}
const AbstractLinearValueListActivity = ValueListActivityTemplate(ContinuousKeyTimeActivityBaseValueListCtor);
class LinearValueListActivity extends AbstractLinearValueListActivity {
}
class DiscreteActivityBaserValueListCtor extends DiscreteActivityBase {
    constructor(aValueList, aActivityParamSet, aAnimation, aInterpolator, aOperatorSet, bAccumulate) {
        super(aActivityParamSet);
    }
}
const AbstractDiscreteValueListActivity = ValueListActivityTemplate(DiscreteActivityBaserValueListCtor);
class DiscreteValueListActivity extends AbstractDiscreteValueListActivity {
}
