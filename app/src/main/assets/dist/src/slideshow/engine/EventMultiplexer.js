// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
class EventMultiplexer {
    static { this.CURR_UNIQUE_ID = 0; }
    constructor(aTimerEventQueue) {
        this.aEventMap = new Map();
        this.aAnimationsEndHandler = null;
        this.aSkipEffectEndHandlerSet = [];
        this.aMouseClickHandlerSet = null;
        this.aSkipEffectEvent = null;
        this.aRewindCurrentEffectEvent = null;
        this.aRewindLastEffectEvent = null;
        this.aSkipInteractiveEffectEventSet = new Map();
        this.aRewindRunningInteractiveEffectEventSet = new Map();
        this.aRewindEndedInteractiveEffectEventSet = new Map();
        this.aRewindedEffectHandlerSet = new Map();
        this.aElementChangedHandlerSet = new Map();
        this.nId = EventMultiplexer.getUniqueId();
        this.aTimerEventQueue = aTimerEventQueue;
        this.aMouseClickHandlerSet = new PriorityQueue(PriorityEntry.compare);
    }
    static getUniqueId() {
        ++EventMultiplexer.CURR_UNIQUE_ID;
        return EventMultiplexer.CURR_UNIQUE_ID;
    }
    clear() {
        this.aEventMap.clear();
        this.aEventMap = null;
        this.aSkipEffectEndHandlerSet = null;
        this.aMouseClickHandlerSet.clear();
        this.aMouseClickHandlerSet = null;
        this.aSkipInteractiveEffectEventSet.clear();
        this.aSkipInteractiveEffectEventSet = null;
        this.aRewindRunningInteractiveEffectEventSet.clear();
        this.aRewindRunningInteractiveEffectEventSet = null;
        this.aRewindEndedInteractiveEffectEventSet.clear();
        this.aRewindEndedInteractiveEffectEventSet = null;
        this.aRewindedEffectHandlerSet.clear();
        this.aRewindedEffectHandlerSet = null;
        this.aElementChangedHandlerSet.clear();
        this.aElementChangedHandlerSet = null;
    }
    getId() {
        return this.nId;
    }
    hasRegisteredMouseClickHandlers() {
        return !this.aMouseClickHandlerSet.isEmpty();
    }
    registerMouseClickHandler(aHandler, nPriority) {
        const aHandlerEntry = new PriorityEntry(aHandler, nPriority);
        this.aMouseClickHandlerSet.push(aHandlerEntry);
    }
    notifyMouseClick(aMouseEvent) {
        const aMouseClickHandlerSet = this.aMouseClickHandlerSet.clone();
        while (!aMouseClickHandlerSet.isEmpty()) {
            const aHandlerEntry = aMouseClickHandlerSet.top();
            aMouseClickHandlerSet.pop();
            if (aHandlerEntry.aValue && aHandlerEntry.aValue.handleClick) {
                if (aHandlerEntry.aValue.handleClick(aMouseEvent))
                    break;
            }
        }
    }
    notifyMouseMove(aMouseEvent) {
        const aMouseClickHandlerSet = this.aMouseClickHandlerSet.clone();
        while (!aMouseClickHandlerSet.isEmpty()) {
            const aHandlerEntry = aMouseClickHandlerSet.top();
            aMouseClickHandlerSet.pop();
            if (aHandlerEntry.aValue && aHandlerEntry.aValue.onMouseMove) {
                if (aHandlerEntry.aValue.onMouseMove(aMouseEvent.x, aMouseEvent.y))
                    break;
            }
        }
    }
    registerEvent(eEventType, aNotifierId, aEvent) {
        const sNotifierId = '' + aNotifierId;
        this.DBG('registerEvent', eEventType, sNotifierId);
        if (!this.aEventMap.has(eEventType)) {
            this.aEventMap.set(eEventType, new Map());
        }
        if (!this.aEventMap.get(eEventType).has(sNotifierId)) {
            this.aEventMap.get(eEventType).set(sNotifierId, []);
        }
        this.aEventMap.get(eEventType).get(sNotifierId).push(aEvent);
    }
    notifyEvent(eEventType, aNotifierId) {
        const sNotifierId = '' + aNotifierId;
        this.DBG('notifyEvent', eEventType, sNotifierId);
        if (this.aEventMap.has(eEventType)) {
            if (this.aEventMap.get(eEventType).has(sNotifierId)) {
                const aEventArray = this.aEventMap.get(eEventType).get(sNotifierId);
                const nSize = aEventArray.length;
                for (let i = 0; i < nSize; ++i) {
                    this.aTimerEventQueue.addEvent(aEventArray[i]);
                }
            }
        }
    }
    registerAnimationsEndHandler(aHandler) {
        this.aAnimationsEndHandler = aHandler;
    }
    notifyAnimationsEndEvent() {
        if (this.aAnimationsEndHandler)
            this.aAnimationsEndHandler();
    }
    registerNextEffectEndHandler(aHandler) {
        this.aSkipEffectEndHandlerSet.push(aHandler);
    }
    notifyNextEffectEndEvent() {
        const nSize = this.aSkipEffectEndHandlerSet.length;
        for (let i = 0; i < nSize; ++i) {
            this.aSkipEffectEndHandlerSet[i]();
        }
        this.aSkipEffectEndHandlerSet = [];
    }
    registerSkipEffectEvent(aEvent) {
        this.aSkipEffectEvent = aEvent;
    }
    notifySkipEffectEvent() {
        if (this.aSkipEffectEvent) {
            this.aTimerEventQueue.addEvent(this.aSkipEffectEvent);
            this.aSkipEffectEvent = null;
        }
    }
    registerRewindCurrentEffectEvent(aEvent) {
        this.aRewindCurrentEffectEvent = aEvent;
    }
    notifyRewindCurrentEffectEvent() {
        if (this.aRewindCurrentEffectEvent) {
            this.aTimerEventQueue.addEvent(this.aRewindCurrentEffectEvent);
            this.aRewindCurrentEffectEvent = null;
        }
    }
    registerRewindLastEffectEvent(aEvent) {
        this.aRewindLastEffectEvent = aEvent;
    }
    notifyRewindLastEffectEvent() {
        if (this.aRewindLastEffectEvent) {
            this.aTimerEventQueue.addEvent(this.aRewindLastEffectEvent);
            this.aRewindLastEffectEvent = null;
        }
    }
    registerSkipInteractiveEffectEvent(nNotifierId, aEvent) {
        this.aSkipInteractiveEffectEventSet.set(nNotifierId, aEvent);
    }
    notifySkipInteractiveEffectEvent(nNotifierId) {
        if (this.aSkipInteractiveEffectEventSet.has(nNotifierId)) {
            this.aTimerEventQueue.addEvent(this.aSkipInteractiveEffectEventSet.get(nNotifierId));
        }
    }
    registerRewindRunningInteractiveEffectEvent(nNotifierId, aEvent) {
        this.aRewindRunningInteractiveEffectEventSet.set(nNotifierId, aEvent);
    }
    notifyRewindRunningInteractiveEffectEvent(nNotifierId) {
        if (this.aRewindRunningInteractiveEffectEventSet.has(nNotifierId)) {
            this.aTimerEventQueue.addEvent(this.aRewindRunningInteractiveEffectEventSet.get(nNotifierId));
        }
    }
    registerRewindEndedInteractiveEffectEvent(nNotifierId, aEvent) {
        this.aRewindEndedInteractiveEffectEventSet.set(nNotifierId, aEvent);
    }
    notifyRewindEndedInteractiveEffectEvent(nNotifierId) {
        if (this.aRewindEndedInteractiveEffectEventSet.has(nNotifierId)) {
            this.aTimerEventQueue.addEvent(this.aRewindEndedInteractiveEffectEventSet.get(nNotifierId));
        }
    }
    registerRewindedEffectHandler(aNotifierId, aHandler) {
        const sNotifierId = '' + aNotifierId;
        this.aRewindedEffectHandlerSet.set(sNotifierId, aHandler);
    }
    notifyRewindedEffectEvent(aNotifierId) {
        const sNotifierId = '' + aNotifierId;
        if (this.aRewindedEffectHandlerSet.has(sNotifierId)) {
            this.aRewindedEffectHandlerSet.get(sNotifierId)();
        }
    }
    registerElementChangedHandler(aNotifierId, aHandler) {
        this.aElementChangedHandlerSet.set(aNotifierId, aHandler);
    }
    notifyElementChangedEvent(aNotifierId, aElement) {
        if (this.aElementChangedHandlerSet.has(aNotifierId)) {
            this.aElementChangedHandlerSet.get(aNotifierId)(aElement);
        }
    }
    DBG(sMethodName, eEventType, nNotifierId, nTime) {
        if (aEventMultiplexerDebugPrinter.isEnabled()) {
            let sInfo = 'EventMultiplexer.' + sMethodName;
            sInfo += '( type: ' + EventTrigger[eEventType];
            sInfo += ', notifier: ' + nNotifierId + ' )';
            aEventMultiplexerDebugPrinter.print(sInfo, nTime);
        }
    }
}
