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
class Util {
    static { this.lastId = 0; }
    static nextId() {
        return ++Util.lastId;
    }
    /// Returns the id of the object. Initializes it if necessary.
    static stamp(obj) {
        if (obj._leaflet_id > 0) {
            return obj._leaflet_id;
        }
        obj._leaflet_id = Util.nextId();
        return obj._leaflet_id;
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static merge(one, two) {
        return { ...one, ...two };
    }
    // return a function that won't be called more often than the given interval
    static throttle(fn, time, 
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    context) {
        let lock = false;
        // eslint-disable-next-line prefer-const
        let wrapperFn;
        let args = false;
        const later = function () {
            // reset lock and call if queued.
            lock = false;
            if (args) {
                wrapperFn.apply(context, args);
                args = false;
            }
        };
        wrapperFn = function (...args_) {
            if (lock) {
                // called too soon, queue to call later
                args = args_;
            }
            else {
                // call and lock until later
                fn.apply(context, args_);
                setTimeout(later, time);
                lock = true;
            }
        };
        return wrapperFn;
    }
    // wrap the given number to lie within a certain range (used for wrapping longitude)
    static wrapNum(x, range, includeMax) {
        const max = range[1];
        const min = range[0];
        const d = max - min;
        return x === max && includeMax ? x : ((((x - min) % d) + d) % d) + min;
    }
    // do nothing (used as a noop throughout the code)
    static falseFn() {
        return false;
    }
    // round a given number to a given precision
    static formatNum(num, digits) {
        var pow = Math.pow(10, digits || 5);
        return Math.round(num * pow) / pow;
    }
    // removes prefix from string if string starts with that prefix
    static trimStart(str, prefix) {
        if (str.indexOf(prefix) === 0)
            return str.substring(prefix.length);
        return str;
    }
    // removes suffix from string if string ends with that suffix
    static trimEnd(str, suffix) {
        var suffixIndex = str.lastIndexOf(suffix);
        if (suffixIndex !== -1 && str.length - suffix.length === suffixIndex)
            return str.substring(0, suffixIndex);
        return str;
    }
    // removes given prefix and suffix from the string if exists
    // if suffix is not specified, prefix is trimmed from both end of string
    // trim whitespace from both sides of a string if prefix and suffix are not given
    static trim(str, prefix, suffix) {
        if (!prefix)
            return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
        let result = Util.trimStart(str, prefix);
        result = Util.trimEnd(result, suffix);
        return result;
    }
    // split a string into words
    static splitWords(str) {
        return Util.trim(str).split(/\s+/);
    }
    static round(x, e) {
        if (!e) {
            return Math.round(x);
        }
        var f = 1.0 / e;
        return Math.round(x * f) * e;
    }
    static { this.templateRe = /\{ *([\w_]+) *\}/g; }
    // super-simple templating facility, used for TileLayer URLs
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static template(str, data) {
        return str.replace(Util.templateRe, function (str, key) {
            let value = data[key];
            if (value === undefined) {
                throw new Error('No value provided for variable ' + str);
            }
            else if (typeof value === 'function') {
                value = value(data);
            }
            return value;
        });
    }
    static { this.isArray = Array.isArray ||
        function (obj) {
            return Object.prototype.toString.call(obj) === '[object Array]';
        }; }
    // minimal image URI, set to an image when disposing to flush memory
    static { this.emptyImageUrl = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; }
    static toggleFullScreen() {
        const doc = document;
        if (!doc.fullscreenElement &&
            !doc.mozFullscreenElement &&
            !doc.msFullscreenElement &&
            !doc.webkitFullscreenElement) {
            if (doc.documentElement.requestFullscreen) {
                doc.documentElement.requestFullscreen();
            }
            else if (doc.documentElement.msRequestFullscreen) {
                doc.documentElement.msRequestFullscreen();
            }
            else if (doc.documentElement.mozRequestFullScreen) {
                doc.documentElement.mozRequestFullScreen();
            }
            else if (doc.documentElement.webkitRequestFullscreen) {
                doc.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
            }
        }
        else if (doc.exitFullscreen) {
            doc.exitFullscreen();
        }
        else if (doc.msExitFullscreen) {
            doc.msExitFullscreen();
        }
        else if (doc.mozCancelFullScreen) {
            doc.mozCancelFullScreen();
        }
        else if (doc.webkitExitFullscreen) {
            doc.webkitExitFullscreen();
        }
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static isEmpty(o) {
        return !(o && o.length);
    }
    static mm100thToInch(mm) {
        return mm / 2540;
    }
    static { this._canvas = null; }
    static getTempCanvas() {
        if (Util._canvas) {
            return Util._canvas;
        }
        Util._canvas = document.createElement('canvas');
        return Util._canvas;
    }
    static getTextWidth(text, font) {
        const canvas = Util.getTempCanvas();
        const context = canvas.getContext('2d');
        context.font = font;
        const metrics = context.measureText(text);
        return Math.floor(metrics.width);
    }
    static getProduct() {
        let brandFAQURL = typeof brandProductFAQURL !== 'undefined'
            ? brandProductFAQURL
            : 'https://www.collaboraoffice.org/post/faq/';
        const customWindow = window;
        if (customWindow.feedbackUrl && customWindow.buyProductUrl) {
            const integratorUrl = encodeURIComponent(customWindow.buyProductUrl);
            brandFAQURL = customWindow.feedbackUrl;
            brandFAQURL =
                brandFAQURL.substring(0, brandFAQURL.lastIndexOf('/')) +
                    '/product.html?integrator=' +
                    integratorUrl;
        }
        return brandFAQURL;
    }
    /// Returns the entry of a table keyed by language whose key matches the
    /// UI language most closely, so that pt-BR takes 'pt-BR' ahead of 'pt'.
    /// A key matches when it is the whole language or its leading subtags,
    /// compared without regard to case as language tags are case-insensitive.
    static getLanguageEntry(table) {
        const locale = String.locale.toLowerCase();
        let bestKey;
        for (const key of Object.keys(table)) {
            const lowerKey = key.toLowerCase();
            const matches = locale === lowerKey || locale.startsWith(lowerKey + '-');
            if (matches && (!bestKey || key.length > bestKey.length))
                bestKey = key;
        }
        return bestKey === undefined ? undefined : table[bestKey];
    }
    static replaceCtrlAltInMac(msg) {
        if (!window.L.Browser.mac)
            return msg;
        // Find the localized modifier names for the current language
        // from the generated unoShortcutsModifierL10N table.
        let ctrlName = 'Ctrl';
        let altName = 'Alt';
        if (typeof unoShortcutsModifierL10N !== 'undefined') {
            const replacements = Util.getLanguageEntry(unoShortcutsModifierL10N);
            if (replacements) {
                if (replacements['Ctrl'])
                    ctrlName = replacements['Ctrl'];
                if (replacements['Alt'])
                    altName = replacements['Alt'];
            }
        }
        return msg
            .replace(new RegExp(ctrlName, 'gi'), '\u2318')
            .replace(new RegExp(altName, 'gi'), '\u2325');
    }
    static randomString(len) {
        let result = '';
        const ValidCharacters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        for (let i = 0; i < len; i++) {
            result += ValidCharacters.charAt(Math.floor(Math.random() * ValidCharacters.length));
        }
        return result;
    }
    static requestAnimFrame(fn, 
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    context) {
        return window.requestAnimationFrame(fn.bind(context));
    }
    static cancelAnimFrame(id) {
        if (id) {
            window.cancelAnimationFrame(id);
        }
    }
    static ensureValue(obj) {
        if (obj === undefined)
            throw new Error('Object is undefined!');
        if (obj === null)
            throw new Error('Object is null!');
    }
    // Looks up an element by id, warning instead of throwing if it's missing,
    // for the (usually document-type-dependent) elements that a caller can't
    // otherwise be sure are on the page.
    static getElementOrWarn(id) {
        const el = document.getElementById(id);
        if (!el)
            window.app.console.warn('HTML element with ID ' + id + " doesn't exist.");
        return el;
    }
    static humanizeDuration(durationMs, maxParts = 2) {
        const units = [
            {
                seconds: 365 * 24 * 3600,
                format: (n) => _n('%n year', '%n years', n),
            },
            { seconds: 24 * 3600, format: (n) => _n('%n day', '%n days', n) },
            { seconds: 3600, format: (n) => _n('%n hour', '%n hours', n) },
            {
                seconds: 60,
                format: (n) => _n('%n minute', '%n minutes', n),
            },
        ];
        let remaining = Math.max(0, Math.round(durationMs / 1000));
        const parts = [];
        for (const unit of units) {
            if (parts.length === maxParts)
                break;
            const count = Math.floor(remaining / unit.seconds);
            if (!count)
                continue;
            remaining -= count * unit.seconds;
            parts.push(unit.format(count));
        }
        if (!parts.length) {
            parts.push(_('less than a minute'));
        }
        return parts.join(' ');
    }
    static { this.MAX_SAFE_INTEGER = Math.pow(2, 53) - 1; }
    static { this.MIN_SAFE_INTEGER = -Util.MAX_SAFE_INTEGER; }
}
app.util = Util;
