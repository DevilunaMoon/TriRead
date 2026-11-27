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
class AnimationPathMotionNode extends AnimationBaseNode {
    constructor(aNodeInfo, aParentNode, aNodeContext) {
        super(aNodeInfo, aParentNode, aNodeContext);
        this.sClassName = 'AnimationPathMotionNode';
    }
    parseNodeInfo() {
        super.parseNodeInfo();
        const aNodeInfo = this.aNodeInfo;
        if (!aNodeInfo.path) {
            this.eCurrentState = NodeState.Invalid;
            window.app.console.log('AnimationPathMotionNode.parseElement: path is not valid');
        }
        this.path = aNodeInfo.path;
    }
    createActivity() {
        const aActivityParamSet = this.fillActivityParams();
        const aAnimation = new PathAnimation(this.path, this.getAdditiveMode(), aActivityParamSet.nSlideWidth, aActivityParamSet.nSlideHeight);
        return new SimpleActivity(aActivityParamSet, aAnimation, DirectionType.Forward);
    }
    getPath() {
        return this.path;
    }
    info(bVerbose = false) {
        let sInfo = super.info.call(this, bVerbose);
        if (bVerbose) {
            // svg path
            sInfo += ';  path: ' + this.getPath();
        }
        return sInfo;
    }
}
