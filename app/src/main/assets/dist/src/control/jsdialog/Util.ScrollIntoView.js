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
JSDialog.ScrollIntoViewBlockOption = function (option) {
    if (option === 'nearest' || option === 'center') {
        // compatibility with older firefox
        const match = window.navigator.userAgent.match(/Firefox\/([0-9]+)\./);
        const firefoxVer = match ? parseInt(match[1]) : 58;
        const blockOption = firefoxVer >= 58 ? option : 'start';
        return blockOption;
    }
    return option;
};
