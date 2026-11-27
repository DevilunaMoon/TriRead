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
class SearchService {
    // TODO: avoid window.L.DomUtil.get(...)
    searchNext() {
        this.search(window.L.DomUtil.get('search-input').value, false);
    }
    searchPrevious() {
        this.search(window.L.DomUtil.get('search-input').value, true);
    }
    search(text, backward, replaceString, command, expand) {
        if (backward === undefined) {
            backward = false;
        }
        if (command === undefined) {
            command = 0;
        }
        if (replaceString === undefined) {
            replaceString = '';
        }
        if (window.L.Map.THIS._docLayer._searchResults &&
            text !== window.L.Map.THIS._docLayer._searchTerm) {
            window.L.Map.THIS._docLayer._clearSearchResults();
        }
        var searchCmd = {
            'SearchItem.SearchString': {
                type: 'string',
                value: undefined,
            },
            'SearchItem.ReplaceString': {
                type: 'string',
                value: undefined,
            },
            'SearchItem.Backward': {
                type: 'boolean',
                value: undefined,
            },
            'SearchItem.SearchStartPointX': {
                type: 'long',
                value: undefined,
            },
            'SearchItem.SearchStartPointY': {
                type: 'long',
                value: undefined,
            },
            'SearchItem.Command': {
                type: 'long',
                value: undefined,
            },
        };
        window.L.Map.THIS.fire('clearselection');
        Util.ensureValue(app.activeDocument);
        var searchStartPointX = app.activeDocument.activeLayout.viewedRectangle.x1;
        var searchStartPointY = app.activeDocument.activeLayout.viewedRectangle.y1;
        if (window.L.Map.THIS._docLayer &&
            window.L.Map.THIS._docLayer._lastSearchResult &&
            expand) {
            var strTwips = window.L.Map.THIS._docLayer._lastSearchResult.twipsRectangles.match(/\d+/g);
            if (strTwips != null) {
                searchStartPointX = strTwips[0];
                searchStartPointY = strTwips[1];
            }
            this.resetSelection();
        }
        searchCmd['SearchItem.SearchString'].value = text;
        searchCmd['SearchItem.Backward'].value = backward;
        searchCmd['SearchItem.ReplaceString'].value = replaceString;
        searchCmd['SearchItem.SearchStartPointX'].value = searchStartPointX;
        searchCmd['SearchItem.SearchStartPointY'].value = searchStartPointY;
        searchCmd['SearchItem.Command'].value = command;
        app.socket.sendMessage('uno .uno:ExecuteSearch ' + JSON.stringify(searchCmd));
    }
    highlightAll(text) {
        if (window.L.Map.THIS._docLayer._searchResults &&
            text === window.L.Map.THIS._docLayer._searchTerm) {
            return;
        }
        this.search(text, false, '1');
    }
    resetSelection() {
        window.L.Map.THIS._docLayer._clearSearchResults();
        app.socket.sendMessage('resetselection');
    }
}
app.searchService = new SearchService();
