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
class MetaSlide {
    constructor(slideInfo, metaPres) {
        this._info = slideInfo;
        this._metaPres = metaPres;
        this._slideShowHandler = metaPres.slideShowHandler;
        if (this.hasTransition())
            this._transitionHandler = new SlideTransition(slideInfo);
        if (slideInfo.animations) {
            this._animationsHandler = new SlideAnimations(this._slideShowHandler.getContext(), this);
            this._animationsHandler.importAnimations(slideInfo.animations.root);
            this._animationsHandler.parseInfo();
            this.setInitialVisibilities(slideInfo.animations.root);
            app.console.debug(`\x1B[1mSlide ${this._info.index} Animation Tree\x1B[m\n` +
                this._animationsHandler.info(true));
        }
    }
    // A target starts the slide in the visibility of its first effect, where
    // the engine resolved one. An effect is a node with a preset id, and its
    // target the first named under it.
    setInitialVisibilities(aRoot) {
        const aSeenTargets = new Set();
        this.walkEffects(aRoot, (aEffect) => {
            const sTarget = MetaSlide.firstTargetUnder(aEffect);
            if (!sTarget || aSeenTargets.has(sTarget))
                return;
            aSeenTargets.add(sTarget);
            if (aEffect.initVisible === undefined)
                return;
            const aElement = this._animationsHandler
                .getAnimatedElementMap()
                .get(sTarget);
            if (aElement)
                aElement.setInitialVisibility(aEffect.initVisible);
        });
    }
    walkEffects(aNode, onEffect) {
        if (!aNode)
            return;
        if (aNode.presetId) {
            onEffect(aNode);
            return;
        }
        const aChildren = aNode.children;
        if (aChildren)
            for (const aChild of aChildren)
                this.walkEffects(aChild, onEffect);
    }
    static firstTargetUnder(aNode) {
        const sTarget = aNode.targetElement;
        if (sTarget)
            return sTarget;
        const aChildren = aNode.children;
        if (aChildren)
            for (const aChild of aChildren) {
                const sFound = MetaSlide.firstTargetUnder(aChild);
                if (sFound)
                    return sFound;
            }
        return undefined;
    }
    hasTransition() {
        return stringToTransitionTypeMap[this._info.transitionType] !== undefined;
    }
    get info() {
        return this._info;
    }
    get hidden() {
        return this._info.hidden;
    }
    get next() {
        return this.info.next ? this._metaPres.getMetaSlide(this.info.next) : null;
    }
    get prev() {
        return this.info.prev ? this._metaPres.getMetaSlide(this.info.prev) : null;
    }
    get transitionHandler() {
        return this._transitionHandler;
    }
    get animationsHandler() {
        return this._animationsHandler;
    }
    getTriggerInfo(hash) {
        const triggers = this._info.triggers;
        if (triggers) {
            const index = triggers.findIndex((value) => value.hash === hash);
            if (index !== -1) {
                return {
                    bounds: triggers[index].bounds,
                    index: index,
                };
            }
        }
        return null;
    }
    show() {
        // TODO implement it ?
    }
    hide() {
        // TODO implement it ?
    }
}
