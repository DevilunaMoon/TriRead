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
 * The inline elements of the paragraphs in an accessibility message: the paragraph at the caret,
 * and the paragraphs before and after it.
 */
var cool;
(function (cool) {
    function inlineElements(message) {
        return {
            paragraph: {
                links: message.links,
                formats: message.formats,
                images: message.images,
                comments: message.comments,
                contentControls: message.contentControls,
            },
            before: {
                links: message.beforeLinks,
                formats: message.beforeFormats,
                images: message.beforeImages,
                comments: message.beforeComments,
                contentControls: message.beforeContentControls,
            },
            after: {
                links: message.afterLinks,
                formats: message.afterFormats,
                images: message.afterImages,
                comments: message.afterComments,
                contentControls: message.afterContentControls,
            },
        };
    }
    cool.inlineElements = inlineElements;
})(cool || (cool = {}));
