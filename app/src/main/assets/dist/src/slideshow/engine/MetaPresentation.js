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
class MetaPresentation {
    constructor(info, aSlideShowHandler, aSlideShowNavigator) {
        this.aSlideShowHandler = aSlideShowHandler;
        this.update(info);
        this.setNavigator(aSlideShowNavigator);
    }
    setNavigator(nav) {
        this.slideShowNavigator = nav;
        // We set up a low priority for the invocation of canvas handleClick
        // in order to make clicks on shapes, that start interactive animation
        // sequence (on click), have a higher priority.
        this.metaSlides.forEach((metaSlide) => {
            if (metaSlide.animationsHandler) {
                const eventMultiplexer = metaSlide.animationsHandler.eventMultiplexer;
                if (eventMultiplexer)
                    eventMultiplexer.registerMouseClickHandler(this.slideShowNavigator.canvasClickHandler, 100);
            }
        });
    }
    get slideShowHandler() {
        return this.aSlideShowHandler;
    }
    get startSlideIndex() {
        return this._startSlideIndex;
    }
    update(info) {
        this.docWidth = info.docWidth;
        this.docHeight = info.docHeight;
        const aContext = this.aSlideShowHandler.getContext();
        aContext.nSlideWidth = this.docWidth;
        aContext.nSlideHeight = this.docHeight;
        this._numberOfSlides = info.slides.length;
        if (this._numberOfSlides === 0)
            return;
        this.firstSlideHash = info.slides[0].hash;
        this.lastSlideHash = info.slides[this._numberOfSlides - 1].hash;
        this.metaSlides = new Map();
        this.partHashes = new Map();
        let prevSlideHash = null;
        for (let i = 0; i < this._numberOfSlides; ++i) {
            const slide = info.slides[i];
            slide.indexInSlideShow = i;
            slide.prev = prevSlideHash;
            slide.next =
                i + 1 < this._numberOfSlides ? info.slides[i + 1].hash : null;
            const metaSlide = new MetaSlide(slide, this);
            this.metaSlides.set(slide.hash, metaSlide);
            this.partHashes.set(slide.index, slide.hash);
            prevSlideHash = slide.hash;
        }
    }
    isEmpty() {
        return this._numberOfSlides === 0;
    }
    get numberOfSlides() {
        return this._numberOfSlides;
    }
    getDocWidth() {
        return this.docWidth;
    }
    getDocHeight() {
        return this.docHeight;
    }
    setDocWidth(slideWidth) {
        this.docWidth = slideWidth;
    }
    setDocHeight(slideHeight) {
        this.docHeight = slideHeight;
    }
    getCurrentSlideIndex() {
        return this.slideShowNavigator.currentSlideIndex;
    }
    getCurrentSlideHash() {
        return this.getSlideHash(this.getCurrentSlideIndex());
    }
    getSlideHash(slideIndex) {
        return this.partHashes.get(slideIndex);
    }
    isFirstSlide(hash) {
        return hash === this.firstSlideHash;
    }
    isLastSlide(hash) {
        return hash === this.lastSlideHash;
    }
    getMetaSlide(slideHash) {
        return this.metaSlides.get(slideHash);
    }
    getMetaSlideByIndex(slideIndex) {
        return this.getMetaSlide(this.getSlideHash(slideIndex));
    }
    getSlideInfo(slideHash) {
        const metaSlide = this.getMetaSlide(slideHash);
        return metaSlide ? metaSlide.info : null;
    }
    getSlideInfoByIndex(slideIndex) {
        const slideHash = this.getSlideHash(slideIndex);
        return slideHash ? this.getSlideInfo(slideHash) : null;
    }
    getMetaSlides() {
        return this.metaSlides;
    }
    setCurrentSlide(nSlideIndex) {
        if (nSlideIndex >= 0 && nSlideIndex < this.numberOfSlides) {
            const nCurSlide = this.getCurrentSlideIndex();
            if (nCurSlide !== undefined)
                this.getMetaSlideByIndex(nCurSlide).hide();
            this.getMetaSlideByIndex(nCurSlide).show();
        }
        else {
            window.app.console.log('MetaPresentation.setCurrentSlide: slide index out of range: ' +
                nSlideIndex);
        }
    }
}
