// @ts-strict-ignore
/** */
class SlideCache {
    constructor() {
        this.renderedSlides = new Map();
    }
    // TODO: cache other layers here
    has(slideHash) {
        return this.renderedSlides.has(slideHash);
    }
    get(slideHash) {
        return this.renderedSlides.get(slideHash);
    }
    set(slideHash, image) {
        this.renderedSlides.set(slideHash, image);
    }
    invalidate(slideHash) {
        this.renderedSlides.delete(slideHash);
    }
    invalidateAll() {
        this.renderedSlides.clear();
    }
}
SlideShow.SlideCache = SlideCache;
