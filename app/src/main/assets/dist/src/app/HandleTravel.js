/* -*- js-indent-level: 8 -*- */
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
    The keyboard on the handles of one selection: which handle it is on, how that handle blinks,
    how it travels from one handle to the next and how it moves the one it is on. The handles
    themselves come from whoever owns the travel, which is the one that knows them.
*/
class HandleTravel {
    /*
        How long the active handle stays shown, and then hidden, in milliseconds. The engine says
        what the desktop of the person using it asks for; half a second stands in until it does,
        which is what the text cursor of this client does anyway.
    */
    static { this.blinkTime = 500; }
    /// The travel whose handle is blinking, of which there is one, since there is one selection.
    static { this.blinking = null; }
    /// Takes the blink speed the engine reports, and blinks at it from now on.
    static setBlinkTime(milliseconds) {
        if (!(milliseconds > 0) || milliseconds === HandleTravel.blinkTime)
            return;
        HandleTravel.blinkTime = milliseconds;
        // Start again at the new speed where a handle is blinking now.
        const travel = HandleTravel.blinking;
        if (travel) {
            travel.blink(false);
            travel.blink(true);
        }
    }
    /// How far a key moves what it works on, in twips, as EditSteps sets it out.
    static stepFor(event) {
        return EditSteps.moveStep(event);
    }
    constructor(handlesOf, moveHandle, pressHandle, blinks) {
        /*
            The handle the keyboard works on, by the name that says what it is, or null while the
            keyboard is on no handle. A name outlives the handles being built again after every move,
            where a place in a list would not.
        */
        this.activeName = null;
        /// Whether the active handle is drawn in its larger form in this moment.
        this.visible = true;
        this.timer = null;
        this.handlesOf = handlesOf;
        this.moveHandle = moveHandle;
        this.pressHandle = pressHandle;
        this.blinks = blinks;
    }
    /// Whether the handle of that name is the one the keyboard is on and is shown large now.
    showsAsActive(name) {
        return name !== undefined && name === this.activeName && this.visible;
    }
    /// Whether the keyboard is on a handle at all.
    isOnAHandle() {
        return this.activeName !== null;
    }
    /// The handles that can be traveled: the ones the client named, since a name is what the
    /// engine is told to move.
    handles() {
        return this.handlesOf().filter((handle) => handle?.name && !handle.deactivated);
    }
    /// The name of the handle the keyboard works on, or nothing while it is on none.
    whichIsActive() {
        return this.activeName;
    }
    /// The handle the keyboard works on, or nothing while it is on none.
    activeHandle() {
        return this.handles().find((handle) => handle.name === this.activeName);
    }
    /// Starts the active handle blinking, or stops it and leaves it shown.
    blink(wanted) {
        if (wanted === (this.timer !== null))
            return;
        if (!wanted) {
            if (this.timer !== null)
                clearInterval(this.timer);
            this.timer = null;
            this.visible = true;
            if (HandleTravel.blinking === this)
                HandleTravel.blinking = null;
            return;
        }
        this.visible = true;
        HandleTravel.blinking = this;
        this.timer = setInterval(() => {
            this.visible = !this.visible;
            app.sectionContainer?.requestReDraw();
        }, HandleTravel.blinkTime);
    }
    /// The handle the keyboard works on, by name, with the blinking that shows which one it is.
    setActive(name) {
        this.activeName = name;
        this.blink(name !== null && this.blinks(name));
        app.sectionContainer?.requestReDraw();
        if (name !== null)
            this.scrollToActive();
    }
    /// Brings the handle the keyboard is on on screen.
    scrollToActive() {
        const handle = this.activeHandle();
        if (!handle)
            return;
        GraphicSelection.scrollPointIntoView(new cool.SimplePoint(handle.point.x, handle.point.y));
    }
    /*
        Moves the keyboard from one handle of the selection to the next, or to the one before. It
        starts at the first handle, or at the last one going backwards, and after the last one it
        goes round to the first. One handle is the one it is on the whole way: walking off the
        handles is what Escape is for, and walking from one object to the next is what Tab is for.
    */
    travel(forward) {
        const handles = this.handles();
        if (!handles.length)
            return false;
        const at = handles.findIndex((handle) => handle.name === this.activeName);
        if (at < 0) {
            this.setActive(handles[forward ? 0 : handles.length - 1].name);
            return true;
        }
        const next = (at + (forward ? 1 : -1) + handles.length) % handles.length;
        this.setActive(handles[next].name);
        return true;
    }
    /*
        Puts the keyboard on the handle of that name, which is what a press that let go where it
        started does: it is the quickest way onto a handle among hundreds, a point of a polygon
        among them, without walking there.
    */
    goTo(name) {
        if (!name || name === this.activeName)
            return false;
        this.setActive(name);
        return true;
    }
    /// Puts the keyboard on the first handle of the selection, or on the last one.
    travelToEnd(first) {
        const handles = this.handles();
        if (!handles.length)
            return false;
        this.setActive(handles[first ? 0 : handles.length - 1].name);
        return true;
    }
    /// Takes the keyboard off the handle it was on.
    leave() {
        if (this.activeName === null)
            return false;
        this.setActive(null);
        return true;
    }
    /*
        Moves the handle the keyboard is on, as dragging it with the mouse would, and takes the
        view along where the handle leaves it.
    */
    move(towards, event) {
        const handle = this.activeHandle();
        if (!handle)
            return false;
        const landed = this.moveHandle(handle, towards, event);
        // The handle goes where it was asked to go, and the view follows it there. Where it lands
        // is known already, while the handles that come back arrive later.
        if (landed)
            GraphicSelection.scrollPointIntoView(landed);
        return true;
    }
    /*
        What the keyboard does to the handles: travel from one to the next, to either end of them,
        away from them again, move the one it is on, and press it with Space, Return or 0. Answers
        whether the key was used up here.
        Going to either end and moving work on the handle the keyboard is on, so they are used up
        only while it is on one; otherwise Ctrl+Home and Ctrl+End are left to the objects.
    */
    keyboard(event) {
        const towards = {
            ArrowUp: new cool.Point(0, -1),
            ArrowDown: new cool.Point(0, 1),
            ArrowLeft: new cool.Point(-1, 0),
            ArrowRight: new cool.Point(1, 0),
        };
        if (event.key === 'Tab' && (event.ctrlKey || event.altKey))
            return this.travel(!event.shiftKey);
        if (event.key === 'Home' && event.ctrlKey && this.activeName !== null)
            return this.travelToEnd(true);
        if (event.key === 'End' && event.ctrlKey && this.activeName !== null)
            return this.travelToEnd(false);
        if (event.key === 'Escape')
            return this.leave();
        if ((event.key === 'Enter' || event.key === ' ' || event.key === '0') &&
            !event.ctrlKey &&
            !event.altKey &&
            !event.metaKey) {
            const handle = this.activeHandle();
            if (handle && this.pressHandle(handle, event))
                return true;
        }
        if (towards[event.key] && this.activeName !== null)
            return this.move(towards[event.key], event);
        return false;
    }
}
