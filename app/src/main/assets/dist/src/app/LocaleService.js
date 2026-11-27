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
 * This file holds locale dependent options.
 */
class LocaleService {
    constructor() {
        this._globalDecimal = '.';
        this._globalMinusSign = '-';
        this._initialized = false;
    }
    initializeNumberFormatting() {
        if (this._initialized)
            return;
        this._initialized = true;
        if (typeof Intl !== 'undefined') {
            try {
                let formatter;
                if (app.UI.language.fromURL && app.UI.language.fromURL !== '')
                    formatter = new Intl.NumberFormat(app.UI.language.fromURL);
                else
                    formatter = new Intl.NumberFormat(window.L.Browser.lang);
                formatter.formatToParts(-11.1).map((item) => {
                    switch (item.type) {
                        case 'decimal':
                            this._globalDecimal = item.value;
                            break;
                        case 'minusSign':
                            this._globalMinusSign = item.value;
                            break;
                    }
                });
            }
            catch (e) {
                window.app.console.log('Exception parsing lang ' + e);
            }
        }
    }
    getDecimalSeparator() {
        return this._globalDecimal;
    }
    getMinusSign() {
        return this._globalMinusSign;
    }
}
