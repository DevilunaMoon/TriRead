// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
class DocEvents {
    static { this.documentContainerId = 'document-container'; }
    constructor() {
        this.initiate();
    }
    initiate() {
        this.container = document.getElementById(DocEvents.documentContainerId);
        if (!this.container)
            console.error('DocEvents initation failed.');
        // Resize event for a div element is not fired. We'll use a resize-observer for catching the event.
        new ResizeObserver(this.fire.bind(this, 'resize')).observe(this.container);
    }
    fire(eventType, details) {
        const newEvent = new CustomEvent(eventType, { detail: details });
        this.container.dispatchEvent(newEvent);
    }
    on(eventType, callback) {
        this.container.addEventListener(eventType, callback);
    }
    off(eventType, callback) {
        this.container.removeEventListener(eventType, callback);
    }
}
