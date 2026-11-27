// @ts-strict-ignore
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
const pendingRenderSenders = new Map();
let resendOnLoadInstalled = false;
// The loaded state the last docloaded event reported. The document reports itself
// loaded again on every later status message, so only the change from not loaded
// to loaded sends the held requests.
let documentWasLoaded = false;
function isDocumentLoaded() {
    return !app.map || app.map._docLoaded !== false;
}
function installResendOnLoad() {
    if (resendOnLoadInstalled || !app.map)
        return;
    resendOnLoadInstalled = true;
    documentWasLoaded = isDocumentLoaded();
    app.map.on('docloaded', (e) => {
        const loaded = !!e.status;
        if (loaded && !documentWasLoaded)
            resendPendingRenders();
        documentWasLoaded = loaded;
    });
}
/// Sends every render request that is still unanswered.
function resendPendingRenders() {
    for (const pending of Array.from(pendingRenderSenders.values()))
        pending.send();
}
/// Sends a render request for one entry, or holds it until the document is loaded.
/// isAlive tells whether the widget that asked still wants the image.
function requestOnDemandRender(builder, controlType, controlId, entryId, isAlive, maxWidth = 0) {
    const key = controlId + ':' + entryId;
    const dpi = Math.floor(100 * window.devicePixelRatio);
    const data = entryId + ';' + dpi + ';' + dpi + (maxWidth > 0 ? ';' + maxWidth : '');
    const pending = {
        sent: false,
        send: () => {
            if (!isAlive()) {
                pendingRenderSenders.delete(key);
                return;
            }
            pending.sent = true;
            builder.callback(controlType, 'render_entry', { id: controlId }, data, builder);
        },
    };
    pendingRenderSenders.set(key, pending);
    if (isDocumentLoaded())
        pending.send();
    else
        installResendOnLoad();
}
/// The engine answered the request with this key. A request for the same key that
/// is still held has not gone out yet, so the answer is not its own and it stays.
function onDemandRenderAnswered(key) {
    const pending = pendingRenderSenders.get(key);
    if (pending && pending.sent)
        pendingRenderSenders.delete(key);
}
function availableTreeViewWidth(placeholder) {
    const list = placeholder.closest('.ui-treeview');
    if (!list)
        return 0;
    const listLeft = list.getBoundingClientRect().left + list.clientLeft - list.scrollLeft;
    const offset = placeholder.getBoundingClientRect().left - listLeft;
    const paddingEnd = parseFloat(getComputedStyle(list).paddingInlineEnd) || 0;
    return Math.max(Math.floor(list.clientWidth - paddingEnd - offset), 0);
}
function onDemandRenderer(builder, controlId, controlType, entryId, placeholder, parentContainer, entryText, counted = true) {
    const setupOnDemandRenderer = () => {
        // avoid races, might be already updated
        if (!parentContainer.contains(placeholder))
            return;
        const cachedComboboxEntries = builder.rendersCache[controlId];
        let requestRender = true;
        if (cachedComboboxEntries && cachedComboboxEntries.images[entryId]) {
            const originalClass = placeholder.classList;
            window.L.DomUtil.remove(placeholder);
            placeholder = window.L.DomUtil.create('img', '', parentContainer);
            const placeholderImg = placeholder;
            placeholderImg.src = cachedComboboxEntries.images[entryId];
            placeholderImg.alt = entryText;
            placeholderImg.title = entryText;
            originalClass.forEach((className) => placeholderImg.classList.add(className));
            requestRender = !cachedComboboxEntries.persistent;
        }
        if (requestRender) {
            // render on demand
            const pendingKey = controlId + ':' + entryId;
            var onIntersection = (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        // Already rendered for this (controlId,
                        // entryId): rendersCache holds the image.
                        // Skipping avoids the redundant round-trip
                        // that core would dedupe and never reply to,
                        // which would leak the counter.
                        const cached = builder.rendersCache[controlId];
                        if (cached && cached.images[entryId])
                            return;
                        // Increment at most once per pair. On rebuild,
                        // observers for the new placeholder may fire
                        // while the original request is still in
                        // flight - allow the retry send to go out
                        // (core may have dropped the first request)
                        // but do not double-count.
                        if (counted && !app.pendingOnDemandRenderRequests.has(pendingKey)) {
                            app.pendingOnDemandRenderRequests.add(pendingKey);
                            app.pendingOnDemandRenders++;
                        }
                        requestOnDemandRender(builder, controlType, controlId, entryId, () => parentContainer.isConnected, availableTreeViewWidth(placeholder));
                    }
                });
            };
            var observer = new IntersectionObserver(onIntersection, {
                root: null,
                threshold: 0.01, // percentage of visible area
            });
            observer.observe(placeholder);
        }
    };
    // If no first tile yet, delay sending the render request.
    RenderManager.appendAfterVisualsReady(setupOnDemandRenderer);
}
JSDialog.OnDemandRenderer = onDemandRenderer;
JSDialog.RequestOnDemandRender = requestOnDemandRender;
JSDialog.OnDemandRenderAnswered = onDemandRenderAnswered;
