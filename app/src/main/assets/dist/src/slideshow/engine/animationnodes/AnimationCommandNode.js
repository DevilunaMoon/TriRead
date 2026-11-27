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
 * Starts, pauses, resumes or stops the video of its target on activation. A command takes no
 * time and leaves nothing to restore.
 */
var EffectCommand;
(function (EffectCommand) {
    EffectCommand[EffectCommand["Custom"] = 0] = "Custom";
    EffectCommand[EffectCommand["Verb"] = 1] = "Verb";
    EffectCommand[EffectCommand["Play"] = 2] = "Play";
    EffectCommand[EffectCommand["TogglePause"] = 3] = "TogglePause";
    EffectCommand[EffectCommand["Stop"] = 4] = "Stop";
    EffectCommand[EffectCommand["StopAudio"] = 5] = "StopAudio";
})(EffectCommand || (EffectCommand = {}));
class AnimationCommandNode extends BaseNode {
    constructor(aNodeInfo, aParentNode, aNodeContext) {
        super(aNodeInfo, aParentNode, aNodeContext);
        this.sClassName = 'AnimationCommandNode';
    }
    parseNodeInfo() {
        super.parseNodeInfo();
        const aNodeInfo = this.aNodeInfo;
        this.sTargetElement = aNodeInfo.targetElement;
        const sCommand = aNodeInfo.command;
        this.eCommand = EffectCommand[sCommand];
        this.nMediaTime = aNodeInfo.mediaTime ?? 0;
        if (!this.sTargetElement || this.eCommand === undefined) {
            this.eCurrentState = NodeState.Invalid;
            window.app.console.log('AnimationCommandNode.parseNodeInfo: invalid target or command');
        }
    }
    // The renderer of the target's video on the slide, or null.
    getVideoRenderer() {
        const slideInfo = this.aNodeContext.metaSlide.info;
        const videoInfo = slideInfo.videos?.find((info) => String(info.id) === this.sTargetElement);
        if (!videoInfo)
            return null;
        return this._context.aSlideShowHandler.getVideoRenderer(slideInfo.hash, videoInfo);
    }
    // Play starts at the media time. Toggle pauses or resumes, and replays an ended video.
    // Stop pauses and rewinds.
    activate_st() {
        const video = this.getVideoRenderer();
        if (video) {
            switch (this.eCommand) {
                case EffectCommand.Play:
                    video.playFrom(this.nMediaTime);
                    break;
                case EffectCommand.TogglePause:
                    video.handleClick();
                    break;
                case EffectCommand.Stop:
                    video.stop();
                    break;
            }
        }
        // A command takes no time, so the next effect in the sequence starts at once.
        this.scheduleDeactivationEvent(this.makeDeactivationEvent(0.0));
    }
    hasPendingAnimation() {
        return true;
    }
    removeEffect() {
        // A command leaves no state to restore.
    }
    saveStateOfAnimatedElement() {
        // A command has no animated element.
    }
}
