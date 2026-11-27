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
// window.L.DomUtil contains various utility functions for working with
// DOM.
class DomUtil {
    static get(id, doc = window.document) {
        return typeof id === 'string' ? doc.getElementById(id) : id;
    }
    static getStyle(el, style, doc = window.document) {
        let value = el.style.getPropertyValue(style) ||
            (el.currentStyle && el.currentStyle[style]);
        if ((!value || value === 'auto') && doc.defaultView) {
            const css = doc.defaultView.getComputedStyle(el, null);
            value = css ? css.getPropertyValue(style) : null;
        }
        return value === 'auto' ? null : value;
    }
    static setStyle(el, style, value) {
        if (el !== undefined)
            el.style.setProperty(style, value);
    }
    // Reading a geometry property makes the browser apply the pending style changes before it
    // answers, so a transition started after this call animates from the values set before it.
    static forceLayoutFlush(element) {
        return element.offsetHeight;
    }
    static { this.durationCache = null; }
    static getDurationMs(token) {
        if (!DomUtil.durationCache) {
            const durationCache = new Map();
            window
                .matchMedia?.('(prefers-reduced-motion: reduce)')
                ?.addEventListener('change', () => durationCache.clear());
            DomUtil.durationCache = durationCache;
        }
        const cached = DomUtil.durationCache.get(token);
        if (cached !== undefined)
            return cached;
        const value = getComputedStyle(document.documentElement)
            .getPropertyValue(token)
            .trim();
        const duration = parseFloat(value);
        if (isNaN(duration))
            return 0;
        const durationMs = value.endsWith('ms') ? duration : duration * 1000;
        DomUtil.durationCache.set(token, durationMs);
        return durationMs;
    }
    static create(tagName, className, container, data, doc = window.document) {
        const el = doc.createElement(tagName);
        el.className = className;
        if (container) {
            container.appendChild(el);
        }
        return el;
    }
    static createWithId(tagName, id, container, data, doc = window.document) {
        const el = doc.createElement(tagName);
        el.id = id;
        if (container) {
            container.appendChild(el);
        }
        return el;
    }
    static remove(el) {
        if (!el) {
            return;
        }
        const parent = el.parentNode;
        if (parent) {
            parent.removeChild(el);
        }
    }
    static empty(el) {
        while (el.firstChild) {
            el.removeChild(el.firstChild);
        }
    }
    static getClass(el) {
        const baseVal = el.className.baseVal;
        return baseVal === undefined ? el.className : baseVal;
    }
    static hasClass(el, name) {
        if (el.classList !== undefined) {
            return el.classList.contains(name);
        }
        const className = DomUtil.getClass(el);
        return (className.length > 0 &&
            new RegExp('(^|\\s)' + name + '(\\s|$)').test(className));
    }
    static setClass(el, name) {
        if (el.className.baseVal === undefined) {
            el.className = name;
        }
        else {
            // in case of SVG element
            el.className.baseVal = name;
        }
    }
    static addClass(el, name) {
        if (!el) {
            return;
        }
        if (el.classList !== undefined) {
            const classes = app.util.splitWords(name);
            for (let i = 0, len = classes.length; i < len; i++) {
                el.classList.add(classes[i]);
            }
        }
        else if (!DomUtil.hasClass(el, name)) {
            const className = DomUtil.getClass(el);
            DomUtil.setClass(el, (className ? className + ' ' : '') + name);
        }
    }
    static removeClass(el, name) {
        if (!el) {
            return;
        }
        if (el.classList !== undefined) {
            el.classList.remove(name);
        }
        else {
            DomUtil.setClass(el, app.util.trim((' ' + DomUtil.getClass(el) + ' ').replace(' ' + name + ' ', ' ')));
        }
    }
    static removeChildNodes(el) {
        while (el.hasChildNodes()) {
            Util.ensureValue(el.lastChild);
            el.removeChild(el.lastChild);
        }
    }
    static setOpacity(el, value) {
        if ('opacity' in el.style) {
            el.style.opacity = String(value);
        }
        else if ('filter' in el.style) {
            DomUtil._setOpacityIE(el, +value);
        }
    }
    static _setOpacityIE(el, value) {
        let filter = undefined;
        const filterName = 'DXImageTransform.Microsoft.Alpha';
        // filters collection throws an error if we try to retrieve a filter that doesn't exist
        try {
            filter = el.filters.item(filterName);
        }
        catch (e) {
            // don't set opacity to 1 if we haven't already set an opacity,
            // it isn't needed and breaks transparent pngs.
            if (value === 1) {
                return;
            }
        }
        value = Math.round(value * 100);
        if (filter) {
            filter.Enabled = value !== 100;
            filter.Opacity = value;
        }
        else {
            el.style.filter += ' progid:' + filterName + '(opacity=' + value + ')';
        }
    }
    // needed for initializing some static data members and functions.
    static testProp(props) {
        const style = document.documentElement.style;
        for (let i = 0; i < props.length; i++) {
            if (props[i] in style) {
                return props[i];
            }
        }
        return undefined;
    }
    static setTransform(el, offset, scale) {
        const pos = offset || new cool.Point(0, 0);
        Util.ensureValue(DomUtil.TRANSFORM);
        el.style.setProperty(DomUtil.TRANSFORM, 'translate3d(' +
            pos.x +
            'px,' +
            pos.y +
            'px' +
            ',0)' +
            (scale ? ' scale(' + scale + ')' : ''));
    }
    static setPosition(el, point, no3d = false) {
        el._leaflet_pos = point;
        Util.ensureValue(window.L);
        if (window.L.Browser.any3d && !no3d) {
            DomUtil.setTransform(el, point);
        }
        else {
            el.style.left = point.x + 'px';
            el.style.top = point.y + 'px';
        }
    }
    static getPosition(el) {
        // this method is only used for elements previously positioned using setPosition,
        // so it's safe to cache the position for performance
        return el._leaflet_pos;
    }
    static isPortrait() {
        return (window.matchMedia && window.matchMedia('(orientation: portrait)').matches);
    }
    // Add/remove a portrait or landscape class from the list of elements.
    static updateElementsOrientation(elements) {
        let remove = 'portrait';
        let add = 'landscape';
        if (DomUtil.isPortrait()) {
            remove = 'landscape';
            add = 'portrait';
        }
        for (let i = 0; i < elements.length; ++i) {
            const element = elements[i];
            const domElement = DomUtil.get(element);
            if (domElement) {
                DomUtil.removeClass(domElement, remove);
                DomUtil.addClass(domElement, add);
            }
            else {
                app.console.warn('updateElementsOrientation(): Cannot find element with id = ' +
                    element);
            }
        }
    }
    // prefix style property names
    static { this.TRANSFORM = DomUtil.testProp([
        'transform',
        'WebkitTransform',
        'OTransform',
        'MozTransform',
        'msTransform',
    ]); }
    static { this.TRANSFORM_ORIGIN = DomUtil.testProp([
        'transformOrigin',
        'msTransformOrigin',
        'WebkitTransformOrigin',
    ]); }
    static getTransitionEnd() {
        // webkitTransition comes first because some browser versions that drop vendor prefix don't do
        // the same for the transitionend event, in particular the Android 4.1 stock browser
        const transition = DomUtil.testProp([
            'webkitTransition',
            'transition',
            'OTransition',
            'MozTransition',
            'msTransition',
        ]);
        return transition === 'webkitTransition' || transition === 'OTransition'
            ? transition + 'End'
            : 'transitionend';
    }
    static { this.TRANSITION_END = DomUtil.getTransitionEnd(); }
    static { this.userSelectProperty = DomUtil.testProp([
        'userSelect',
        'WebkitUserSelect',
        'OUserSelect',
        'MozUserSelect',
        'msUserSelect',
    ]); }
    static { this._userSelect = undefined; }
    static getDisbleTextSelection() {
        if ('onselectstart' in document) {
            return () => {
                window.L.DomEvent.on(window, 'selectstart', window.L.DomEvent.preventDefault);
            };
        }
        return () => {
            if (DomUtil.userSelectProperty) {
                const style = document.documentElement.style;
                DomUtil._userSelect = style.getPropertyValue(DomUtil.userSelectProperty);
                style.setProperty(DomUtil.userSelectProperty, 'none');
            }
        };
    }
    static { this.disableTextSelection = DomUtil.getDisbleTextSelection(); }
    static getEnableTextSelection() {
        if ('onselectstart' in document) {
            return () => {
                window.L.DomEvent.off(window, 'selectstart', window.L.DomEvent.preventDefault);
            };
        }
        return () => {
            if (DomUtil.userSelectProperty) {
                document.documentElement.style.setProperty(DomUtil.userSelectProperty, DomUtil._userSelect);
                this._userSelect = undefined;
            }
        };
    }
    static { this.enableTextSelection = DomUtil.getEnableTextSelection(); }
    static disableImageDrag() {
        window.L.DomEvent.on(window, 'dragstart', window.L.DomEvent.preventDefault);
    }
    static enableImageDrag() {
        window.L.DomEvent.off(window, 'dragstart', window.L.DomEvent.preventDefault);
    }
    static { this._outlineStyle = 'none'; }
    static preventOutline(element) {
        DomUtil.restoreOutline();
        DomUtil._outlineElement = element;
        DomUtil._outlineStyle = element.style.outline;
        element.style.outline = 'none';
        window.L.DomEvent.on(window, 'keydown', DomUtil.restoreOutline);
    }
    static restoreOutline() {
        if (!DomUtil._outlineElement) {
            return;
        }
        DomUtil._outlineElement.style.outline = DomUtil._outlineStyle;
        DomUtil._outlineElement = undefined;
        DomUtil._outlineStyle = 'none';
        window.L.DomEvent.off(window, 'keydown', DomUtil.restoreOutline);
    }
}
window.L.DomUtil = DomUtil;
