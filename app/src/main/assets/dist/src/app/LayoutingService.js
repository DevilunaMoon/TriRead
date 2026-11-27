/* -*- js-indent-level: 8; fill-column: 100 -*- */
class LayoutingService {
    constructor() {
        this._requestedFrame = null;
        this._layoutTasks = [];
        this._layoutTaskFlush = null;
        this._drainCallbacks = [];
        this._lastTaskId = 0;
        // get something around 25 fps as minimum (35ms + some overflow = ~40ms)
        this.MAX_TASK_DURATION_MS = 35;
        this.MIN_TIMER_DELAY_MS = 10;
    }
    appendLayoutingTask(task) {
        const taskObject = {
            taskId: '' + this._lastTaskId++,
            func: task,
        };
        this._layoutTasks.push(taskObject);
        this._scheduleLayouting();
        return taskObject.taskId;
    }
    cancelLayoutingTask(id) {
        this._layoutTasks = this._layoutTasks.filter((task) => {
            return task.taskId !== id;
        });
    }
    hasTasksPending() {
        return this._layoutTasks.length > 0;
    }
    onDrain(callback) {
        this._drainCallbacks.push(callback);
        this._scheduleLayouting();
    }
    runTheTopTask() {
        const task = this._layoutTasks.shift();
        if (!task || !task.func)
            return false;
        app.enterRAF();
        try {
            task.func();
        }
        catch (ex) {
            console.error('LayoutingTask exception: ' + ex);
        }
        app.exitRAF();
        return true;
    }
    cancelFrame() {
        if (this._requestedFrame)
            window.cancelAnimationFrame(this._requestedFrame);
        this._requestedFrame = null;
    }
    // Called by CanvasSectionContainer after it synchronously flushes tasks
    triggerDrainCallbacks() {
        if (!this.hasTasksPending()) {
            this._runDrainCallbacks();
        }
    }
    // internal implementation below
    _setupTimer() {
        this._layoutTaskFlush = setTimeout(this._flushLayoutingQueue.bind(this), this.MIN_TIMER_DELAY_MS);
    }
    _reachedTaskTimeout(start) {
        const duration = performance.now() - start;
        if (duration > this.MAX_TASK_DURATION_MS)
            return true;
        return false;
    }
    _flushLayoutingQueue() {
        this._layoutTaskFlush = null;
        if (!this.hasTasksPending()) {
            this._runDrainCallbacks();
            return;
        }
        this._requestedFrame = window.requestAnimationFrame(() => {
            this._requestedFrame = null;
            const start = performance.now();
            while (this.runTheTopTask()) {
                if (this._reachedTaskTimeout(start)) {
                    this._scheduleLayouting();
                    return;
                }
            }
            this._runDrainCallbacks();
        });
    }
    _runDrainCallbacks() {
        app.enterRAF();
        const callbacks = this._drainCallbacks;
        this._drainCallbacks = [];
        for (const cb of callbacks) {
            try {
                cb();
            }
            catch (ex) {
                console.error('Drain callback exception: ' + ex);
            }
        }
        app.exitRAF();
    }
    _scheduleLayouting() {
        if (this._layoutTaskFlush)
            return;
        this._setupTimer();
    }
}
