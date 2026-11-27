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
class ISlideChangeBase {
}
// we use mixin for simulating multiple inheritance
function SlideChangeTemplate(BaseType) {
    class SlideChangeBase extends BaseType {
        constructor(...args) {
            assert(args.length === 1, 'SlideChangeBase, constructor args length is wrong');
            const transitionParameters = args[0];
            super(transitionParameters);
            this.transitionParameters = transitionParameters;
            this.leavingSlide = transitionParameters.current;
            this.enteringSlide = transitionParameters.next;
            this.isFinished = false;
            this.time = null;
        }
        end() {
            if (this.isFinished)
                return;
            this.isFinished = true;
            this.endTransition();
        }
        // Each step of the transition is drawn as soon as it is performed.
        perform(nT, _last = false) {
            if (this.isFinished)
                return;
            this.time = nT;
            if (nT > 0.0)
                this.render(nT);
        }
        renderFrame(nT, properties) {
            if (nT !== null && nT >= 0.0) {
                this.render(nT, properties);
            }
        }
        getUnderlyingValue() {
            return 0.0;
        }
    }
    return SlideChangeBase;
}
// classes passed to SlideChangeTemplate must have the same number and types of ctor parameters
// expected by SlideChangeBase, so we define the following wrapper class
class TextureRendererCtorForSlideChangeBase extends SimpleTextureRenderer {
    constructor(transitionParameters) {
        super(transitionParameters.context, 
        /*create program*/ false);
    }
}
// SlideChangeGl extends SlideChangeBase, SimpleTextureRenderer
const SlideChangeGl = SlideChangeTemplate(TextureRendererCtorForSlideChangeBase);
