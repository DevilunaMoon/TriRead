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
const NAV_KEYS = new Set([
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
    'PageUp',
    'PageDown',
]);
const lastSentSelection = new Map();
// Edits are preventDefault-ed, so the DOM caret never moves, and under latency
// fast typing would send several edits at the same stale offset. So we advance
// this localCaret and send edits against it.
const localCaret = new Map();
const ACTIVE_TYPING_MS = 700;
function getLocalCaret(container) {
    const st = localCaret.get(container.id);
    return st ? st.sel : container._spellSel;
}
function setLocalCaret(container, sel, typing) {
    const prev = localCaret.get(container.id);
    localCaret.set(container.id, {
        sel,
        lastEdit: typing ? Date.now() : prev ? prev.lastEdit : 0,
    });
}
function advanceCaret(sel, inputType, text) {
    let p;
    if (inputType === 'deleteContentBackward')
        p = sel.start === sel.end ? Math.max(0, sel.start - 1) : sel.start;
    else if (inputType === 'deleteContentForward')
        p = sel.start;
    else
        p = sel.start + text.length;
    return { start: p, end: p };
}
function syncLocalFromDom(container) {
    const sel = getSelOffsets(container);
    if (sel)
        localCaret.set(container.id, { sel, lastEdit: 0 });
}
function spellSendAction(container, action, data) {
    if (!container.builder || !container.builder.callback)
        return;
    container.builder.callback('customwidget', action, container, data || '', container.builder);
}
function getSelOffsets(container) {
    return JSDialog.ContentEditable.getFlatSelection(container);
}
function setCaret(container, start, end) {
    JSDialog.ContentEditable.setFlatCaret(container, start, end);
}
function maybeSendSelection(container) {
    const sel = getSelOffsets(container);
    if (!sel)
        return;
    const val = sel.start + ':' + sel.end;
    if (lastSentSelection.get(container.id) === val)
        return;
    lastSentSelection.set(container.id, val);
    spellSendAction(container, 'selection', JSON.stringify(sel));
}
function renderRuns(container, data) {
    const text = data.text || '';
    const runs = data.runs || [];
    container.textContent = '';
    if (!runs.length) {
        container.appendChild(document.createTextNode(text));
        return;
    }
    for (const run of runs) {
        const sub = text.substring(run.start, run.end);
        if (!sub)
            continue;
        const span = document.createElement('span');
        span.textContent = sub;
        if (run.field)
            span.classList.add('ui-spell-field');
        if (run.error)
            span.classList.add('ui-spell-error');
        if (run.active) {
            span.classList.add('ui-spell-active');
            span.style.color = run.grammar
                ? data.grammarColor || ''
                : data.spellColor || '';
            span.style.fontWeight = 'bold';
            span.setAttribute('aria-invalid', run.grammar ? 'grammar' : 'spelling');
        }
        container.appendChild(span);
    }
}
function onBeforeInput(container, e) {
    e.preventDefault();
    const domSel = getSelOffsets(container);
    if (!domSel)
        return;
    const sel = domSel.start === domSel.end ? getLocalCaret(container) : domSel;
    const send = (text, inputType) => {
        spellSendAction(container, 'edit', JSON.stringify({ start: sel.start, end: sel.end, text, inputType }));
        setLocalCaret(container, advanceCaret(sel, inputType, text), true);
    };
    const it = e.inputType;
    if (it === 'insertText' || it === 'insertReplacementText') {
        send(e.data || '', 'insertText');
    }
    else if (it === 'insertParagraph' || it === 'insertLineBreak') {
        send('\n', 'insertText');
    }
    else if (it === 'deleteContentBackward' ||
        it === 'deleteWordBackward' ||
        it === 'deleteSoftLineBackward' ||
        it === 'deleteHardLineBackward') {
        send('', 'deleteContentBackward');
    }
    else if (it === 'deleteContentForward' ||
        it === 'deleteWordForward' ||
        it === 'deleteSoftLineForward' ||
        it === 'deleteHardLineForward') {
        send('', 'deleteContentForward');
    }
    else if (it === 'deleteContent' ||
        it === 'deleteByCut' ||
        it === 'deleteByDrag') {
        send('', 'deleteContentBackward');
    }
}
function attachHandlers(container) {
    container.addEventListener('beforeinput', (e) => onBeforeInput(container, e));
    container.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
        if (!text)
            return;
        const sel = getLocalCaret(container);
        spellSendAction(container, 'selection', JSON.stringify(sel));
        spellSendAction(container, 'paste', JSON.stringify({ text }));
        setLocalCaret(container, advanceCaret(sel, 'insertText', text), true);
    });
    container.addEventListener('cut', (e) => {
        const sel = getSelOffsets(container);
        e.preventDefault();
        if (!sel || sel.start === sel.end)
            return;
        if (e.clipboardData)
            e.clipboardData.setData('text/plain', window.getSelection()?.toString() || '');
        spellSendAction(container, 'edit', JSON.stringify({
            start: sel.start,
            end: sel.end,
            text: '',
            inputType: 'deleteContentBackward',
        }));
        setLocalCaret(container, { start: sel.start, end: sel.start }, true);
    });
    const onNav = () => {
        syncLocalFromDom(container);
        maybeSendSelection(container);
    };
    container.addEventListener('mouseup', onNav);
    container.addEventListener('keyup', (e) => {
        if (NAV_KEYS.has(e.key))
            onNav();
    });
}
function _spellSentenceControl(parentContainer, data, builder) {
    const widgetData = data.data || data;
    const container = window.L.DomUtil.create('div', 'ui-spell-sentence ' + (builder.options.cssClass || ''), parentContainer);
    container.id = data.id;
    container.builder = builder;
    const serverSel = widgetData.selection || { start: 0, end: 0 };
    const prev = localCaret.get(data.id);
    const adopt = !prev ||
        Date.now() - prev.lastEdit >= ACTIVE_TYPING_MS ||
        serverSel.start !== serverSel.end;
    container._spellSel = adopt ? serverSel : prev.sel;
    localCaret.set(data.id, {
        sel: container._spellSel,
        lastEdit: adopt ? 0 : prev.lastEdit,
    });
    container.setAttribute('role', 'textbox');
    container.setAttribute('aria-multiline', 'true');
    container.setAttribute('spellcheck', 'false');
    container.setAttribute('autocorrect', 'off');
    container.tabIndex = 0;
    if (widgetData.docColor)
        container.style.background = widgetData.docColor;
    if (widgetData.undoEditMode)
        container.classList.add('undo-edit-mode');
    renderRuns(container, widgetData);
    attachHandlers(container);
    container.setAttribute('contenteditable', 'true');
    const applyCaret = () => {
        if (document.activeElement === container)
            setCaret(container, container._spellSel.start, container._spellSel.end);
    };
    setCaret(container, container._spellSel.start, container._spellSel.end);
    requestAnimationFrame(applyCaret);
    return false;
}
JSDialog.spellSentence = function (parentContainer, data, builder) {
    return _spellSentenceControl(parentContainer, data, builder);
};
if (JSDialog.registerCustomWidgetHandler) {
    JSDialog.registerCustomWidgetHandler('spellsentence', _spellSentenceControl);
}
