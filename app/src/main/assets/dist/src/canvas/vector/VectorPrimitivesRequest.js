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
var cool;
(function (cool) {
    /// The message that asks for the vector primitives of a part.
    function vectorPrimitivesRequest(request) {
        let message = 'commandvalues command=.uno:VectorPrimitives?partid=' +
            request.partId +
            '&mode=' +
            String(request.mode);
        if (request.requestId !== undefined)
            message += '&requestid=' + String(request.requestId);
        if (request.blocks && request.blocks.length)
            message += '&blocks=' + request.blocks.join(',');
        if (request.epoch !== undefined) {
            if (request.since !== undefined)
                message += '&since=' + String(request.since);
            message += '&epoch=' + String(request.epoch);
        }
        return message;
    }
    cool.vectorPrimitivesRequest = vectorPrimitivesRequest;
})(cool || (cool = {}));
