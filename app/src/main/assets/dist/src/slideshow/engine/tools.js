// @ts-strict-ignore
/* -*- tab-width: 4 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
function assert(object, message) {
    if (!object) {
        window.app.console.trace();
        throw new Error(message);
    }
}
function getCurrentSystemTime() {
    return performance.now();
}
// Remove any whitespace inside a string
function removeWhiteSpaces(str) {
    if (!str)
        return '';
    const re = / */;
    const aSplitString = str.split(re);
    return aSplitString.join('');
}
function clampN(nValue, nMinimum, nMaximum) {
    return Math.min(Math.max(nValue, nMinimum), nMaximum);
}
function hasValue(x) {
    if (x === undefined || x === null)
        return false;
    if (typeof x === 'number' && Number.isNaN(x))
        return false;
    return true;
}
function booleanParser(sValue) {
    sValue = sValue.toLowerCase();
    return sValue === 'true';
}
function colorParser(sValue) {
    function hsl(nHue, nSaturation, nLuminance) {
        return new HSLColor(nHue, nSaturation / 100, nLuminance / 100);
    }
    function rgb(nRed, nGreen, nBlue) {
        return new RGBColor(nRed / 255, nGreen / 255, nBlue / 255);
    }
    function prgb(nRed, nGreen, nBlue) {
        return new RGBColor(nRed / 100, nGreen / 100, nBlue / 100);
    }
    const sCommaPattern = ' *[,] *';
    const sNumberPattern = '([+-]?[0-9]+[.]?[0-9]*)';
    const sHexDigitPattern = '[0-9A-Fa-f]';
    const sHexColorPattern = '#(' +
        sHexDigitPattern +
        '{2})(' +
        sHexDigitPattern +
        '{2})(' +
        sHexDigitPattern +
        '{2})';
    const sRGBIntegerPattern = 'rgb[(] *' +
        sNumberPattern +
        sCommaPattern +
        sNumberPattern +
        sCommaPattern +
        sNumberPattern +
        ' *[)]';
    const sRGBPercentPattern = 'rgb[(] *' +
        sNumberPattern +
        '%' +
        sCommaPattern +
        sNumberPattern +
        '%' +
        sCommaPattern +
        sNumberPattern +
        '%' +
        ' *[)]';
    const sHSLPercentPattern = 'hsl[(] *' +
        sNumberPattern +
        sCommaPattern +
        sNumberPattern +
        '%' +
        sCommaPattern +
        sNumberPattern +
        '%' +
        ' *[)]';
    const reHexColor = new RegExp(sHexColorPattern);
    const reRGBInteger = new RegExp(sRGBIntegerPattern);
    const reRGBPercent = new RegExp(sRGBPercentPattern);
    const reHSLPercent = new RegExp(sHSLPercentPattern);
    if (reHexColor.test(sValue)) {
        const aRGBTriple = reHexColor.exec(sValue);
        const nRed = parseInt(aRGBTriple[1], 16) / 255;
        const nGreen = parseInt(aRGBTriple[2], 16) / 255;
        const nBlue = parseInt(aRGBTriple[3], 16) / 255;
        return new RGBColor(nRed, nGreen, nBlue);
    }
    else if (reHSLPercent.test(sValue)) {
        const m = reHSLPercent.exec(sValue);
        return hsl(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
    }
    else if (reRGBInteger.test(sValue)) {
        const m = reRGBInteger.exec(sValue);
        return rgb(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
    }
    else if (reRGBPercent.test(sValue)) {
        const m = reRGBPercent.exec(sValue);
        return prgb(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
    }
    else {
        return null;
    }
}
class RGBColor {
    constructor(nRed, nGreen, nBlue) {
        this.eColorSpace = ColorSpace.rgb;
        // values in the [0,1] range
        this.nRed = nRed;
        this.nGreen = nGreen;
        this.nBlue = nBlue;
    }
    clone() {
        return new RGBColor(this.nRed, this.nGreen, this.nBlue);
    }
    equal(aRGBColor) {
        return (this.nRed == aRGBColor.nRed &&
            this.nGreen == aRGBColor.nGreen &&
            this.nBlue == aRGBColor.nBlue);
    }
    add(aRGBColor) {
        this.nRed += aRGBColor.nRed;
        this.nGreen += aRGBColor.nGreen;
        this.nBlue += aRGBColor.nBlue;
        return this;
    }
    scale(aT) {
        this.nRed *= aT;
        this.nGreen *= aT;
        this.nBlue *= aT;
        return this;
    }
    static clamp(aRGBColor) {
        const aClampedRGBColor = new RGBColor(0, 0, 0);
        aClampedRGBColor.nRed = clampN(aRGBColor.nRed, 0.0, 1.0);
        aClampedRGBColor.nGreen = clampN(aRGBColor.nGreen, 0.0, 1.0);
        aClampedRGBColor.nBlue = clampN(aRGBColor.nBlue, 0.0, 1.0);
        return aClampedRGBColor;
    }
    convertToHSL() {
        const nRed = clampN(this.nRed, 0.0, 1.0);
        const nGreen = clampN(this.nGreen, 0.0, 1.0);
        const nBlue = clampN(this.nBlue, 0.0, 1.0);
        const nMax = Math.max(nRed, nGreen, nBlue);
        const nMin = Math.min(nRed, nGreen, nBlue);
        const nDelta = nMax - nMin;
        const nLuminance = (nMax + nMin) / 2.0;
        let nSaturation = 0.0;
        let nHue = 0.0;
        if (nDelta !== 0) {
            nSaturation =
                nLuminance > 0.5
                    ? nDelta / (2.0 - nMax - nMin)
                    : nDelta / (nMax + nMin);
            if (nRed == nMax)
                nHue = (nGreen - nBlue) / nDelta;
            else if (nGreen == nMax)
                nHue = 2.0 + (nBlue - nRed) / nDelta;
            else if (nBlue == nMax)
                nHue = 4.0 + (nRed - nGreen) / nDelta;
            nHue *= 60.0;
            if (nHue < 0.0)
                nHue += 360.0;
        }
        return new HSLColor(nHue, nSaturation, nLuminance);
    }
    toFloat32Array() {
        const aRGBColor = RGBColor.clamp(this);
        return new Float32Array([
            aRGBColor.nRed,
            aRGBColor.nGreen,
            aRGBColor.nBlue,
            1.0,
        ]);
    }
    toString(bClamped = false) {
        const aRGBColor = bClamped ? RGBColor.clamp(this) : this;
        const nRed = Math.round(aRGBColor.nRed * 255);
        const nGreen = Math.round(aRGBColor.nGreen * 255);
        const nBlue = Math.round(aRGBColor.nBlue * 255);
        return 'rgb(' + nRed + ',' + nGreen + ',' + nBlue + ')';
    }
    static interpolate(aStartRGB, aEndRGB, nT) {
        const aResult = aStartRGB.clone();
        const aTEndRGB = aEndRGB.clone();
        aResult.scale(1.0 - nT);
        aTEndRGB.scale(nT);
        aResult.add(aTEndRGB);
        return aResult;
    }
}
class HSLColor {
    constructor(nHue, nSaturation, nLuminance) {
        this.eColorSpace = ColorSpace.hsl;
        // Hue is in the [0,360[ range, Saturation and Luminance are in the [0,1] range
        this.nHue = nHue;
        this.nSaturation = nSaturation;
        this.nLuminance = nLuminance;
        this.normalizeHue();
    }
    clone() {
        return new HSLColor(this.nHue, this.nSaturation, this.nLuminance);
    }
    equal(aHSLColor) {
        return (this.nHue == aHSLColor.nHue &&
            this.nSaturation == aHSLColor.nSaturation &&
            this.nLuminance == aHSLColor.nLuminance);
    }
    add(aHSLColor) {
        this.nHue += aHSLColor.nHue;
        this.nSaturation += aHSLColor.nSaturation;
        this.nLuminance += aHSLColor.nLuminance;
        this.normalizeHue();
        return this;
    }
    scale(aT) {
        this.nHue *= aT;
        this.nSaturation *= aT;
        this.nLuminance *= aT;
        this.normalizeHue();
        return this;
    }
    static clamp(aHSLColor) {
        const aClampedHSLColor = new HSLColor(0, 0, 0);
        aClampedHSLColor.nHue = aHSLColor.nHue % 360;
        if (aClampedHSLColor.nHue < 0)
            aClampedHSLColor.nHue += 360;
        aClampedHSLColor.nSaturation = clampN(aHSLColor.nSaturation, 0.0, 1.0);
        aClampedHSLColor.nLuminance = clampN(aHSLColor.nLuminance, 0.0, 1.0);
        return aClampedHSLColor;
    }
    normalizeHue() {
        this.nHue = this.nHue % 360;
        if (this.nHue < 0)
            this.nHue += 360;
    }
    toString() {
        return ('hsl(' +
            this.nHue.toFixed(3) +
            ',' +
            this.nSaturation.toFixed(3) +
            ',' +
            this.nLuminance.toFixed(3) +
            ')');
    }
    convertToRGB() {
        let nHue = this.nHue % 360;
        if (nHue < 0)
            nHue += 360;
        const nSaturation = clampN(this.nSaturation, 0.0, 1.0);
        const nLuminance = clampN(this.nLuminance, 0.0, 1.0);
        if (nSaturation === 0) {
            return new RGBColor(nLuminance, nLuminance, nLuminance);
        }
        const nVal1 = nLuminance <= 0.5
            ? nLuminance * (1.0 + nSaturation)
            : nLuminance + nSaturation - nLuminance * nSaturation;
        const nVal2 = 2.0 * nLuminance - nVal1;
        const nRed = HSLColor.hsl2rgbHelper(nVal2, nVal1, nHue + 120);
        const nGreen = HSLColor.hsl2rgbHelper(nVal2, nVal1, nHue);
        const nBlue = HSLColor.hsl2rgbHelper(nVal2, nVal1, nHue - 120);
        return new RGBColor(nRed, nGreen, nBlue);
    }
    static hsl2rgbHelper(nValue1, nValue2, nHue) {
        nHue = nHue % 360;
        if (nHue < 0)
            nHue += 360;
        if (nHue < 60.0)
            return nValue1 + ((nValue2 - nValue1) * nHue) / 60.0;
        else if (nHue < 180.0)
            return nValue2;
        else if (nHue < 240.0)
            return nValue1 + ((nValue2 - nValue1) * (240.0 - nHue)) / 60.0;
        else
            return nValue1;
    }
    static interpolate(aFrom, aTo, nT, bCCW) {
        const nS = 1.0 - nT;
        let nHue = 0.0;
        if (aFrom.nHue <= aTo.nHue && !bCCW) {
            // interpolate hue clockwise. That is, hue starts at
            // high values and ends at low ones. Therefore, we
            // must 'cross' the 360 degrees and start at low
            // values again (imagine the hues to lie on the
            // circle, where values above 360 degrees are mapped
            // back to [0,360)).
            nHue = nS * (aFrom.nHue + 360.0) + nT * aTo.nHue;
        }
        else if (aFrom.nHue > aTo.nHue && bCCW) {
            // interpolate hue counter-clockwise. That is, hue
            // starts at high values and ends at low
            // ones. Therefore, we must 'cross' the 360 degrees
            // and start at low values again (imagine the hues to
            // lie on the circle, where values above 360 degrees
            // are mapped back to [0,360)).
            nHue = nS * aFrom.nHue + nT * (aTo.nHue + 360.0);
        }
        else {
            // interpolate hue counter-clockwise. That is, hue
            // starts at low values and ends at high ones (imagine
            // the hue value as degrees on a circle, with
            // increasing values going counter-clockwise)
            nHue = nS * aFrom.nHue + nT * aTo.nHue;
        }
        const nSaturation = nS * aFrom.nSaturation + nT * aTo.nSaturation;
        const nLuminance = nS * aFrom.nLuminance + nT * aTo.nLuminance;
        return new HSLColor(nHue, nSaturation, nLuminance);
    }
}
// makeScaler is used in aPropertyGetterSetterMap:
// eslint-disable-next-line no-unused-vars
function makeScaler(nScale) {
    if (typeof nScale !== typeof 0 || !isFinite(nScale)) {
        window.app.console.log('makeScaler: not valid param passed: ' + nScale);
        return null;
    }
    return function (nValue) {
        return nScale * nValue;
    };
}
function getRectCenter(rect) {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    return { x: cx, y: cy };
}
function convert(convFactor, rect) {
    const x1 = Math.floor(rect.x * convFactor.x);
    const y1 = Math.floor(rect.y * convFactor.y);
    const x2 = Math.ceil((rect.x + rect.width) * convFactor.x);
    const y2 = Math.ceil((rect.y + rect.height) * convFactor.y);
    return new DOMRect(x1, y1, x2 - x1 + 1, y2 - y1 + 1);
}
class PriorityQueue {
    constructor(aCompareFunc) {
        this.aSequence = [];
        this.aCompareFunc = aCompareFunc;
    }
    clone() {
        const aCopy = new PriorityQueue(this.aCompareFunc);
        const src = this.aSequence;
        const dest = [];
        for (let i = 0, l = src.length; i < l; ++i) {
            if (i in src) {
                dest.push(src[i]);
            }
        }
        aCopy.aSequence = dest;
        return aCopy;
    }
    top() {
        return this.aSequence[this.aSequence.length - 1];
    }
    isEmpty() {
        return this.aSequence.length === 0;
    }
    push(aValue) {
        this.aSequence.unshift(aValue);
        this.aSequence.sort(this.aCompareFunc);
    }
    clear() {
        this.aSequence = [];
    }
    pop() {
        return this.aSequence.pop();
    }
}
var GlHelpers;
(function (GlHelpers) {
    GlHelpers.nearestPointOnSegment = `
		float nearestPointOnSegment(vec4 CF, vec4 CT, vec4 C) {

			// Compute the vector along the segment (CT - CF)
			vec4 segment = CT - CF;

			// Compute the vector from the endpoint CF to the point C
			vec4 toC = C - CF;

			float length2 = dot(segment, segment);

			// Project C onto the segment, finding the scalar 't'
			float t = dot(toC, segment) / length2;

			// Clamp 't' to [0, 1] range to ensure the nearest point lies on the segment
			t = clamp(t, 0.0, 1.0);
			return t;
		}
`;
    GlHelpers.computeColor = `
		vec4 computeColor(vec4 color) {
			if (fromLineColor != toLineColor || fromFillColor != toFillColor) {
				vec4 colorSegment = fromFillColor - fromLineColor;
				float length2 = dot(colorSegment, colorSegment);
				if (length2 < 1e-6) {
				 	return toFillColor;
				}
				else {
					float t = nearestPointOnSegment(fromLineColor, fromFillColor, color);
					vec4 fromColor = fromLineColor + t * colorSegment;
					vec4 toColor = toLineColor + t * (toFillColor - toLineColor);
					return mix(color, toColor, float(distance(color, fromColor) < 0.01));
				}
			}
			return color;
		}
`;
})(GlHelpers || (GlHelpers = {}));
/** class PriorityEntry
 *  It provides an entry type for priority queues.
 *  Higher is the value of nPriority higher is the priority of the created entry.
 *
 *  @param aValue
 *      The object to be prioritized.
 *  @param nPriority
 *      An integral number representing the object priority.*
 */
class PriorityEntry {
    constructor(aValue, nPriority) {
        this.aValue = aValue;
        this.nPriority = nPriority;
    }
    /** PriorityEntry.compare
     *  Compare priority of two entries.
     *
     *  @param aLhsEntry
     *      An instance of type PriorityEntry.
     *  @param aRhsEntry
     *      An instance of type PriorityEntry.
     *  @return Integer
     *      -1 if the left entry has lower priority of the right entry,
     *       1 if the left entry has higher priority of the right entry,
     *       0 if the two entry have the same priority
     */
    static compare(aLhsEntry, aRhsEntry) {
        if (aLhsEntry.nPriority < aRhsEntry.nPriority) {
            return -1;
        }
        else if (aLhsEntry.nPriority > aRhsEntry.nPriority) {
            return 1;
        }
        else {
            return 0;
        }
    }
}
class DebugPrinter {
    constructor() {
        this.bEnabled = false;
    }
    on() {
        this.bEnabled = true;
    }
    off() {
        this.bEnabled = false;
    }
    isEnabled() {
        return this.bEnabled;
    }
    print(sMessage, nTime) {
        if (this.isEnabled()) {
            let sInfo = 'DBG: ' + sMessage;
            if (nTime)
                sInfo += ' (at: ' + String(nTime / 1000) + 's)';
            window.app.console.log(sInfo);
        }
    }
}
const aGenericDebugPrinter = new DebugPrinter();
aGenericDebugPrinter.on();
const NAVDBG = new DebugPrinter();
NAVDBG.on();
const ANIMDBG = new DebugPrinter();
ANIMDBG.on();
const aRegisterEventDebugPrinter = new DebugPrinter();
aRegisterEventDebugPrinter.on();
const aTimerEventQueueDebugPrinter = new DebugPrinter();
aTimerEventQueueDebugPrinter.on();
const aEventMultiplexerDebugPrinter = new DebugPrinter();
aEventMultiplexerDebugPrinter.on();
const aNextEffectEventArrayDebugPrinter = new DebugPrinter();
aNextEffectEventArrayDebugPrinter.on();
const aActivityQueueDebugPrinter = new DebugPrinter();
aActivityQueueDebugPrinter.on();
const aAnimatedElementDebugPrinter = new DebugPrinter();
aAnimatedElementDebugPrinter.on();
