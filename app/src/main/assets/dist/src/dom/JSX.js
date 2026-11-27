// @ts-strict-ignore -*- Mode: JavaScript; js-indent-level: 8; fill-column: 100 -*-
const JSX_SVG_NS = 'http://www.w3.org/2000/svg';
const JSX_SVG_TAGS = new Set([
    'svg',
    'path',
    'g',
    'circle',
    'rect',
    'line',
    'polyline',
    'polygon',
    'ellipse',
    'text',
    'tspan',
    'defs',
    'use',
    'symbol',
    'mask',
    'clipPath',
    'linearGradient',
    'radialGradient',
    'stop',
    'pattern',
    'filter',
    'foreignObject',
    'animate',
    'animateMotion',
    'animateTransform',
    'mpath',
    'set',
]);
function jsxAppendChildren(parent, children) {
    for (const c of children) {
        if (c == null || c === false || c === true)
            continue;
        if (Array.isArray(c))
            jsxAppendChildren(parent, c);
        else if (c instanceof Node)
            parent.appendChild(c);
        else
            parent.appendChild(document.createTextNode(String(c)));
    }
}
function jsxApplyProps(el, props) {
    if (!props)
        return;
    for (const key in props) {
        const value = props[key];
        if (value == null || value === false)
            continue;
        if (key === 'children')
            continue;
        if (key === 'class' || key === 'className') {
            el.setAttribute('class', String(value));
        }
        else if (key === 'style' && typeof value === 'object') {
            Object.assign(el.style, value);
        }
        else if (key === 'ref' && typeof value === 'function') {
            value(el);
        }
        else if (key === 'dangerouslySetInnerHTML') {
            // eslint-disable-next-line no-restricted-syntax -- the explicit raw markup property
            el.innerHTML = value.__html;
        }
        else if (key.length > 2 &&
            key[0] === 'o' &&
            key[1] === 'n' &&
            typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        }
        else if (value === true) {
            el.setAttribute(key, '');
        }
        else {
            el.setAttribute(key, String(value));
        }
    }
}
function h(tag, props, ...children) {
    if (typeof tag === 'function') {
        return tag({ ...(props || {}), children });
    }
    const el = JSX_SVG_TAGS.has(tag)
        ? document.createElementNS(JSX_SVG_NS, tag)
        : document.createElement(tag);
    jsxApplyProps(el, props);
    jsxAppendChildren(el, children);
    return el;
}
function Fragment(props) {
    const frag = document.createDocumentFragment();
    jsxAppendChildren(frag, props.children || []);
    return frag;
}
