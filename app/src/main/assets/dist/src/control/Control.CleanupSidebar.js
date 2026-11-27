/* -*- Mode: JavaScript; js-indent-level: 8; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/* global app JSDialog _ _n */
/// What the check that looks for images holding more detail than a slide draws says at
/// greater length: the detail an image is stored at, against the detail a slide can show. A
/// scan that leaves the images alone measures against no figure, so the line names none.
function imageCheckTooltip(options) {
    if (options.resolution <= 0)
        return _('Images stored with more detail than a slide can show');
    return _('Images stored at more than %1 DPI, more detail than a slide can show').replace('%1', String(options.resolution));
}
/// The checks the panel lists, grouped into the tools they belong to and in the order they
/// are drawn in. A new tool is a new entry here with its checks.
const CLEANUP_TOOLS = [
    {
        id: 'images',
        name: () => _('Images'),
        checks: [
            {
                category: 'image',
                slug: 'image',
                // The row that holds the values a scan is run with says which resolution
                // the images are measured against, so the name of the check does not.
                // The line the reader can rest on says it instead.
                name: () => _('High-resolution images'),
                tooltip: (options) => imageCheckTooltip(options),
            },
            {
                category: 'croppedImage',
                slug: 'cropped-image',
                name: () => _('Cropped images'),
            },
        ],
    },
    {
        id: 'slides',
        name: () => _('Slides'),
        checks: [
            {
                category: 'hiddenSlide',
                slug: 'hidden-slide',
                name: () => _('Hidden slides'),
            },
            {
                category: 'unusedMaster',
                slug: 'unused-master',
                name: () => _('Unused master slides'),
            },
        ],
    },
    {
        id: 'sharing',
        name: () => _('For sharing'),
        checks: [
            { category: 'notes', slug: 'notes', name: () => _('Speaker notes') },
            {
                category: 'embeddedObject',
                slug: 'embedded-object',
                name: () => _('Embedded objects'),
            },
        ],
    },
];
const CLEANUP_CHECKS = CLEANUP_TOOLS.reduce((all, tool) => all.concat(tool.checks), []);
/// The kinds of finding, in the order the panel lists them.
const CLEANUP_CATEGORIES = CLEANUP_CHECKS.map((check) => check.category);
/// The part of a group's widget ids that names its category.
const CLEANUP_GROUP_SLUG = CLEANUP_CHECKS.reduce((slugs, check) => {
    slugs[check.category] = check.slug;
    return slugs;
}, {});
/// The targets a scan can be asked for, in the order the list offers them. Zero leaves the
/// images as they are.
const CLEANUP_RESOLUTIONS = [0, 96, 150, 220, 300];
/// How long a run may say nothing before the panel gives it up, in milliseconds. A run that
/// is going reports far more often than this: the kit sends progress for every whole percent
/// of the work and measures in slices a few milliseconds long. One very large image can hold
/// the kit for several seconds at a time, so the wait is a generous one.
const CLEANUP_SILENCE_TIMEOUT = 30000;
/// The ids of the widgets the panel refreshes one at a time. A group is named by its
/// category and a row by its id, see groupWidgetId and rowWidgetId.
const CleanupWidgetId = {
    deck: 'cleanup-deck',
    options: 'cleanup-options',
    resolutionLabel: 'cleanup-resolution-label',
    resolution: 'cleanup-resolution',
    qualityLabel: 'cleanup-quality-label',
    quality: 'cleanup-quality',
    sharing: 'cleanup-sharing',
    run: 'cleanup-run',
    scan: 'cleanup-scan',
    status: 'cleanup-status',
    statusLine: 'cleanup-status-line',
    statusText: 'cleanup-status-text',
    progressLine: 'cleanup-progress-line',
    progressFigures: 'cleanup-progress-figures',
    progress: 'cleanup-progress',
    stop: 'cleanup-stop',
    summary: 'cleanup-summary',
    total: 'cleanup-total',
    fixAll: 'cleanup-fix-all',
    separator: 'cleanup-separator',
    message: 'cleanup-message',
    footer: 'cleanup-footer',
    optionsBody: 'cleanup-options-body',
};
const CLEANUP_TOOL_PREFIX = 'cleanup-tool-';
const CLEANUP_CHECK_PREFIX = 'cleanup-check-';
/// The flat row that stands in the place of a check while it has nothing to report.
function checkWidgetId(category) {
    return CLEANUP_CHECK_PREFIX + CLEANUP_GROUP_SLUG[category];
}
function toolWidgetId(id) {
    return CLEANUP_TOOL_PREFIX + id;
}
/// The kinds of finding a scan run with these values looks for. This is what the panel goes
/// by while the kit says nothing: a target resolution brings the two image checks, the two
/// slide checks run every time, and a scan for sharing brings the notes and the embedded
/// objects.
function scannedFromOptions(options) {
    const scanned = [];
    if (options.resolution > 0)
        scanned.push('image', 'croppedImage');
    scanned.push('hiddenSlide', 'unusedMaster');
    if (options.forPublication)
        scanned.push('notes', 'embeddedObject');
    return scanned;
}
/// What a check has to report, from how many findings it holds and whether a scan covered
/// it.
function checkStateFor(count, scanned) {
    if (count > 0)
        return 'found';
    return scanned ? 'none' : 'unchecked';
}
/// The one line the values a scan is run with say while they are folded away: what the
/// images are measured against and what they are written at.
function imageOptionsSummary(options) {
    if (options.resolution <= 0)
        return _('images left alone');
    return _('%1 DPI, quality %2 %')
        .replace('%1', String(options.resolution))
        .replace('%2', String(options.quality));
}
/// What the band over the list says the whole list comes to: the figure the list would free
/// up, and the share of the file that figure is. A file whose size is not known, and a
/// saving too small to round to a whole percent, leave the share out.
function cleanupTotalText(savingBytes, documentBytes) {
    const percent = documentBytes > 0 ? Math.round((savingBytes * 100) / documentBytes) : 0;
    if (percent <= 0)
        return _('%1 can be cleaned up').replace('%1', formatByteSize(savingBytes));
    return _('%1 (%2%) can be cleaned up')
        .replace('%1', formatByteSize(savingBytes))
        .replace('%2', String(percent));
}
/// The word on the button of a row. A cleanup takes the speaker notes off the slide they
/// are on, so that row offers to remove them. Every other row offers to fix what it names.
function fixButtonText(category) {
    return category === 'notes' ? _('Remove') : _('Fix');
}
const CLEANUP_GROUP_PREFIX = 'cleanup-group-';
const CLEANUP_ROW_PREFIX = 'cleanup-row-';
function groupWidgetId(category) {
    return CLEANUP_GROUP_PREFIX + CLEANUP_GROUP_SLUG[category];
}
function rowWidgetId(rowId) {
    return CLEANUP_ROW_PREFIX + String(rowId);
}
/// The category a group widget id names, and null for any other id.
function categoryOfGroupWidgetId(id) {
    for (const category of CLEANUP_CATEGORIES)
        if (id === groupWidgetId(category))
            return category;
    return null;
}
/// The category the flat row of a check names, and null for any other id.
function categoryOfCheckWidgetId(id) {
    for (const category of CLEANUP_CATEGORIES)
        if (id === checkWidgetId(category))
            return category;
    return null;
}
/// The row a widget id of the form cleanup-row-<id><suffix> names, and null for any other
/// id.
function rowOfWidgetId(id, suffix) {
    if (!id.startsWith(CLEANUP_ROW_PREFIX) || !id.endsWith(suffix))
        return null;
    const digits = id.slice(CLEANUP_ROW_PREFIX.length, id.length - suffix.length);
    if (!/^\d+$/.test(digits))
        return null;
    return parseInt(digits, 10);
}
/// A state with no list, the way the panel starts and the way it is left when the deck
/// closes.
function newCleanupPanelState() {
    return {
        readOnly: false,
        busy: false,
        hasList: false,
        statusName: 'idle',
        measuredDone: 0,
        measuredTotal: 0,
        savedBytes: 0,
        estimatedBytes: 0,
        rowCount: 0,
        fixableCount: 0,
        options: { resolution: 150, quality: 80, forPublication: false },
        chosenOptions: { resolution: 150, quality: 80, forPublication: false },
        rows: new Map(),
        goneRows: new Set(),
        foldedGroups: new Set(),
        documentBytes: 0,
        scanned: new Set(),
        optionsOpen: true,
        notice: '',
    };
}
/// The language the UI is shown in, as LocaleService reads it.
function uiLocale() {
    const fromURL = app.UI && app.UI.language ? app.UI.language.fromURL : '';
    return fromURL || window.L.Browser.lang;
}
/// Says how many bytes a figure stands for: whole bytes under a kilobyte, whole kilobytes
/// under a megabyte, and megabytes to one decimal place in the number format of locale.
function formatByteSize(bytes, locale = uiLocale()) {
    const oneKilobyte = 1024;
    const oneMegabyte = 1024 * 1024;
    if (bytes < oneKilobyte) {
        const wholeBytes = Math.round(bytes);
        return _n('%1 byte', '%1 bytes', wholeBytes).replace('%1', String(wholeBytes));
    }
    if (bytes < oneMegabyte) {
        const kilobytes = Math.floor((bytes + oneKilobyte / 2) / oneKilobyte);
        return _('%1 KB').replace('%1', String(kilobytes));
    }
    const tenths = Math.floor((bytes * 10 + oneMegabyte / 2) / oneMegabyte);
    const megabytes = (tenths / 10).toLocaleString(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
    return _('%1 MB').replace('%1', megabytes);
}
/// The label a screen reader hears on the Fix button of a row, naming the row it belongs
/// to.
function fixLabelFor(category, rowText) {
    if (category === 'notes')
        return _('Remove %1').replace('%1', rowText);
    return _('Fix %1').replace('%1', rowText);
}
function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
}
/// The entries a payload field holds, and an empty list when the field holds anything but a
/// list.
/// The kinds of finding a payload field names, with every entry the panel does not know
/// left out.
function asCategoryArray(value) {
    return asArray(value).filter((entry) => typeof entry === 'string' &&
        CLEANUP_CATEGORIES.indexOf(entry) !== -1);
}
function asArray(value) {
    return Array.isArray(value) ? value : [];
}
/// The numbers a payload field holds, with every entry that is not a number left out.
function asNumberArray(value) {
    return asArray(value).filter(isFiniteNumber);
}
/// True for a whole set of scan values: the two figures are numbers and the choice is a
/// boolean.
function isCleanupOptions(value) {
    if (!value || typeof value !== 'object')
        return false;
    const options = value;
    return (isFiniteNumber(options.resolution) &&
        isFiniteNumber(options.quality) &&
        typeof options.forPublication === 'boolean');
}
/// How far the measuring has come, as the panel reads it from a payload. A count that is
/// not a number counts as zero.
function asMeasuredProgress(value) {
    if (!value || typeof value !== 'object')
        return { done: 0, total: 0 };
    const measured = value;
    return {
        done: isFiniteNumber(measured.done) ? measured.done : 0,
        total: isFiniteNumber(measured.total) ? measured.total : 0,
    };
}
/// The line that names where a finding sits. An image says which slide it is on, and which
/// image of that slide it is when the slide has more than one to tell apart. A slide number
/// of -1 stands for a master slide.
function rowTextFor(row) {
    const slide = String(row.slide + 1);
    switch (row.category) {
        case 'image':
        case 'croppedImage':
            if (row.slide < 0)
                return row.imageNumber <= 0
                    ? _('Master slide')
                    : _('Master slide, image %1').replace('%1', String(row.imageNumber));
            return row.imageNumber <= 0
                ? _('Slide %1').replace('%1', slide)
                : _('Slide %1, image %2')
                    .replace('%1', slide)
                    .replace('%2', String(row.imageNumber));
        case 'hiddenSlide':
            return _('Slide %1 is hidden and can be removed').replace('%1', slide);
        case 'unusedMaster':
            return _("Master slide '%1' is not used by any slide").replace('%1', row.name);
        case 'notes':
            return _('Slide %1 has speaker notes').replace('%1', slide);
        case 'embeddedObject':
            return row.canFix
                ? _('Slide %1: embedded object').replace('%1', slide)
                : _('Slide %1: embedded object, no image to replace it with').replace('%1', slide);
    }
}
/// The line under that one, which says what the document spends on an image and what makes
/// it worth a row. A finding with nothing more to say has none.
function rowDetailFor(row) {
    const size = formatByteSize(row.currentBytes);
    if (row.category === 'image') {
        if (row.currentBytes === 0)
            return _('%1 DPI').replace('%1', String(row.dpi));
        return _('%1 at %2 DPI').replace('%1', size).replace('%2', String(row.dpi));
    }
    if (row.category === 'croppedImage') {
        if (row.currentBytes === 0)
            return _('%1% cropped away').replace('%1', String(row.hiddenPercent));
        return _('%1, %2% cropped away')
            .replace('%1', size)
            .replace('%2', String(row.hiddenPercent));
    }
    return '';
}
/// True for a whole finding the panel can draw a row from.
function isCleanupRow(value) {
    if (!value || typeof value !== 'object')
        return false;
    const row = value;
    return (isFiniteNumber(row.id) &&
        isFiniteNumber(row.slide) &&
        isFiniteNumber(row.imageNumber) &&
        isFiniteNumber(row.currentBytes) &&
        isFiniteNumber(row.saving) &&
        CLEANUP_CATEGORIES.indexOf(row.category) !== -1);
}
/// True for a patch of a row already on screen: an id, and each figure it carries of the
/// right kind. A patch names only what changed, so a field that is missing is not a fault.
function isCleanupRowPatch(value) {
    if (!value || typeof value !== 'object')
        return false;
    const patch = value;
    if (!isFiniteNumber(patch.id))
        return false;
    if (patch.imageNumber !== undefined && !isFiniteNumber(patch.imageNumber))
        return false;
    if (patch.saving !== undefined && !isFiniteNumber(patch.saving))
        return false;
    return true;
}
/// True for the actions that put the panel into its busy state: scan, fix and fixAll. goTo
/// and list are allowed while a run is going and their refusal says nothing about that run.
function refusalEndsBusyState(action) {
    return action === 'scan' || action === 'fix' || action === 'fixAll';
}
/// True for the actions the panel cannot go on without an answer to: the three that put it
/// into its busy state, and the stop that ends a run.
function actionNeedsAnswer(action) {
    return refusalEndsBusyState(action) || action === 'stop';
}
/// True while the event belongs to a list the panel is not showing. An event carrying a run
/// while the panel has none is stale as well, unless the panel has asked for a list and is
/// waiting to hear which run it now has.
function isStaleEvent(result, run, listRequested) {
    if (typeof result.run !== 'number')
        return false;
    if (run === null)
        return !listRequested;
    return result.run !== run;
}
// --- the deck as JSON ------------------------------------------------------------------
function resolutionTexts() {
    return [
        _('Leave images alone'),
        _('96 DPI'),
        _('150 DPI'),
        _('220 DPI'),
        _('300 DPI'),
    ];
}
/// The place of a target in the list of resolutions, and the place of the default when the
/// target is not one the list offers.
function resolutionIndex(resolution) {
    const index = CLEANUP_RESOLUTIONS.indexOf(resolution);
    return index === -1 ? CLEANUP_RESOLUTIONS.indexOf(150) : index;
}
function rowsOf(state, category) {
    const rows = [];
    for (const row of state.rows.values())
        if (row.category === category)
            rows.push(row);
    return rows;
}
function statusTextFor(status) {
    switch (status) {
        case 'scanning':
            return _('Scanning...');
        case 'measuring':
            return _('Measuring images...');
        case 'preparing':
            return _('Preparing cleanup...');
        case 'cleaning':
            return _('Cleaning up...');
    }
    return '';
}
function countOf(state, category) {
    return rowsOf(state, category).length;
}
/// What a check looks for, in the language of the view and with the values of the scan the
/// list stands under written into it.
function checkNameFor(category) {
    for (const check of CLEANUP_CHECKS)
        if (check.category === category)
            return check.name();
    return '';
}
/// What a check looks for at greater length, and nothing for a check whose name says
/// everything.
function checkTooltipFor(state, category) {
    for (const check of CLEANUP_CHECKS)
        if (check.category === category)
            return check.tooltip ? check.tooltip(state.options) : '';
    return '';
}
/// True while there is a list to deal with in one go.
function offersFixAllIn(state) {
    return !state.readOnly && state.fixableCount > 0;
}
/// What the band under the list says the whole list comes to, and nothing while it has no
/// figure and no count to give.
function totalTextFor(state) {
    if (state.savedBytes > 0)
        return _('Saved %1').replace('%1', formatByteSize(state.savedBytes));
    if (state.estimatedBytes > 0)
        return cleanupTotalText(state.estimatedBytes, state.documentBytes);
    if (state.fixableCount > 0)
        return _n('%1 thing to clean up', '%1 things to clean up', state.fixableCount).replace('%1', String(state.fixableCount));
    return '';
}
/// The values a scan is run with stand behind one row that names them, at the foot of the
/// panel. The row opens with the deck and folds the fields away on a press, and while it is
/// folded it says what the values come to.
function optionsJSON(state) {
    return {
        id: CleanupWidgetId.options,
        type: 'expander',
        expanded: state.optionsOpen,
        visible: !state.readOnly,
        secondaryText: imageOptionsSummary(state.chosenOptions),
        cssClass: 'cleanup-options',
        children: [
            {
                id: CleanupWidgetId.options + '-heading',
                type: 'fixedtext',
                text: _('Options'),
            },
            optionsBodyJSON(state),
        ],
    };
}
/// The three option rows: a label and its control side by side, and the choice under them.
/// The body is a region of its own, since the run turns its fields off and on again while
/// the row around them stands as it is. Each control names the label beside it, so the
/// label alone is the name a screen reader reads out for the control.
function optionsBodyJSON(state) {
    const enabled = !state.busy;
    return {
        id: CleanupWidgetId.optionsBody,
        type: 'grid',
        cols: 2,
        rows: 3,
        cssClass: 'cleanup-options-body',
        children: [
            {
                id: CleanupWidgetId.resolutionLabel,
                type: 'fixedtext',
                text: _('Image resolution'),
                labelFor: CleanupWidgetId.resolution,
                labelForType: 'listbox',
                hexpand: true,
                left: '0',
                top: '0',
            },
            {
                id: CleanupWidgetId.resolution,
                type: 'listbox',
                labelledBy: CleanupWidgetId.resolutionLabel,
                entries: resolutionTexts(),
                selectedEntries: [
                    String(resolutionIndex(state.chosenOptions.resolution)),
                ],
                enabled: enabled,
                left: '1',
                top: '0',
            },
            {
                id: CleanupWidgetId.qualityLabel,
                type: 'fixedtext',
                text: _('JPEG quality (%)'),
                labelFor: CleanupWidgetId.quality,
                labelForType: 'spinfield',
                hexpand: true,
                left: '0',
                top: '1',
            },
            {
                id: CleanupWidgetId.quality,
                type: 'spinfield',
                labelledBy: CleanupWidgetId.qualityLabel,
                // The field shows its text and reads its bounds from the
                // figures.
                text: String(state.chosenOptions.quality),
                value: state.chosenOptions.quality,
                min: 1,
                max: 100,
                step: 5,
                enabled: enabled,
                left: '1',
                top: '1',
            },
            {
                id: CleanupWidgetId.sharing,
                type: 'checkbox',
                text: _('Prepare for sharing'),
                checked: state.chosenOptions.forPublication,
                enabled: enabled,
                left: '0',
                top: '2',
                width: '2',
            },
        ],
    };
}
/// The phase the run is in. It stands in a line that is read out as it changes, so it is
/// sent on its own: a phase is announced once, when it is new.
function statusTextJSON(state) {
    return {
        id: CleanupWidgetId.statusText,
        type: 'fixedtext',
        text: statusTextFor(state.statusName),
    };
}
/// How far the run has come: a share of the whole for the eye and the two counts beside it.
/// The counts move with every step, so they stand outside the line that is read out.
function progressLineJSON(state) {
    const total = state.measuredTotal;
    const done = Math.min(state.measuredDone, total);
    const figures = total === 0
        ? ''
        : _('%1 of %2').replace('%1', String(done)).replace('%2', String(total));
    return {
        id: CleanupWidgetId.progressLine,
        type: 'container',
        cssClass: 'cleanup-progress-line',
        children: [
            {
                id: CleanupWidgetId.progress,
                type: 'progressbar',
                value: done,
                maxValue: total === 0 ? 100 : total,
                infinite: total === 0,
                aria: { label: _('Cleanup progress') },
            },
            {
                id: CleanupWidgetId.progressFigures,
                type: 'fixedtext',
                text: figures,
                visible: figures !== '',
                cssClass: 'cleanup-progress-figures',
            },
        ],
    };
}
/// The status of the run that is going: the phase with Stop beside it, and the bar under
/// them.
function statusJSON(state) {
    return {
        id: CleanupWidgetId.status,
        type: 'container',
        vertical: true,
        visible: state.busy && !state.readOnly,
        cssClass: 'cleanup-status',
        children: [
            {
                id: CleanupWidgetId.statusLine,
                type: 'container',
                ariaLive: 'polite',
                cssClass: 'cleanup-status-line',
                children: [
                    statusTextJSON(state),
                    {
                        id: CleanupWidgetId.stop,
                        type: 'pushbutton',
                        text: _('Stop Cleanup'),
                    },
                ],
            },
            progressLineJSON(state),
        ],
    };
}
/// One place over the list holds either the button that starts a run or the status of the
/// run that is going.
function runJSON(state) {
    return {
        id: CleanupWidgetId.run,
        type: 'container',
        vertical: true,
        cssClass: 'cleanup-run',
        children: [
            {
                id: CleanupWidgetId.scan,
                type: 'pushbutton',
                text: _('Scan presentation'),
                cssClass: offersFixAllIn(state) ? '' : 'cleanup-primary',
                enabled: !state.busy,
                visible: !state.busy && !state.readOnly,
            },
            statusJSON(state),
        ],
    };
}
/// The band over the foot of the panel says what the whole list comes to, with the button
/// that deals with the whole list under it. It waits for the run to settle rather than
/// reporting a figure that is still moving, and stands there only while it has something in
/// it: a figure, a count, or the button.
function summaryJSON(state) {
    const total = totalTextFor(state);
    const offersFixAll = offersFixAllIn(state);
    return {
        id: CleanupWidgetId.summary,
        type: 'container',
        vertical: true,
        ariaLive: 'polite',
        visible: !state.busy && !state.readOnly && (total !== '' || offersFixAll),
        cssClass: 'cleanup-summary',
        children: [
            {
                id: CleanupWidgetId.total,
                type: 'fixedtext',
                text: total,
                visible: total !== '',
                cssClass: 'cleanup-total',
            },
            {
                id: CleanupWidgetId.fixAll,
                type: 'pushbutton',
                text: _('Fix all'),
                enabled: !state.busy,
                visible: offersFixAll,
                cssClass: 'cleanup-primary',
            },
        ],
    };
}
/// The foot of the panel: what the list comes to, the values the next scan is run with, and
/// the button that starts one. It keeps to the foot of the dock however short the list is.
function footerJSON(state) {
    return {
        id: CleanupWidgetId.footer,
        type: 'container',
        vertical: true,
        cssClass: 'cleanup-footer',
        children: [
            summaryJSON(state),
            separatorJSON(state),
            optionsJSON(state),
            runJSON(state),
        ],
    };
}
function separatorJSON(state) {
    return {
        id: CleanupWidgetId.separator,
        type: 'separator',
        orientation: 'horizontal',
        visible: !state.readOnly,
    };
}
/// The panel says what the scan button is for until a list arrives, what the list came to
/// once one has, why there is nothing to do when the document may not be changed, and what
/// became of a run it gave up.
function messageJSON(state) {
    let text;
    let visible = true;
    if (state.readOnly) {
        text = _('This document cannot be changed here, so there is nothing to clean up.');
    }
    else if (state.notice) {
        // A line about a run that was given up stands over whatever list is on
        // screen, so it is in sight even when the panel has findings to show.
        text = state.notice;
    }
    else {
        text = _('Find what makes this presentation large, and clean it up here.');
        visible = !state.hasList;
    }
    return {
        id: CleanupWidgetId.message,
        type: 'fixedtext',
        text: text,
        visible: visible,
        ariaLive: 'polite',
        cssClass: 'cleanup-message',
    };
}
/// A row: where the finding is, as a link when the view can go there, with the figures it
/// was made on under that; how much it saves, once measured; and its Fix button, when it
/// offers one. The two lines stand together in one cell, so the badge and the button sit
/// beside the pair of them.
function rowJSON(state, row) {
    const id = rowWidgetId(row.id);
    const text = rowTextFor(row);
    const detail = rowDetailFor(row);
    const lines = [];
    if (row.canGoTo)
        lines.push({
            id: id + '-goto',
            type: 'linkbutton',
            text: text,
            cssClass: 'cleanup-row-text',
        });
    else
        lines.push({
            id: id + '-text',
            type: 'fixedtext',
            text: text,
            cssClass: 'cleanup-row-text',
        });
    if (detail !== '')
        lines.push({
            id: id + '-detail',
            type: 'fixedtext',
            text: detail,
            cssClass: 'cleanup-row-detail',
        });
    const children = [
        {
            id: id + '-lines',
            type: 'container',
            vertical: true,
            cssClass: 'cleanup-row-lines',
            hexpand: true,
            left: '0',
            top: '0',
            children: lines,
        },
    ];
    if (row.saving > 0)
        children.push({
            id: id + '-saving',
            type: 'fixedtext',
            text: _('saves %1').replace('%1', formatByteSize(row.saving)),
            cssClass: 'cleanup-row-saving',
            left: '1',
            top: '0',
        });
    if (row.canFix)
        children.push({
            id: id + '-fix',
            type: 'pushbutton',
            text: fixButtonText(row.category),
            enabled: !state.busy,
            aria: { label: fixLabelFor(row.category, text) },
            left: '2',
            top: '0',
        });
    return {
        id: id,
        type: 'grid',
        cols: 3,
        rows: 1,
        cssClass: 'cleanup-row' + (state.goneRows.has(row.id) ? ' cleanup-row-gone' : ''),
        children: children,
    };
}
/// A group is a section that folds shut under a heading saying what kind of finding it
/// holds and how many. A group with nothing to report is off the screen. The line that
/// says more about the check belongs to the heading, so it shows beside the heading rather
/// than under the rows.
function groupJSON(state, category) {
    const id = groupWidgetId(category);
    const rows = rowsOf(state, category);
    const children = [
        {
            id: id + '-heading',
            type: 'fixedtext',
            text: checkNameFor(category),
            tooltip: checkTooltipFor(state, category),
        },
    ];
    for (const row of rows)
        children.push(rowJSON(state, row));
    return {
        id: id,
        type: 'expander',
        expanded: !state.foldedGroups.has(category),
        visible: rows.length > 0,
        secondaryText: String(rows.length),
        cssClass: 'cleanup-group',
        children: children,
    };
}
/// The flat row that stands in the place of a check while it has nothing to report. It
/// holds nothing to press, so the keyboard walks past a check with no findings.
function checkRowJSON(state, category) {
    const id = checkWidgetId(category);
    const state_ = checkStateFor(countOf(state, category), state.scanned.has(category));
    return {
        id: id,
        type: 'grid',
        cols: 2,
        rows: 1,
        visible: state_ !== 'found',
        cssClass: 'cleanup-check-row',
        children: [
            {
                id: id + '-title',
                type: 'fixedtext',
                text: checkNameFor(category),
                tooltip: checkTooltipFor(state, category),
                cssClass: 'cleanup-check-title',
                hexpand: true,
                left: '0',
                top: '0',
            },
            {
                id: id + '-state',
                type: 'fixedtext',
                text: state_ === 'none' ? _('None') : _('Not checked'),
                cssClass: 'cleanup-check-state',
                left: '1',
                top: '0',
            },
        ],
    };
}
/// One tool: a title and the checks that belong to it, each of them in whichever of its two
/// shapes belongs on the screen.
function toolJSON(state, tool) {
    const children = [
        {
            id: toolWidgetId(tool.id) + '-title',
            type: 'fixedtext',
            text: tool.name(),
            allyRole: 'heading',
            cssClass: 'cleanup-tool-title',
        },
    ];
    for (const check of tool.checks) {
        children.push(groupJSON(state, check.category));
        children.push(checkRowJSON(state, check.category));
    }
    return {
        id: toolWidgetId(tool.id),
        type: 'container',
        vertical: true,
        visible: !state.readOnly,
        cssClass: 'cleanup-tool',
        children: children,
    };
}
/// The JSON of one region of the deck, named by the id of its widget, and null for an id
/// that names no region. The regions are the widgets the panel sends on their own once the
/// deck is built: the options row and the fields inside it, the run, the band, the divider,
/// the message, a tool, a check in both of its shapes and a row.
function cleanupRegionJSON(state, id) {
    switch (id) {
        case CleanupWidgetId.options:
            return optionsJSON(state);
        case CleanupWidgetId.optionsBody:
            return optionsBodyJSON(state);
        case CleanupWidgetId.run:
            return runJSON(state);
        case CleanupWidgetId.statusText:
            return statusTextJSON(state);
        case CleanupWidgetId.progressLine:
            return progressLineJSON(state);
        case CleanupWidgetId.summary:
            return summaryJSON(state);
        case CleanupWidgetId.separator:
            return separatorJSON(state);
        case CleanupWidgetId.message:
            return messageJSON(state);
    }
    for (const tool of CLEANUP_TOOLS)
        if (id === toolWidgetId(tool.id))
            return toolJSON(state, tool);
    const category = categoryOfGroupWidgetId(id);
    if (category)
        return groupJSON(state, category);
    const checked = categoryOfCheckWidgetId(id);
    if (checked)
        return checkRowJSON(state, checked);
    const rowId = rowOfWidgetId(id, '');
    if (rowId !== null) {
        const row = state.rows.get(rowId);
        return row ? rowJSON(state, row) : null;
    }
    return null;
}
/// What a region looks like, for telling whether it has to be rebuilt. A group is its
/// heading and the rows it holds, not what those rows say: a row that changes is rebuilt on
/// its own, so a group is rebuilt only when a row joins or leaves it or its heading
/// changes.
function regionLook(json) {
    if (json.type !== 'expander')
        return JSON.stringify(json);
    const children = json.children || [];
    return JSON.stringify(Object.assign({}, json, {
        children: children.map((child) => child.id),
        heading: children.length ? children[0] : null,
    }));
}
/// The whole deck: a heading row that says the title, and the regions under it.
function cleanupDeckJSON(state) {
    const title = _('Clean Up');
    const children = [messageJSON(state)];
    for (const tool of CLEANUP_TOOLS)
        children.push(toolJSON(state, tool));
    children.push(footerJSON(state));
    return {
        id: CleanupWidgetId.deck,
        type: 'deck',
        enabled: true,
        visible: true,
        text: title,
        headerText: title,
        name: CleanupWidgetId.deck,
        children: children,
    };
}
/// The ids of the elements that take the focus: the builder names the button inside a push
/// button widget and the input inside a field with a suffix on the widget id.
function buttonElementId(widgetId) {
    return widgetId + '-button';
}
function inputElementId(widgetId) {
    return widgetId + '-input';
}
/// True for the element ids of the controls a run turns off: the options, the two buttons
/// that act on a list and the button of every row.
function goesDeadWhenBusy(elementId) {
    if (elementId === buttonElementId(CleanupWidgetId.scan) ||
        elementId === buttonElementId(CleanupWidgetId.fixAll) ||
        // The fields the row holds go dead with the rest, so the row hands the keyboard
        // on rather than dropping it.
        elementId === buttonElementId(CleanupWidgetId.options + '-heading') ||
        elementId === inputElementId(CleanupWidgetId.resolution) ||
        elementId === inputElementId(CleanupWidgetId.quality) ||
        elementId === inputElementId(CleanupWidgetId.sharing))
        return true;
    return rowOfWidgetId(elementId, '-fix-button') !== null;
}
/// Which fields of the panel state the deck's own widgets write, keyed by the widget event
/// that carries the new value. Returns true when the event was one of them.
function applyOptionEvent(options, objectType, eventType, id, data) {
    if (objectType === 'combobox' &&
        eventType === 'selected' &&
        id === CleanupWidgetId.resolution) {
        // The listbox reports the place of the entry and its text, as 'index;text'.
        const index = parseInt(String(data), 10);
        if (index >= 0 && index < CLEANUP_RESOLUTIONS.length)
            options.resolution = CLEANUP_RESOLUTIONS[index];
        return true;
    }
    if (objectType === 'spinfield' &&
        eventType === 'change' &&
        id === CleanupWidgetId.quality) {
        const quality = Number(data);
        if (isFinite(quality))
            options.quality = Math.min(100, Math.max(1, Math.round(quality)));
        return true;
    }
    if (objectType === 'checkbox' &&
        eventType === 'change' &&
        id === CleanupWidgetId.sharing) {
        options.forPublication = data === true;
        return true;
    }
    return false;
}
class CleanupSidebar extends SidebarBase {
    constructor(map) {
        super(map, SidebarType.Cleanup);
        this.state = newCleanupPanelState();
        /// Request numbers increase for the life of the view, and the action of a request
        /// is kept until the event that finishes it arrives.
        this.nextRequestId = 0;
        this.requestActions = new Map();
        /// The list the panel is showing, and null while it has none.
        this.run = null;
        this.shown = false;
        /// What each region looked like when it was last given to the sidebar, so a region
        /// whose state has not changed is not rebuilt.
        this.lastSent = new Map();
        /// The row whose Fix button was pressed, and the row under it that offers one, so
        /// that the focus has somewhere to go once the row it was on has left the list.
        this.fixedRowId = null;
        this.fixedRowCategory = null;
        this.rowAfterFixedId = null;
        /// True from the moment the panel puts the focus on Stop for a run until it places
        /// it again at the end of that run, and the id of the element it took the focus
        /// from, which is empty while it holds none.
        this.focusHeldForRun = false;
        this.focusTakenFrom = '';
        /// True while the panel is listening for what its run reports.
        this.listening = false;
        this.onCommandResultBound = this.onCommandResult.bind(this);
        this.onDocLoadedBound = this.onDocLoaded.bind(this);
        /// The wait for the run to say something, and null while nothing is being waited
        /// for.
        this.silenceTimer = null;
        /// The number of the last request the panel sent before it gave its run up, and null
        /// while no run was given up. The kit answers requests in the order they were sent, so
        /// what the run reports up to the reply to a later request belongs to the run given up.
        this.lastRequestOfGivenUpRun = null;
        this.map.on('dockcontent', this.onDockContent, this);
        app.events.on('updatepermission', () => this.onPermissionChanged());
    }
    onRemove() {
        super.onRemove();
        this.map.off('dockcontent', this.onDockContent, this);
    }
    /// The deck is built and driven in the browser, so the builder is told the window
    /// the other browser-driven decks of this dock use, and every widget event stops
    /// here.
    createBuilder() {
        this.builder = new window.L.control.jsDialogBuilder({
            mobileWizard: this,
            map: this.map,
            windowId: WindowId.Notebookbar,
            cssClass: 'jsdialog sidebar',
            useScrollAnimation: false,
            suffix: 'sidebar',
            callback: this.callback.bind(this),
        });
    }
    /// The deck borrows the sidebar dock rather than having one of its own.
    setupContainer(parentContainer) {
        this.container = document.getElementById('sidebar-container');
        this.wrapper = document.getElementById('sidebar-dock-wrapper');
        this.documentContainer = document.querySelector('#document-container');
    }
    /// Turns the deck on or off. Once the dock holds the deck, the panel asks the kit
    /// for the state of the run.
    toggle() {
        if (this.shown) {
            this.closeSidebar();
            return;
        }
        // The deck is built from the state it opens in, so nothing has to follow on
        // its heels.
        this.state.readOnly = this.map.isReadOnlyMode();
        this.lastSent.clear();
        this.takeOverDock();
        this.buildDeck();
        this.showSidebar();
        this.updatePresentationDeckHighlight(CleanupWidgetId.deck);
        this.listenToMap();
        if (this.state.readOnly)
            return;
        this.sendRequest('list');
    }
    /// Empties the dock for the deck. A core deck showing there is closed in the kit as
    /// well, so the deck commands keep toggling in step with what the user sees.
    takeOverDock() {
        // isVisible is true exactly while a core deck fills the dock
        if (this.isVisible())
            app.socket.sendMessage('uno .uno:SidebarHide');
        this.closeSidebar();
    }
    /// Puts the deck in the dock, built with this component's own builder, and takes the
    /// content of the dock over so that patches meant for another component pass it by.
    buildDeck() {
        if (!this.builder || !this.container)
            return;
        const deck = cleanupDeckJSON(this.state);
        this.model.fullUpdate({
            // The container the deck sits in. It carries a name of its own rather than the
            // deck's, so that an id names one thing.
            id: SidebarType.Cleanup,
            jsontype: SidebarType.Cleanup,
            type: 'container',
            dialogid: '0',
            children: [deck],
        });
        this.markContainerContentOwner();
        this.rememberDrawn(deck);
        // The deck is built away from the page and put in once it is whole.
        const fragment = new DocumentFragment();
        const temporary = window.L.DomUtil.create('div', '', fragment);
        this.builder.build(temporary, [this.model.getSnapshot()], false);
        const container = this.container;
        app.layoutingService.appendLayoutingTask(() => container.replaceChildren(temporary.firstChild));
        this.onResize();
    }
    /// Draws one widget of the deck again from new JSON. The model takes the new state
    /// as well, so a rebuild of the whole deck draws the same thing. True when it was
    /// drawn.
    updateWidget(control) {
        if (!this.shown || !this.builder || !this.container)
            return false;
        this.model.widgetUpdate(control);
        this.builder.updateWidget(this.container, control);
        return true;
    }
    /// The dock this deck borrows now holds something else, or nothing at all. Every way
    /// the deck can go ends here: the toggle closing it, another deck taking the dock,
    /// and the dock being closed by the read-only switch.
    onDockContent(e) {
        if (e.wrapper !== this.wrapper)
            return;
        if (e.jsontype === this.allowedJsonType) {
            this.shown = true;
            return;
        }
        this.onHidden();
    }
    /// The deck no longer holds the panel. The kit throws its session away and the
    /// panel forgets the list, so the next opening starts from an empty panel and a
    /// fresh run.
    onHidden() {
        if (!this.shown)
            return;
        this.shown = false;
        this.updatePresentationDeckHighlight('');
        if (!this.state.readOnly)
            this.sendRequest('release');
        this.stopListeningToMap();
        this.clearSilenceTimer();
        this.lastRequestOfGivenUpRun = null;
        this.run = null;
        this.requestActions.clear();
        this.lastSent.clear();
        this.state.scanned.clear();
        this.state.documentBytes = 0;
        this.fixedRowId = null;
        this.fixedRowCategory = null;
        this.rowAfterFixedId = null;
        this.focusHeldForRun = false;
        // The options and the permission outlive the list, the rest starts over.
        const fresh = newCleanupPanelState();
        fresh.options = this.state.options;
        fresh.chosenOptions = this.state.chosenOptions;
        fresh.readOnly = this.state.readOnly;
        this.state = fresh;
    }
    /// What the run reports arrives on the map, and so does the loss of the connection
    /// to the document.
    listenToMap() {
        if (this.listening)
            return;
        this.map.on('commandresult', this.onCommandResultBound);
        this.map.on('docloaded', this.onDocLoadedBound);
        this.listening = true;
    }
    stopListeningToMap() {
        if (!this.listening)
            return;
        this.map.off('commandresult', this.onCommandResultBound);
        this.map.off('docloaded', this.onDocLoadedBound);
        this.listening = false;
    }
    /// The connection to the document is up or down. While it is down nothing more can
    /// come of a run, so the panel gives the run up straight away rather than waiting the
    /// silence out.
    onDocLoaded(event) {
        if (event && event.status === false) {
            this.giveUpQuietRun();
            this.lastRequestOfGivenUpRun = null;
        }
    }
    /// The view changed between editing and reading, so the panel takes the state it
    /// now has. A view that can no longer be changed gives its run up and shows why the
    /// list is empty.
    onPermissionChanged() {
        const readOnly = this.map.isReadOnlyMode();
        if (readOnly === this.state.readOnly)
            return;
        if (readOnly && this.shown && this.run !== null)
            this.sendRequest('release');
        this.state.readOnly = readOnly;
        if (readOnly) {
            this.clearSilenceTimer();
            this.lastRequestOfGivenUpRun = null;
            this.run = null;
            this.state.hasList = false;
            this.requestActions.clear();
            this.clearRows();
            this.recountRows();
        }
        this.applyReadOnly();
        if (!readOnly && this.shown)
            this.sendRequest('list');
    }
    // --- the deck on screen
    // --------------------------------------------------------------
    /// Draws the regions named again, each one only when it does not look as it did when
    /// it was last drawn. A region drawn carries its children with it, so what was last
    /// drawn for those is forgotten.
    refresh(...ids) {
        if (!this.shown)
            return;
        for (const id of ids) {
            const json = cleanupRegionJSON(this.state, id);
            if (!json)
                continue;
            const look = regionLook(json);
            if (this.lastSent.get(id) === look)
                continue;
            if (!this.updateWidget(json))
                continue;
            this.forgetSentChildren(json);
            this.lastSent.set(id, look);
        }
    }
    forgetSentChildren(widget) {
        for (const child of widget.children || []) {
            this.lastSent.delete(child.id);
            this.forgetSentChildren(child);
        }
    }
    /// Notes what a widget and everything inside it look like as they go on screen,
    /// so a region asked for again in the same state is left as it stands.
    rememberDrawn(widget) {
        this.lastSent.set(widget.id, regionLook(widget));
        for (const child of widget.children || [])
            this.rememberDrawn(child);
    }
    /// Notes that the region named already looks the way the state says, for a change
    /// the builder has drawn on its own.
    markDrawn(id) {
        const json = cleanupRegionJSON(this.state, id);
        if (json)
            this.lastSent.set(id, regionLook(json));
    }
    /// A check is drawn again in both of its shapes, since a row joining or leaving it
    /// decides which of them belongs on the screen.
    refreshGroups() {
        this.refresh(...CLEANUP_CATEGORIES.map(groupWidgetId), ...CLEANUP_CATEGORIES.map(checkWidgetId));
    }
    refreshAll() {
        this.refresh(CleanupWidgetId.options, CleanupWidgetId.run, CleanupWidgetId.summary, CleanupWidgetId.separator, CleanupWidgetId.message);
        this.refreshGroups();
    }
    /// Puts the focus on the element named once the rebuilds queued before it are on
    /// screen.
    focusAfterRefresh(elementId) {
        app.layoutingService.appendLayoutingTask(() => {
            const element = document.getElementById(elementId);
            if (element)
                element.focus();
        });
    }
    focusedElementId() {
        const focused = document.activeElement;
        return focused ? focused.id : '';
    }
    focusIsInside(widgetId) {
        const element = document.getElementById(widgetId);
        return !!element && element.contains(document.activeElement);
    }
    // --- what the person presses
    // ---------------------------------------------------------
    /// Every widget event of the deck is answered here, so none of them travels on to
    /// the kit.
    callback(objectType, eventType, object, data, builder) {
        const id = object && typeof object.id === 'string' ? object.id : '';
        if (!id.startsWith('cleanup-'))
            return false;
        if (objectType === 'pushbutton' && eventType === 'click') {
            if (id === CleanupWidgetId.scan)
                this.onScanPressed();
            else if (id === CleanupWidgetId.stop)
                this.onStopPressed();
            else if (id === CleanupWidgetId.fixAll)
                this.onFixAllPressed();
            else {
                const rowId = rowOfWidgetId(id, '-fix');
                if (rowId !== null)
                    this.onFixPressed(rowId);
            }
        }
        else if (objectType === 'linkbutton' && eventType === 'click') {
            const rowId = rowOfWidgetId(id, '-goto');
            if (rowId !== null)
                this.onGoToPressed(rowId);
        }
        else if (objectType === 'expander' && eventType === 'toggle') {
            // The row that holds the values a scan is run with folds like a check does,
            // and the builder has already turned the section on screen, so the panel
            // only follows where it now stands.
            if (id === CleanupWidgetId.options) {
                this.state.optionsOpen = !this.state.optionsOpen;
                this.markDrawn(id);
                this.writeOptionsSummary();
                return true;
            }
            const category = categoryOfGroupWidgetId(id);
            if (category) {
                if (this.state.foldedGroups.has(category))
                    this.state.foldedGroups.delete(category);
                else
                    this.state.foldedGroups.add(category);
                this.markDrawn(id);
            }
        }
        else if (applyOptionEvent(this.state.chosenOptions, objectType, eventType, id, data)) {
            this.writeOptionsSummary();
        }
        return true;
    }
    /// The line the row that holds the fields says while they are folded away. It sits
    /// inside the heading the builder draws, which is not a widget of its own, so it is
    /// written here rather than by drawing the row again. Drawing the row again would
    /// take the keyboard out of the field the reader is in.
    writeOptionsSummary() {
        if (!this.container)
            return;
        const line = this.container.querySelector('#' + CleanupWidgetId.options + '-heading-secondary');
        if (line)
            line.textContent = imageOptionsSummary(this.state.chosenOptions);
        this.markDrawn(CleanupWidgetId.options);
    }
    onScanPressed() {
        if (this.state.busy || this.state.readOnly)
            return;
        this.state.options = Object.assign({}, this.state.chosenOptions);
        this.state.savedBytes = 0;
        this.setBusy(true);
        this.setStatus('scanning');
        this.setProgress(0, 0);
        this.sendRequest('scan', { options: this.state.options });
    }
    onStopPressed() {
        this.sendRequest('stop');
    }
    onFixAllPressed() {
        if (this.state.busy || this.run === null)
            return;
        this.setBusy(true);
        this.setStatus('cleaning');
        this.setProgress(0, 0);
        this.sendRequest('fixAll', { run: this.run });
    }
    onFixPressed(rowId) {
        if (this.state.busy || this.run === null)
            return;
        this.fixedRowId = rowId;
        const row = this.state.rows.get(rowId);
        this.fixedRowCategory = row ? row.category : null;
        this.rowAfterFixedId = this.rowWithFixAfter(rowId);
        this.setBusy(true);
        this.setStatus('cleaning');
        this.setProgress(0, 0);
        this.sendRequest('fix', { run: this.run, row: rowId });
    }
    onGoToPressed(rowId) {
        if (this.run === null)
            return;
        this.sendRequest('goTo', { run: this.run, row: rowId });
    }
    /// The kit says what the list was made with, so the controls take those values as
    /// well.
    writeOptions(options) {
        this.state.options = options;
        this.state.chosenOptions = Object.assign({}, options);
        this.refresh(CleanupWidgetId.optionsBody);
        this.writeOptionsSummary();
    }
    // --- the wire
    // ------------------------------------------------------------------------
    /// Sends one request and returns the number it was given. The request goes to the
    /// socket as it stands.
    sendRequest(action, fields) {
        const requestId = ++this.nextRequestId;
        const request = {
            request: requestId,
            action: action,
        };
        if (fields)
            for (const key in fields)
                request[key] = fields[key];
        this.requestActions.set(requestId, action);
        if (actionNeedsAnswer(action)) {
            // The panel is about to wait on the kit, so the line about the last run
            // it waited on in vain goes.
            this.clearNotice();
            this.watchForSilence();
        }
        app.socket.sendMessage('uno .uno:PresentationCleanup ' +
            JSON.stringify({
                DataJson: { type: 'string', value: JSON.stringify(request) },
            }));
        return requestId;
    }
    onCommandResult(event) {
        if (event.commandName !== '.uno:PresentationCleanup')
            return;
        if (!this.shown)
            return;
        let result = null;
        if (typeof event.result === 'string') {
            try {
                result = JSON.parse(event.result);
            }
            catch {
                result = null;
            }
        }
        else if (event.result && typeof event.result === 'object') {
            result = event.result;
        }
        if (!result || !result.event)
            return;
        if (this.belongsToGivenUpRun(result)) {
            // The run is still alive, so the wait starts over all the same.
            if (this.state.busy)
                this.watchForSilence();
            return;
        }
        // Every event is applied inside one guard, so a payload the panel cannot
        // make sense of is reported and the panel stays as it was.
        try {
            switch (result.event) {
                case 'reply':
                    this.onReply(result);
                    break;
                case 'list':
                    this.onList(result);
                    break;
                case 'progress':
                    this.onProgress(result);
                    break;
                case 'measured':
                    this.onMeasured(result);
                    break;
                case 'finished':
                    this.onFinished(result);
                    break;
                case 'fixed':
                    this.onFixed(result);
                    break;
            }
        }
        catch (exception) {
            app.console.warn('cleanup: the panel could not apply an event: ' + String(exception));
        }
        // Whatever the event was, the run is alive, so the wait starts over for as long
        // as the panel is still waiting on it.
        if (this.state.busy)
            this.watchForSilence();
        else
            this.clearSilenceTimer();
    }
    /// True for what the run the panel gave up reports: its progress and its end. Those arrive
    /// before the reply to the first request sent after the panel gave the run up, and that
    /// reply marks the point where what the kit sends is about the panel's requests again.
    belongsToGivenUpRun(result) {
        if (this.lastRequestOfGivenUpRun === null)
            return false;
        if (result.event === 'reply' &&
            typeof result.request === 'number' &&
            result.request > this.lastRequestOfGivenUpRun) {
            this.lastRequestOfGivenUpRun = null;
            return false;
        }
        return (result.event === 'progress' ||
            result.event === 'measured' ||
            result.event === 'finished' ||
            result.event === 'fixed');
    }
    /// True while a request for the whole list is out and its reply has not arrived.
    hasListRequestOut() {
        for (const action of this.requestActions.values())
            if (action === 'list')
                return true;
        return false;
    }
    /// True while the event belongs to a list the panel is not showing.
    isStaleEvent(result) {
        return isStaleEvent(result, this.run, this.hasListRequestOut());
    }
    onReply(result) {
        const requestId = result.request;
        if (typeof requestId !== 'number')
            return;
        // A cleanup request is finished by the fixed event that follows its reply,
        // and that event reads the action back. Every other request is finished by
        // its reply.
        const action = this.requestActions.get(requestId);
        if (result.ok === false || (action !== 'fix' && action !== 'fixAll'))
            this.requestActions.delete(requestId);
        if (result.ok !== false)
            return;
        // The kit turns a request away with readOnly when the document may not be
        // changed or its content may not leave the machine, and the browser cannot
        // always see either of those for itself. So the panel takes that state from
        // the answer and says there is nothing to do.
        const refusedAsReadOnly = result.reason === 'readOnly';
        if (refusedAsReadOnly)
            this.state.readOnly = true;
        // The request was refused, so what pressing it disabled comes back. A goTo
        // or a list is allowed while a run is going, so a refusal of one of those
        // leaves the run alone.
        if (refusalEndsBusyState(action)) {
            this.setBusy(false);
            this.setStatus('idle');
            this.updateSummary();
        }
        if (refusedAsReadOnly)
            this.applyReadOnly();
        if (result.reason === 'stale' || result.reason === 'gone')
            this.sendRequest('list');
    }
    onList(result) {
        // A list is an answer from the kit, so a line saying it did not answer goes.
        this.state.notice = '';
        this.run = typeof result.run === 'number' ? result.run : null;
        // The kit numbers its lists from one, so a list under run zero is the state
        // of a session that has scanned nothing yet, and the panel keeps inviting
        // the reader to scan.
        this.state.hasList = this.run !== null && this.run > 0;
        if (result.reason !== 'fix')
            this.state.savedBytes = 0;
        if (result.reason === 'request' && isCleanupOptions(result.options))
            this.writeOptions(result.options);
        this.takeScanned(result);
        const measured = asMeasuredProgress(result.measured);
        // The rows the panel drew are what the counts are worked out over, so a row
        // the panel could not read is left out of them as well as off the screen.
        this.takeTotal(result.total);
        this.rebuildRows(asArray(result.rows));
        this.setStatus(result.status || 'idle');
        this.setBusy(this.state.statusName !== 'idle');
        this.setProgress(measured.done, measured.total);
        this.updateChecks();
        this.updateSummary();
        this.updateMessage();
    }
    /// Which checks the scan behind this list looked for. A kit that says nothing leaves
    /// the panel to work it out from the values the list was made with, and a list of a
    /// session that has scanned nothing covers no check at all.
    takeScanned(result) {
        if (!this.state.hasList) {
            this.state.scanned.clear();
            return;
        }
        const named = asCategoryArray(result.scanned);
        this.state.scanned = new Set(named.length > 0 ? named : scannedFromOptions(this.state.options));
    }
    /// Both shapes of every check are drawn again, since what a check has to report
    /// decides which of them belongs on the screen.
    updateChecks() {
        this.refreshGroups();
    }
    onProgress(result) {
        if (this.isStaleEvent(result))
            return;
        const phase = result.phase;
        this.setStatus(phase === 'preparing' || phase === 'cleaning' ? phase : 'measuring');
        this.setProgress(isFiniteNumber(result.done) ? result.done : 0, isFiniteNumber(result.total) ? result.total : 0);
    }
    onMeasured(result) {
        if (this.isStaleEvent(result))
            return;
        for (const entry of asArray(result.rows)) {
            if (!isCleanupRowPatch(entry)) {
                app.console.warn('cleanup: dropping a row patch the panel cannot read');
                continue;
            }
            const row = this.state.rows.get(entry.id);
            if (!row)
                continue;
            if (typeof entry.saving === 'number')
                row.saving = entry.saving;
            row.measured = true;
            this.refresh(rowWidgetId(row.id));
        }
        for (const droppedId of asNumberArray(result.dropped))
            this.removeRow(droppedId);
        // The counts are worked out over the rows on screen, and the message
        // carries the estimate alone, so what it does not say keeps the value the
        // list gave it.
        this.recountRows();
        this.takeTotal(result.total);
        this.updateChecks();
        this.updateSummary();
        this.updateMessage();
    }
    onFinished(result) {
        if (this.isStaleEvent(result))
            return;
        this.writeRowNumbers(asArray(result.rows));
        this.takeTotal(result.total);
        this.recountRows();
        this.setStatus('idle');
        this.setBusy(false);
        this.updateChecks();
        this.updateSummary();
        this.updateMessage();
    }
    onFixed(result) {
        if (this.isStaleEvent(result))
            return;
        const action = typeof result.request === 'number'
            ? this.requestActions.get(result.request)
            : undefined;
        if (typeof result.request === 'number')
            this.requestActions.delete(result.request);
        if (result.cancelled) {
            this.setStatus('idle');
            this.setBusy(false);
            this.updateSummary();
            return;
        }
        const rescan = result.rescan === true;
        // A cleanup that reaches beyond the rows it names is followed by a scan of
        // its own. The rows it dealt with stay on screen greyed out until that list
        // arrives, so the reader sees the list they pressed on rather than an empty
        // panel.
        for (const removedId of asNumberArray(result.removed)) {
            if (rescan)
                this.greyRow(removedId);
            else
                this.removeRow(removedId);
        }
        this.writeRowNumbers(asArray(result.rows));
        if (action === 'fixAll' && typeof result.saved === 'number')
            this.state.savedBytes = result.saved;
        if (!rescan) {
            this.takeTotal(result.total);
            this.recountRows();
            this.setStatus('idle');
            this.setBusy(false);
            this.updateChecks();
            this.updateSummary();
            this.updateMessage();
        }
    }
    /// The rows in the order they stand on screen: group by group, and within a group
    /// as the kit listed them.
    rowsInScreenOrder() {
        const rows = [];
        for (const category of CLEANUP_CATEGORIES)
            rows.push(...rowsOf(this.state, category));
        return rows;
    }
    /// The id of the first row under the given one that offers a cleanup, and null when
    /// the row is the last one that does. Read before the cleanup runs, while both rows
    /// are still there.
    rowWithFixAfter(rowId) {
        const withFix = this.rowsInScreenOrder().filter((row) => row.canFix);
        const index = withFix.findIndex((row) => row.id === rowId);
        if (index === -1 || index + 1 >= withFix.length)
            return null;
        return withFix[index + 1].id;
    }
    /// The run is over and its status line is about to leave the screen, so the focus
    /// the line is holding moves to something that stays: the Fix button of the row
    /// that followed the one dealt with, the heading of that row's group, or the button
    /// that starts a run. The focus is placed again when the status line holds it, when
    /// the line has left the screen, or when the document took it. A focus the reader
    /// moved anywhere else is left where they put it. Returns the id of the element to
    /// focus, decided while the status line is still on screen, and null when the focus
    /// is to be left alone.
    focusTargetAfterRun() {
        const heldForRun = this.focusHeldForRun;
        const takenFrom = this.focusTakenFrom;
        const fixedRowCategory = this.fixedRowCategory;
        const rowAfterFixedId = this.rowAfterFixedId;
        this.focusHeldForRun = false;
        this.focusTakenFrom = '';
        this.fixedRowId = null;
        this.fixedRowCategory = null;
        this.rowAfterFixedId = null;
        if (!this.shown)
            return null;
        const focused = document.activeElement;
        const focusInStatusLine = this.focusIsInside(CleanupWidgetId.status);
        if (!heldForRun && !focusInStatusLine)
            return null;
        // A run short enough to end before the move to Stop is drawn leaves the focus
        // on the widget the run took it from, and that widget goes with the rebuild.
        // So the panel still has the focus to place, the same as when nothing holds
        // it. A widget the reader moved to in the meantime is left alone.
        const heldByNothing = !focused ||
            focused === document.body ||
            (takenFrom !== '' && focused.id === takenFrom);
        if (!focusInStatusLine && !heldByNothing && !this.map.hasFocus())
            return null;
        const scanButton = this.state.readOnly
            ? null
            : buttonElementId(CleanupWidgetId.scan);
        if (!heldForRun)
            return scanButton;
        const next = rowAfterFixedId === null ? null : this.state.rows.get(rowAfterFixedId);
        if (next && next.canFix)
            return buttonElementId(rowWidgetId(next.id) + '-fix');
        if (fixedRowCategory && this.countOf(fixedRowCategory) > 0)
            return buttonElementId(groupWidgetId(fixedRowCategory) + '-heading');
        return scanButton;
    }
    takeTotal(total) {
        if (!total || typeof total === 'number')
            return;
        if (typeof total.estimated === 'number')
            this.state.estimatedBytes = total.estimated;
        // The kit carries the saved figure on every list, so an undo of a cleanup
        // leaves the two sides agreeing on what the document has shed.
        if (typeof total.saved === 'number')
            this.state.savedBytes = total.saved;
        if (typeof total.count === 'number')
            this.state.rowCount = total.count;
        if (typeof total.fixable === 'number')
            this.state.fixableCount = total.fixable;
        if (typeof total.documentBytes === 'number')
            this.state.documentBytes = total.documentBytes;
    }
    // --- the rows
    // ------------------------------------------------------------------------
    clearRows() {
        this.state.rows.clear();
        this.state.goneRows.clear();
        this.refreshGroups();
    }
    rebuildRows(rows) {
        // The kit numbers the rows of every list from one, so the row the last
        // cleanup was pressed on and the row that followed it are named by ids of a
        // list that is gone. The group they were in stands over the same kind of
        // finding in every list, so it stays.
        this.fixedRowId = null;
        this.rowAfterFixedId = null;
        this.state.rows.clear();
        this.state.goneRows.clear();
        for (const entry of rows) {
            if (!isCleanupRow(entry)) {
                app.console.warn('cleanup: dropping a row the panel cannot read');
                continue;
            }
            this.state.rows.set(entry.id, entry);
        }
        this.recountRows();
        this.refreshGroups();
    }
    removeRow(rowId) {
        const row = this.state.rows.get(rowId);
        if (!row)
            return;
        this.state.rows.delete(rowId);
        this.state.goneRows.delete(rowId);
        this.refresh(groupWidgetId(row.category));
    }
    greyRow(rowId) {
        if (!this.state.rows.has(rowId))
            return;
        this.state.goneRows.add(rowId);
        this.refresh(rowWidgetId(rowId));
    }
    writeRowNumbers(patches) {
        for (const entry of patches) {
            if (!isCleanupRowPatch(entry)) {
                app.console.warn('cleanup: dropping a row patch the panel cannot read');
                continue;
            }
            if (typeof entry.imageNumber !== 'number')
                continue;
            const row = this.state.rows.get(entry.id);
            if (!row)
                continue;
            row.imageNumber = entry.imageNumber;
            this.refresh(rowWidgetId(row.id));
        }
    }
    /// Works the counts out over the rows on screen, for the events that patch the list
    /// without saying what it now comes to.
    recountRows() {
        let count = 0;
        let fixable = 0;
        for (const row of this.state.rows.values()) {
            count++;
            if (row.canFix)
                fixable++;
        }
        this.state.rowCount = count;
        this.state.fixableCount = fixable;
    }
    countOf(category) {
        return countOf(this.state, category);
    }
    // --- the top of the panel
    // ------------------------------------------------------------
    /// The line over the bar names the phase the run is in, and is read out as it
    /// changes.
    setStatus(status) {
        this.state.statusName = status;
        this.refresh(CleanupWidgetId.statusText);
    }
    /// How far the run has come stands on the bar, as a share of the whole for the eye
    /// and as the two counts beside it.
    setProgress(done, total) {
        this.state.measuredDone = done;
        this.state.measuredTotal = total;
        this.refresh(CleanupWidgetId.progressLine);
    }
    /// One place over the list holds either the button that starts a run or the status
    /// line of the run that is going. The options, the two buttons that act on a list
    /// and the button of every row are turned off while the run lasts.
    setBusy(busy) {
        if (busy) {
            // A run turns off the controls, so one of them holding the focus
            // hands it to Stop, which stays live for as long as the run does.
            const focusedId = this.focusedElementId();
            this.state.busy = true;
            this.refreshBusyRegions();
            if (goesDeadWhenBusy(focusedId)) {
                this.focusHeldForRun = true;
                this.focusTakenFrom = focusedId;
                this.focusAfterRefresh(buttonElementId(CleanupWidgetId.stop));
            }
            return;
        }
        // The status line leaves the screen with this rebuild, so where the focus
        // it may hold goes is decided while the line is still there, and the focus
        // is placed once the rebuild is on screen.
        const target = this.focusTargetAfterRun();
        this.state.busy = false;
        this.clearSilenceTimer();
        this.refreshBusyRegions();
        if (target)
            this.focusAfterRefresh(target);
    }
    /// The busy state shows in the fields of the options row, the run, the band and the
    /// button of every row.
    refreshBusyRegions() {
        this.refresh(CleanupWidgetId.optionsBody, CleanupWidgetId.run, CleanupWidgetId.summary);
        this.refreshGroups();
        this.refresh(...Array.from(this.state.rows.keys()).map((rowId) => rowWidgetId(rowId)));
    }
    updateSummary() {
        this.refresh(CleanupWidgetId.summary);
    }
    updateMessage() {
        this.refresh(CleanupWidgetId.message);
    }
    // --- waiting on the kit
    // -------------------------------------------------------------
    /// Waits for the run to say something. Each request the panel cannot go on without an
    /// answer to starts the wait, and everything the run sends starts it over, so the wait
    /// only runs out on a run that has gone quiet.
    watchForSilence() {
        this.clearSilenceTimer();
        this.silenceTimer = app.timerRegistry.setTimeout('cleanupsilence', () => {
            this.silenceTimer = null;
            this.giveUpSilentRun();
        }, JSDialog.CleanupSilenceTimeout);
    }
    clearSilenceTimer() {
        if (this.silenceTimer === null)
            return;
        app.timerRegistry.clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
    }
    /// The run said nothing for the whole of the wait, so the panel gives it up, and it
    /// tells the kit to stop the run first. It then asks for the list, so a kit that is
    /// alive but slow ends its run and brings the panel up to date with what it holds. A
    /// kit that is gone hears nothing either way.
    giveUpSilentRun() {
        if (!this.shown || !this.state.busy)
            return;
        const stopRequest = this.sendRequest('stop');
        this.giveUpQuietRun();
        this.lastRequestOfGivenUpRun = stopRequest;
        this.sendRequest('list');
    }
    /// The run is over as far as the panel is concerned, so the panel gives it up. The
    /// controls come back, the requests that are still out are forgotten so that anything
    /// arriving for them later is left alone, and the panel says what became of the run.
    /// The list stays on screen as it stands.
    giveUpQuietRun() {
        if (!this.shown || !this.state.busy)
            return;
        this.clearSilenceTimer();
        this.requestActions.clear();
        this.setStatus('idle');
        this.setBusy(false);
        this.setNotice(_('The cleanup did not answer. Please try again.'));
        this.updateSummary();
    }
    /// Puts a short line about the run the panel gave up over the panel.
    setNotice(notice) {
        this.state.notice = notice;
        this.updateMessage();
    }
    clearNotice() {
        if (this.state.notice)
            this.setNotice('');
    }
    /// A read-only document offers no cleanup, so the options, the run and the band all
    /// go and the panel says why the list is empty. The line that divides the list off
    /// goes with it.
    applyReadOnly() {
        if (!this.state.readOnly)
            this.setBusy(false);
        this.refreshAll();
    }
}
JSDialog.CleanupSidebar = function (map) {
    return new CleanupSidebar(map);
};
/// How long a run may say nothing before the panel gives it up, in milliseconds.
JSDialog.CleanupSilenceTimeout = CLEANUP_SILENCE_TIMEOUT;
