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
class NodeContext {
    constructor(aSlideShowContext) {
        this._context = null;
        this.aAnimationNodeMap = null;
        this.aAnimatedElementMap = null;
        this.aSourceEventElementMap = null;
        this.metaSlide = null;
        this.nStartDelay = 0.0;
        this.bFirstRun = undefined;
        this.bIsInvalid = false;
        this._context = aSlideShowContext;
    }
    makeSourceEventElement(sId, aSlideShow) {
        if (!this._context.aEventMultiplexer) {
            window.app.console.log('NodeContext.makeSourceEventElement: event multiplexer not initialized');
            return null;
        }
        if (!this.aSourceEventElementMap.has(sId)) {
            const triggerInfo = this.metaSlide.getTriggerInfo(sId);
            if (!triggerInfo) {
                window.app.console.log('NodeContext.makeSourceEventElement: no bounds found for event trigger: ' +
                    sId);
                return null;
            }
            this.aSourceEventElementMap.set(sId, new SourceEventElement(sId, this._context._canvas, triggerInfo.bounds, triggerInfo.index, aSlideShow, this._context.aEventMultiplexer));
        }
        return this.aSourceEventElementMap.get(sId);
    }
}
