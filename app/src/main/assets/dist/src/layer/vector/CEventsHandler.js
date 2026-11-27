// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
// Used as base class for classes that needs to setup
// event handlers for real or synthetic events.
class CEventsHandler {
    constructor() {
        this.supportedEventNames = [
            'add',
            'remove',
            'mouseenter',
            'mouseleave'
        ];
        this.handlers = new Map();
        var handlers = this.handlers;
        this.supportedEventNames.forEach(function (eName) {
            handlers.set(eName, new Set());
        });
    }
    addSupportedEvents(eventNames) {
        for (var i = 0; i < eventNames.length; ++i) {
            var eName = eventNames[i];
            if (this.handlers.has(eName))
                continue;
            this.supportedEventNames.push(eName);
            this.handlers.set(eName, new Set());
        }
    }
    on(eventName, handler) {
        var handlerSet = this.handlers.get(eventName);
        if (handlerSet === undefined) {
            console.warn('Unknown event type: ' + eventName + ' used to register a handler');
            return false;
        }
        handlerSet.add(handler);
    }
    off(eventName, handler) {
        var handlerSet = this.handlers.get(eventName);
        if (handlerSet === undefined) {
            console.warn('Unknown event type: ' + eventName + ' used to unregister a handler');
            return false;
        }
        var removed = handlerSet.delete(handler);
        if (!removed) {
            console.warn('Unregistered handler!');
            return false;
        }
        return true;
    }
    fire(eventName, eventData) {
        var handlerSet = this.handlers.get(eventName);
        if (handlerSet === undefined) {
            console.warn('Unknown event type: ' + eventName);
            return false;
        }
        handlerSet.forEach(function (handler) {
            handler.call(this, eventData);
        }, this);
    }
}
