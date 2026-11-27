/* -*- js-indent-level: 8; fill-column: 100 -*- */
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
    The values of the view that draws from the objects that can be set in the client's
    preferences, read each time, so a change counts at once. Outside that view each gives its
    default, and the tiled view stays as it is.
*/
class VectorSettings {
    /// true while the view draws from the objects
    static inVectorView() {
        return app.activeDocument?.activeLayout?.type === 'ViewLayoutVector';
    }
    /// the number set under that name where it is at least the lowest, the default otherwise
    static number(name, byDefault, lowest) {
        if (!VectorSettings.inVectorView())
            return byDefault;
        const value = window.prefs?.getNumber(name, byDefault) ?? byDefault;
        return value >= lowest ? value : byDefault;
    }
    /// how near a dragged edge or middle comes to another object's before it snaps to it, in
    /// screen pixels (vectorSnapDistance); 0 snaps never
    static snapDistance() {
        return VectorSettings.number('vectorSnapDistance', 10, 0);
    }
    /// how wide a handle of a share of one is, in screen pixels (vectorHandleSize)
    static handleSize(byDefault) {
        return VectorSettings.number('vectorHandleSize', byDefault, 4);
    }
    /// how long the notice of a key or a drag held back is fully seen, in ms
    /// (vectorHoldBackSeen)
    static holdBackSeen() {
        return VectorSettings.number('vectorHoldBackSeen', 700, 0);
    }
    /// how long that notice then takes to fade away, in ms (vectorHoldBackFading)
    static holdBackFading() {
        return VectorSettings.number('vectorHoldBackFading', 400, 1);
    }
    /// how long an undo or a redo is waited for before a key or a drag held back for it is told,
    /// in ms (vectorHoldBackToldAfter); a connection of the usual speed answers well within the
    /// default, so a key right after an undo is held back there without a word
    static holdBackToldAfter() {
        return VectorSettings.number('vectorHoldBackToldAfter', 1000, 0);
    }
    /// how long a caret moved in the client rests before the engine is told, in ms
    /// (vectorCaretRestDelay); a held key moves it many times a second, and the engine shows
    /// each caret to the toolbar and the other views
    static caretRestDelay() {
        return VectorSettings.number('vectorCaretRestDelay', 300, 0);
    }
}
